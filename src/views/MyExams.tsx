import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Card } from '../components/ui';

export default function MyExams() {
  const { data, currentUser } = useStore();
  const showToast = useToastStore(s => s.showToast);

  const getAttemptCount = (id: string | number) => {
    return data.results.filter(r => r.studentId === currentUser?.id && r.examId === id).length;
  };

  const availableExams = data.exams.filter(e => e.status === 'active' && getAttemptCount(e.id) < Math.max(1, e.attempts || 1));

  const startExam = (id: string | number) => {
    // We will trigger a state change in App.tsx by setting an active exam ID in the store
    // Let's add setActiveExam to the store
    useStore.setState({ activeExamId: id });
  };

  if (!availableExams.length) {
    return <p className="text-slate-500">No available exams.</p>;
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
