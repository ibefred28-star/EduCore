import { useState } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Modal } from '../components/ui';
import { isStudentInTeacherClasses } from '../lib/classUtils';

function normalizeTF(v: any) {
  if (typeof v === 'boolean') return v ? 0 : 1;
  if (typeof v === 'number') return v === 0 ? 0 : 1;
  let x = String(v ?? '').trim().toLowerCase();
  if (['true', 't', 'yes', '1'].includes(x)) return 0;
  if (['false', 'f', 'no', '0'].includes(x)) return 1;
  return -1;
}

function answerIsCorrect(q: any, a: any) {
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
}

export default function ResultsView({ studentOnly = false }: { studentOnly?: boolean }) {
  const { data, currentUser, currentRole } = useStore();
  const showToast = useToastStore(s => s.showToast);
  
  const [reviewResult, setReviewResult] = useState<any>(null);

  const teacher = currentRole === 'teacher' 
    ? data.teachers.find(t => (t.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase()) || (currentUser as any)
    : null;
  const teacherClasses = teacher?.classes || [];

  let rs = data.results;
  if (studentOnly || currentRole === 'student') {
    rs = data.results.filter(r => r.studentId === currentUser?.id);
  } else if (currentRole === 'teacher') {
    rs = data.results.filter(r => {
      const student = data.students.find(s => s.id === r.studentId);
      return student && isStudentInTeacherClasses(student.class, teacherClasses);
    });
  }

  const openReview = (r: any) => {
    if (!r.answers) return showToast('Answer review is not available for this result');
    const e = data.exams.find(x => String(x.id) === String(r.examId));
    if (!e) return showToast('Original assessment is no longer available');
    setReviewResult({ exam: e, answers: r.answers, score: r.raw });
  };

  return (
    <>
      <div className="overflow-x-auto bg-white rounded-lg shadow border border-slate-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th className="p-3 font-semibold">Student</th>
              <th className="p-3 font-semibold">Subject</th>
              <th className="p-3 font-semibold">Type</th>
              <th className="p-3 font-semibold">Raw</th>
              <th className="p-3 font-semibold">Official Score</th>
              <th className="p-3 font-semibold">Attempt</th>
              <th className="p-3 font-semibold">Date</th>
              <th className="p-3 font-semibold">Review</th>
            </tr>
          </thead>
          <tbody>
            {rs.map(r => {
              const s = data.students.find(x => x.id === r.studentId);
              return (
                <tr key={r.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                  <td className="p-3">{s ? s.name : r.studentId}</td>
                  <td className="p-3">{r.subject}</td>
                  <td className="p-3">{r.type}</td>
                  <td className="p-3">{r.raw}/{r.rawMax}</td>
                  <td className="p-3">{r.max ? r.scaled + '/' + r.max : (r.rawMax > 0 ? Math.round((r.raw/r.rawMax)*100) + '%' : '—')}</td>
                  <td className="p-3">{r.attempt || 1}/{r.attemptsAllowed || 1}</td>
                  <td className="p-3">{new Date(r.submittedAt).toLocaleString()}</td>
                  <td className="p-3">
                    {studentOnly && r.answers ? (
                      <Button onClick={() => openReview(r)}>Review</Button>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!reviewResult} onClose={() => setReviewResult(null)}>
        {reviewResult && (
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold m-0">Answer Review</h2>
                <p className="text-slate-500 m-0">{reviewResult.exam.title}</p>
              </div>
              <div className="text-2xl font-black">
                {reviewResult.score}/{reviewResult.exam.questions.length} · {Math.round(reviewResult.score / reviewResult.exam.questions.length * 100)}%
              </div>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto mb-4 space-y-3">
              {reviewResult.exam.questions.map((q: any, i: number) => {
                const ans = reviewResult.answers[i];
                const ok = answerIsCorrect(q, ans);
                const type = q.type || 'mcq';
                
                const correct = type === 'fill_blank' 
                  ? (Array.isArray(q.answers) ? q.answers.join(' / ') : q.answer)
                  : (type === 'true_false' ? (normalizeTF(q.ans) === 0 ? 'True' : 'False') : (q.options?.[q.ans] ?? ''));
                  
                const yours = type === 'fill_blank' 
                  ? (ans ?? 'No answer') 
                  : (type === 'true_false' ? (ans == null ? 'No answer' : normalizeTF(ans) === 0 ? 'True' : 'False') : (ans == null ? 'No answer' : q.options?.[ans] ?? 'No answer'));

                return (
                  <div key={i} className={`p-3 border-2 rounded-xl ${ok ? 'bg-emerald-50 border-emerald-500' : 'bg-red-50 border-red-500'}`}>
                    <div className="font-bold mb-1">Question {i + 1}: {q.q}</div>
                    {type === 'diagram' && q.image && (
                      <img src={q.image} alt="diagram" className="max-w-full max-h-[220px] my-2 rounded-lg" />
                    )}
                    <div>Your answer: <span className="font-bold">{yours}</span></div>
                    <div>Correct answer: <span className="font-bold">{correct}</span></div>
                    <div className="font-bold mt-1">{ok ? '✓ Correct' : '✗ Incorrect'}</div>
                  </div>
                );
              })}
            </div>
            
            <Button onClick={() => setReviewResult(null)}>Close Review</Button>
          </div>
        )}
      </Modal>
    </>
  );
}
