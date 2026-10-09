import { Question } from '../../types';
import { SanitizedExamQuestion } from '../firestore/models';

export type AttemptLifecycleState =
  | 'created'
  | 'in_progress'
  | 'submitted'
  | 'auto_submitted'
  | 'expired'
  | 'abandoned';

export interface CbtSessionState {
  attemptId: string;
  examId: string | number;
  studentId: string;
  startTime: string;
  expiryTime: string;
  status: AttemptLifecycleState;
  answers: Record<number, any>;
  currentQuestionIndex: number;
  violationsCount: number;
  isResumed: boolean;
}

export const CbtEngine = {
  /**
   * Computes remaining seconds from server-authoritative expiry timestamp.
   * Returns 0 if expired.
   */
  calculateTimeRemaining(expiryTimeIso: string): number {
    if (!expiryTimeIso) return 0;
    const expiryMs = new Date(expiryTimeIso).getTime();
    const nowMs = Date.now();
    return Math.max(0, Math.floor((expiryMs - nowMs) / 1000));
  },

  /**
   * Sanitizes questions to ensure no answer keys or pedagogical explanations
   * are exposed to candidate memory.
   */
  sanitizeQuestions(questions: Question[]): SanitizedExamQuestion[] {
    return (questions || []).map((q, idx) => ({
      id: q.id || `q_${idx}`,
      type: q.type || 'mcq',
      q: q.q,
      options: q.options ? [...q.options] : [],
      image: q.image || '',
      marks: q.marks || 1
    }));
  },

  /**
   * Local recovery draft cache key for temporary disconnection resilience
   */
  getDraftKey(attemptId: string): string {
    return `educore_cbt_draft_${attemptId}`;
  },

  saveLocalDraft(attemptId: string, answers: Record<number, any>): void {
    try {
      localStorage.setItem(this.getDraftKey(attemptId), JSON.stringify(answers));
    } catch (e) {
      // Ignore quota errors
    }
  },

  getLocalDraft(attemptId: string): Record<number, any> | null {
    try {
      const item = localStorage.getItem(this.getDraftKey(attemptId));
      return item ? JSON.parse(item) : null;
    } catch (e) {
      return null;
    }
  },

  clearLocalDraft(attemptId: string): void {
    try {
      localStorage.removeItem(this.getDraftKey(attemptId));
    } catch (e) {
      // Ignore
    }
  }
};
