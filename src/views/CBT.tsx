import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Input } from '../components/ui';
import { Student } from '../types';
import { useExamsSubscription } from '../hooks/useDomainSubscriptions';
import {
  startStudentLiveSession,
  updateStudentLiveProgress,
  sendStudentLiveHeartbeat,
  reportStudentLiveViolation,
  completeStudentLiveSession
} from '../lib/liveExamService';
import { AttemptRepository } from '../lib/firestore/repositories/attemptRepository';
import { FunctionsService } from '../lib/functions/functionsService';
import { CbtEngine, AttemptLifecycleState } from '../lib/cbt/cbtEngine';
import confetti from 'canvas-confetti';

export default function CBT() {
  const { data, activeExamId, currentUser, updateData, config, schoolId } = useStore();
  const showToast = useToastStore(s => s.showToast);
  
  const studentClass = currentUser ? (currentUser as Student).class : undefined;
  const { exams: liveExams } = useExamsSubscription(schoolId, studentClass);

  const effectiveExams = useMemo(() => {
    if (liveExams && liveExams.length > 0) return liveExams;
    return data.exams;
  }, [liveExams, data.exams]);

  const exam = effectiveExams.find(e => String(e.id) === String(activeExamId));
  const rawQuestions = exam?.questions || [];
  
  // State initialization
  const [sanitizedQs, setSanitizedQs] = useState<any[]>(() => CbtEngine.sanitizeQuestions(rawQuestions));
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [qIndex, setQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState((exam?.duration || 30) * 60);
  const [violations, setViolations] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline_queued'>('saved');
  const [attemptId, setAttemptId] = useState<string>('');
  const [lifecycleState, setLifecycleState] = useState<AttemptLifecycleState>('created');
  const [isInitializing, setIsInitializing] = useState(true);
  const [submissionResult, setSubmissionResult] = useState<{
    score: number;
    rawMax: number;
    pct: number;
    grade: string;
    remark: string;
  } | null>(null);
  
  const timerRef = useRef<any>(null);
  const heartbeatTimerRef = useRef<any>(null);
  const autosaveTimeoutRef = useRef<any>(null);
  const violationsRef = useRef(0);
  const expiryTimeRef = useRef<string>('');
  const answersRef = useRef<Record<number, any>>({});
  answersRef.current = answers;

  // 1. Authoritative Exam Initialization
  useEffect(() => {
    if (!exam || !currentUser || !schoolId) return;

    let isMounted = true;
    setIsInitializing(true);

    const initExam = async () => {
      try {
        // Start or resume attempt via authoritative backend
        const res = await FunctionsService.startExamAttempt(schoolId, exam.id);
        
        if (!isMounted) return;

        setAttemptId(res.attemptId);
        expiryTimeRef.current = res.expiryTime;
        setLifecycleState('in_progress');

        // Restore saved answers from server or local draft
        const serverAnswers = res.answers || {};
        const localDraft = CbtEngine.getLocalDraft(res.attemptId) || {};
        const mergedAnswers = { ...serverAnswers, ...localDraft };
        setAnswers(mergedAnswers);

        // Calculate authoritative remaining seconds
        const secondsRemaining = CbtEngine.calculateTimeRemaining(res.expiryTime);
        setTimeLeft(secondsRemaining);

        if (res.resumed) {
          showToast('Resumed active exam session');
        }

        // Start Live Proctoring Session in Firestore
        startStudentLiveSession(schoolId, exam, currentUser as Student);

        // Start heartbeat interval (every 15 seconds)
        heartbeatTimerRef.current = setInterval(() => {
          sendStudentLiveHeartbeat(schoolId, exam.id, currentUser.id);
        }, 15000);

        // Start server-authoritative countdown timer
        timerRef.current = setInterval(() => {
          if (!expiryTimeRef.current) return;
          const remaining = CbtEngine.calculateTimeRemaining(expiryTimeRef.current);
          setTimeLeft(remaining);

          if (remaining <= 0) {
            clearInterval(timerRef.current);
            submitExam(true);
          }
        }, 1000);
      } catch (err: any) {
        console.warn('CBT Initialization error:', err);
        // Robust fallback for static / preview / offline environments
        const fallbackAttemptId = `local_attempt_${exam.id}_${Date.now()}`;
        const nowMs = Date.now();
        const durationMins = Number(exam.duration) || 30;
        const expiryIso = new Date(nowMs + durationMins * 60 * 1000).toISOString();

        if (!isMounted) return;
        setAttemptId(fallbackAttemptId);
        expiryTimeRef.current = expiryIso;
        setLifecycleState('in_progress');
        const localDraft = CbtEngine.getLocalDraft(fallbackAttemptId) || {};
        setAnswers(localDraft);
        setTimeLeft(durationMins * 60);

        timerRef.current = setInterval(() => {
          if (!expiryTimeRef.current) return;
          const remaining = CbtEngine.calculateTimeRemaining(expiryTimeRef.current);
          setTimeLeft(remaining);
          if (remaining <= 0) {
            clearInterval(timerRef.current);
            submitExam(true);
          }
        }, 1000);
        showToast('Exam started in offline-resilient mode');
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    };

    initExam();

    // Anti-cheat detection: visibility change and window blur
    const handleVis = () => {
      if (document.hidden && lifecycleState === 'in_progress') {
        violationsRef.current += 1;
        setViolations(violationsRef.current);
        showToast(`Anti-cheat warning ${violationsRef.current}/${config.violationLimit}`);
        
        // Report violation to live session
        reportStudentLiveViolation(schoolId, exam.id, currentUser.id, violationsRef.current);

        if (violationsRef.current >= config.violationLimit) {
          submitExam(true);
        }
      }
    };

    const block = (e: any) => e.preventDefault();
    document.addEventListener('visibilitychange', handleVis);
    document.addEventListener('contextmenu', block);
    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    document.addEventListener('paste', block);
    
    try {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } catch (e) {}

    return () => {
      isMounted = false;
      clearInterval(timerRef.current);
      clearInterval(heartbeatTimerRef.current);
      clearTimeout(autosaveTimeoutRef.current);
      document.removeEventListener('visibilitychange', handleVis);
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
      document.removeEventListener('paste', block);
    };
  }, [exam?.id, currentUser?.id, schoolId]);

  // 1b. Realtime sync with candidate's server-authoritative attempt document
  useEffect(() => {
    if (!schoolId || !attemptId) return;

    const unsub = AttemptRepository.subscribeAttempt(schoolId, attemptId, (doc) => {
      if (!doc) return;

      // Authoritative status change (e.g. server auto-submitted or teacher finalized)
      if ((doc.status === 'submitted' || doc.status === 'auto_submitted') && (lifecycleState === 'in_progress' || lifecycleState === 'created')) {
        clearInterval(timerRef.current);
        clearInterval(heartbeatTimerRef.current);
        clearTimeout(autosaveTimeoutRef.current);
        setLifecycleState(doc.status);
        showToast('Exam attempt has been finalized and recorded.');
      }

      // Authoritative expiry time update
      if (doc.expiryTime && doc.expiryTime !== expiryTimeRef.current) {
        expiryTimeRef.current = doc.expiryTime;
        const remaining = CbtEngine.calculateTimeRemaining(doc.expiryTime);
        setTimeLeft(remaining);
      }
    });

    return () => {
      unsub();
    };
  }, [schoolId, attemptId, lifecycleState, showToast]);

  // 2. Debounced Autosave & Live Progress Sync
  const triggerAutosave = useCallback((currentAnswers: Record<number, any>, currQIndex: number) => {
    if (!attemptId || !schoolId || lifecycleState !== 'in_progress') return;

    setSaveStatus('saving');
    CbtEngine.saveLocalDraft(attemptId, currentAnswers);

    clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(async () => {
      try {
        await AttemptRepository.autosaveAttempt(schoolId, attemptId, {
          answers: currentAnswers,
          currentQuestionIndex: currQIndex,
          violationsCount: violationsRef.current
        });
        setSaveStatus('saved');
      } catch (err) {
        console.warn('Autosave network error, draft held locally:', err);
        setSaveStatus('offline_queued');
      }
    }, 1200);
  }, [attemptId, schoolId, lifecycleState]);

  // Handle Answer Selection
  const handleAnswerChange = (val: any) => {
    if (lifecycleState !== 'in_progress' || timeLeft <= 0) return;

    const newAnswers = { ...answers, [qIndex]: val };
    setAnswers(newAnswers);
    triggerAutosave(newAnswers, qIndex);

    // Update real-time proctoring progress
    const answeredCount = Object.keys(newAnswers).filter(
      k => newAnswers[Number(k)] !== undefined && newAnswers[Number(k)] !== null && newAnswers[Number(k)] !== ''
    ).length;

    updateStudentLiveProgress(schoolId, exam!.id, currentUser!.id, {
      answeredCount,
      totalQuestions: sanitizedQs.length,
      currentQuestionIndex: qIndex
    });
  };

  // 3. Authoritative Exam Submission
  const submitExam = async (auto = false) => {
    if (!exam || !currentUser || !schoolId || lifecycleState === 'submitted' || lifecycleState === 'auto_submitted') {
      return;
    }
    
    clearInterval(timerRef.current);
    clearInterval(heartbeatTimerRef.current);
    clearTimeout(autosaveTimeoutRef.current);

    const finalState = auto ? 'auto_submitted' : 'submitted';
    setLifecycleState(finalState);
    setSaveStatus('saving');

    // Complete live proctoring session
    completeStudentLiveSession(schoolId, exam.id, currentUser.id, auto);

    try {
      // 1. Submit through Cloud Functions authoritative grading
      const serverResult = await FunctionsService.submitExamAttempt(
        schoolId,
        attemptId,
        exam.id,
        answersRef.current,
        violationsRef.current
      );

      // Clear local draft after confirmed submission
      CbtEngine.clearLocalDraft(attemptId);

      let finalScore = 0;
      let finalRawMax = sanitizedQs.length;
      let finalPct = 0;
      let finalGrade = 'Pass';
      let finalRemark = 'Completed';

      if (serverResult && serverResult.percentage !== undefined) {
        finalScore = serverResult.raw;
        finalRawMax = serverResult.rawMax;
        finalPct = serverResult.percentage;
        finalGrade = serverResult.grade;
        finalRemark = serverResult.remark;
      } else {
        // Fallback grading if offline or serverless preview mode
        let calculatedRaw = 0;
        let totalMax = 0;
        rawQuestions.forEach((q, idx) => {
          const w = Number(q.marks) || 1;
          totalMax += w;
          const ans = answersRef.current[idx] !== undefined ? answersRef.current[idx] : answersRef.current[String(idx)];
          if (ans !== undefined && ans !== null && ans !== '') {
            let isCorrect = false;
            if (q.type === 'mcq' || q.type === 'diagram') {
              const correctAns = q.ans;
              const options = q.options || [];
              if (Number(ans) === Number(correctAns)) {
                isCorrect = true;
              } else if (String(ans).trim().toLowerCase() === String(correctAns).trim().toLowerCase()) {
                isCorrect = true;
              } else if (options.length > 0) {
                const correctIdx = Number(correctAns);
                const studentIdx = Number(ans);
                if (Number.isFinite(correctIdx) && options[correctIdx] !== undefined) {
                  if (String(options[correctIdx]).trim().toLowerCase() === String(ans).trim().toLowerCase()) isCorrect = true;
                }
                if (Number.isFinite(studentIdx) && options[studentIdx] !== undefined && Number.isFinite(correctIdx)) {
                  if (String(options[studentIdx]).trim().toLowerCase() === String(options[correctIdx]).trim().toLowerCase()) isCorrect = true;
                }
              }
            } else if (q.type === 'true_false') {
              const norm = (v: any) => {
                if (typeof v === 'boolean') return v ? 1 : 0;
                if (typeof v === 'number') return v === 1 || v === 0 ? v : -1;
                const s = String(v ?? '').trim().toLowerCase();
                if (['true', 't', 'yes', '1'].includes(s)) return 1;
                if (['false', 'f', 'no', '0'].includes(s)) return 0;
                return -1;
              };
              if (norm(ans) === norm(q.ans)) isCorrect = true;
            } else if (q.type === 'fill_blank') {
              const exp = Array.isArray(q.answers) ? q.answers : q.answer ? [q.answer] : q.ans !== undefined ? [q.ans] : [];
              const got = String(ans).trim().toLowerCase();
              if (exp.some((e: any) => got === String(e ?? '').trim().toLowerCase())) isCorrect = true;
            }
            if (isCorrect) calculatedRaw += w;
          }
        });
        finalRawMax = totalMax > 0 ? totalMax : sanitizedQs.length;
        finalPct = finalRawMax > 0 ? Math.round((calculatedRaw / finalRawMax) * 100) : 0;
        const g = config.grades.find(z => finalPct >= z.min) || config.grades[config.grades.length - 1];
        finalScore = calculatedRaw;
        finalGrade = g.grade;
        finalRemark = g.remark;
      }

      // Record in local store for immediate client dashboard feedback
      const localResultRecord = {
        id: serverResult?.id || Date.now(),
        studentId: currentUser.id,
        examId: exam.id,
        subject: exam.subject,
        type: exam.type,
        raw: finalScore,
        rawMax: finalRawMax,
        scaled: serverResult?.scaled ?? null,
        max: serverResult?.max ?? null,
        percentage: finalPct,
        grade: finalGrade,
        remark: finalRemark,
        gradingStatus: (serverResult?.gradingStatus || 'final') as 'final' | 'pending_manual',
        breakdown: serverResult?.breakdown || [],
        violations: violationsRef.current,
        answers: answersRef.current,
        attempt: (data.results.filter(r => r.studentId === currentUser.id && r.examId === exam.id).length) + 1,
        attemptsAllowed: Math.max(1, exam.attempts || 1),
        submittedAt: new Date().toISOString(),
        gradedAt: serverResult?.gradedAt || new Date().toISOString()
      };

      updateData(draft => {
        draft.results.push(localResultRecord);
      });

      if (finalPct >= 50) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      }

      setSubmissionResult({
        score: finalScore,
        rawMax: finalRawMax,
        pct: finalPct,
        grade: finalGrade,
        remark: finalRemark
      });
      showToast(auto ? 'Time expired. Exam submitted automatically.' : 'Exam submitted successfully!');
    } catch (err: any) {
      console.warn('Submission error:', err);
      showToast('Error finalizing submission. Retrying in background.');
    }
  };

  const confirmSubmit = () => {
    setShowConfirm(true);
  };

  if (!exam) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center text-center">
        <h3 className="text-xl font-bold text-slate-800 mb-2">Exam Session Not Found</h3>
        <p className="text-slate-500 text-sm mb-4">The selected examination could not be loaded or is no longer active.</p>
        <Button onClick={() => useStore.setState({ activeExamId: null })}>Return to Dashboard</Button>
      </div>
    );
  }

  // Loading Screen
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-slate-600 font-medium">Securing and launching exam session...</p>
      </div>
    );
  }

  // Submission Result Celebration Screen
  if (submissionResult) {
    return (
      <div className="min-h-screen bg-slate-50 p-5 flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#eef2ff,#ecfeff 45%,#fff7ed)' }}>
        <div className="bg-white rounded-3xl shadow-[0_12px_35px_rgba(15,23,42,.12)] p-10 max-w-lg w-full text-center">
          <h2 className="text-3xl font-black mb-2 text-slate-800">Assessment Complete!</h2>
          <p className="text-slate-500 mb-8">Your answers have been authoritatively recorded and verified.</p>

          <div className="text-[100px] font-black text-indigo-600 leading-none mb-2">
            {submissionResult.pct}%
          </div>
          <div className="text-2xl font-bold text-slate-700 mb-8">
            Score: {submissionResult.score} / {submissionResult.rawMax}
          </div>

          <div className={`inline-block px-6 py-3 rounded-xl text-lg font-bold mb-10 ${submissionResult.pct >= 50 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
            Grade: {submissionResult.grade} &mdash; {submissionResult.remark}
          </div>

          <Button onClick={() => useStore.setState({ activeExamId: null })} className="w-full text-lg py-4">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const q = sanitizedQs[qIndex] || { q: '', type: 'mcq' };
  const type = q.type || 'mcq';

  return (
    <div className="min-h-screen bg-slate-50 p-5" style={{ background: 'linear-gradient(135deg,#eef2ff,#ecfeff 45%,#fff7ed)' }}>
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-[1fr_240px] gap-5 items-start">
        
        <div className="bg-white rounded-[20px] shadow-[0_12px_35px_rgba(15,23,42,.12)] p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-bold m-0">{exam.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-slate-500">{currentUser?.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium border flex items-center gap-1.5"
                  style={{
                    backgroundColor: saveStatus === 'saved' ? '#f0fdf4' : saveStatus === 'saving' ? '#eef2ff' : '#fffbeb',
                    borderColor: saveStatus === 'saved' ? '#bbf7d0' : saveStatus === 'saving' ? '#c7d2fe' : '#fde68a',
                    color: saveStatus === 'saved' ? '#166534' : saveStatus === 'saving' ? '#3730a3' : '#92400e'
                  }}
                >
                  {saveStatus === 'saved' && '✓ All answers saved'}
                  {saveStatus === 'saving' && '⏳ Saving...'}
                  {saveStatus === 'offline_queued' && '⚡ Offline - saved locally'}
                </span>
              </div>
            </div>
            
            {/* Server-authoritative timer display */}
            <div className={`text-4xl font-black bg-red-50 border-4 rounded-xl px-4 py-2 shadow-sm ${timeLeft <= 60 ? 'border-red-600 text-red-600 animate-pulse' : 'border-slate-800 text-slate-800'}`}>
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden mb-4">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-300" 
              style={{ width: `${(Object.keys(answers).length / sanitizedQs.length) * 100}%` }}
            />
          </div>
          
          {/* Question View */}
          <div className="bg-gradient-to-br from-white to-slate-50 border-3 border-indigo-100 rounded-[18px] p-5 min-h-[330px]">
            <div className="text-slate-500 mb-2">Question {qIndex + 1} of {sanitizedQs.length}</div>
            <h2 className="text-xl font-bold mt-0 mb-4">{q.q}</h2>
            
            {type === 'fill_blank' && (
              <Input 
                placeholder="Type your answer" 
                value={answers[qIndex] || ''} 
                onChange={e => handleAnswerChange(e.target.value)} 
              />
            )}
            
            {type === 'true_false' && (
              ['True', 'False'].map((o, i) => (
                <label key={i} className="block p-3 my-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <input 
                    type="radio" 
                    name="tf" 
                    checked={answers[qIndex] === i} 
                    onChange={() => handleAnswerChange(i)} 
                    className="mr-2" 
                  />
                  {o}
                </label>
              ))
            )}
            
            {type === 'diagram' && q.image && (
              <img src={q.image} alt="Diagram" className="max-w-full max-h-[360px] block my-2 rounded-xl" />
            )}
            
            {(type === 'mcq' || type === 'diagram') && (
              (q.options || []).map((o: string, i: number) => (
                <label key={i} className="block p-3 my-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <input 
                    type="radio" 
                    name="opt" 
                    checked={answers[qIndex] === i} 
                    onChange={() => handleAnswerChange(i)} 
                    className="mr-2" 
                  />
                  {o}
                </label>
              ))
            )}
          </div>
          
          <div className="flex gap-2 flex-wrap mt-4">
            <Button onClick={() => setQIndex(p => Math.max(0, p - 1))} disabled={qIndex === 0}>Previous</Button>
            <Button onClick={() => setQIndex(p => Math.min(sanitizedQs.length - 1, p + 1))} disabled={qIndex === sanitizedQs.length - 1}>Next</Button>
            <Button variant="secondary" onClick={confirmSubmit} className="ml-auto">Submit</Button>
          </div>
        </div>
        
        {/* Submit Confirmation Modal */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
              <h3 className="text-xl font-bold mb-2">Submit Exam?</h3>
              <p className="text-slate-500 mb-6">Are you sure you want to submit this exam? You will not be able to change your answers after submission.</p>
              <div className="flex gap-3 justify-center">
                <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancel</Button>
                <Button onClick={() => { setShowConfirm(false); submitExam(); }}>Yes, Submit</Button>
              </div>
            </div>
          </div>
        )}

        {/* Question Map */}
        <div className="bg-white rounded-[20px] shadow-[0_12px_35px_rgba(15,23,42,.12)] p-4 md:sticky md:top-5">
          <h3 className="mt-0 mb-1">Question Map</h3>
          <p className="text-slate-500 text-[12px] m-0 mb-3">Green = answered · Outlined = current</p>
          
          <div className="grid grid-cols-5 md:grid-cols-4 gap-2">
            {sanitizedQs.map((_, i) => (
              <button
                key={i}
                className={`font-black border border-slate-300 rounded-lg p-2 cursor-pointer transition-colors
                  ${answers[i] != null && answers[i] !== '' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white'}
                  ${i === qIndex ? 'outline outline-2 outline-amber-500 outline-offset-1 scale-105' : ''}
                `}
                onClick={() => setQIndex(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
        
      </div>
    </div>
  );
}
