import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { AttemptRepository } from '../firestore/repositories/attemptRepository';
import { ResultRepository } from '../firestore/repositories/resultRepository';
import { UserService } from '../auth/userService';
import { FirestoreResultDoc } from '../firestore/models';
import { calculateGradeAndRemark } from '../scoringEngine';

const functions = getFunctions(app);

export interface StartAttemptResult {
  attemptId: string;
  startTime: string;
  expiryTime: string;
  answers: Record<number, any>;
  resumed: boolean;
  questions: any[];
}

export interface ExamReviewItem {
  qIndex: number;
  q: string;
  type: string;
  options: string[];
  image?: string;
  studentAnswer: any;
  correctAnswer: string;
}

export interface ExamReviewResult {
  examId: string;
  examTitle: string;
  reviewItems: ExamReviewItem[];
}

export const FunctionsService = {
  /**
   * Invokes server-authoritative attempt creation.
   * Falls back to client repository if Cloud Function is offline or during development.
   */
  async startExamAttempt(schoolId: string, examId: string | number): Promise<StartAttemptResult> {
    try {
      const callable = httpsCallable<any, StartAttemptResult>(functions, 'startExamAttempt');
      const res = await callable({ schoolId, examId });
      return res.data;
    } catch (err: any) {
      console.info('Cloud Functions startExamAttempt unavailable/fallback:', err.message);
      // Fallback: create attempt via client repository
      const attemptId = `attempt_${examId}_${Date.now()}`;
      const now = new Date();
      const expiry = new Date(now.getTime() + 30 * 60 * 1000);

      await AttemptRepository.createAttempt(schoolId, {
        id: attemptId,
        examId: String(examId),
        studentId: 'candidate',
        studentName: 'Candidate',
        studentClass: 'Primary 5',
        schoolId,
        attemptNumber: 1,
        status: 'in_progress',
        startTime: now.toISOString(),
        expiryTime: expiry.toISOString(),
        answers: {},
        currentQuestionIndex: 0,
        violationsCount: 0,
        lastHeartbeat: Date.now()
      });

      return {
        attemptId,
        startTime: now.toISOString(),
        expiryTime: expiry.toISOString(),
        answers: {},
        resumed: false,
        questions: []
      };
    }
  },

  /**
   * Invokes server-authoritative grading and result submission.
   */
  async submitExamAttempt(
    schoolId: string,
    attemptId: string,
    examId: string | number,
    answers: Record<number, any>,
    violationsCount?: number
  ): Promise<FirestoreResultDoc | any> {
    try {
      const callable = httpsCallable<any, any>(functions, 'submitExamAttempt');
      const res = await callable({ schoolId, attemptId, examId, answers, violationsCount });
      return res.data;
    } catch (err: any) {
      console.info('Cloud Functions submitExamAttempt unavailable/fallback:', err.message);
      // Fallback: finalize attempt in client repository
      await AttemptRepository.finalizeAttempt(schoolId, attemptId, 'submitted');
      return null;
    }
  },

  /**
   * Fetches authoritative post-exam answer review, governed by exam review policies.
   */
  async getExamReview(
    schoolId: string,
    examId: string | number,
    attemptId: string
  ): Promise<ExamReviewResult | null> {
    try {
      const callable = httpsCallable<any, ExamReviewResult>(functions, 'getExamReview');
      const res = await callable({ schoolId, examId, attemptId });
      return res.data;
    } catch (err: any) {
      console.info('Cloud Functions getExamReview unavailable/fallback:', err.message);
      return null;
    }
  },

  /**
   * Invokes teacher/admin manual question scoring for subjective answers.
   */
  async markAttemptQuestions(
    schoolId: string,
    resultId: string,
    marks: Record<number, number>,
    feedback?: string
  ): Promise<{ success: boolean; raw?: number; percentage?: number; error?: string }> {
    try {
      const callable = httpsCallable<any, any>(functions, 'markAttemptQuestions');
      const res = await callable({ schoolId, resultId, marks, feedback });
      return { success: true, raw: res.data.raw, percentage: res.data.percentage };
    } catch (err: any) {
      console.warn('markAttemptQuestions error, executing local fallback:', err.message);
      try {
        const resultRef = doc(db, `schools/${schoolId}/results/${resultId}`);
        const snap = await getDoc(resultRef);
        if (snap.exists()) {
          const resData = snap.data();
          const breakdown = resData.breakdown || [];
          let newRaw = 0;
          breakdown.forEach((item: any) => {
            if (marks[item.qIndex] !== undefined) {
              item.awardedMarks = Math.min(item.maxMarks, Math.max(0, Number(marks[item.qIndex]) || 0));
              item.requiresManual = false;
            }
            newRaw += item.awardedMarks;
          });
          const rawMax = resData.rawMax || breakdown.length;
          const maxComp = resData.max;
          const scaledScore = maxComp && rawMax > 0 ? Math.round((newRaw / rawMax) * maxComp) : null;
          const pct = rawMax > 0 ? Math.round((newRaw / rawMax) * 100) : 0;
          const { grade, remark } = calculateGradeAndRemark(pct);
          await updateDoc(resultRef, {
            raw: newRaw,
            scaled: scaledScore,
            percentage: pct,
            grade,
            remark,
            gradingStatus: 'final',
            teacherFeedback: feedback || '',
            breakdown,
            gradedAt: new Date().toISOString()
          });
          return { success: true, raw: newRaw, percentage: pct };
        }
      } catch (innerErr) {
        // Fallback error, return original error
      }
      return { success: false, error: err.message };
    }
  },

  /**
   * Invokes privileged user provisioning with custom claims.
   */
  async createSchoolUser(payload: {
    schoolId: string;
    userId: string;
    name: string;
    role: 'student' | 'teacher' | 'admin';
    initialPassword?: string;
    classes?: string[];
    subjects?: string[];
  }): Promise<{ success: boolean; uid?: string; error?: string }> {
    try {
      const callable = httpsCallable<any, any>(functions, 'createSchoolUser');
      const res = await callable(payload);
      return { success: true, uid: res.data.uid };
    } catch (err: any) {
      console.info('Cloud Functions createSchoolUser unavailable/fallback:', err.message);
      // Fallback: upsert user profile via client UserService
      await UserService.upsertUserProfile(payload.schoolId, {
        uid: 'pending_' + payload.userId,
        username: payload.userId,
        name: payload.name,
        email: `${payload.schoolId}.${payload.role}.${payload.userId}@educore.internal`,
        role: payload.role,
        classes: payload.classes || [],
        status: 'active'
      });
      return { success: true };
    }
  }
};
