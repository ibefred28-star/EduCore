import { useMemo } from 'react';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { FirestorePaths } from '../lib/firestore/paths';
import {
  FirestoreExamDoc,
  FirestoreStudentDoc,
  FirestoreAttemptDoc,
  FirestoreResultDoc,
  FirestoreAnnouncementDoc,
  FirestoreAttendanceDoc,
  FirestoreQuestionBankDoc
} from '../lib/firestore/models';
import { QuestionBankRepository } from '../lib/firestore/repositories/questionBankRepository';
import {
  useFirestoreSubscription,
  useFirestoreQueryData,
  useFirestoreDocData,
  UseFirestoreSubscriptionOptions
} from './useFirestoreSubscription';

/**
 * Live subscription hook for available exams for a school
 */
export function useExamsSubscription(
  schoolId: string | null | undefined,
  targetClassFilter?: string,
  options?: UseFirestoreSubscriptionOptions
) {
  const q = useMemo(() => {
    if (!schoolId) return null;
    const colRef = collection(db, FirestorePaths.exams(schoolId));
    return query(colRef, orderBy('createdAt', 'desc'));
  }, [schoolId]);

  const { data: rawExams, loading, error } = useFirestoreQueryData<FirestoreExamDoc>(q, {
    enabled: !!schoolId,
    ...options
  });

  const exams = useMemo(() => {
    if (!rawExams) return [];
    if (targetClassFilter && targetClassFilter !== 'all') {
      const classLower = targetClassFilter.trim().toLowerCase();
      return rawExams.filter(e => {
        if (!e.targetClasses || e.targetClasses.length === 0) return true;
        return e.targetClasses.some(tc => {
          const tcClean = String(tc || '').trim().toLowerCase();
          return tcClean === classLower || classLower.includes(classLower) || classLower.includes(tcClean);
        });
      });
    }
    return rawExams;
  }, [rawExams, targetClassFilter]);

  return { exams, loading, error };
}

/**
 * Live subscription hook for students in a school, with optional class filter
 */
export function useStudentsSubscription(
  schoolId: string | null | undefined,
  classFilter?: string,
  options?: UseFirestoreSubscriptionOptions
) {
  const q = useMemo(() => {
    if (!schoolId) return null;
    const colRef = collection(db, FirestorePaths.students(schoolId));
    if (classFilter && classFilter !== 'all') {
      return query(colRef, where('class', '==', classFilter), orderBy('name', 'asc'));
    }
    return query(colRef, orderBy('name', 'asc'));
  }, [schoolId, classFilter]);

  const { data: students, loading, error } = useFirestoreQueryData<FirestoreStudentDoc>(q, {
    enabled: !!schoolId,
    ...options
  });

  return { students: students || [], loading, error };
}

/**
 * Live subscription hook for exam attempts (used for teacher proctoring & monitoring)
 */
export function useExamAttemptsSubscription(
  schoolId: string | null | undefined,
  examId: string | number | null | undefined,
  options?: UseFirestoreSubscriptionOptions
) {
  const q = useMemo(() => {
    if (!schoolId || !examId) return null;
    const colRef = collection(db, FirestorePaths.attempts(schoolId));
    return query(colRef, where('examId', '==', String(examId)));
  }, [schoolId, examId]);

  const { data: attempts, loading, error } = useFirestoreQueryData<FirestoreAttemptDoc>(q, {
    enabled: !!schoolId && !!examId,
    ...options
  });

  return { attempts: attempts || [], loading, error };
}

/**
 * Live subscription hook for an individual student attempt (used for CBT status sync)
 */
export function useAttemptSessionSubscription(
  schoolId: string | null | undefined,
  attemptId: string | null | undefined,
  options?: UseFirestoreSubscriptionOptions
) {
  const docRef = useMemo(() => {
    if (!schoolId || !attemptId) return null;
    return doc(db, FirestorePaths.attempt(schoolId, attemptId));
  }, [schoolId, attemptId]);

  const { data: attempt, loading, error } = useFirestoreDocData<FirestoreAttemptDoc>(docRef, {
    enabled: !!schoolId && !!attemptId,
    ...options
  });

  return { attempt, loading, error };
}

/**
 * Live subscription hook for a candidate's official results
 */
export function useStudentResultsSubscription(
  schoolId: string | null | undefined,
  studentId: string | null | undefined,
  options?: UseFirestoreSubscriptionOptions
) {
  const q = useMemo(() => {
    if (!schoolId || !studentId) return null;
    const colRef = collection(db, FirestorePaths.results(schoolId));
    return query(colRef, where('studentId', '==', studentId), orderBy('submittedAt', 'desc'));
  }, [schoolId, studentId]);

  const { data: results, loading, error } = useFirestoreQueryData<FirestoreResultDoc>(q, {
    enabled: !!schoolId && !!studentId,
    ...options
  });

  return { results: results || [], loading, error };
}

/**
 * Live subscription hook for school announcements
 */
export function useAnnouncementsSubscription(
  schoolId: string | null | undefined,
  targetRole?: 'student' | 'teacher' | 'admin',
  options?: UseFirestoreSubscriptionOptions
) {
  const q = useMemo(() => {
    if (!schoolId) return null;
    const colRef = collection(db, FirestorePaths.announcements(schoolId));
    if (targetRole) {
      return query(
        colRef,
        where('targetRoles', 'array-contains', targetRole),
        orderBy('createdAt', 'desc')
      );
    }
    return query(colRef, orderBy('createdAt', 'desc'));
  }, [schoolId, targetRole]);

  const { data: announcements, loading, error } = useFirestoreQueryData<FirestoreAnnouncementDoc>(q, {
    enabled: !!schoolId,
    ...options
  });

  return { announcements: announcements || [], loading, error };
}

/**
 * Live subscription hook for class attendance records
 */
export function useAttendanceSubscription(
  schoolId: string | null | undefined,
  classFilter?: string,
  options?: UseFirestoreSubscriptionOptions
) {
  const q = useMemo(() => {
    if (!schoolId) return null;
    const colRef = collection(db, FirestorePaths.attendance(schoolId));
    if (classFilter && classFilter !== 'all') {
      return query(colRef, where('class', '==', classFilter), orderBy('studentId', 'asc'));
    }
    return query(colRef, orderBy('studentId', 'asc'));
  }, [schoolId, classFilter]);

  const { data: attendance, loading, error } = useFirestoreQueryData<FirestoreAttendanceDoc>(q, {
    enabled: !!schoolId,
    ...options
  });

  return { attendance: attendance || [], loading, error };
}

/**
 * Live subscription hook for question bank items
 */
export function useQuestionBankSubscription(
  schoolId: string | null | undefined,
  options?: UseFirestoreSubscriptionOptions
) {
  const q = useMemo(() => {
    if (!schoolId) return null;
    const colRef = collection(db, FirestorePaths.questionBanks(schoolId));
    return query(colRef, orderBy('createdAt', 'desc'));
  }, [schoolId]);

  const { data: questions, loading, error } = useFirestoreQueryData<FirestoreQuestionBankDoc>(q, {
    enabled: !!schoolId,
    ...options
  });

  return { questions: questions || [], loading, error };
}

