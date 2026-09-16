import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Card } from '../components/ui';
import { Student } from '../types';

export default function MyExams() {
  const { data, currentUser } = useStore();
  const showToast = useToastStore(s => s.showToast);

  const getAttemptCount = (id: string | number) => {
    return data.results.filter(r => r.studentId === currentUser?.id && r.examId === id).length;
  };

  const studentClass = currentUser ? (currentUser as Student).class : '';

  const availableExams = data.exams.filter(e => {
    if (e.status !== 'active') return false;
    if (getAttemptCount(e.id) >= Math.max(1, e.attempts || 1)) return false;
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
          <p className="text-slate-500 text-sm mt-1 mb-4">Attempts: {getAttemptCount(e.id)}/{e.attempts || 1}</p>
          <Button onClick={() => startExam(e.id)}>Start</Button>
        </Card>
      ))}
    </div>
  );
}
