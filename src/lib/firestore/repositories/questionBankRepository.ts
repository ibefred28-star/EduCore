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
import { FirestoreQuestionBankDoc } from '../models';

export const QuestionBankRepository = {
  /**
   * Retrieves master questions pool (Staff access only)
   */
  async getQuestions(
    schoolId: string,
    filters?: { subject?: string; classLevel?: string; topic?: string }
  ): Promise<FirestoreQuestionBankDoc[]> {
    if (!schoolId) return [];
    const colRef = collection(db, FirestorePaths.questionBanks(schoolId));
    let q = query(colRef, orderBy('createdAt', 'desc'));

    if (filters?.subject && filters.subject !== 'all') {
      q = query(colRef, where('subject', '==', filters.subject), orderBy('createdAt', 'desc'));
    }

    const snapshot = await getDocs(q);
    let items = snapshot.docs.map(d => d.data() as FirestoreQuestionBankDoc);

    if (filters?.classLevel && filters.classLevel !== 'all') {
      items = items.filter(i => i.class === filters.classLevel);
    }
    if (filters?.topic && filters.topic !== 'all') {
      items = items.filter(i => i.topic?.toLowerCase().includes(filters.topic!.toLowerCase()));
    }

    return items;
  },

  /**
   * Idempotently saves a question in the bank
   */
  async upsertQuestion(
    schoolId: string,
    question: Omit<FirestoreQuestionBankDoc, 'schoolId' | 'updatedAt' | 'createdAt'>
  ): Promise<void> {
    if (!schoolId || !question.id) throw new Error('Missing schoolId or question ID');
    const ref = doc(db, FirestorePaths.questionBankDoc(schoolId, question.id));
    const snap = await getDoc(ref);

    const now = new Date().toISOString();
    const payload: FirestoreQuestionBankDoc = {
      ...question,
      schoolId,
      createdAt: snap.exists() ? (snap.data() as FirestoreQuestionBankDoc).createdAt : now,
      updatedAt: now
    };

    await setDoc(ref, payload, { merge: true });
  },

  /**
   * Deletes a question from the bank
   */
  async deleteQuestion(schoolId: string, questionId: string): Promise<void> {
    if (!schoolId || !questionId) return;
    const ref = doc(db, FirestorePaths.questionBankDoc(schoolId, questionId));
    await deleteDoc(ref);
  },

  /**
   * Realtime subscription for question bank items
   */
  subscribeQuestions(
    schoolId: string,
    callback: (questions: FirestoreQuestionBankDoc[]) => void
  ): Unsubscribe {
    if (!schoolId) return () => {};
    const colRef = collection(db, FirestorePaths.questionBanks(schoolId));
    const q = query(colRef, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => d.data() as FirestoreQuestionBankDoc);
      callback(list);
    }, (error) => {
      console.warn('QuestionBankRepository.subscribeQuestions error:', error);
    });
  }
};
