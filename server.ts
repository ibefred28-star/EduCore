import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import { sql } from 'drizzle-orm';
import { adminAuth, adminDb } from './src/lib/firebase-admin.ts';
import firebaseConfig from './firebase-applet-config.json';

function parseFirestoreValue(val: any): any {
  if (!val) return null;
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
  if (val.doubleValue !== undefined) return parseFloat(val.doubleValue);
  if (val.arrayValue !== undefined) {
    return (val.arrayValue.values || []).map(parseFirestoreValue);
  }
  if (val.mapValue !== undefined) {
    const res: Record<string, any> = {};
    const fields = val.mapValue.fields || {};
    for (const key of Object.keys(fields)) {
      res[key] = parseFirestoreValue(fields[key]);
    }
    return res;
  }
  return null;
}

function parseFirestoreDoc(docJson: any): any {
  if (!docJson || !docJson.fields) return null;
  const res: Record<string, any> = {};
  for (const key of Object.keys(docJson.fields)) {
    res[key] = parseFirestoreValue(docJson.fields[key]);
  }
  return res;
}

async function getFirestoreDocRest(collection: string, docId: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/${collection}/${encodeURIComponent(docId)}?key=${firebaseConfig.apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return json;
  } catch (err) {
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body Parser
  app.use(express.json());

  // CORS & Preflight handling
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // API route for health
  app.get("/api/health", async (req, res) => {
    try {
      const result = await db.execute(sql`SELECT 1 as is_alive`);
      res.json({ status: "ok", postgres: result.rows[0].is_alive === 1 });
    } catch (e: any) {
      res.status(500).json({ status: "error", error: e.message });
    }
  });

  // Public endpoint to validate School ID and fetch basic institutional branding
  app.get("/api/schools/validate/:schoolId", async (req, res) => {
    try {
      let cleanSchool = (req.params.schoolId || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const normInput = cleanSchool.replace(/[^a-z0-9]/g, '');
      if (!cleanSchool && !normInput) {
        return res.status(400).json({ exists: false, error: 'School ID is required.' });
      }

      // 1. Built-in Demo School
      if (cleanSchool === 'demo' || normInput === 'demo') {
        return res.json({
          exists: true,
          schoolId: 'demo',
          name: 'Demo International Academy',
          status: 'active',
          branding: {
            schoolName: 'Demo International Academy',
            motto: 'Excellence, Character & Wisdom',
            primaryColor: '#1e3a8a',
            accentColor: '#f59e0b',
            crestUrl: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=128&q=80'
          }
        });
      }

      // 2. Authoritative check via Firestore REST (avoids gRPC permission issues)
      let tenant: any = null;
      const tenantsDoc = await getFirestoreDocRest('app_state', 'GLOBAL_TENANTS');
      const tenantsData = parseFirestoreDoc(tenantsDoc);
      if (tenantsData && Array.isArray(tenantsData.tenants)) {
        tenant = tenantsData.tenants.find((t: any) => {
          const tId = (t.id || '').toLowerCase();
          const tNorm = tId.replace(/[^a-z0-9]/g, '');
          const nameNorm = (t.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return tId === cleanSchool || tNorm === normInput || nameNorm === normInput || (normInput.length >= 4 && (tNorm.includes(normInput) || normInput.includes(tNorm) || nameNorm.includes(normInput)));
        });
        if (tenant && tenant.id) {
          cleanSchool = tenant.id;
        }
      }

      // Check if school is archived/deleted
      const schoolRootDoc = await getFirestoreDocRest('schools', cleanSchool);
      const schoolRootData = parseFirestoreDoc(schoolRootDoc);
      if (schoolRootData && (schoolRootData.isDeleted || schoolRootData.status === 'deleted')) {
        return res.status(404).json({ exists: false, error: 'This school has been decommissioned.' });
      }

      // Check app_state/{cleanSchool}
      const schoolDoc = await getFirestoreDocRest('app_state', cleanSchool);
      const schoolData = parseFirestoreDoc(schoolDoc);

      if (!tenant && !schoolData && !schoolRootData) {
        return res.status(404).json({ exists: false, error: 'School ID not found. Please check with your school administration.' });
      }

      const branding = schoolData?.branding || schoolRootData?.branding || { schoolName: tenant?.name || cleanSchool };
      const status = tenant?.status || schoolRootData?.status || 'active';

      res.json({
        exists: true,
        schoolId: cleanSchool,
        name: tenant?.name || branding.schoolName || cleanSchool,
        status,
        branding
      });
    } catch (err: any) {
      console.error('School validation error:', err);
      // Fail gracefully for demo
      if ((req.params.schoolId || '').trim().toLowerCase() === 'demo') {
        return res.json({
          exists: true,
          schoolId: 'demo',
          name: 'Demo International Academy',
          status: 'active'
        });
      }
      res.status(500).json({ exists: false, error: 'Failed to validate School ID.' });
    }
  });

  // Admin authentication verification middleware
  const requireAdminAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization token.' });
      }
      const token = authHeader.split('Bearer ')[1].trim();
      const decoded = await adminAuth.verifyIdToken(token);

      const email = (decoded.email || '').toLowerCase();
      const isSuperAdmin = decoded.role === 'superadmin' || email === 'superadmin@educore.internal' || email.includes('superadmin');
      const isAdmin = isSuperAdmin || decoded.role === 'admin' || email.includes('.admin.');

      if (!isAdmin) {
        return res.status(403).json({ error: 'Access denied: School Administrator privileges required.' });
      }

      (req as any).user = decoded;
      next();
    } catch (err: any) {
      console.warn('Admin token verification failed:', err.message);
      return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    }
  };

  // Dedicated Super Administrator verification middleware
  const requireSuperAdminAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization token.' });
      }
      const token = authHeader.split('Bearer ')[1].trim();
      const decoded = await adminAuth.verifyIdToken(token);

      const email = (decoded.email || '').toLowerCase();
      const isSuperAdmin = decoded.role === 'superadmin' || email === 'superadmin@educore.internal' || (decoded.userId === 'superadmin');

      if (!isSuperAdmin) {
        return res.status(403).json({ error: 'Access denied: Global Super Administrator privileges required.' });
      }

      (req as any).user = decoded;
      next();
    } catch (err: any) {
      console.warn('Super Admin token verification failed:', err.message);
      return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    }
  };

  // POST /api/superadmin/change-password
  app.post("/api/superadmin/change-password", requireSuperAdminAuth, async (req, res) => {
    try {
      const { newPassword } = req.body;
      const trimmedPass = (newPassword || '').trim();
      if (!trimmedPass || trimmedPass.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      }

      const user = (req as any).user;
      await adminAuth.updateUser(user.uid, { password: trimmedPass });

      // Record audit log
      const now = new Date().toISOString();
      const logId = `log_${Date.now()}_pwd`;
      await adminDb.collection('schools').doc('global').collection('auditLogs').doc(logId).set({
        id: logId,
        schoolId: 'global',
        actorId: 'superadmin',
        actorRole: 'superadmin',
        action: 'SUPERADMIN_PASSWORD_UPDATED',
        targetType: 'auth',
        targetId: user.uid,
        timestamp: now,
        details: { method: 'admin_dashboard_security' }
      }, { merge: true });

      res.json({ success: true, message: 'Super Administrator password updated successfully.' });
    } catch (err: any) {
      console.error('Change password error:', err);
      res.status(500).json({ error: err.message || 'Failed to update superadmin password.' });
    }
  });

  // POST /api/superadmin/provision-admin
  app.post("/api/superadmin/provision-admin", requireSuperAdminAuth, async (req, res) => {
    try {
      const { schoolId, adminId, adminName, password } = req.body;
      if (!schoolId || !adminId) {
        return res.status(400).json({ error: 'Missing schoolId or adminId.' });
      }
      const trimmedPass = (password || '').trim();
      if (!trimmedPass || trimmedPass.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }

      const cleanSchool = schoolId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const cleanAdmin = adminId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const email = `${cleanSchool}.admin.${cleanAdmin}@educore.internal`;
      const displayName = (adminName || `Admin ${cleanAdmin}`).trim();

      let userRecord;
      try {
        userRecord = await adminAuth.getUserByEmail(email);
        await adminAuth.updateUser(userRecord.uid, {
          password: trimmedPass,
          displayName
        });
      } catch (e: any) {
        if (e.code === 'auth/user-not-found') {
          userRecord = await adminAuth.createUser({
            email,
            password: trimmedPass,
            displayName
          });
        } else {
          throw e;
        }
      }

      await adminAuth.setCustomUserClaims(userRecord.uid, {
        schoolId: cleanSchool,
        role: 'admin',
        userId: cleanAdmin
      });

      const now = new Date().toISOString();
      await adminDb.collection('schools').doc(cleanSchool).collection('users').doc(cleanAdmin).set({
        uid: userRecord.uid,
        username: cleanAdmin,
        name: displayName,
        email,
        role: 'admin',
        status: 'active',
        schoolId: cleanSchool,
        updatedAt: now
      }, { merge: true });

      res.json({
        success: true,
        uid: userRecord.uid,
        email,
        message: `School Administrator account "${cleanAdmin}" provisioned successfully.`
      });
    } catch (err: any) {
      console.error('Provision admin error:', err);
      res.status(500).json({ error: err.message || 'Failed to provision school administrator.' });
    }
  });

  // POST /api/superadmin/toggle-user-status
  app.post("/api/superadmin/toggle-user-status", requireSuperAdminAuth, async (req, res) => {
    try {
      const { schoolId, username, status } = req.body;
      if (!schoolId || !username || !status) {
        return res.status(400).json({ error: 'Missing schoolId, username, or status.' });
      }

      const cleanSchool = schoolId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const userDocRef = adminDb.collection('schools').doc(cleanSchool).collection('users').doc(cleanUser);
      
      const snap = await userDocRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: `User profile "${username}" not found in school "${schoolId}".` });
      }

      const now = new Date().toISOString();
      await userDocRef.set({ status, updatedAt: now }, { merge: true });

      // Disable/enable in Auth if UID is available
      const userData = snap.data();
      if (userData?.uid) {
        try {
          await adminAuth.updateUser(userData.uid, { disabled: status === 'disabled' });
        } catch (authErr: any) {
          console.warn('Could not update Auth disabled flag:', authErr.message);
        }
      }

      res.json({ success: true, message: `Account status updated to ${status}.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update account status.' });
    }
  });

  // POST /api/superadmin/recover-user-account
  app.post("/api/superadmin/recover-user-account", requireSuperAdminAuth, async (req, res) => {
    try {
      const { schoolId, username, role, displayName, newPassword } = req.body;
      if (!schoolId || !username || !role) {
        return res.status(400).json({ error: 'Missing required account details.' });
      }
      const trimmedPass = (newPassword || 'welcome123').trim();
      const cleanSchool = schoolId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const cleanRole = role.trim().toLowerCase();
      const email = `${cleanSchool}.${cleanRole}.${cleanUser}@educore.internal`;
      const name = (displayName || username).trim();

      let userRecord;
      try {
        userRecord = await adminAuth.getUserByEmail(email);
        await adminAuth.updateUser(userRecord.uid, {
          password: trimmedPass,
          displayName: name,
          disabled: false
        });
      } catch (e: any) {
        if (e.code === 'auth/user-not-found') {
          userRecord = await adminAuth.createUser({
            email,
            password: trimmedPass,
            displayName: name
          });
        } else {
          throw e;
        }
      }

      await adminAuth.setCustomUserClaims(userRecord.uid, {
        schoolId: cleanSchool,
        role: cleanRole,
        userId: cleanUser
      });

      const now = new Date().toISOString();
      await adminDb.collection('schools').doc(cleanSchool).collection('users').doc(cleanUser).set({
        uid: userRecord.uid,
        username: cleanUser,
        name,
        email,
        role: cleanRole,
        status: 'active',
        schoolId: cleanSchool,
        updatedAt: now
      }, { merge: true });

      res.json({
        success: true,
        uid: userRecord.uid,
        email,
        message: `Account "${username}" recovered and synchronized with Firebase Auth.`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to recover account.' });
    }
  });

  // GET /api/superadmin/overview
  app.get("/api/superadmin/overview", requireSuperAdminAuth, async (req, res) => {
    try {
      let tenants: any[] = [];
      try {
        const tenantsSnap = await adminDb.collection('app_state').doc('GLOBAL_TENANTS').get();
        if (tenantsSnap.exists && tenantsSnap.data()?.tenants) {
          tenants = tenantsSnap.data()?.tenants || [];
        }
      } catch {
        const tenantsDoc = await getFirestoreDocRest('app_state', 'GLOBAL_TENANTS');
        const tenantsData = parseFirestoreDoc(tenantsDoc);
        if (tenantsData && Array.isArray(tenantsData.tenants)) {
          tenants = tenantsData.tenants;
        }
      }

      let totalStudents = 0;
      let totalTeachers = 0;
      let totalAdmins = 0;
      let activeSchools = 0;
      let suspendedSchools = 0;

      const schoolSummaries: any[] = [];

      for (const t of tenants) {
        if (t.status === 'suspended') {
          suspendedSchools++;
        } else {
          activeSchools++;
        }

        let studentCount = 0;
        let teacherCount = 0;
        let adminCount = 0;
        let academicSession = '2024/2025';
        let academicTerm = 'Term 1';

        try {
          let data: any = null;
          try {
            const schoolDoc = await adminDb.collection('app_state').doc(t.id).get();
            if (schoolDoc.exists) data = schoolDoc.data();
          } catch {
            const sDoc = await getFirestoreDocRest('app_state', t.id);
            data = parseFirestoreDoc(sDoc);
          }

          if (data) {
            studentCount = data?.state?.students?.length || 0;
            teacherCount = data?.state?.teachers?.length || 0;
            adminCount = data?.state?.admins?.length || 0;
            if (data?.config?.academic) {
              academicSession = data.config.academic.currentSession || academicSession;
              academicTerm = data.config.academic.currentTerm || academicTerm;
            }
          }
        } catch (e) {
          console.warn(`Could not load doc for school ${t.id}`, e);
        }

        totalStudents += studentCount;
        totalTeachers += teacherCount;
        totalAdmins += adminCount;

        schoolSummaries.push({
          id: t.id,
          name: t.name,
          createdAt: t.createdAt,
          status: t.status || 'active',
          contactEmail: t.contactEmail || '',
          contactPhone: t.contactPhone || '',
          studentCount,
          teacherCount,
          adminCount,
          academicSession,
          academicTerm
        });
      }

      // Fetch recent global audit logs
      let recentLogs: any[] = [];
      try {
        const auditSnap = await adminDb.collection('schools').doc('global').collection('auditLogs')
          .orderBy('timestamp', 'desc')
          .limit(20)
          .get();
        recentLogs = auditSnap.docs.map(d => d.data());
      } catch (e) {
        console.warn('Could not load audit logs:', e);
      }

      res.json({
        success: true,
        metrics: {
          totalSchools: tenants.length,
          activeSchools,
          suspendedSchools,
          pendingSchools: 0,
          totalStudents,
          totalTeachers,
          totalAdmins,
          platformStatus: 'Operational'
        },
        schools: schoolSummaries,
        recentLogs,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('Superadmin overview error:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch platform overview' });
    }
  });

  // GET /api/superadmin/users
  app.get("/api/superadmin/users", requireSuperAdminAuth, async (req, res) => {
    try {
      let tenants: any[] = [];
      try {
        const tenantsSnap = await adminDb.collection('app_state').doc('GLOBAL_TENANTS').get();
        if (tenantsSnap.exists && tenantsSnap.data()?.tenants) {
          tenants = tenantsSnap.data()?.tenants || [];
        }
      } catch {
        const tenantsDoc = await getFirestoreDocRest('app_state', 'GLOBAL_TENANTS');
        const tenantsData = parseFirestoreDoc(tenantsDoc);
        if (tenantsData && Array.isArray(tenantsData.tenants)) {
          tenants = tenantsData.tenants;
        }
      }
      
      const allUsers: any[] = [];

      for (const t of tenants) {
        try {
          let data: any = null;
          try {
            const schoolDoc = await adminDb.collection('app_state').doc(t.id).get();
            if (schoolDoc.exists) data = schoolDoc.data()?.state;
          } catch {
            const sDoc = await getFirestoreDocRest('app_state', t.id);
            data = parseFirestoreDoc(sDoc)?.state;
          }
          if (data) {
            // Admins
            if (Array.isArray(data.admins)) {
              for (const a of data.admins) {
                allUsers.push({
                  id: a.id,
                  username: a.id,
                  name: a.name || 'School Administrator',
                  role: 'admin',
                  schoolId: t.id,
                  schoolName: t.name,
                  email: `${t.id}.admin.${a.id.toLowerCase()}@educore.internal`,
                  status: t.status === 'suspended' ? 'suspended' : 'active'
                });
              }
            }
            // Teachers
            if (Array.isArray(data.teachers)) {
              for (const tc of data.teachers) {
                allUsers.push({
                  id: tc.id,
                  username: tc.id,
                  name: tc.name,
                  role: 'teacher',
                  schoolId: t.id,
                  schoolName: t.name,
                  email: `${t.id}.teacher.${tc.id.toLowerCase()}@educore.internal`,
                  classes: tc.classes || [],
                  subjects: tc.subjects || [],
                  status: t.status === 'suspended' ? 'suspended' : 'active'
                });
              }
            }
            // Students
            if (Array.isArray(data.students)) {
              for (const s of data.students) {
                allUsers.push({
                  id: s.id,
                  username: s.id,
                  name: s.name,
                  role: 'student',
                  schoolId: t.id,
                  schoolName: t.name,
                  email: `${t.id}.student.${s.id.toLowerCase()}@educore.internal`,
                  class: s.class || '',
                  status: t.status === 'suspended' ? 'suspended' : 'active'
                });
              }
            }
          }
        } catch (e) {
          console.warn(`Could not load users for school ${t.id}`, e);
        }
      }

      res.json({ success: true, users: allUsers });
    } catch (err: any) {
      console.error('Superadmin users error:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch platform users' });
    }
  });

  // POST /api/superadmin/update-school
  app.post("/api/superadmin/update-school", requireSuperAdminAuth, async (req, res) => {
    try {
      const { schoolId, name, status, contactEmail, contactPhone, notes } = req.body;
      if (!schoolId) {
        return res.status(400).json({ error: 'Missing schoolId.' });
      }

      const cleanSchool = schoolId.trim().toLowerCase();
      const tenantsRef = adminDb.collection('app_state').doc('GLOBAL_TENANTS');
      const snap = await tenantsRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Global tenants directory not found.' });
      }

      let tenants = snap.data()?.tenants || [];
      const index = tenants.findIndex((t: any) => t.id === cleanSchool);
      if (index === -1) {
        return res.status(404).json({ error: `School "${schoolId}" not found.` });
      }

      if (name) tenants[index].name = name.trim();
      if (status) tenants[index].status = status;
      if (contactEmail !== undefined) tenants[index].contactEmail = contactEmail.trim();
      if (contactPhone !== undefined) tenants[index].contactPhone = contactPhone.trim();
      if (notes !== undefined) tenants[index].notes = notes.trim();

      await tenantsRef.set({ tenants }, { merge: true });

      if (name) {
        await adminDb.collection('app_state').doc(cleanSchool).set({
          branding: { schoolName: name.trim() },
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // Record audit log
      const now = new Date().toISOString();
      const logId = `log_${Date.now()}_sch_upd`;
      await adminDb.collection('schools').doc('global').collection('auditLogs').doc(logId).set({
        id: logId,
        schoolId: 'global',
        actorId: 'superadmin',
        actorRole: 'superadmin',
        action: 'TENANT_UPDATED',
        targetType: 'tenant',
        targetId: cleanSchool,
        timestamp: now,
        details: { updatedFields: { name, status, contactEmail, contactPhone } }
      }, { merge: true });

      res.json({ success: true, message: `School ${cleanSchool} updated successfully.` });
    } catch (err: any) {
      console.error('Update school error:', err);
      res.status(500).json({ error: err.message || 'Failed to update school.' });
    }
  });

  // POST /api/superadmin/delete-school
  app.post("/api/superadmin/delete-school", requireSuperAdminAuth, async (req, res) => {
    try {
      const { schoolId } = req.body;
      if (!schoolId) {
        return res.status(400).json({ error: 'Missing schoolId.' });
      }

      const cleanSchool = schoolId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const tenantsRef = adminDb.collection('app_state').doc('GLOBAL_TENANTS');
      const snap = await tenantsRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Global tenants directory not found.' });
      }

      let tenants = snap.data()?.tenants || [];
      const found = tenants.some((t: any) => t.id.toLowerCase() === cleanSchool);
      if (!found) {
        return res.status(404).json({ error: `School "${schoolId}" not found in global directory.` });
      }

      // 1. Remove from GLOBAL_TENANTS
      tenants = tenants.filter((t: any) => t.id.toLowerCase() !== cleanSchool);
      await tenantsRef.set({ tenants }, { merge: true });

      const now = new Date().toISOString();

      // 2. Remove or archive app_state/{cleanSchool}
      await adminDb.collection('app_state').doc(cleanSchool).delete().catch(console.warn);

      // 3. Disable all school users in Firebase Authentication to prevent login
      try {
        const usersSnap = await adminDb.collection('schools').doc(cleanSchool).collection('users').get();
        for (const doc of usersSnap.docs) {
          const uData = doc.data();
          if (uData.uid) {
            await adminAuth.updateUser(uData.uid, { disabled: true }).catch(console.warn);
          }
        }
      } catch (authErr) {
        console.warn('Could not disable school users in Auth:', authErr);
      }

      // 4. Mark school root document as deactivated/archived
      await adminDb.collection('schools').doc(cleanSchool).set({
        status: 'deleted',
        deletedAt: now,
        isDeleted: true
      }, { merge: true }).catch(console.warn);

      // 5. Record immutable audit log in global audit trail
      const logId = `log_${Date.now()}_sch_del`;
      await adminDb.collection('schools').doc('global').collection('auditLogs').doc(logId).set({
        id: logId,
        schoolId: 'global',
        actorId: 'superadmin',
        actorRole: 'superadmin',
        action: 'TENANT_DELETED',
        targetType: 'tenant',
        targetId: cleanSchool,
        timestamp: now,
        details: { schoolId: cleanSchool }
      }, { merge: true });

      res.json({ success: true, message: `School ${cleanSchool} deleted from directory and accounts deactivated.` });
    } catch (err: any) {
      console.error('Delete school error:', err);
      res.status(500).json({ error: err.message || 'Failed to delete school.' });
    }
  });

  // POST /api/superadmin/reset-admin-password
  app.post("/api/superadmin/reset-admin-password", requireSuperAdminAuth, async (req, res) => {
    try {
      const { schoolId, adminUsername, newPassword } = req.body;
      if (!schoolId || !adminUsername || !newPassword) {
        return res.status(400).json({ error: 'Missing required schoolId, adminUsername, or newPassword.' });
      }
      const trimmedPass = (newPassword || '').trim();
      if (trimmedPass.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }

      const cleanSchool = schoolId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const cleanAdmin = adminUsername.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

      // Check whether target administrator belongs to the target school
      const userDocRef = adminDb.collection('schools').doc(cleanSchool).collection('users').doc(cleanAdmin);
      const userSnap = await userDocRef.get();
      
      const schoolDoc = await adminDb.collection('app_state').doc(cleanSchool).get();
      const schoolAdmins = schoolDoc.data()?.state?.admins || [];
      const belongsInState = schoolAdmins.some((a: any) => a.id.toLowerCase() === cleanAdmin);

      if (!userSnap.exists && !belongsInState) {
        return res.status(404).json({ error: `Administrator "${adminUsername}" not found in school "${schoolId}".` });
      }

      const adminAuthEmail = `${cleanSchool}.admin.${cleanAdmin}@educore.internal`;
      let userRecord;
      try {
        userRecord = await adminAuth.getUserByEmail(adminAuthEmail);
        await adminAuth.updateUser(userRecord.uid, { password: trimmedPass, disabled: false });
      } catch (authErr: any) {
        if (authErr.code === 'auth/user-not-found') {
          // Provision in Firebase Auth if not yet created
          userRecord = await adminAuth.createUser({
            email: adminAuthEmail,
            password: trimmedPass,
            displayName: userSnap.data()?.name || `Admin ${cleanAdmin}`
          });
          await adminAuth.setCustomUserClaims(userRecord.uid, {
            schoolId: cleanSchool,
            role: 'admin',
            userId: cleanAdmin
          });
        } else {
          throw authErr;
        }
      }

      const now = new Date().toISOString();
      await userDocRef.set({
        uid: userRecord.uid,
        username: cleanAdmin,
        role: 'admin',
        schoolId: cleanSchool,
        status: 'active',
        passwordResetAt: now,
        updatedAt: now
      }, { merge: true });

      // Record audit log
      const logId = `log_${Date.now()}_pwd_adm`;
      await adminDb.collection('schools').doc('global').collection('auditLogs').doc(logId).set({
        id: logId,
        schoolId: 'global',
        actorId: 'superadmin',
        actorRole: 'superadmin',
        action: 'SCHOOL_ADMIN_PASSWORD_RESET',
        targetType: 'auth',
        targetId: cleanAdmin,
        timestamp: now,
        details: { schoolId: cleanSchool, admin: cleanAdmin }
      }, { merge: true });

      res.json({
        success: true,
        message: `Password successfully reset for administrator "${adminUsername}" in school "${schoolId}".`
      });
    } catch (err: any) {
      console.error('Reset admin password error:', err);
      res.status(500).json({ error: err.message || 'Failed to reset administrator password.' });
    }
  });

  // GET /api/superadmin/audit-logs
  app.get("/api/superadmin/audit-logs", requireSuperAdminAuth, async (req, res) => {
    try {
      const auditSnap = await adminDb.collection('schools').doc('global').collection('auditLogs')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();
      const logs = auditSnap.docs.map(d => d.data());
      res.json({ success: true, logs });
    } catch (err: any) {
      console.error('Superadmin audit logs error:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch audit logs' });
    }
  });

  // POST /api/admin/provision-student
  app.post("/api/admin/provision-student", requireAdminAuth, async (req, res) => {
    let createdAuthUid: string | null = null;
    try {
      const { schoolId, studentId, studentName, studentClass, password, photo } = req.body;
      if (!schoolId || !studentId || !studentName) {
        return res.status(400).json({ error: 'Missing required student details (ID, name, and schoolId).' });
      }
      const trimmedPass = (password || '').trim();
      if (!trimmedPass || trimmedPass.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }

      const cleanSchool = schoolId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const cleanUser = studentId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

      // Scope & permission check: verify caller belongs to this school
      const caller = (req as any).user;
      const email = (caller?.email || '').toLowerCase();
      const isSuperAdmin = caller?.role === 'superadmin' || email === 'superadmin@educore.internal' || email.includes('superadmin');
      const callerSchool = (caller?.schoolId || (email.includes('.admin.') ? email.split('.admin.')[0] : '')).toLowerCase();

      if (!isSuperAdmin) {
        if (!callerSchool || callerSchool !== cleanSchool) {
          return res.status(403).json({ error: `Access denied: You are only authorized to manage school "${callerSchool || 'unknown'}".` });
        }
      }

      // Confirm that the School ID belongs to an active institution
      const tenantsSnap = await adminDb.collection('app_state').doc('GLOBAL_TENANTS').get();
      const tenants = tenantsSnap.data()?.tenants || [];
      const schoolExists = tenants.some((t: any) => t.id.toLowerCase() === cleanSchool && t.status !== 'deleted');
      if (!schoolExists && cleanSchool !== 'demo') {
        return res.status(404).json({ error: `School "${schoolId}" does not exist or has been decommissioned.` });
      }

      // Check for duplicate student/staff identifiers
      const teacherDoc = await adminDb.collection('schools').doc(cleanSchool).collection('teachers').doc(cleanUser).get();
      if (teacherDoc.exists) {
        return res.status(400).json({ error: `ID "${studentId}" is already assigned to a Teacher in this school.` });
      }
      const adminUserDoc = await adminDb.collection('schools').doc(cleanSchool).collection('users').doc(cleanUser).get();
      if (adminUserDoc.exists && adminUserDoc.data()?.role === 'admin') {
        return res.status(400).json({ error: `ID "${studentId}" is already assigned to an Administrator in this school.` });
      }

      // Check if student already exists when not updating
      const isUpdate = Boolean(req.body.isUpdate);
      const studentDoc = await adminDb.collection('schools').doc(cleanSchool).collection('students').doc(cleanUser).get();
      if (studentDoc.exists && !isUpdate) {
        return res.status(409).json({ error: `Student ID "${studentId}" already exists in this school.` });
      }

      const studentAuthEmail = `${cleanSchool}.student.${cleanUser}@educore.internal`;

      let userRecord;
      try {
        userRecord = await adminAuth.getUserByEmail(studentAuthEmail);
        await adminAuth.updateUser(userRecord.uid, {
          password: trimmedPass,
          displayName: studentName.trim(),
          disabled: false
        });
      } catch (e: any) {
        if (e.code === 'auth/user-not-found') {
          userRecord = await adminAuth.createUser({
            email: studentAuthEmail,
            password: trimmedPass,
            displayName: studentName.trim()
          });
          createdAuthUid = userRecord.uid;
        } else {
          throw e;
        }
      }

      await adminAuth.setCustomUserClaims(userRecord.uid, {
        schoolId: cleanSchool,
        role: 'student',
        userId: studentId.trim(),
        classes: [studentClass || 'Primary 5']
      });

      const now = new Date().toISOString();

      // Upsert student document in Firestore roster with linked UID
      const studentRef = adminDb.collection('schools').doc(cleanSchool).collection('students').doc(cleanUser);
      await studentRef.set({
        id: studentId.trim(),
        uid: userRecord.uid,
        name: studentName.trim(),
        class: studentClass || 'Primary 5',
        photo: photo || '',
        schoolId: cleanSchool,
        updatedAt: now
      }, { merge: true });

      // Upsert user profile document in Firestore
      const userDocRef = adminDb.collection('schools').doc(cleanSchool).collection('users').doc(cleanUser);
      await userDocRef.set({
        uid: userRecord.uid,
        username: cleanUser,
        name: studentName.trim(),
        email: studentAuthEmail,
        role: 'student',
        classes: [studentClass || 'Primary 5'],
        status: 'active',
        schoolId: cleanSchool,
        updatedAt: now
      }, { merge: true });

      // Synchronize centralized app_state.state.students
      const schoolAppStateRef = adminDb.collection('app_state').doc(cleanSchool);
      const appStateSnap = await schoolAppStateRef.get();
      if (appStateSnap.exists) {
        const appState = appStateSnap.data();
        let studentsList = appState?.state?.students || [];
        const existingIndex = studentsList.findIndex((s: any) => s.id.toLowerCase() === cleanUser);
        const studentObj = {
          id: studentId.trim(),
          name: studentName.trim(),
          class: studentClass || 'Primary 5',
          photo: photo || ''
        };
        if (existingIndex >= 0) {
          studentsList[existingIndex] = { ...studentsList[existingIndex], ...studentObj };
        } else {
          studentsList.push(studentObj);
        }
        await schoolAppStateRef.set({
          state: { ...appState.state, students: studentsList },
          updatedAt: now
        }, { merge: true });
      }

      // Log audit event
      const logId = `log_${Date.now()}_prov_stu`;
      await adminDb.collection('schools').doc(cleanSchool).collection('auditLogs').doc(logId).set({
        id: logId,
        schoolId: cleanSchool,
        actorId: caller.userId || caller.email || 'admin',
        actorRole: caller.role || 'admin',
        action: 'STUDENT_PROVISIONED',
        targetType: 'student',
        targetId: cleanUser,
        timestamp: now,
        details: { studentId: cleanUser, name: studentName.trim(), class: studentClass || 'Primary 5' }
      }, { merge: true });

      res.json({
        success: true,
        uid: userRecord.uid,
        studentId: studentId.trim(),
        email: studentAuthEmail,
        message: 'Student account successfully provisioned in Firebase Authentication and Firestore.'
      });
    } catch (err: any) {
      console.error('Provisioning error:', err);
      // Compensation: if we created an Auth user but database write failed, rollback
      if (createdAuthUid) {
        await adminAuth.deleteUser(createdAuthUid).catch(console.warn);
      }
      res.status(500).json({ error: err.message || 'Failed to provision student in Firebase Authentication.' });
    }
  });

  // POST /api/admin/delete-student
  app.post("/api/admin/delete-student", requireAdminAuth, async (req, res) => {
    try {
      const { schoolId, studentId } = req.body;
      if (!schoolId || !studentId) {
        return res.status(400).json({ error: 'Missing required schoolId or studentId.' });
      }

      const cleanSchool = schoolId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const cleanUser = studentId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

      // Scope & permission check
      const caller = (req as any).user;
      const email = (caller?.email || '').toLowerCase();
      const isSuperAdmin = caller?.role === 'superadmin' || email === 'superadmin@educore.internal' || email.includes('superadmin');
      const callerSchool = (caller?.schoolId || (email.includes('.admin.') ? email.split('.admin.')[0] : '')).toLowerCase();

      if (!isSuperAdmin) {
        if (!callerSchool || callerSchool !== cleanSchool) {
          return res.status(403).json({ error: `Access denied: You are only authorized to manage school "${callerSchool || 'unknown'}".` });
        }
      }

      const studentAuthEmail = `${cleanSchool}.student.${cleanUser}@educore.internal`;

      // 1. Delete Firebase Authentication account permanently so student can NEVER log in
      try {
        const userRecord = await adminAuth.getUserByEmail(studentAuthEmail);
        await adminAuth.deleteUser(userRecord.uid);
      } catch (authErr: any) {
        if (authErr.code !== 'auth/user-not-found') {
          console.warn('Auth user deletion warning:', authErr);
        }
      }

      const now = new Date().toISOString();

      // 2. Remove student from active students collection
      await adminDb.collection('schools').doc(cleanSchool).collection('students').doc(cleanUser).delete();

      // 3. Remove user document from users collection
      await adminDb.collection('schools').doc(cleanSchool).collection('users').doc(cleanUser).delete();

      // 4. Remove student from centralized app_state.state.students (WITHOUT deleting historical results/attendance)
      const schoolAppStateRef = adminDb.collection('app_state').doc(cleanSchool);
      const appStateSnap = await schoolAppStateRef.get();
      if (appStateSnap.exists) {
        const appState = appStateSnap.data();
        let studentsList = appState?.state?.students || [];
        studentsList = studentsList.filter((s: any) => s.id.toLowerCase() !== cleanUser);
        await schoolAppStateRef.set({
          state: { ...appState.state, students: studentsList },
          updatedAt: now
        }, { merge: true });
      }

      // 5. Log audit event
      const logId = `log_${Date.now()}_del_stu`;
      await adminDb.collection('schools').doc(cleanSchool).collection('auditLogs').doc(logId).set({
        id: logId,
        schoolId: cleanSchool,
        actorId: caller.userId || caller.email || 'admin',
        actorRole: caller.role || 'admin',
        action: 'STUDENT_DELETED',
        targetType: 'student',
        targetId: cleanUser,
        timestamp: now,
        details: { studentId: cleanUser }
      }, { merge: true });

      res.json({
        success: true,
        message: `Student "${studentId}" successfully deleted and access revoked.`
      });
    } catch (err: any) {
      console.error('Delete student error:', err);
      res.status(500).json({ error: err.message || 'Failed to delete student.' });
    }
  });

  // POST /api/admin/reset-student-password
  app.post("/api/admin/reset-student-password", requireAdminAuth, async (req, res) => {
    try {
      const { schoolId, studentId, newPassword } = req.body;
      if (!schoolId || !studentId || !newPassword) {
        return res.status(400).json({ error: 'Missing schoolId, studentId, or newPassword.' });
      }
      const trimmedPass = newPassword.trim();
      if (trimmedPass.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }

      const cleanSchool = schoolId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const cleanUser = studentId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

      // Scope & permission check
      const caller = (req as any).user;
      const email = (caller?.email || '').toLowerCase();
      const isSuperAdmin = caller?.role === 'superadmin' || email === 'superadmin@educore.internal' || email.includes('superadmin');
      const callerSchool = (caller?.schoolId || '').toLowerCase();

      if (!isSuperAdmin) {
        if (!callerSchool || callerSchool !== cleanSchool) {
          return res.status(403).json({ error: `Access denied: You are only authorized to manage school "${callerSchool}".` });
        }
      }

      const emailAddress = `${cleanSchool}.student.${cleanUser}@educore.internal`;

      let userRecord;
      try {
        userRecord = await adminAuth.getUserByEmail(emailAddress);
      } catch (e: any) {
        if (e.code === 'auth/user-not-found') {
          return res.status(404).json({ error: `No authentication account found for student ID "${studentId}". Please provision account first.` });
        }
        throw e;
      }

      await adminAuth.updateUser(userRecord.uid, { password: trimmedPass });
      res.json({ success: true, message: `Password successfully reset for student ${studentId}.` });
    } catch (err: any) {
      console.error('Password reset error:', err);
      res.status(500).json({ error: err.message || 'Failed to reset student password.' });
    }
  });

  // POST /api/admin/sync-all-students
  app.post("/api/admin/sync-all-students", requireAdminAuth, async (req, res) => {
    try {
      const { schoolId, students } = req.body;
      if (!schoolId || !Array.isArray(students)) {
        return res.status(400).json({ error: 'Missing schoolId or students array.' });
      }

      const cleanSchool = schoolId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

      // Scope & permission check
      const caller = (req as any).user;
      const email = (caller?.email || '').toLowerCase();
      const isSuperAdmin = caller?.role === 'superadmin' || email === 'superadmin@educore.internal' || email.includes('superadmin');
      const callerSchool = (caller?.schoolId || '').toLowerCase();

      if (!isSuperAdmin) {
        if (!callerSchool || callerSchool !== cleanSchool) {
          return res.status(403).json({ error: `Access denied: You are only authorized to manage school "${callerSchool}".` });
        }
      }

      let provisioned = 0;
      const errors: string[] = [];

      for (const s of students) {
        try {
          if (!s.id || !s.name) continue;
          const cleanUser = s.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
          const studentEmail = `${cleanSchool}.student.${cleanUser}@educore.internal`;
          const rawPass = (s.password && String(s.password).trim().length >= 6) ? String(s.password).trim() : 'student123';

          let userRecord;
          try {
            userRecord = await adminAuth.getUserByEmail(studentEmail);
            await adminAuth.updateUser(userRecord.uid, {
              password: rawPass,
              displayName: s.name.trim()
            });
          } catch (e: any) {
            if (e.code === 'auth/user-not-found') {
              userRecord = await adminAuth.createUser({
                email: studentEmail,
                password: rawPass,
                displayName: s.name.trim()
              });
            } else {
              throw e;
            }
          }

          await adminAuth.setCustomUserClaims(userRecord.uid, {
            schoolId: cleanSchool,
            role: 'student',
            userId: s.id.trim(),
            classes: [s.class || 'Primary 5']
          });

          const now = new Date().toISOString();
          await adminDb.collection('schools').doc(cleanSchool).collection('users').doc(cleanUser).set({
            uid: userRecord.uid,
            username: cleanUser,
            name: s.name.trim(),
            email: studentEmail,
            role: 'student',
            classes: [s.class || 'Primary 5'],
            status: 'active',
            schoolId: cleanSchool,
            updatedAt: now
          }, { merge: true });

          provisioned++;
        } catch (err: any) {
          errors.push(`${s.id}: ${err.message}`);
        }
      }

      res.json({ success: true, provisionedCount: provisioned, errors });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to sync students to Firebase Auth.' });
    }
  });

  // POST /api/admin/provision-teacher
  app.post("/api/admin/provision-teacher", requireAdminAuth, async (req, res) => {
    let createdAuthUid: string | null = null;
    try {
      const { schoolId, teacherId, teacherName, password, subjects, classes, pupils, photo } = req.body;
      if (!schoolId || !teacherId || !teacherName) {
        return res.status(400).json({ error: 'Missing required teacher details (ID, name, and schoolId).' });
      }
      const trimmedPass = (password || '').trim();
      if (!trimmedPass || trimmedPass.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }

      const cleanSchool = schoolId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const cleanUser = teacherId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

      // Scope check
      const caller = (req as any).user;
      const email = (caller?.email || '').toLowerCase();
      const isSuperAdmin = caller?.role === 'superadmin' || email === 'superadmin@educore.internal' || email.includes('superadmin');
      const callerSchool = (caller?.schoolId || (email.includes('.admin.') ? email.split('.admin.')[0] : '') || cleanSchool).toLowerCase();

      if (!isSuperAdmin) {
        if (callerSchool && callerSchool !== cleanSchool) {
          return res.status(403).json({ error: `Access denied: You are only authorized to manage school "${callerSchool}".` });
        }
      }

      // Check duplicates
      const studentDoc = await adminDb.collection('schools').doc(cleanSchool).collection('students').doc(cleanUser).get();
      if (studentDoc.exists) {
        return res.status(400).json({ error: `ID "${teacherId}" is already assigned to a Student in this school.` });
      }
      const adminUserDoc = await adminDb.collection('schools').doc(cleanSchool).collection('users').doc(cleanUser).get();
      if (adminUserDoc.exists && adminUserDoc.data()?.role === 'admin') {
        return res.status(400).json({ error: `ID "${teacherId}" is already assigned to an Administrator in this school.` });
      }

      const teacherAuthEmail = `${cleanSchool}.teacher.${cleanUser}@educore.internal`;

      let userRecord;
      try {
        userRecord = await adminAuth.getUserByEmail(teacherAuthEmail);
        await adminAuth.updateUser(userRecord.uid, {
          password: trimmedPass,
          displayName: teacherName.trim(),
          disabled: false
        });
      } catch (e: any) {
        if (e.code === 'auth/user-not-found') {
          userRecord = await adminAuth.createUser({
            email: teacherAuthEmail,
            password: trimmedPass,
            displayName: teacherName.trim()
          });
          createdAuthUid = userRecord.uid;
        } else {
          throw e;
        }
      }

      await adminAuth.setCustomUserClaims(userRecord.uid, {
        schoolId: cleanSchool,
        role: 'teacher',
        userId: teacherId.trim(),
        subjects: Array.isArray(subjects) ? subjects : [],
        classes: Array.isArray(classes) ? classes : [],
        pupils: Array.isArray(pupils) ? pupils : []
      });

      const now = new Date().toISOString();

      // Upsert teacher document in Firestore
      await adminDb.collection('schools').doc(cleanSchool).collection('teachers').doc(cleanUser).set({
        id: teacherId.trim(),
        uid: userRecord.uid,
        name: teacherName.trim(),
        subjects: Array.isArray(subjects) ? subjects : [],
        classes: Array.isArray(classes) ? classes : [],
        pupils: Array.isArray(pupils) ? pupils : [],
        photo: photo || '',
        schoolId: cleanSchool,
        updatedAt: now
      }, { merge: true });

      // Upsert user profile document in Firestore
      await adminDb.collection('schools').doc(cleanSchool).collection('users').doc(cleanUser).set({
        uid: userRecord.uid,
        username: cleanUser,
        name: teacherName.trim(),
        email: teacherAuthEmail,
        role: 'teacher',
        subjects: Array.isArray(subjects) ? subjects : [],
        classes: Array.isArray(classes) ? classes : [],
        pupils: Array.isArray(pupils) ? pupils : [],
        status: 'active',
        schoolId: cleanSchool,
        updatedAt: now
      }, { merge: true });

      // Synchronize centralized app_state.state.teachers
      const schoolAppStateRef = adminDb.collection('app_state').doc(cleanSchool);
      const appStateSnap = await schoolAppStateRef.get();
      if (appStateSnap.exists) {
        const appState = appStateSnap.data();
        let teachersList = appState?.state?.teachers || [];
        const existingIndex = teachersList.findIndex((t: any) => t.id.toLowerCase() === cleanUser);
        const teacherObj = {
          id: teacherId.trim(),
          name: teacherName.trim(),
          subjects: Array.isArray(subjects) ? subjects : [],
          classes: Array.isArray(classes) ? classes : [],
          pupils: Array.isArray(pupils) ? pupils : []
        };
        if (existingIndex >= 0) {
          teachersList[existingIndex] = { ...teachersList[existingIndex], ...teacherObj };
        } else {
          teachersList.push(teacherObj);
        }
        await schoolAppStateRef.set({
          state: { ...appState.state, teachers: teachersList },
          updatedAt: now
        }, { merge: true });
      }

      // Audit log
      const logId = `log_${Date.now()}_prov_tch`;
      await adminDb.collection('schools').doc(cleanSchool).collection('auditLogs').doc(logId).set({
        id: logId,
        schoolId: cleanSchool,
        actorId: caller.userId || caller.email || 'admin',
        actorRole: caller.role || 'admin',
        action: 'TEACHER_PROVISIONED',
        targetType: 'teacher',
        targetId: cleanUser,
        timestamp: now,
        details: { teacherId: cleanUser, name: teacherName.trim() }
      }, { merge: true });

      res.json({
        success: true,
        uid: userRecord.uid,
        teacherId: teacherId.trim(),
        email: teacherAuthEmail,
        message: 'Teacher account successfully provisioned in Firebase Authentication and Firestore.'
      });
    } catch (err: any) {
      console.error('Teacher provisioning error:', err);
      if (createdAuthUid) {
        await adminAuth.deleteUser(createdAuthUid).catch(console.warn);
      }
      res.status(500).json({ error: err.message || 'Failed to provision teacher in Firebase Authentication.' });
    }
  });

  // POST /api/admin/delete-teacher
  app.post("/api/admin/delete-teacher", requireAdminAuth, async (req, res) => {
    try {
      const { schoolId, teacherId } = req.body;
      if (!schoolId || !teacherId) {
        return res.status(400).json({ error: 'Missing schoolId or teacherId.' });
      }

      const cleanSchool = schoolId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const cleanUser = teacherId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

      // Scope check
      const caller = (req as any).user;
      const email = (caller?.email || '').toLowerCase();
      const isSuperAdmin = caller?.role === 'superadmin' || email === 'superadmin@educore.internal' || email.includes('superadmin');
      const callerSchool = (caller?.schoolId || '').toLowerCase();

      if (!isSuperAdmin) {
        if (!callerSchool || callerSchool !== cleanSchool) {
          return res.status(403).json({ error: `Access denied: You are only authorized to manage school "${callerSchool}".` });
        }
      }

      const teacherAuthEmail = `${cleanSchool}.teacher.${cleanUser}@educore.internal`;

      // 1. Delete Firebase Authentication account permanently
      try {
        const userRecord = await adminAuth.getUserByEmail(teacherAuthEmail);
        await adminAuth.deleteUser(userRecord.uid);
      } catch (authErr: any) {
        if (authErr.code !== 'auth/user-not-found') {
          console.warn('Teacher Auth deletion warning:', authErr);
        }
      }

      const now = new Date().toISOString();

      // 2. Remove teacher document from teachers collection
      await adminDb.collection('schools').doc(cleanSchool).collection('teachers').doc(cleanUser).delete();

      // 3. Remove user document from users collection
      await adminDb.collection('schools').doc(cleanSchool).collection('users').doc(cleanUser).delete();

      // 4. Remove teacher from centralized app_state.state.teachers
      const schoolAppStateRef = adminDb.collection('app_state').doc(cleanSchool);
      const appStateSnap = await schoolAppStateRef.get();
      if (appStateSnap.exists) {
        const appState = appStateSnap.data();
        let teachersList = appState?.state?.teachers || [];
        teachersList = teachersList.filter((t: any) => t.id.toLowerCase() !== cleanUser);
        await schoolAppStateRef.set({
          state: { ...appState.state, teachers: teachersList },
          updatedAt: now
        }, { merge: true });
      }

      // 5. Log audit event
      const logId = `log_${Date.now()}_del_tch`;
      await adminDb.collection('schools').doc(cleanSchool).collection('auditLogs').doc(logId).set({
        id: logId,
        schoolId: cleanSchool,
        actorId: caller.userId || caller.email || 'admin',
        actorRole: caller.role || 'admin',
        action: 'TEACHER_DELETED',
        targetType: 'teacher',
        targetId: cleanUser,
        timestamp: now,
        details: { teacherId: cleanUser }
      }, { merge: true });

      res.json({
        success: true,
        message: `Teacher "${teacherId}" successfully deleted and access revoked.`
      });
    } catch (err: any) {
      console.error('Delete teacher error:', err);
      res.status(500).json({ error: err.message || 'Failed to delete teacher.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
