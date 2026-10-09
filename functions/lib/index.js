"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoSubmitExpiredExams = exports.createSchoolUser = exports.markAttemptQuestions = exports.getExamReview = exports.submitExamAttempt = exports.startExamAttempt = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
// Safe singleton initialization of Firebase Admin SDK
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
const db = (0, firestore_1.getFirestore)();
const auth = (0, auth_1.getAuth)();
function resolveCaller(request) {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const { uid, token } = request.auth;
    const email = token.email || '';
    // Super Admin check
    if (email === 'superadmin@educore.internal' || token.role === 'superadmin') {
        return {
            uid,
            email,
            role: 'superadmin',
            schoolId: 'global',
            userId: 'superadmin'
        };
    }
    // Parse structured email format: {schoolId}.{role}.{userId}@educore.internal
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 3) {
        return {
            uid,
            email,
            schoolId: parts[0],
            role: parts[1],
            userId: parts.slice(2).join('.')
        };
    }
    // Token custom claims fallback
    return {
        uid,
        email,
        schoolId: token.schoolId || '',
        role: token.role || 'student',
        userId: token.userId || uid
    };
}
function verifySchoolAccess(caller, targetSchoolId) {
    if (caller.role === 'superadmin')
        return;
    if (!caller.schoolId || caller.schoolId !== targetSchoolId) {
        throw new https_1.HttpsError('permission-denied', 'Cross-school access is prohibited.');
    }
}
function calculateGradeAndRemark(percentage, customGrades) {
    const grades = customGrades && customGrades.length > 0
        ? customGrades
        : [
            { min: 75, grade: 'A', remark: 'Excellent' },
            { min: 65, grade: 'B', remark: 'Very Good' },
            { min: 55, grade: 'C', remark: 'Good' },
            { min: 45, grade: 'D', remark: 'Fair' },
            { min: 40, grade: 'E', remark: 'Pass' },
            { min: 0, grade: 'F', remark: 'Fail' }
        ];
    const matched = grades.find((g) => percentage >= g.min) || grades[grades.length - 1];
    return {
        grade: matched.grade || 'F',
        remark: matched.remark || 'Fail'
    };
}
exports.startExamAttempt = (0, https_1.onCall)(async (request) => {
    const caller = resolveCaller(request);
    const data = request.data;
    if (!data?.schoolId || !data?.examId) {
        throw new https_1.HttpsError('invalid-argument', 'Missing schoolId or examId.');
    }
    verifySchoolAccess(caller, data.schoolId);
    const schoolId = data.schoolId;
    const examIdStr = String(data.examId);
    const studentId = caller.userId;
    const examRef = db.doc(`schools/${schoolId}/exams/${examIdStr}`);
    const examSnap = await examRef.get();
    if (!examSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Exam does not exist.');
    }
    const examData = examSnap.data();
    if (examData.status !== 'active') {
        throw new https_1.HttpsError('failed-precondition', 'This exam is not currently active.');
    }
    // Fetch student profile to verify class eligibility
    const studentRef = db.doc(`schools/${schoolId}/students/${studentId}`);
    const studentSnap = await studentRef.get();
    const studentClass = studentSnap.exists ? studentSnap.data().class : 'Primary 5';
    const studentName = studentSnap.exists ? studentSnap.data().name : studentId;
    if (Array.isArray(examData.targetClasses) && examData.targetClasses.length > 0) {
        if (!examData.targetClasses.includes(studentClass)) {
            throw new https_1.HttpsError('permission-denied', `This exam is restricted to ${examData.targetClasses.join(', ')}.`);
        }
    }
    // Concurrency-controlled check for existing attempts
    const attemptsCol = db.collection(`schools/${schoolId}/attempts`);
    const existingAttemptsSnap = await attemptsCol
        .where('examId', '==', examIdStr)
        .where('studentId', '==', studentId)
        .get();
    const attemptsCount = existingAttemptsSnap.size;
    const maxAttempts = examData.attempts || 1;
    if (attemptsCount >= maxAttempts) {
        // Check if there is an in-progress attempt to resume
        const inProgressDoc = existingAttemptsSnap.docs.find((d) => d.data().status === 'in_progress');
        if (inProgressDoc) {
            const d = inProgressDoc.data();
            return {
                attemptId: inProgressDoc.id,
                startTime: d.startTime,
                expiryTime: d.expiryTime,
                answers: d.answers || {},
                resumed: true,
                questions: examData.questions || []
            };
        }
        throw new https_1.HttpsError('failed-precondition', `Maximum attempt limit (${maxAttempts}) reached for this exam.`);
    }
    const attemptNumber = attemptsCount + 1;
    const attemptId = `attempt_${examIdStr}_${studentId}_${attemptNumber}`;
    const now = new Date();
    const durationMinutes = Number(examData.duration) || 30;
    const expiryDate = new Date(now.getTime() + durationMinutes * 60 * 1000);
    const attemptDocData = {
        id: attemptId,
        examId: examIdStr,
        studentId,
        studentName,
        studentClass,
        schoolId,
        attemptNumber,
        status: 'in_progress',
        startTime: now.toISOString(),
        expiryTime: expiryDate.toISOString(),
        answers: {},
        currentQuestionIndex: 0,
        violationsCount: 0,
        lastHeartbeat: Date.now(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    };
    await db.doc(`schools/${schoolId}/attempts/${attemptId}`).set(attemptDocData);
    return {
        attemptId,
        startTime: attemptDocData.startTime,
        expiryTime: attemptDocData.expiryTime,
        answers: {},
        resumed: false,
        questions: examData.questions || []
    };
});
exports.submitExamAttempt = (0, https_1.onCall)(async (request) => {
    const caller = resolveCaller(request);
    const data = request.data;
    if (!data?.schoolId || !data?.attemptId || !data?.examId) {
        throw new https_1.HttpsError('invalid-argument', 'Missing schoolId, attemptId, or examId.');
    }
    verifySchoolAccess(caller, data.schoolId);
    const schoolId = data.schoolId;
    const attemptId = data.attemptId;
    const examIdStr = String(data.examId);
    const attemptRef = db.doc(`schools/${schoolId}/attempts/${attemptId}`);
    const attemptSnap = await attemptRef.get();
    if (!attemptSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Attempt record not found.');
    }
    const attemptData = attemptSnap.data();
    if (caller.role !== 'admin' && caller.role !== 'superadmin' && attemptData.studentId !== caller.userId) {
        throw new https_1.HttpsError('permission-denied', 'Cannot submit another student attempt.');
    }
    // Idempotency: If already submitted, return existing result without re-grading
    if (attemptData.status === 'submitted' || attemptData.status === 'auto_submitted') {
        const resultSnap = await db.doc(`schools/${schoolId}/results/res_${attemptId}`).get();
        if (resultSnap.exists) {
            return resultSnap.data();
        }
    }
    // Fetch confidential grading answer keys
    const keyRef = db.doc(`schools/${schoolId}/examKeys/${examIdStr}`);
    const keySnap = await keyRef.get();
    if (!keySnap.exists) {
        throw new https_1.HttpsError('failed-precondition', 'Confidential answer keys not found for this exam.');
    }
    const keyData = keySnap.data();
    const keys = keyData.keys || [];
    // Fetch exam metadata for component scaling
    const examSnap = await db.doc(`schools/${schoolId}/exams/${examIdStr}`).get();
    const examData = examSnap.data() || {};
    // Fetch school settings for grading weights & grade definitions
    const settingsSnap = await db.doc(`schools/${schoolId}/settings/configuration`).get();
    const settings = settingsSnap.data() || { ca1: 20, ca2: 20, exam: 60 };
    const submittedAnswers = data.answers || attemptData.answers || {};
    // Authoritative grading logic across all question types
    let rawScore = 0;
    let totalMaxMarks = 0;
    let pendingManualCount = 0;
    const breakdown = [];
    keys.forEach((keyItem, idx) => {
        const questionWeight = Number(keyItem.marks) || 1;
        totalMaxMarks += questionWeight;
        const studentAns = submittedAnswers[idx];
        const qType = keyItem.type || 'mcq';
        let isCorrect = false;
        let awardedMarks = 0;
        let requiresManual = false;
        if (qType === 'short_answer' && (keyItem.ans === undefined && !keyItem.answer && !keyItem.answers)) {
            requiresManual = true;
            pendingManualCount++;
        }
        else if (studentAns !== undefined && studentAns !== null && studentAns !== '') {
            if (qType === 'mcq' || qType === 'diagram') {
                isCorrect = Number(studentAns) === Number(keyItem.ans);
            }
            else if (qType === 'true_false') {
                const normalize = (v) => {
                    if (typeof v === 'boolean')
                        return v ? 0 : 1;
                    const s = String(v ?? '').trim().toLowerCase();
                    if (['true', 't', 'yes', '0'].includes(s))
                        return 0;
                    return 1;
                };
                isCorrect = normalize(studentAns) === normalize(keyItem.ans);
            }
            else if (qType === 'fill_blank') {
                const expectedArr = Array.isArray(keyItem.answers)
                    ? keyItem.answers
                    : keyItem.answer ? [keyItem.answer] : [];
                const got = String(studentAns).trim().toLowerCase();
                isCorrect = expectedArr.some((expected) => got === String(expected ?? '').trim().toLowerCase());
            }
        }
        if (isCorrect) {
            awardedMarks = questionWeight;
            rawScore += awardedMarks;
        }
        breakdown.push({
            qIndex: idx,
            type: qType,
            awardedMarks,
            maxMarks: questionWeight,
            isCorrect,
            requiresManual
        });
    });
    // Calculate component scale
    const rawMax = totalMaxMarks > 0 ? totalMaxMarks : keys.length;
    const examType = examData.type || 'CA 1';
    let maxComponentMark = null;
    if (examType === 'CA 1')
        maxComponentMark = settings.ca1 || 20;
    else if (examType === 'CA 2')
        maxComponentMark = settings.ca2 || 20;
    else if (examType === 'Examination')
        maxComponentMark = settings.exam || 60;
    const scaledScore = maxComponentMark && rawMax > 0
        ? Math.round((rawScore / rawMax) * maxComponentMark)
        : null;
    const percentage = rawMax > 0 ? Math.round((rawScore / rawMax) * 100) : 0;
    const { grade, remark } = calculateGradeAndRemark(percentage, settings.grades);
    const nowIso = new Date().toISOString();
    const resultId = `res_${attemptId}`;
    const gradingStatus = pendingManualCount > 0 ? 'pending_manual' : 'final';
    const officialResult = {
        id: resultId,
        examId: examIdStr,
        studentId: attemptData.studentId,
        schoolId,
        subject: examData.subject || 'General',
        type: examType,
        raw: rawScore,
        rawMax,
        scaled: scaledScore,
        max: maxComponentMark,
        percentage,
        grade,
        remark,
        attempt: attemptData.attemptNumber || 1,
        attemptsAllowed: examData.attempts || 1,
        violations: data.violationsCount || attemptData.violationsCount || 0,
        gradingStatus,
        breakdown,
        submittedAt: nowIso,
        gradedAt: nowIso
    };
    // Atomic batch execution to update attempt status and store official result
    const batch = db.batch();
    batch.update(attemptRef, {
        status: 'submitted',
        submittedAt: nowIso,
        answers: submittedAnswers,
        violationsCount: officialResult.violations,
        updatedAt: nowIso
    });
    const resultRef = db.doc(`schools/${schoolId}/results/${resultId}`);
    batch.set(resultRef, officialResult, { merge: true });
    // Immutable audit log
    const auditRef = db.collection(`schools/${schoolId}/auditLogs`).doc();
    batch.set(auditRef, {
        id: auditRef.id,
        schoolId,
        actorId: caller.userId,
        actorRole: caller.role,
        action: 'EXAM_ATTEMPT_GRADED',
        targetType: 'result',
        targetId: resultId,
        timestamp: nowIso,
        details: {
            examId: examIdStr,
            studentId: attemptData.studentId,
            rawScore,
            rawMax,
            percentage,
            gradingStatus
        }
    });
    await batch.commit();
    return officialResult;
});
exports.getExamReview = (0, https_1.onCall)(async (request) => {
    const caller = resolveCaller(request);
    const data = request.data;
    if (!data?.schoolId || !data?.examId || !data?.attemptId) {
        throw new https_1.HttpsError('invalid-argument', 'Missing schoolId, examId, or attemptId.');
    }
    verifySchoolAccess(caller, data.schoolId);
    const schoolId = data.schoolId;
    const examIdStr = String(data.examId);
    const attemptId = data.attemptId;
    // Verify attempt ownership and completion
    const attemptSnap = await db.doc(`schools/${schoolId}/attempts/${attemptId}`).get();
    if (!attemptSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Attempt record not found.');
    }
    const attemptData = attemptSnap.data();
    if (caller.role !== 'admin' && caller.role !== 'teacher' && attemptData.studentId !== caller.userId) {
        throw new https_1.HttpsError('permission-denied', 'Cannot access review for another student attempt.');
    }
    if (attemptData.status !== 'submitted' && attemptData.status !== 'auto_submitted') {
        throw new https_1.HttpsError('failed-precondition', 'Cannot review exam answers while attempt is in progress.');
    }
    // Check review policy
    const examSnap = await db.doc(`schools/${schoolId}/exams/${examIdStr}`).get();
    const examData = examSnap.data() || {};
    if (caller.role === 'student' && examData.allowReview === false) {
        throw new https_1.HttpsError('permission-denied', 'Reviewing correct answers is disabled for this exam.');
    }
    // Read answer keys
    const keySnap = await db.doc(`schools/${schoolId}/examKeys/${examIdStr}`).get();
    const keys = keySnap.exists ? keySnap.data().keys || [] : [];
    const questions = examData.questions || [];
    const studentAnswers = attemptData.answers || {};
    const reviewItems = questions.map((q, idx) => {
        const keyItem = keys[idx] || {};
        const studentAns = studentAnswers[idx];
        let correctDisplay = '';
        const qType = q.type || 'mcq';
        if (qType === 'mcq' || qType === 'diagram') {
            const optIdx = Number(keyItem.ans);
            correctDisplay = q.options && q.options[optIdx] !== undefined ? q.options[optIdx] : String(optIdx);
        }
        else if (qType === 'true_false') {
            correctDisplay = Number(keyItem.ans) === 0 ? 'True' : 'False';
        }
        else if (qType === 'fill_blank') {
            correctDisplay = Array.isArray(keyItem.answers) ? keyItem.answers.join(' / ') : keyItem.answer || '';
        }
        return {
            qIndex: idx,
            q: q.q,
            type: qType,
            options: q.options || [],
            image: q.image || '',
            studentAnswer: studentAns ?? null,
            correctAnswer: correctDisplay
        };
    });
    return {
        examId: examIdStr,
        examTitle: examData.title || '',
        reviewItems
    };
});
exports.markAttemptQuestions = (0, https_1.onCall)(async (request) => {
    const caller = resolveCaller(request);
    const data = request.data;
    if (!data?.schoolId || !data?.resultId || !data?.marks) {
        throw new https_1.HttpsError('invalid-argument', 'Missing schoolId, resultId, or marks payload.');
    }
    // Privilege: Only Teachers or Admins
    if (caller.role !== 'teacher' && caller.role !== 'admin' && caller.role !== 'superadmin') {
        throw new https_1.HttpsError('permission-denied', 'Only teachers and administrators can award manual marks.');
    }
    verifySchoolAccess(caller, data.schoolId);
    const schoolId = data.schoolId;
    const resultRef = db.doc(`schools/${schoolId}/results/${data.resultId}`);
    const resultSnap = await resultRef.get();
    if (!resultSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Result document not found.');
    }
    const resultData = resultSnap.data();
    const breakdown = resultData.breakdown || [];
    let newRaw = 0;
    breakdown.forEach((item) => {
        if (data.marks[item.qIndex] !== undefined) {
            const awarded = Math.min(item.maxMarks, Math.max(0, Number(data.marks[item.qIndex]) || 0));
            item.awardedMarks = awarded;
            item.requiresManual = false;
        }
        newRaw += item.awardedMarks;
    });
    const rawMax = resultData.rawMax || breakdown.length;
    const maxComponentMark = resultData.max;
    const scaledScore = maxComponentMark && rawMax > 0
        ? Math.round((newRaw / rawMax) * maxComponentMark)
        : null;
    const percentage = rawMax > 0 ? Math.round((newRaw / rawMax) * 100) : 0;
    // Fetch settings for grades
    const settingsSnap = await db.doc(`schools/${schoolId}/settings/configuration`).get();
    const settings = settingsSnap.data() || {};
    const { grade, remark } = calculateGradeAndRemark(percentage, settings.grades);
    const nowIso = new Date().toISOString();
    await resultRef.update({
        raw: newRaw,
        scaled: scaledScore,
        percentage,
        grade,
        remark,
        gradingStatus: 'final',
        breakdown,
        teacherFeedback: data.feedback || '',
        finalizedBy: caller.userId,
        gradedAt: nowIso
    });
    // Audit log
    await db.collection(`schools/${schoolId}/auditLogs`).add({
        schoolId,
        actorId: caller.userId,
        actorRole: caller.role,
        action: 'MANUAL_MARKING_FINALIZED',
        targetType: 'result',
        targetId: data.resultId,
        timestamp: nowIso,
        details: { newRaw, percentage, grade }
    });
    return { success: true, raw: newRaw, percentage, grade, remark };
});
exports.createSchoolUser = (0, https_1.onCall)(async (request) => {
    const caller = resolveCaller(request);
    const data = request.data;
    if (!data?.schoolId || !data?.userId || !data?.name || !data?.role) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required user parameters.');
    }
    // Privilege check: Only School Admin of that school or Super Admin
    if (caller.role !== 'admin' && caller.role !== 'superadmin') {
        throw new https_1.HttpsError('permission-denied', 'Only school administrators can provision users.');
    }
    verifySchoolAccess(caller, data.schoolId);
    const cleanSchool = data.schoolId.trim().toLowerCase();
    const cleanId = data.userId.trim().toLowerCase();
    const email = `${cleanSchool}.${data.role}.${cleanId}@educore.internal`;
    const password = data.initialPassword || 'pass123';
    let fbUid = '';
    try {
        const userRecord = await auth.createUser({
            email,
            password,
            displayName: data.name
        });
        fbUid = userRecord.uid;
        // Set server-authoritative custom claims
        await auth.setCustomUserClaims(fbUid, {
            schoolId: cleanSchool,
            role: data.role,
            userId: cleanId,
            classes: data.classes || []
        });
    }
    catch (err) {
        if (err.code === 'auth/email-already-exists') {
            const existing = await auth.getUserByEmail(email);
            fbUid = existing.uid;
            await auth.setCustomUserClaims(fbUid, {
                schoolId: cleanSchool,
                role: data.role,
                userId: cleanId,
                classes: data.classes || []
            });
        }
        else {
            throw new https_1.HttpsError('internal', err.message || 'Failed to create Firebase Auth record.');
        }
    }
    const now = new Date().toISOString();
    // Write authoritative user profile
    await db.doc(`schools/${cleanSchool}/users/${cleanId}`).set({
        uid: fbUid,
        schoolId: cleanSchool,
        username: cleanId,
        name: data.name,
        email,
        role: data.role,
        classes: data.classes || [],
        status: 'active',
        createdAt: now,
        updatedAt: now
    }, { merge: true });
    // Entity specific roster insertion
    if (data.role === 'student') {
        await db.doc(`schools/${cleanSchool}/students/${cleanId}`).set({
            id: cleanId,
            schoolId: cleanSchool,
            name: data.name,
            class: (data.classes && data.classes[0]) || 'Primary 5',
            createdAt: now,
            updatedAt: now
        }, { merge: true });
    }
    else if (data.role === 'teacher') {
        await db.doc(`schools/${cleanSchool}/teachers/${cleanId}`).set({
            id: cleanId,
            schoolId: cleanSchool,
            name: data.name,
            subjects: data.subjects || ['Math'],
            classes: data.classes || ['Primary 5'],
            createdAt: now,
            updatedAt: now
        }, { merge: true });
    }
    return { success: true, uid: fbUid, email, userId: cleanId };
});
// ============================================================================
// 6. BACKGROUND TASK: AUTO-SUBMIT EXPIRED EXAMS (SCHEDULED EVERY 5 MINUTES)
// ============================================================================
exports.autoSubmitExpiredExams = (0, scheduler_1.onSchedule)('every 5 minutes', async (_event) => {
    const now = new Date().toISOString();
    // Query all active attempts across all schools that have exceeded expiryTime
    const expiredSnap = await db.collectionGroup('attempts')
        .where('status', '==', 'in_progress')
        .where('expiryTime', '<', now)
        .limit(50)
        .get();
    for (const docSnap of expiredSnap.docs) {
        const attempt = docSnap.data();
        const attemptId = docSnap.id;
        try {
            // Auto-finalize attempt
            await docSnap.ref.update({
                status: 'auto_submitted',
                submittedAt: now,
                updatedAt: now
            });
            console.info(`Auto-submitted expired attempt ${attemptId} for student ${attempt.studentId}`);
        }
        catch (err) {
            console.warn(`Failed to auto-submit attempt ${attemptId}:`, err);
        }
    }
});
//# sourceMappingURL=index.js.map