import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Card } from '../components/ui';
import { Student, Exam } from '../types';
import { useExamsSubscription, useStudentResultsSubscription } from '../hooks/useDomainSubscriptions';
import { CheckCircle2, Clock, BookOpen, AlertCircle } from 'lucide-react';

export default function MyExams() {
  const { data, currentUser, schoolId } = useStore();
  const showToast = useToastStore(s => s.showToast);

  const studentClass = currentUser ? (currentUser as Student).class : '';

  // Real-time Firestore subscription for exams
  const { exams: liveExams } = useExamsSubscription(schoolId, studentClass);
  // Real-time Firestore subscription for student's official results
  const { results: liveResults } = useStudentResultsSubscription(schoolId, currentUser?.id);

  // Fallback to store data if offline or before Firestore populates
  const effectiveResults = useMemo(() => {
    if (liveResults && liveResults.length > 0) return liveResults;
    return data.results.filter(r => r.studentId === currentUser?.id);
  }, [liveResults, data.results, currentUser?.id]);

  const effectiveExams = useMemo(() => {
    if (liveExams && liveExams.length > 0) return liveExams;
    return data.exams;
  }, [liveExams, data.exams]);

  const getAttemptCount = (id: string | number) => {
    return effectiveResults.filter(r => String(r.examId) === String(id)).length;
  };

  // Categorize active exams for this student's class
  const activeExams = useMemo(() => {
    return effectiveExams.filter(e => {
      if (e.status !== 'active') return false;
      // If targetClasses is specified, check inclusion (allow if empty/undefined or includes studentClass)
      if (e.targetClasses && e.targetClasses.length > 0 && studentClass) {
        if (!e.targetClasses.includes(studentClass)) return false;
      }
      return true;
    });
  }, [effectiveExams, studentClass]);

  const availableExams = activeExams.filter(e => {
    const maxAttempts = Math.max(1, (e as any).attempts || 1);
    return getAttemptCount(e.id) < maxAttempts;
  });

  const completedExams = activeExams.filter(e => {
    const maxAttempts = Math.max(1, (e as any).attempts || 1);
    return getAttemptCount(e.id) >= maxAttempts;
  });

  const [activeTab, setActiveTab] = useState<'available' | 'completed'>('available');

  const startExam = (id: string | number) => {
    useStore.setState({ activeExamId: id });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 m-0">My Examinations & Quizzes</h2>
            <p className="text-slate-500 text-sm mt-1 mb-0">
              Complete active assessments assigned to your class ({studentClass || 'General'}).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full border border-indigo-200">
              {activeExams.length} Total Active Exams
            </span>
          </div>
        </div>

        {/* Tabs for Available vs Completed */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('available')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'available'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" /> Available to Take ({availableExams.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'completed'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" /> Completed / Submitted ({completedExams.length})
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'available' ? (
        availableExams.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-slate-200 shadow-sm">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-700">No Available Exams</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto mt-1">
              You have completed all active exams or none are currently assigned to your class. Check your completed tab or speak with your teacher.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {availableExams.map(e => (
              <Card key={e.id} className="flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-slate-800 text-base m-0">{e.title}</h3>
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                      Active
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs font-medium mb-1">{e.subject} · {e.type}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-600 my-2">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> {e.duration} mins</span>
                    <span>Attempts: {getAttemptCount(e.id)} / {(e as any).attempts || 1}</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Questions: {e.questions?.length || 0}</span>
                  <Button onClick={() => startExam(e.id)} className="px-4 py-1.5 text-xs">Start Exam</Button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        completedExams.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-slate-200 shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-700">No Completed Exams Yet</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto mt-1">
              Exams that you have successfully submitted or reached maximum attempts for will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {completedExams.map(e => (
              <Card key={e.id} className="flex flex-col justify-between bg-slate-50/50">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-slate-700 text-base m-0">{e.title}</h3>
                    <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">
                      Submitted / Completed
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs font-medium mb-1">{e.subject} · {e.type}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500 my-2">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> {e.duration} mins</span>
                    <span>Attempts: {getAttemptCount(e.id)} / {(e as any).attempts || 1}</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                  </span>
                  <Button variant="secondary" onClick={() => useStore.setState({ activeTab: 'results' })} className="px-3 py-1.5 text-xs">
                    View Results
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
