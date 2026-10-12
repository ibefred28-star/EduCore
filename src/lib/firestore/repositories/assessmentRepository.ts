import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../../firebase';
import { FirestorePaths, cleanId } from '../paths';
import { FirestoreAssessmentDoc } from '../models';
import { AssessmentRecord, AssessmentType, AssessmentStatus } from '../../../types';

/**
 * Deterministic document key generator ensuring no duplicates for
 * the same pupil, subject, assessment component (CA1/CA2), academic session, and term.
 */
export function generateAssessmentId(
  studentId: string,
  subjectId: string,
  assessmentType: AssessmentType | string,
  academicSessionId: string,
  termId: string
): string {
  const sanitize = (s: string) => cleanId(s || '');
  return `${sanitize(studentId)}_${sanitize(subjectId)}_${sanitize(assessmentType)}_${sanitize(academicSessionId)}_${sanitize(termId)}`;
}

/**
 * Score validation rules:
 * - CA1 scores must be between 0 and 20.
 * - CA2 scores must be between 0 and 20.
 * - Reject negative scores and scores above 20.
 * - Accept zero as a valid score.
 * - Do not treat blank or unentered score as zero.
 */
export function validateCAScore(val: any): {
  isValid: boolean;
  isUnrecorded: boolean;
  score?: number;
  errorMessage?: string;
} {
  if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
    return { isValid: false, isUnrecorded: true, errorMessage: 'Unrecorded assessment' };
  }

  const num = typeof val === 'number' ? val : Number(val);
  if (isNaN(num)) {
    return { isValid: false, isUnrecorded: false, errorMessage: 'Score must be a valid number' };
  }

  if (num < 0) {
    return { isValid: false, isUnrecorded: false, errorMessage: 'Score cannot be negative' };
  }

  if (num > 20) {
    return { isValid: false, isUnrecorded: false, errorMessage: 'Score cannot exceed 20' };
  }

  // Accept 0 through 20 (can support 1 decimal place if needed)
  return { isValid: true, isUnrecorded: false, score: Math.round(num * 100) / 100 };
}

export const AssessmentRepository = {
  generateId: generateAssessmentId,
  validateScore: validateCAScore,

  /**
   * Fetch all assessment records for a school
   */
  async getAllAssessments(schoolId: string): Promise<AssessmentRecord[]> {
    if (!schoolId) return [];
    try {
      const colRef = collection(db, FirestorePaths.assessments(schoolId));
      const snap = await getDocs(colRef);
      return snap.docs.map(d => d.data() as AssessmentRecord);
    } catch (err) {
      console.error('Error fetching assessments from Firestore:', err);
      return [];
    }
  },

  /**
   * Fetch assessment records filtered by class, session, and term
   */
  async getAssessmentsByClass(
    schoolId: string,
    classId: string,
    sessionId?: string,
    termId?: string
  ): Promise<AssessmentRecord[]> {
    if (!schoolId || !classId) return [];
    try {
      const colRef = collection(db, FirestorePaths.assessments(schoolId));
      let q = query(colRef, where('classId', '==', classId));
      if (sessionId) {
        q = query(q, where('academicSessionId', '==', sessionId));
      }
      if (termId) {
        q = query(q, where('termId', '==', termId));
      }
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as AssessmentRecord);
    } catch (err) {
      console.error('Error querying class assessments:', err);
      return [];
    }
  },

  /**
   * Fetch assessment records for an individual pupil
   */
  async getAssessmentsByStudent(
    schoolId: string,
    studentId: string,
    sessionId?: string,
    termId?: string
  ): Promise<AssessmentRecord[]> {
    if (!schoolId || !studentId) return [];
    try {
      const colRef = collection(db, FirestorePaths.assessments(schoolId));
      let q = query(colRef, where('studentId', '==', studentId));
      if (sessionId) {
        q = query(q, where('academicSessionId', '==', sessionId));
      }
      if (termId) {
        q = query(q, where('termId', '==', termId));
      }
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as AssessmentRecord);
    } catch (err) {
      console.error('Error querying student assessments:', err);
      return [];
    }
  },

  /**
   * Persist or update a single continuous assessment record
   */
  async saveAssessment(schoolId: string, record: AssessmentRecord): Promise<void> {
    if (!schoolId || !record.id) throw new Error('Missing schoolId or assessment record id');
    const docRef = doc(db, FirestorePaths.assessmentDoc(schoolId, record.id));
    await setDoc(docRef, record, { merge: true });
  },

  /**
   * Batch save multiple continuous assessment records (atomic class entry)
   */
  async saveBatchAssessments(schoolId: string, records: AssessmentRecord[]): Promise<void> {
    if (!schoolId || records.length === 0) return;
    try {
      const batch = writeBatch(db);
      for (const rec of records) {
        const docRef = doc(db, FirestorePaths.assessmentDoc(schoolId, rec.id));
        batch.set(docRef, rec, { merge: true });
      }
      await batch.commit();
    } catch (err) {
      console.error('Error committing batch assessments to Firestore:', err);
      // Fallback: sequential save
      for (const rec of records) {
        const docRef = doc(db, FirestorePaths.assessmentDoc(schoolId, rec.id));
        await setDoc(docRef, rec, { merge: true });
      }
    }
  },

  /**
   * Real-time subscription to school assessments
   */
  subscribeAssessments(
    schoolId: string,
    callback: (assessments: AssessmentRecord[]) => void
  ): Unsubscribe {
    if (!schoolId) return () => {};
    try {
      const colRef = collection(db, FirestorePaths.assessments(schoolId));
      return onSnapshot(colRef, (snap) => {
        const records = snap.docs.map(d => d.data() as AssessmentRecord);
        callback(records);
      }, (err) => {
        console.warn('Assessments subscription notice:', err.message);
      });
    } catch (err) {
      console.error('Failed to subscribe to assessments:', err);
      return () => {};
    }
  }
};
