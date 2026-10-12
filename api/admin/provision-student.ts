import type { IncomingMessage, ServerResponse } from 'http';
import { adminAuth, adminDb } from '../../src/lib/firebase-admin';

// Helper to read JSON request body in Vercel serverless environment
async function getJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method Not Allowed. Expected POST.' }));
  }

  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'Missing authorization bearer token.' }));
    }

    const token = authHeader.split('Bearer ')[1].trim();
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();
    const isSuperAdmin = decoded.role === 'superadmin' || email === 'superadmin@educore.internal' || email.includes('superadmin');
    const isAdmin = isSuperAdmin || decoded.role === 'admin' || email.includes('.admin.');

    if (!isAdmin) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ error: 'Access denied: Administrator privileges required.' }));
    }

    const body = req.body && typeof req.body === 'object' ? req.body : await getJsonBody(req);
    const { schoolId, studentId, studentName, studentClass, password, photo } = body;

    if (!schoolId || !studentId || !studentName) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Missing required student details (ID, name, and schoolId).' }));
    }

    const trimmedPass = (password || '').trim();
    if (!trimmedPass || trimmedPass.length < 6) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Password must be at least 6 characters long.' }));
    }

    const cleanSchool = schoolId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanUser = studentId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const studentAuthEmail = `${cleanSchool}.student.${cleanUser}@educore.internal`;

    let userRecord: any;
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

    // Persist in Firestore
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

    res.statusCode = 200;
    return res.end(JSON.stringify({
      success: true,
      uid: userRecord.uid,
      studentId: studentId.trim(),
      email: studentAuthEmail,
      message: 'Student account successfully provisioned in Firebase Authentication and Firestore.'
    }));
  } catch (err: any) {
    console.error('Vercel API provision-student error:', err);
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message || 'Failed to provision student in Firebase Authentication.' }));
  }
}
