import { useState } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Input, Label, Modal, Select, Textarea } from '../components/ui';
import { Exam, Question } from '../types';

function questionTemplates() {
  return {
    mcq: [{ type: 'mcq', q: 'What is 2 + 2?', options: ['3', '4', '5', '6'], ans: 1 }],
    fill_blank: [{ type: 'fill_blank', q: 'The capital of Nigeria is ________.', answer: 'Abuja' }],
    true_false: [{ type: 'true_false', q: 'The Earth revolves around the Sun.', ans: 0 }],
    diagram: [{ type: 'diagram', q: 'Identify the labelled part in the diagram.', image: 'https://via.placeholder.com/700x300?text=Insert+Diagram+URL', options: ['A', 'B', 'C', 'D'], ans: 0 }]
  };
}

export default function ExamsManager() {
  const { data, currentRole, currentUser, updateData } = useStore();
  const showToast = useToastStore(s => s.showToast);
  
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | number | null>(null);
  
  const [formData, setFormData] = useState({
    title: '', subject: '', type: 'CA 1', duration: 30, attempts: 1, status: 'draft', start: '', questionsStr: '', template: 'mcq', targetClasses: [] as string[]
  });

  const uniqueClasses = Array.from(new Set(data.students.map(s => s.class).filter(Boolean)));

  const openForm = (id?: string | number) => {
    if (id) {
      const e = data.exams.find(x => x.id === id);
      if (e) {
        setFormData({
          title: e.title, subject: e.subject, type: e.type, duration: e.duration, attempts: e.attempts || 1, status: e.status, start: e.start || '',
          questionsStr: JSON.stringify(e.questions, null, 2), template: 'mcq', targetClasses: e.targetClasses || []
        });
      }
    } else {
      setFormData({
        title: '', subject: data.subjects[0] || '', type: 'CA 1', duration: 30, attempts: 1, status: 'draft', start: '',
        questionsStr: JSON.stringify(questionTemplates().mcq, null, 2), template: 'mcq', targetClasses: []
      });
    }
    setEditingId(id || null);
    setIsOpen(true);
  };

  const toggleClass = (c: string) => {
    setFormData(p => ({
      ...p,
      targetClasses: p.targetClasses.includes(c) ? p.targetClasses.filter(x => x !== c) : [...p.targetClasses, c]
    }));
  };

  const loadTemplate = () => {
    setFormData(p => ({ ...p, questionsStr: JSON.stringify((questionTemplates() as any)[p.template], null, 2) }));
  };

  const validateQuestions = (qs: any[]) => {
    if (!Array.isArray(qs) || !qs.length) return false;
    return qs.every(q => {
      const t = q.type || 'mcq';
      if (!q.q) return false;
      if (t === 'fill_blank') return typeof q.answer === 'string' && q.answer.trim() !== '';
      if (t === 'true_false') return typeof q.ans === 'boolean' || q.ans === 0 || q.ans === 1;
      if (t === 'diagram') return typeof q.image === 'string' && q.image.trim() !== '' && Array.isArray(q.options) && q.ans >= 0 && q.ans < q.options.length;
      return Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.ans) && q.ans >= 0 && q.ans < q.options.length;
    });
  };

  const saveExam = () => {
    try {
      const qs = JSON.parse(formData.questionsStr);
      if (!validateQuestions(qs)) throw new Error('Invalid questions');
      if (!formData.targetClasses.length) {
        showToast('Please select at least one target class');
        return;
      }
      
      updateData(draft => {
        const payload: Exam = {
          id: editingId || Date.now(),
          title: formData.title || 'Untitled Exam',
          subject: formData.subject || draft.subjects[0],
          type: formData.type,
          duration: Number(formData.duration) || 30,
          attempts: Math.max(1, Math.min(20, Number(formData.attempts) || 1)),
          status: formData.status as any,
          start: formData.start,
          targetClasses: formData.targetClasses,
          questions: qs,
          createdBy: editingId ? (draft.exams.find(e => e.id === editingId)?.createdBy || currentUser!.id) : currentUser!.id
        };

        if (editingId) {
          const i = draft.exams.findIndex(x => x.id === editingId);
          if (i >= 0) draft.exams[i] = payload;
        } else {
          draft.exams.push(payload);
        }
      });
      showToast(editingId ? 'Exam updated' : 'Exam saved');
      setIsOpen(false);
    } catch (e) {
      showToast('Invalid question JSON or structure');
    }
  };

  const changeStatus = (id: string | number, status: string) => {
    updateData(draft => {
      const e = draft.exams.find(x => x.id === id);
      if (e) e.status = status as any;
    });
    showToast('Status updated');
  };

  const deleteExam = (id: string | number) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      updateData(draft => {
        draft.exams = draft.exams.filter(x => x.id !== deleteConfirm);
        draft.results = draft.results.filter(x => x.examId !== deleteConfirm);
      });
      showToast('Exam deleted');
      setDeleteConfirm(null);
    }
  };

  return (
    <>
      <div className="flex gap-2 flex-wrap mb-4">
        <Button onClick={() => openForm()}>Create Exam</Button>
      </div>
      
      <div className="overflow-x-auto bg-white rounded-lg shadow border border-slate-200">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th className="p-3 font-semibold">Title</th>
              <th className="p-3 font-semibold">Classes</th>
              <th className="p-3 font-semibold">Subject</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold">Questions</th>
              <th className="p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.exams.map(e => {
              const canEdit = currentRole === 'admin' || (currentRole === 'teacher' && e.createdBy === currentUser?.id);
              return (
                <tr key={e.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                  <td className="p-3">{e.title}</td>
                  <td className="p-3 text-sm text-slate-600">{e.targetClasses?.join(', ') || 'All'}</td>
                  <td className="p-3">{e.subject}</td>
                  <td className="p-3">
                    <Select 
                      className="min-w-[120px] m-0" 
                      value={e.status} 
                      onChange={ev => changeStatus(e.id, ev.target.value)}
                      disabled={!canEdit}
                    >
                      <option value="draft">draft</option>
                      <option value="active">active</option>
                      <option value="scheduled">scheduled</option>
                      <option value="closed">closed</option>
                    </Select>
                  </td>
                  <td className="p-3">{e.questions.length}</td>
                  <td className="p-3">
                    {canEdit ? (
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => openForm(e.id)}>Edit</Button>
                        <Button variant="danger" onClick={() => deleteExam(e.id)}>Delete</Button>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <h2 className="text-xl font-bold mt-0">{editingId ? 'Edit' : 'Create'} Exam</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Title</Label>
            <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <Label>Subject</Label>
            <Select value={formData.subject} onChange={e => setFormData(p => ({ ...p, subject: e.target.value }))}>
              {data.subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <div>
            <Label>Assessment Type</Label>
            <Select value={formData.type} onChange={e => setFormData(p => ({ ...p, type: e.target.value }))}>
              {['CA 1', 'CA 2', 'Examination', 'AFL', 'Test', 'Quiz', 'Assignment', 'Mock', 'Other'].map(x => <option key={x} value={x}>{x}</option>)}
            </Select>
          </div>
          <div>
            <Label>Duration (minutes)</Label>
            <Input type="number" min="1" value={formData.duration} onChange={e => setFormData(p => ({ ...p, duration: Number(e.target.value) }))} />
          </div>
          <div>
            <Label>Number of Attempts</Label>
            <Input type="number" min="1" max="20" value={formData.attempts} onChange={e => setFormData(p => ({ ...p, attempts: Number(e.target.value) }))} />
            <p className="text-slate-500 text-[12px] m-0">Max allowed submissions.</p>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
            </Select>
          </div>
        </div>

        <div className="mt-4">
          <Label>Target Classes</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {uniqueClasses.map(c => (
              <label key={c} className="flex items-center gap-2 bg-slate-100 p-2 rounded-md cursor-pointer hover:bg-slate-200">
                <input 
                  type="checkbox" 
                  checked={formData.targetClasses.includes(c)}
                  onChange={() => toggleClass(c)}
                />
                <span className="text-sm">{c}</span>
              </label>
            ))}
            {!uniqueClasses.length && <p className="text-sm text-slate-500">No classes found in student data. Please add students first.</p>}
          </div>
        </div>

        <Label className="mt-4 block">Start time (optional)</Label>
        <Input type="datetime-local" value={formData.start} onChange={e => setFormData(p => ({ ...p, start: e.target.value }))} />
        
        <div className="mt-6 border border-slate-200 rounded-lg p-4 bg-slate-50">
          <h3 className="font-bold text-lg mb-4 mt-0">Questions Editor</h3>
          <p className="text-sm text-slate-600 mb-4">Edit the JSON array directly below, or use the Quick Add tool to generate JSON for you.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col gap-2">
              <Label>Quick Add MCQ</Label>
              <Input 
                id="qa_q"
                placeholder="Question text..." 
              />
              <div className="grid grid-cols-2 gap-2">
                <Input id="qa_opt0" placeholder="Option A" />
                <Input id="qa_opt1" placeholder="Option B" />
                <Input id="qa_opt2" placeholder="Option C" />
                <Input id="qa_opt3" placeholder="Option D" />
              </div>
              <Select id="qa_ans">
                <option value="0">Answer: Option A</option>
                <option value="1">Answer: Option B</option>
                <option value="2">Answer: Option C</option>
                <option value="3">Answer: Option D</option>
              </Select>
              <Button onClick={() => {
                const q = (document.getElementById('qa_q') as HTMLInputElement).value;
                const o0 = (document.getElementById('qa_opt0') as HTMLInputElement).value;
                const o1 = (document.getElementById('qa_opt1') as HTMLInputElement).value;
                const o2 = (document.getElementById('qa_opt2') as HTMLInputElement).value;
                const o3 = (document.getElementById('qa_opt3') as HTMLInputElement).value;
                const ans = parseInt((document.getElementById('qa_ans') as HTMLSelectElement).value);
                
                if (!q || !o0 || !o1) {
                  showToast('Question and at least Options A and B are required');
                  return;
                }
                
                try {
                  const current = JSON.parse(formData.questionsStr);
                  const newQ = { type: 'mcq', q, options: [o0, o1, o2, o3].filter(Boolean), ans };
                  setFormData(p => ({ ...p, questionsStr: JSON.stringify([...current, newQ], null, 2) }));
                  
                  // Clear form
                  (document.getElementById('qa_q') as HTMLInputElement).value = '';
                  (document.getElementById('qa_opt0') as HTMLInputElement).value = '';
                  (document.getElementById('qa_opt1') as HTMLInputElement).value = '';
                  (document.getElementById('qa_opt2') as HTMLInputElement).value = '';
                  (document.getElementById('qa_opt3') as HTMLInputElement).value = '';
                  showToast('Question appended to JSON below');
                } catch (e) {
                  showToast('Current JSON is invalid, please fix it first');
                }
              }}>Append MCQ to JSON</Button>
            </div>
            
            <div className="flex flex-col gap-2 border-l border-slate-200 pl-4">
              <Label>Template Loader</Label>
              <div className="flex gap-2">
                <Select value={formData.template} onChange={e => setFormData(p => ({ ...p, template: e.target.value }))}>
                  <option value="mcq">MCQ template</option>
                  <option value="fill_blank">Fill-in-the-blanks template</option>
                  <option value="true_false">True/False template</option>
                  <option value="diagram">Diagram-based template</option>
                </Select>
                <Button variant="secondary" onClick={loadTemplate}>Replace JSON</Button>
              </div>
            </div>
          </div>
          
          <Label>Questions (JSON format)</Label>
          <Textarea rows={10} value={formData.questionsStr} onChange={e => setFormData(p => ({ ...p, questionsStr: e.target.value }))} className="font-mono text-sm" />
          <p className="text-slate-500 text-[12px]">Supported types: mcq, fill_blank, true_false, diagram.</p>
        </div>
        
        <div className="flex gap-2 mt-5">
          <Button onClick={saveExam}>Save</Button>
          <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
        </div>
      </Modal>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
            <h3 className="text-xl font-bold mb-2">Delete Exam?</h3>
            <p className="text-slate-500 mb-6">Are you sure you want to delete this exam and its stored results?</p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDelete}>Yes, Delete</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
