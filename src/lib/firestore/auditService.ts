import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { FirestorePaths } from './paths';
import { Role } from '../../types';

export interface AuditEvent {
  id?: string;
  schoolId: string;
  actorId: string;
  actorRole: Role | 'superadmin' | 'system';
  action: string;
  targetType: 'student' | 'teacher' | 'exam' | 'result' | 'attempt' | 'settings' | 'tenant' | 'auth';
  targetId?: string;
  timestamp: string;
  details?: Record<string, any>;
}

export const AuditService = {
  /**
   * Records an immutable audit log entry in the school's audit trail
   */
  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const docRef = doc(db, FirestorePaths.auditLog(event.schoolId, logId));

    try {
      await setDoc(docRef, {
        id: logId,
        schoolId: event.schoolId,
        actorId: event.actorId,
        actorRole: event.actorRole,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId || null,
        timestamp,
        details: event.details || null
      });
    } catch (err) {
      console.warn('AuditService: Failed to record audit log:', err);
    }
  }
};
