import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { FirestorePaths } from '../paths';
import {
  FirestoreStudentDoc,
  FirestoreTeacherDoc,
  FirestoreExamDoc,
  FirestoreExamKeyDoc,
  FirestoreQuestionBankDoc,
  FirestoreResultDoc,
  FirestoreAttendanceDoc,
  SanitizedExamQuestion
} from '../models';
import { AppData } from '../../../types';
import { AuditService } from '../auditService';

export interface MigrationReport {
  schoolId: string;
  dryRun: boolean;
  status: 'completed' | 'failed' | 'skipped';
  counts: {
    students: number;
    teachers: number;
    exams: number;
    examKeys: number;
    questions: number;
    results: number;
    attendance: number;
  };
  errors: string[];
  durationMs: number;
}

export const MigrationService = {
  /**
   * Safe, idempotent migration from monolithic app_state/{schoolId} to structured subcollections.
   * Can be run in dryRun mode to inspect transformations without executing database writes.
   * NEVER deletes or mutates the original source app_state document.
   */
  async migrateSchoolData(schoolId: string, dryRun = true): Promise<MigrationReport> {
    const startTime = Date.now();
    const report: MigrationReport = {
      schoolId,
      dryRun,
      status: 'completed',
      counts: {
        students: 0,
        teachers: 0,
        exams: 0,
        examKeys: 0,
        questions: 0,
        results: 0,
        attendance: 0
      },
      errors: [],
      durationMs: 0
    };

    if (!schoolId) {
      report.status = 'failed';
      report.errors.push('Invalid schoolId provided');
      return report;
    }

    try {
      // 1. Fetch source document from app_state/{schoolId}
      const sourceRef = doc(db, 'app_state', schoolId);
      const sourceSnap = await getDoc(sourceRef);

      if (!sourceSnap.exists() || !sourceSnap.data()?.state) {
        report.status = 'skipped';
        report.errors.push(`No monolithic source state found at app_state/${schoolId}`);
        report.durationMs = Date.now() - startTime;
        return report;
      }

      const sourceData = sourceSnap.data().state as AppData;
      const now = new Date().toISOString();

      // 2. Prepare subcollection entities
      const students: FirestoreStudentDoc[] = (sourceData.students || []).map(s => ({
        id: s.id,
        schoolId,
        name: s.name,
        class: s.class || 'Primary 5',
        photo: s.photo || '',
        reportTerm: s.reportTerm || '',
        reportSession: s.reportSession || '',
        position: s.position || '',
        nextTerm: s.nextTerm || '',
        teacherName: s.teacherName || '',
        teacherComment: s.teacherComment || '',
        principalComment: s.principalComment || '',
        createdAt: now,
        updatedAt: now
      }));

      const teachers: FirestoreTeacherDoc[] = (sourceData.teachers || []).map(t => ({
        id: t.id,
        schoolId,
        name: t.name,
        subjects: t.subjects || [],
        classes: t.classes || [],
        createdAt: now,
        updatedAt: now
      }));

      const questions: FirestoreQuestionBankDoc[] = (sourceData.questions || []).map(q => ({
        id: q.id,
        schoolId,
        type: q.type || 'mcq',
        q: q.q,
        subject: q.subject || 'General',
        class: q.class || 'Primary 5',
        topic: q.topic || 'General',
        subtopic: q.subtopic || '',
        difficulty: q.difficulty || 'Medium',
        tags: q.tags || [],
        options: q.options || [],
        ans: q.ans,
        answers: q.answers,
        answer: q.answer,
        marks: q.marks || 1,
        explanation: q.explanation || '',
        image: q.image || '',
        status: q.status || 'active',
        createdBy: q.createdBy || 'staff',
        createdAt: q.createdAt || now,
        updatedAt: q.updatedAt || now
      }));

      const exams: FirestoreExamDoc[] = [];
      const examKeys: FirestoreExamKeyDoc[] = [];

      (sourceData.exams || []).forEach(e => {
        const examIdStr = String(e.id);
        const rawQs = e.questions || [];

        // Sanitize question items for student distribution
        const sanitizedQs: SanitizedExamQuestion[] = rawQs.map((q, idx) => ({
          id: q.id || `q_${idx}`,
          type: q.type || 'mcq',
          q: q.q,
          options: q.options || [],
          image: q.image || '',
          marks: q.marks || 1
        }));

        // Confidential answer keys for server grading
        const keys = rawQs.map((q, idx) => ({
          qIndex: idx,
          type: q.type || 'mcq',
          ans: q.ans !== undefined ? q.ans : undefined,
          answers: q.answers || undefined,
          answer: q.answer || undefined,
          marks: q.marks || 1
        }));

        exams.push({
          id: examIdStr,
          schoolId,
          title: e.title,
          subject: e.subject,
          type: e.type,
          duration: e.duration || 30,
          attempts: e.attempts || 1,
          status: e.status || 'active',
          targetClasses: e.targetClasses || ['Primary 5'],
          questions: sanitizedQs,
          createdBy: e.createdBy || 'staff',
          createdAt: now,
          updatedAt: now
        });

        examKeys.push({
          examId: examIdStr,
          schoolId,
          keys,
          updatedAt: now
        });
      });

      const results: FirestoreResultDoc[] = (sourceData.results || []).map((r, idx) => ({
        id: String(r.id || `res_${r.studentId}_${r.examId}_${idx}`),
        examId: String(r.examId),
        studentId: r.studentId,
        schoolId,
        subject: r.subject,
        type: r.type,
        raw: r.raw,
        rawMax: r.rawMax,
        scaled: r.scaled,
        max: r.max,
        percentage: r.rawMax > 0 ? Math.round((r.raw / r.rawMax) * 100) : 0,
        grade: r.scaled !== null ? 'Pass' : 'Pending',
        remark: 'Completed',
        attempt: r.attempt || 1,
        attemptsAllowed: r.attemptsAllowed || 1,
        violations: r.violations || 0,
        submittedAt: r.submittedAt || now,
        gradedAt: now
      }));

      const attendance: FirestoreAttendanceDoc[] = (sourceData.attendance || []).map(a => ({
        id: a.studentId,
        schoolId,
        studentId: a.studentId,
        class: 'Primary 5',
        days: a.days,
        present: a.present,
        absent: a.absent,
        percent: a.percent,
        updatedAt: now
      }));

      report.counts = {
        students: students.length,
        teachers: teachers.length,
        exams: exams.length,
        examKeys: examKeys.length,
        questions: questions.length,
        results: results.length,
        attendance: attendance.length
      };

      // 3. In dryRun mode, stop before writing
      if (dryRun) {
        report.durationMs = Date.now() - startTime;
        return report;
      }

      // 4. Batch Execution with 500-op chunks
      let batch = writeBatch(db);
      let opCount = 0;

      const commitBatchIfNeeded = async () => {
        if (opCount >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      };

      for (const s of students) {
        batch.set(doc(db, FirestorePaths.student(schoolId, s.id)), s, { merge: true });
        opCount++;
        await commitBatchIfNeeded();
      }

      for (const t of teachers) {
        batch.set(doc(db, FirestorePaths.teacher(schoolId, t.id)), t, { merge: true });
        opCount++;
        await commitBatchIfNeeded();
      }

      for (const q of questions) {
        batch.set(doc(db, FirestorePaths.questionBankDoc(schoolId, q.id)), q, { merge: true });
        opCount++;
        await commitBatchIfNeeded();
      }

      for (const e of exams) {
        batch.set(doc(db, FirestorePaths.exam(schoolId, e.id)), e, { merge: true });
        opCount++;
        await commitBatchIfNeeded();
      }

      for (const k of examKeys) {
        batch.set(doc(db, FirestorePaths.examKey(schoolId, k.examId)), k, { merge: true });
        opCount++;
        await commitBatchIfNeeded();
      }

      for (const r of results) {
        batch.set(doc(db, FirestorePaths.result(schoolId, r.id)), r, { merge: true });
        opCount++;
        await commitBatchIfNeeded();
      }

      for (const a of attendance) {
        batch.set(doc(db, FirestorePaths.attendanceDoc(schoolId, a.id)), a, { merge: true });
        opCount++;
        await commitBatchIfNeeded();
      }

      if (opCount > 0) {
        await batch.commit();
      }

      await AuditService.log({
        schoolId,
        actorId: 'system_migration',
        actorRole: 'system',
        action: 'MIGRATION_SUBCOLLECTIONS_COMPLETED',
        targetType: 'tenant',
        details: { counts: report.counts }
      });
    } catch (err: any) {
      report.status = 'failed';
      report.errors.push(err.message || 'Migration batch execution failure');
    }

    report.durationMs = Date.now() - startTime;
    return report;
  }
};
