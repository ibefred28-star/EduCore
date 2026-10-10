import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import { sql } from 'drizzle-orm';
import { adminAuth, adminDb } from './src/lib/firebase-admin.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body Parser
  app.use(express.json());

  // API route for health
  app.get("/api/health", async (req, res) => {
    try {
      const result = await db.execute(sql`SELECT 1 as is_alive`);
      res.json({ status: "ok", postgres: result.rows[0].is_alive === 1 });
    } catch (e: any) {
      res.status(500).json({ status: "error", error: e.message });
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

  // POST /api/admin/provision-student
  app.post("/api/admin/provision-student", requireAdminAuth, async (req, res) => {
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
      const email = `${cleanSchool}.student.${cleanUser}@educore.internal`;

      let userRecord;
      try {
        userRecord = await adminAuth.getUserByEmail(email);
        await adminAuth.updateUser(userRecord.uid, {
          password: trimmedPass,
          displayName: studentName.trim()
        });
      } catch (e: any) {
        if (e.code === 'auth/user-not-found') {
          userRecord = await adminAuth.createUser({
            email,
            password: trimmedPass,
            displayName: studentName.trim()
          });
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

      // Upsert student document in Firestore roster (NO plaintext password stored!)
      const studentRef = adminDb.collection('schools').doc(cleanSchool).collection('students').doc(cleanUser);
      await studentRef.set({
        id: studentId.trim(),
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
        email,
        role: 'student',
        classes: [studentClass || 'Primary 5'],
        status: 'active',
        schoolId: cleanSchool,
        updatedAt: now
      }, { merge: true });

      res.json({
        success: true,
        uid: userRecord.uid,
        studentId: studentId.trim(),
        email,
        message: 'Student account successfully provisioned in Firebase Authentication.'
      });
    } catch (err: any) {
      console.error('Provisioning error:', err);
      res.status(500).json({ error: err.message || 'Failed to provision student in Firebase Authentication.' });
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
      const email = `${cleanSchool}.student.${cleanUser}@educore.internal`;

      let userRecord;
      try {
        userRecord = await adminAuth.getUserByEmail(email);
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
      let provisioned = 0;
      const errors: string[] = [];

      for (const s of students) {
        try {
          if (!s.id || !s.name) continue;
          const cleanUser = s.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
          const email = `${cleanSchool}.student.${cleanUser}@educore.internal`;
          const rawPass = (s.password && String(s.password).trim().length >= 6) ? String(s.password).trim() : 'student123';

          let userRecord;
          try {
            userRecord = await adminAuth.getUserByEmail(email);
            await adminAuth.updateUser(userRecord.uid, {
              password: rawPass,
              displayName: s.name.trim()
            });
          } catch (e: any) {
            if (e.code === 'auth/user-not-found') {
              userRecord = await adminAuth.createUser({
                email,
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
            email,
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
