import { useEffect, useState, useRef } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Card, Input } from '../components/ui';
import confetti from 'canvas-confetti';

export default function CBT() {
  const { data, activeExamId, currentUser, updateData, config } = useStore();
  const showToast = useToastStore(s => s.showToast);
  
  const exam = data.exams.find(e => e.id === activeExamId);
  const qs = exam?.questions || [];
  
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [qIndex, setQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState((exam?.duration || 30) * 60);
  const [violations, setViolations] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{score: number, rawMax: number, pct: number, grade: string, remark: string} | null>(null);
  
  const timerRef = useRef<any>(null);
  const violationsRef = useRef(0);
  
  useEffect(() => {
    if (!exam) return;
    
    // Start timer
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          submitExam(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Anti-cheat
    const handleVis = () => {
      if (document.hidden) {
        violationsRef.current += 1;
        setViolations(violationsRef.current);
        showToast(`Anti-cheat warning ${violationsRef.current}/${config.violationLimit}`);
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
      clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVis);
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
      document.removeEventListener('paste', block);
    };
  }, [exam]);

  const normalizeTF = (v: any) => {
    if (typeof v === 'boolean') return v ? 0 : 1;
    if (typeof v === 'number') return v === 0 ? 0 : 1;
    let x = String(v ?? '').trim().toLowerCase();
    if (['true', 't', 'yes', '1'].includes(x)) return 0;
    if (['false', 'f', 'no', '0'].includes(x)) return 1;
    return -1;
  };

  const answerIsCorrect = (q: any, a: any) => {
    let type = q.type || 'mcq';
    if (a === undefined || a === null) return false;
    if (type === 'fill_blank') {
      let expected = Array.isArray(q.answers) ? q.answers : q.answer;
      let vals = Array.isArray(expected) ? expected : [expected];
      let got = String(a).trim().toLowerCase();
      return vals.some(v => got === String(v ?? '').trim().toLowerCase());
    }
    if (type === 'true_false') return normalizeTF(a) === normalizeTF(q.ans);
    let expected = Number(q.ans);
    return Number.isFinite(expected) && Number(a) === expected;
  };

  const getComponentMax = (type: string) => {
    if (type === 'CA 1') return config.ca1;
    if (type === 'CA 2') return config.ca2;
    if (type === 'Examination') return config.exam;
    return null;
  };

  const submitExam = (auto = false) => {
    if (!exam || !currentUser) return;
    
    clearInterval(timerRef.current);
    const score = qs.reduce((total, q, i) => total + (answerIsCorrect(q, answers[i]) ? 1 : 0), 0);
    const rawMax = qs.length;
    const max = getComponentMax(exam.type);
    const scaled = max ? Math.round((score / rawMax) * max) : null;
    
    const usedAttempts = data.results.filter(r => r.studentId === currentUser.id && r.examId === exam.id).length;
    
    const result = {
      id: Date.now(),
      studentId: currentUser.id,
      examId: exam.id,
      subject: exam.subject,
      type: exam.type,
      raw: score,
      rawMax,
      scaled,
      max,
      violations: violationsRef.current,
      answers,
      attempt: usedAttempts + 1,
      attemptsAllowed: Math.max(1, exam.attempts || 1),
      submittedAt: new Date().toISOString()
    };
    
    updateData(draft => {
      draft.results.push(result);
    });
    
    const pct = rawMax > 0 ? Math.round((score / rawMax) * 100) : 0;
    const g = config.grades.find(z => pct >= z.min) || config.grades[config.grades.length - 1];

    if (pct >= 50) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }
    
    setSubmissionResult({ score, rawMax, pct, grade: g.grade, remark: g.remark });
    showToast(`Exam submitted successfully!`);
  };

  const confirmSubmit = () => {
    setShowConfirm(true);
  };

  if (!exam) return null;
  
  if (submissionResult) {
    return (
      <div className="min-h-screen bg-slate-50 p-5 flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#eef2ff,#ecfeff 45%,#fff7ed)' }}>
        <div className="bg-white rounded-3xl shadow-[0_12px_35px_rgba(15,23,42,.12)] p-10 max-w-lg w-full text-center">
          <h2 className="text-3xl font-black mb-2 text-slate-800">Assessment Complete!</h2>
          <p className="text-slate-500 mb-8">Your answers have been securely submitted and graded.</p>

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

  const q = qs[qIndex];
  const type = q.type || 'mcq';

  return (
    <div className="min-h-screen bg-slate-50 p-5" style={{ background: 'linear-gradient(135deg,#eef2ff,#ecfeff 45%,#fff7ed)' }}>
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-[1fr_240px] gap-5 items-start">
        
        <div className="bg-white rounded-[20px] shadow-[0_12px_35px_rgba(15,23,42,.12)] p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-bold m-0">{exam.title}</h2>
              <span className="text-slate-500 block">{currentUser?.name}</span>
            </div>
            <div className={`text-4xl font-black bg-red-50 border-4 rounded-xl px-4 py-2 shadow-sm ${timeLeft <= 60 ? 'border-red-600 text-red-600' : 'border-slate-800 text-slate-800'}`}>
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </div>
          </div>
          
          <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden mb-4">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all" 
              style={{ width: `${(Object.keys(answers).length / qs.length) * 100}%` }}
            />
          </div>
          
          <div className="bg-gradient-to-br from-white to-slate-50 border-3 border-indigo-100 rounded-[18px] p-5 min-h-[330px]">
            <div className="text-slate-500 mb-2">Question {qIndex + 1} of {qs.length}</div>
            <h2 className="text-xl font-bold mt-0 mb-4">{q.q}</h2>
            
            {type === 'fill_blank' && (
              <Input 
                placeholder="Type your answer" 
                value={answers[qIndex] || ''} 
                onChange={e => setAnswers(p => ({ ...p, [qIndex]: e.target.value }))} 
              />
            )}
            
            {type === 'true_false' && (
              ['True', 'False'].map((o, i) => (
                <label key={i} className="block p-3 my-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <input type="radio" name="tf" checked={answers[qIndex] === i} onChange={() => setAnswers(p => ({ ...p, [qIndex]: i }))} className="mr-2" />
                  {o}
                </label>
              ))
            )}
            
            {type === 'diagram' && q.image && (
              <img src={q.image} alt="Diagram" className="max-w-full max-h-[360px] block my-2 rounded-xl" />
            )}
            
            {(type === 'mcq' || type === 'diagram') && (
              (q.options || []).map((o, i) => (
                <label key={i} className="block p-3 my-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <input type="radio" name="opt" checked={answers[qIndex] === i} onChange={() => setAnswers(p => ({ ...p, [qIndex]: i }))} className="mr-2" />
                  {o}
                </label>
              ))
            )}
          </div>
          
          <div className="flex gap-2 flex-wrap mt-4">
            <Button onClick={() => setQIndex(p => Math.max(0, p - 1))} disabled={qIndex === 0}>Previous</Button>
            <Button onClick={() => setQIndex(p => Math.min(qs.length - 1, p + 1))} disabled={qIndex === qs.length - 1}>Next</Button>
            <Button variant="secondary" onClick={confirmSubmit} className="ml-auto">Submit</Button>
          </div>
        </div>
        
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

        <div className="bg-white rounded-[20px] shadow-[0_12px_35px_rgba(15,23,42,.12)] p-4 md:sticky md:top-5">
          <h3 className="mt-0 mb-1">Question Map</h3>
          <p className="text-slate-500 text-[12px] m-0 mb-3">Green = answered · Outlined = current</p>
          
          <div className="grid grid-cols-5 md:grid-cols-4 gap-2">
            {qs.map((_, i) => (
              <button
                key={i}
                className={`font-black border border-slate-300 rounded-lg p-2 cursor-pointer transition-colors
                  ${answers[i] != null ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white'}
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
