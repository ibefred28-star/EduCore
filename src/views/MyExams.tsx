import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Card } from '../components/ui';
import { Student } from '../types';
import { useExamsSubscription, useStudentResultsSubscription } from '../hooks/useDomainSubscriptions';
import { useMemo } from 'react';

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

  const availableExams = effectiveExams.filter(e => {
    if (e.status !== 'active') return false;
    const maxAttempts = Math.max(1, (e as any).attempts || 1);
    if (getAttemptCount(e.id) >= maxAttempts) return false;
    if (e.targetClasses && e.targetClasses.length > 0) {
      if (!e.targetClasses.includes(studentClass)) return false;
    }
    return true;
  });

  const startExam = (id: string | number) => {
    useStore.setState({ activeExamId: id });
  };

  if (!availableExams.length) {
    return <p className="text-slate-500">No available exams for your class.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-[15px]">
      {availableExams.map(e => (
        <Card key={e.id}>
          <h3 className="m-0 mb-1">{e.title}</h3>
          <p className="m-0 text-sm">{e.subject} · {e.type} · {e.duration} min</p>
          <p className="text-slate-500 text-sm mt-1 mb-4">Attempts: {getAttemptCount(e.id)}/{(e as any).attempts || 1}</p>
          <Button onClick={() => startExam(e.id)}>Start</Button>
        </Card>
      ))}
    </div>
  );
}
