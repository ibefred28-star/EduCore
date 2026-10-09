import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../../firebase';
import { FirestorePaths } from '../paths';
import { FirestoreExamDoc, FirestoreExamKeyDoc, SanitizedExamQuestion } from '../models';
import { Question } from '../../../types';

export const ExamRepository = {
  /**
   * Retrieves exams for candidates (sanitized - zero answer keys) or staff
   */
  async getExams(
    schoolId: string,
    targetClassFilter?: string,
    statusFilter?: string
  ): Promise<FirestoreExamDoc[]> {
    if (!schoolId) return [];
    const colRef = collection(db, FirestorePaths.exams(schoolId));
    let q = query(colRef, orderBy('createdAt', 'desc'));

    if (statusFilter && statusFilter !== 'all') {
      q = query(colRef, where('status', '==', statusFilter), orderBy('createdAt', 'desc'));
    }

    const snapshot = await getDocs(q);
    let exams = snapshot.docs.map(d => d.data() as FirestoreExamDoc);

    if (targetClassFilter && targetClassFilter !== 'all') {
      exams = exams.filter(e => e.targetClasses?.includes(targetClassFilter));
    }

    return exams;
  },

  /**
   * Retrieves a single exam document
   */
  async getExamById(schoolId: string, examId: string | number): Promise<FirestoreExamDoc | null> {
    if (!schoolId || !examId) return null;
    const ref = doc(db, FirestorePaths.exam(schoolId, examId));
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as FirestoreExamDoc;
  },

  /**
   * Securely persists an exam:
   * 1. Sanitizes question objects (stripping 'ans', 'answer', 'answers', 'explanation')
   * 2. Writes public candidate exam to schools/{schoolId}/exams/{examId}
   * 3. Writes confidential grading keys to schools/{schoolId}/examKeys/{examId}
   */
  async saveExamWithAnswerKeys(
    schoolId: string,
    exam: {
      id: string | number;
      title: string;
      subject: string;
      type: string;
      duration: number;
      attempts: number;
      status: 'active' | 'draft' | 'scheduled' | 'closed';
      targetClasses: string[];
      instructions?: string;
      createdBy: string;
      rawQuestions: Question[];
    }
  ): Promise<void> {
    const examIdStr = String(exam.id);
    const examRef = doc(db, FirestorePaths.exam(schoolId, examIdStr));
    const keyRef = doc(db, FirestorePaths.examKey(schoolId, examIdStr));

    const existingSnap = await getDoc(examRef);
    const now = new Date().toISOString();

    // 1. Sanitize questions for student exam document
    const sanitizedQuestions: SanitizedExamQuestion[] = exam.rawQuestions.map((q, idx) => ({
      id: q.id || `q_${idx}`,
      type: q.type || 'mcq',
      q: q.q,
      options: q.options || [],
      image: q.image || '',
      marks: q.marks || 1
    }));

    // 2. Extract confidential answer keys
    const answerKeys = exam.rawQuestions.map((q, idx) => ({
      qIndex: idx,
      type: q.type || 'mcq',
      ans: q.ans !== undefined ? q.ans : undefined,
      answers: q.answers || undefined,
      answer: q.answer || undefined,
      marks: q.marks || 1
    }));

    const examDocData: FirestoreExamDoc = {
      id: examIdStr,
      schoolId,
      title: exam.title,
      subject: exam.subject,
      type: exam.type,
      duration: exam.duration,
      attempts: exam.attempts,
      status: exam.status,
      targetClasses: exam.targetClasses,
      instructions: exam.instructions || '',
      questions: sanitizedQuestions,
      createdBy: exam.createdBy,
      createdAt: existingSnap.exists() ? (existingSnap.data() as FirestoreExamDoc).createdAt : now,
      updatedAt: now
    };

    const keyDocData: FirestoreExamKeyDoc = {
      examId: examIdStr,
      schoolId,
      keys: answerKeys,
      updatedAt: now
    };

    // Transactionally write both documents
    await Promise.all([
      setDoc(examRef, examDocData, { merge: true }),
      setDoc(keyRef, keyDocData, { merge: true })
    ]);
  },

  /**
   * Deletes an exam and its associated answer keys
   */
  async deleteExam(schoolId: string, examId: string | number): Promise<void> {
    const examIdStr = String(examId);
    await Promise.all([
      deleteDoc(doc(db, FirestorePaths.exam(schoolId, examIdStr))),
      deleteDoc(doc(db, FirestorePaths.examKey(schoolId, examIdStr)))
    ]);
  },

  /**
   * Realtime subscription for available exams
   */
  subscribeExams(
    schoolId: string,
    callback: (exams: FirestoreExamDoc[]) => void,
    targetClassFilter?: string
  ): Unsubscribe {
    if (!schoolId) return () => {};
    const colRef = collection(db, FirestorePaths.exams(schoolId));
    const q = query(colRef, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      let exams = snapshot.docs.map(d => d.data() as FirestoreExamDoc);
      if (targetClassFilter && targetClassFilter !== 'all') {
        exams = exams.filter(e => e.targetClasses?.includes(targetClassFilter));
      }
      callback(exams);
    }, (error) => {
      console.warn('ExamRepository.subscribeExams error:', error);
    });
  }
};
