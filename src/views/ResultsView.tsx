import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Modal, Textarea, Input } from '../components/ui';
import { isStudentInTeacherClasses } from '../lib/classUtils';
import { FunctionsService } from '../lib/functions/functionsService';
import { ResultRepository } from '../lib/firestore/repositories/resultRepository';
import { useStudentResultsSubscription } from '../hooks/useDomainSubscriptions';
import { CheckCircle2, Clock, Award, AlertCircle, FileText } from 'lucide-react';

function normalizeTF(v: any) {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return v === 1 || v === 0 ? v : -1;
  const x = String(v ?? '').trim().toLowerCase();
  if (['true', 't', 'yes', '1'].includes(x)) return 1;
  if (['false', 'f', 'no', '0'].includes(x)) return 0;
  return -1;
}

function answerIsCorrect(q: any, a: any) {
  const type = q.type || 'mcq';
  if (a === undefined || a === null || a === '') return false;
  if (type === 'fill_blank') {
    const expected = Array.isArray(q.answers) ? q.answers : q.answer ? [q.answer] : q.ans !== undefined ? [q.ans] : [];
    const got = String(a).trim().toLowerCase();
    return expected.some((v: any) => got === String(v ?? '').trim().toLowerCase());
  }
  if (type === 'true_false') {
    return normalizeTF(a) === normalizeTF(q.ans);
  }
  if (type === 'mcq' || type === 'diagram') {
    const correctAns = q.ans;
    const options = q.options || [];
    if (Number(a) === Number(correctAns)) return true;
    if (String(a).trim().toLowerCase() === String(correctAns).trim().toLowerCase()) return true;
    if (options.length > 0) {
      const correctIdx = Number(correctAns);
      const studentIdx = Number(a);
      if (Number.isFinite(correctIdx) && options[correctIdx] !== undefined) {
        if (String(options[correctIdx]).trim().toLowerCase() === String(a).trim().toLowerCase()) return true;
      }
      if (Number.isFinite(studentIdx) && options[studentIdx] !== undefined && Number.isFinite(correctIdx)) {
        if (String(options[studentIdx]).trim().toLowerCase() === String(options[correctIdx]).trim().toLowerCase()) return true;
      }
    }
    return false;
  }
  const expected = Number(q.ans);
  return Number.isFinite(expected) && Number(a) === expected;
}

export default function ResultsView({ studentOnly = false }: { studentOnly?: boolean }) {
  const { data, currentUser, currentRole, schoolId, config, updateData } = useStore();
  const showToast = useToastStore(s => s.showToast);
  
  const [reviewResult, setReviewResult] = useState<any>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [isSubmittingMarks, setIsSubmittingMarks] = useState(false);
  const [manualMarks, setManualMarks] = useState<Record<number, number>>({});
  const [teacherFeedback, setTeacherFeedback] = useState('');

  const isStaff = currentRole === 'teacher' || currentRole === 'admin' || currentRole === 'superadmin';

  const teacher = currentRole === 'teacher' 
    ? data.teachers.find(t => (t.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase()) || (currentUser as any)
    : null;
  const teacherClasses = teacher?.classes || [];

  // Live Firestore subscription for students to see newly released grades in real time
  const isStudent = studentOnly || currentRole === 'student';
  const { results: liveStudentResults } = useStudentResultsSubscription(
    schoolId,
    isStudent ? currentUser?.id : null
  );

  const rs = useMemo(() => {
    let list = data.results;
    if (isStudent) {
      if (liveStudentResults && liveStudentResults.length > 0) {
        return liveStudentResults as any[];
      }
      return list.filter(r => r.studentId === currentUser?.id);
    } else if (currentRole === 'teacher') {
      return list.filter(r => {
        const student = data.students.find(s => s.id === r.studentId);
        return student && isStudentInTeacherClasses(student.class, teacherClasses);
      });
    }
    return list;
  }, [data.results, isStudent, liveStudentResults, currentUser?.id, currentRole, data.students, teacherClasses]);

  const openReview = async (r: any) => {
    setIsLoadingReview(true);
    setManualMarks({});
    setTeacherFeedback(r.teacherFeedback || '');

    const attemptId = `attempt_${r.examId}_${r.studentId}_${r.attempt || 1}`;
    const exam = data.exams.find(x => String(x.id) === String(r.examId));

    try {
      // 1. Try authoritative Cloud Function review first
      let reviewData = null;
      if (schoolId) {
        reviewData = await FunctionsService.getExamReview(schoolId, r.examId, attemptId);
      }

      if (reviewData && Array.isArray(reviewData.reviewItems) && reviewData.reviewItems.length > 0) {
        const initialMarks: Record<number, number> = {};
        if (Array.isArray(r.breakdown)) {
          r.breakdown.forEach((b: any) => {
            initialMarks[b.qIndex] = b.awardedMarks;
          });
        }

        setManualMarks(initialMarks);
        setReviewResult({
          resultRecord: r,
          examTitle: reviewData.examTitle || exam?.title || r.subject,
          items: reviewData.reviewItems,
          score: r.raw,
          rawMax: r.rawMax,
          percentage: r.percentage ?? (r.rawMax > 0 ? Math.round((r.raw / r.rawMax) * 100) : 0),
          grade: r.grade,
          remark: r.remark,
          gradingStatus: r.gradingStatus || 'final',
          teacherFeedback: r.teacherFeedback || '',
          isAuthoritative: true
        });
      } else {
        // 2. Graceful fallback for local offline demo preview
        if (!exam) {
          showToast('Assessment details are not available');
          setIsLoadingReview(false);
          return;
        }

        const questions = exam.questions || [];
        const studentAnswers = r.answers || {};
        const initialMarks: Record<number, number> = {};

        const items = questions.map((q: any, idx: number) => {
          const ans = studentAnswers[idx];
          const ok = answerIsCorrect(q, ans);
          const qType = q.type || 'mcq';
          const maxMarks = Number(q.marks) || 1;

          let correctDisplay = '';
          if (qType === 'fill_blank') {
            correctDisplay = Array.isArray(q.answers) ? q.answers.join(' / ') : q.answer || '';
          } else if (qType === 'true_false') {
            correctDisplay = normalizeTF(q.ans) === 0 ? 'True' : 'False';
          } else if (qType === 'diagram' || qType === 'mcq') {
            correctDisplay = q.options?.[q.ans] ?? String(q.ans ?? '');
          } else {
            correctDisplay = q.answer || 'Subjective Evaluation';
          }

          let studentDisplay = 'No answer';
          if (ans !== undefined && ans !== null && ans !== '') {
            if (qType === 'true_false') {
              studentDisplay = normalizeTF(ans) === 0 ? 'True' : 'False';
            } else if (qType === 'mcq' || qType === 'diagram') {
              studentDisplay = q.options?.[ans] ?? String(ans);
            } else {
              studentDisplay = String(ans);
            }
          }

          const awarded = ok ? maxMarks : 0;
          initialMarks[idx] = awarded;

          return {
            qIndex: idx,
            q: q.q,
            type: qType,
            options: q.options || [],
            image: q.image || '',
            studentAnswer: studentDisplay,
            correctAnswer: correctDisplay,
            maxMarks,
            awardedMarks: awarded,
            isCorrect: ok
          };
        });

        setManualMarks(initialMarks);
        setReviewResult({
          resultRecord: r,
          examTitle: exam.title,
          items,
          score: r.raw,
          rawMax: r.rawMax,
          percentage: r.percentage ?? (r.rawMax > 0 ? Math.round((r.raw / r.rawMax) * 100) : 0),
          grade: r.grade,
          remark: r.remark,
          gradingStatus: r.gradingStatus || 'final',
          teacherFeedback: r.teacherFeedback || '',
          isAuthoritative: false
        });
      }
    } catch (err: any) {
      console.warn('Error opening review:', err);
      showToast('Could not load answer review');
    } finally {
      setIsLoadingReview(false);
    }
  };

  const handleFinalizeMarks = async () => {
    if (!reviewResult || !reviewResult.resultRecord) return;
    const r = reviewResult.resultRecord;

    setIsSubmittingMarks(true);
    try {
      let updatedRaw = 0;
      let totalRawMax = reviewResult.rawMax || reviewResult.items.length;

      reviewResult.items.forEach((item: any, idx: number) => {
        const awarded = Math.min(item.maxMarks || 1, Math.max(0, Number(manualMarks[idx] ?? item.awardedMarks ?? 0)));
        updatedRaw += awarded;
      });

      const pct = totalRawMax > 0 ? Math.round((updatedRaw / totalRawMax) * 100) : 0;
      const matchedGrade = config.grades.find(g => pct >= g.min) || config.grades[config.grades.length - 1];

      let maxComponent = r.max;
      if (!maxComponent) {
        if (r.type === 'CA 1') maxComponent = config.ca1 || 20;
        else if (r.type === 'CA 2') maxComponent = config.ca2 || 20;
        else if (r.type === 'Examination') maxComponent = config.exam || 60;
      }

      const scaledScore = maxComponent && totalRawMax > 0
        ? Math.round((updatedRaw / totalRawMax) * maxComponent)
        : null;

      // 1. Invoke authoritative Cloud Function if connected
      if (schoolId) {
        await FunctionsService.markAttemptQuestions(
          schoolId,
          String(r.id),
          manualMarks,
          teacherFeedback
        );
      }

      // 2. Update local application state and store
      updateData(draft => {
        const target = draft.results.find(x => String(x.id) === String(r.id));
        if (target) {
          target.raw = updatedRaw;
          target.scaled = scaledScore;
          target.percentage = pct;
          target.grade = matchedGrade.grade;
          target.remark = matchedGrade.remark;
          target.gradingStatus = 'final';
          target.teacherFeedback = teacherFeedback;
          target.finalizedBy = currentUser?.name || currentUser?.id;
          target.gradedAt = new Date().toISOString();
        }
      });

      // 3. Persist to Firestore result document
      if (schoolId) {
        await ResultRepository.recordGradedResult(schoolId, {
          id: String(r.id),
          examId: String(r.examId),
          studentId: r.studentId,
          schoolId,
          subject: r.subject,
          type: r.type,
          raw: updatedRaw,
          rawMax: totalRawMax,
          scaled: scaledScore,
          max: maxComponent,
          percentage: pct,
          grade: matchedGrade.grade,
          remark: matchedGrade.remark,
          gradingStatus: 'final',
          teacherFeedback,
          finalizedBy: currentUser?.name || currentUser?.id,
          attempt: r.attempt || 1,
          attemptsAllowed: r.attemptsAllowed || 1,
          violations: r.violations || 0,
          submittedAt: r.submittedAt,
          gradedAt: new Date().toISOString()
        });
      }

      showToast('Official result finalized and saved successfully');
      setReviewResult(null);
    } catch (err: any) {
      console.warn('Error saving teacher marks:', err);
      showToast(err.message || 'Error saving marks');
    } finally {
      setIsSubmittingMarks(false);
    }
  };

  return (
    <>
      <div className="overflow-x-auto bg-white rounded-lg shadow border border-slate-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th className="p-3 font-semibold">Student</th>
              <th className="p-3 font-semibold">Class</th>
              <th className="p-3 font-semibold">Subject</th>
              <th className="p-3 font-semibold">Type</th>
              <th className="p-3 font-semibold">Raw Score</th>
              <th className="p-3 font-semibold">Official Mark</th>
              <th className="p-3 font-semibold">Grade</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold">Attempt</th>
              <th className="p-3 font-semibold">Date</th>
              <th className="p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rs.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-500">
                  No assessment results recorded yet.
                </td>
              </tr>
            ) : (
              rs.map(r => {
                const s = data.students.find(x => x.id === r.studentId);
                const pct = r.percentage ?? (r.rawMax > 0 ? Math.round((r.raw / r.rawMax) * 100) : 0);
                const isPendingManual = r.gradingStatus === 'pending_manual';

                return (
                  <tr key={r.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-medium text-slate-800">{s ? s.name : r.studentId}</td>
                    <td className="p-3 text-slate-600">{s?.class || '—'}</td>
                    <td className="p-3 font-medium">{r.subject}</td>
                    <td className="p-3 text-slate-600">{r.type}</td>
                    <td className="p-3 font-semibold text-slate-700">{r.raw} / {r.rawMax}</td>
                    <td className="p-3 font-bold text-indigo-700">
                      {r.max ? `${r.scaled} / ${r.max}` : `${pct}%`}
                    </td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        pct >= 70 ? 'bg-emerald-100 text-emerald-800' :
                        pct >= 50 ? 'bg-blue-100 text-blue-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {r.grade || '—'}
                      </span>
                    </td>
                    <td className="p-3">
                      {isPendingManual ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
                          <Clock className="w-3 h-3" /> Pending Marking
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3" /> Official
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600">{r.attempt || 1} / {r.attemptsAllowed || 1}</td>
                    <td className="p-3 text-slate-500 text-xs">{new Date(r.submittedAt).toLocaleDateString()}</td>
                    <td className="p-3">
                      {r.answers ? (
                        <Button
                          variant={isStaff && isPendingManual ? 'primary' : 'secondary'}
                          onClick={() => openReview(r)}
                          disabled={isLoadingReview}
                          className="text-xs py-1.5 px-3 flex items-center gap-1.5"
                        >
                          {isStaff ? (isPendingManual ? 'Grade / Mark' : 'Review & Mark') : 'Review Answers'}
                        </Button>
                      ) : (
                        <span className="text-slate-400 text-xs">No answers</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Authoritative Answer Review & Manual Marking Modal */}
      <Modal isOpen={!!reviewResult} onClose={() => setReviewResult(null)}>
        {reviewResult && (
          <div className="max-w-3xl w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-200 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold m-0 text-slate-900">{reviewResult.examTitle}</h2>
                  {reviewResult.gradingStatus === 'pending_manual' ? (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
                      Pending Manual Marking
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Official Finalized
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-xs m-0">
                  Candidate ID: <span className="font-semibold text-slate-700">{reviewResult.resultRecord?.studentId}</span> · Submitted: {new Date(reviewResult.resultRecord?.submittedAt).toLocaleString()}
                </p>
              </div>

              <div className="text-right bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="text-2xl font-black text-indigo-700 leading-tight">
                  {reviewResult.percentage}%
                </div>
                <div className="text-xs font-semibold text-slate-600">
                  Raw: {reviewResult.score} / {reviewResult.rawMax} · Grade: {reviewResult.grade || '—'}
                </div>
              </div>
            </div>

            {/* Questions Review & Marking List */}
            <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-4 mb-4">
              {reviewResult.items.map((qItem: any, idx: number) => {
                const maxMarks = qItem.maxMarks || 1;
                const awarded = manualMarks[idx] !== undefined ? manualMarks[idx] : (qItem.awardedMarks ?? 0);
                const isCorrect = qItem.isCorrect ?? (awarded >= maxMarks);

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border-2 transition-colors ${
                      isCorrect
                        ? 'bg-emerald-50/60 border-emerald-400'
                        : 'bg-rose-50/60 border-rose-400'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="font-bold text-slate-900 text-sm">
                        Question {idx + 1}: {qItem.q}
                      </div>
                      <span className="shrink-0 text-xs px-2 py-0.5 bg-white border rounded font-semibold text-slate-600">
                        Max: {maxMarks} {maxMarks === 1 ? 'mark' : 'marks'}
                      </span>
                    </div>

                    {qItem.image && (
                      <img
                        src={qItem.image}
                        alt="Diagram question asset"
                        className="max-w-full max-h-[200px] object-contain rounded-lg border border-slate-200 my-2"
                      />
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mt-3 pt-2 border-t border-slate-200/60">
                      <div className="bg-white/80 p-2 rounded border border-slate-200">
                        <span className="font-semibold text-slate-500 block mb-0.5">Candidate's Answer:</span>
                        <span className="font-bold text-slate-800">{String(qItem.studentAnswer || 'No response recorded')}</span>
                      </div>
                      <div className="bg-white/80 p-2 rounded border border-slate-200">
                        <span className="font-semibold text-slate-500 block mb-0.5">Correct Answer Key:</span>
                        <span className="font-bold text-emerald-700">{String(qItem.correctAnswer || 'Subjective / Evaluated')}</span>
                      </div>
                    </div>

                    {/* Teacher / Admin Manual Scoring Controls */}
                    {isStaff && (
                      <div className="mt-3 pt-2 border-t border-slate-200/80 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">Awarded Marks:</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max={maxMarks}
                            value={awarded}
                            onChange={(e) => {
                              const val = Math.min(maxMarks, Math.max(0, Number(e.target.value) || 0));
                              setManualMarks(prev => ({ ...prev, [idx]: val }));
                            }}
                            className="w-20 text-center py-1 text-sm font-bold bg-white"
                          />
                          <span className="text-xs text-slate-500">/ {maxMarks}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Teacher Feedback Section */}
            {isStaff ? (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Teacher Notes & Feedback for Candidate:
                </label>
                <Textarea
                  value={teacherFeedback}
                  onChange={(e) => setTeacherFeedback(e.target.value)}
                  placeholder="Provide constructive academic feedback or explain manual marking..."
                  rows={2}
                  className="bg-white text-sm"
                />
              </div>
            ) : (
              reviewResult.teacherFeedback && (
                <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-200 mb-4 text-xs">
                  <div className="font-bold text-indigo-900 mb-0.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" /> Teacher Feedback:
                  </div>
                  <p className="text-indigo-800 m-0">{reviewResult.teacherFeedback}</p>
                </div>
              )
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setReviewResult(null)}>
                Close
              </Button>
              {isStaff && (
                <Button
                  onClick={handleFinalizeMarks}
                  disabled={isSubmittingMarks}
                  className="flex items-center gap-1.5"
                >
                  <Award className="w-4 h-4" />
                  {isSubmittingMarks ? 'Finalizing Marks...' : 'Finalize & Save Official Grade'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
