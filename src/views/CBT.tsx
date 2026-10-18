import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Input } from '../components/ui';
import { Student, Exam } from '../types';
import { useExamsSubscription } from '../hooks/useDomainSubscriptions';
import {
  startStudentLiveSession,
  updateStudentLiveProgress,
  sendStudentLiveHeartbeat,
  reportStudentLiveViolation,
  completeStudentLiveSession
} from '../lib/liveExamService';
import { AttemptRepository } from '../lib/firestore/repositories/attemptRepository';
import { ResultRepository } from '../lib/firestore/repositories/resultRepository';
import { FunctionsService } from '../lib/functions/functionsService';
import { CbtEngine, AttemptLifecycleState } from '../lib/cbt/cbtEngine';
import { evaluateAttempt, resolveAuthoritativeQuestions } from '../lib/scoringEngine';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { FirestorePaths } from '../lib/firestore/paths';
import confetti from 'canvas-confetti';

export default function CBT() {
  const { data, activeExamId, currentUser, updateData, config, schoolId } = useStore();
  const showToast = useToastStore(s => s.showToast);
  
  const studentClass = currentUser ? (currentUser as Student).class : undefined;
  const { exams: liveExams } = useExamsSubscription(schoolId, studentClass);

  const effectiveExams = useMemo(() => {
    const map = new Map<string, Exam>();
    // First load data.exams (which has full questions with answer keys)
    (data.exams || []).forEach(e => map.set(String(e.id), e));
    // Overlay liveExams, but preserve questions with answer keys if data.exams had them
    (liveExams || []).forEach(e => {
      const existing = map.get(String(e.id));
      if (existing && existing.questions && existing.questions.some(q => q.ans !== undefined || q.answer !== undefined)) {
        map.set(String(e.id), { ...e, questions: existing.questions } as Exam);
      } else {
        map.set(String(e.id), e as Exam);
      }
    });
    return Array.from(map.values());
  }, [liveExams, data.exams]);

  const exam = effectiveExams.find(e => String(e.id) === String(activeExamId));
  const rawQuestions = exam?.questions || [];
  
  // State initialization
  const [sanitizedQs, setSanitizedQs] = useState<any[]>(() => CbtEngine.sanitizeQuestions(rawQuestions));

  useEffect(() => {
    setSanitizedQs(CbtEngine.sanitizeQuestions(rawQuestions));
  }, [rawQuestions]);
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
        // Start or resume attempt via authoritative backend with real student metadata
        const res = await FunctionsService.startExamAttempt(
          schoolId,
          exam.id,
          currentUser.id,
          currentUser.name,
          (currentUser as Student).class,
          exam.duration
        );
        
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
      } catch (err: any) {
        console.warn('CBT Initialization error:', err);
        // Robust fallback for static / preview / offline environments
        const fallbackAttemptId = `attempt_${exam.id}_${currentUser.id}_${Date.now()}`;
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
        showToast('Exam started in offline-resilient mode');
      } finally {
        if (isMounted) {
          setIsInitializing(false);
          // GUARANTEED: Start Live Proctoring Session in Firestore regardless of Cloud Functions state
          startStudentLiveSession(schoolId, exam, currentUser as Student);

          // Start heartbeat interval (every 12 seconds)
          clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = setInterval(() => {
            sendStudentLiveHeartbeat(schoolId, exam.id, currentUser.id);
          }, 12000);

          // Start server-authoritative countdown timer
          clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            if (!expiryTimeRef.current) return;
            const remaining = CbtEngine.calculateTimeRemaining(expiryTimeRef.current);
            setTimeLeft(remaining);

            if (remaining <= 0) {
              clearInterval(timerRef.current);
              submitExam(true);
            }
          }, 1000);
        }
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
      if (document.fullscreenEnabled) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
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
      // 1. Resolve authoritative questions with true answer keys across store, Firestore examKeys, and bank
      const resolvedQuestions = await resolveAuthoritativeQuestions(
        exam.id,
        rawQuestions,
        data.exams,
        data.questions,
        schoolId
      );

      // 2. Authoritative local scoring
      const evaluated = evaluateAttempt(resolvedQuestions, answersRef.current, config, exam.type);

      // 3. Clear local draft after confirmed submission
      CbtEngine.clearLocalDraft(attemptId);

      // 4. Try Cloud Functions submission if deployed
      let serverResult: any = null;
      try {
        serverResult = await FunctionsService.submitExamAttempt(
          schoolId,
          attemptId,
          exam.id,
          answersRef.current,
          violationsRef.current
        );
      } catch (err) {
        console.info('Cloud Functions submission bypassed, using evaluated score:', err);
      }

      let finalScore = evaluated.rawScore;
      let finalRawMax = evaluated.rawMax > 0 ? evaluated.rawMax : sanitizedQs.length;
      let finalPct = evaluated.percentage;
      let finalGrade = evaluated.grade;
      let finalRemark = evaluated.remark;

      if (serverResult && serverResult.percentage !== undefined && serverResult.raw !== undefined) {
        // Only accept server result if it does NOT overwrite a verified positive evaluated score with 0
        if (!(evaluated.rawScore > 0 && Number(serverResult.raw) === 0)) {
          finalScore = serverResult.raw;
          finalRawMax = serverResult.rawMax || finalRawMax;
          finalPct = serverResult.percentage;
          finalGrade = serverResult.grade || finalGrade;
          finalRemark = serverResult.remark || finalRemark;
        }
      }

      // 5. Normalize type: if exam was AFL, map to 'CA 1' per institution policy
      const examTypeClean = String(exam.type || '').trim().toUpperCase();
      const normalizedType = examTypeClean === 'AFL' ? 'CA 1' : (exam.type || 'CA 1');

      // Update live proctoring session with final graded score
      completeStudentLiveSession(schoolId, exam.id, currentUser.id, auto, finalScore, finalPct);

      // Build official result record with full breakdown
      const localResultRecord = {
        id: serverResult?.id || `res_${exam.id}_${currentUser.id}_${Date.now()}`,
        studentId: currentUser.id,
        examId: exam.id,
        subject: exam.subject,
        type: normalizedType,
        raw: finalScore,
        rawMax: finalRawMax,
        scaled: serverResult?.scaled ?? evaluated.scaledScore,
        max: serverResult?.max ?? evaluated.maxComponentMark,
        percentage: finalPct,
        grade: finalGrade,
        remark: finalRemark,
        gradingStatus: (serverResult?.gradingStatus || evaluated.gradingStatus || 'final') as 'final' | 'pending_manual',
        breakdown: (serverResult?.breakdown && serverResult.breakdown.length > 0) ? serverResult.breakdown : evaluated.breakdown,
        violations: violationsRef.current,
        answers: { ...answersRef.current },
        attempt: (data.results.filter(r => r.studentId === currentUser.id && r.examId === exam.id).length) + 1,
        attemptsAllowed: Math.max(1, exam.attempts || 1),
        submittedAt: new Date().toISOString(),
        gradedAt: serverResult?.gradedAt || new Date().toISOString()
      };

      // 6. Record in local store for immediate client dashboard feedback
      updateData(draft => {
        const existingIdx = draft.results.findIndex(r => r.id === localResultRecord.id);
        if (existingIdx >= 0) {
          draft.results[existingIdx] = localResultRecord as any;
        } else {
          draft.results.push(localResultRecord as any);
        }
      });

      // 7. Persist to Firestore results collection
      if (schoolId) {
        await ResultRepository.recordGradedResult(schoolId, localResultRecord as any).catch(err => {
          console.warn('Could not persist result to Firestore:', err);
        });
      }

      // 8. Celebratory confetti animation ONLY on pass and score > 0! Never fire on 0 score.
      if (finalPct >= 50 && finalScore > 0) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      }

      // 9. Display authoritative score on completion screen
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

  // Loading Screen
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-slate-600 font-medium">Securing and launching exam session...</p>
      </div>
    );
  }

  if (!exam || sanitizedQs.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center text-center">
        <h3 className="text-xl font-bold text-slate-800 mb-2">
          {!exam ? 'Exam Session Not Found' : 'No Questions Found'}
        </h3>
        <p className="text-slate-500 text-sm mb-4">
          {!exam 
            ? 'The selected examination could not be loaded or is no longer active.' 
            : 'This examination does not have any questions configured yet. Please contact your teacher.'}
        </p>
        <Button onClick={() => useStore.setState({ activeExamId: null })}>Return to Dashboard</Button>
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
            <div className={`text-2xl sm:text-4xl font-black bg-red-50 border-2 sm:border-4 rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 shadow-sm shrink-0 ${timeLeft <= 60 ? 'border-red-600 text-red-600 animate-pulse' : 'border-slate-800 text-slate-800'}`}>
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
              [
                { label: 'True', val: true, altVal: 0 },
                { label: 'False', val: false, altVal: 1 }
              ].map((opt) => {
                const currentAns = answers[qIndex];
                const isChecked = currentAns === opt.val ||
                  currentAns === opt.altVal ||
                  String(currentAns).trim().toLowerCase() === opt.label.toLowerCase() ||
                  (opt.val === true && ['true', 't', 'yes'].includes(String(currentAns).trim().toLowerCase())) ||
                  (opt.val === false && ['false', 'f', 'no'].includes(String(currentAns).trim().toLowerCase()));

                return (
                  <label key={opt.label} className="block p-3 my-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input 
                      type="radio" 
                      name="tf" 
                      checked={isChecked} 
                      onChange={() => handleAnswerChange(opt.val)} 
                      className="mr-2" 
                    />
                    {opt.label}
                  </label>
                );
              })
            )}
            
            {q.image && (
              <div className="my-3">
                <img 
                  src={q.image} 
                  alt="Reference diagram / question visual" 
                  className="max-w-full max-h-[360px] object-contain block rounded-xl border border-slate-200 shadow-xs bg-white" 
                />
              </div>
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
