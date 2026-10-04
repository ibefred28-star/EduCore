import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Input, Label, Modal, Select, Textarea } from '../components/ui';
import { Exam, Question, BankQuestion, QuestionType, QuestionDifficulty } from '../types';
import {
  bankQuestionToExamQuestion,
  generateRandomExamQuestions
} from '../lib/questionBankUtils';
import {
  BookOpen,
  Shuffle,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  CheckSquare,
  HelpCircle,
  FileQuestion,
  Image as ImageIcon,
  X,
  FileSpreadsheet,
  Code2,
  CheckCircle2,
  Layers,
  Sparkles
} from 'lucide-react';

function questionTemplates() {
  return {
    mcq: [{ type: 'mcq', q: 'What is 2 + 2?', options: ['3', '4', '5', '6'], ans: 1, marks: 1 }],
    fill_blank: [{ type: 'fill_blank', q: 'The capital of Nigeria is ________.', answer: 'Abuja', marks: 1 }],
    true_false: [{ type: 'true_false', q: 'The Earth revolves around the Sun.', ans: 0, marks: 1 }],
    diagram: [{ type: 'diagram', q: 'Identify the labelled part in the diagram.', image: 'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=800&auto=format&fit=crop&q=80', options: ['A', 'B', 'C', 'D'], ans: 0, marks: 2 }]
  };
}

export default function ExamsManager() {
  const { data, currentRole, currentUser, updateData } = useStore();
  const showToast = useToastStore(s => s.showToast);
  
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | number | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    type: 'CA 1',
    duration: 30,
    attempts: 1,
    status: 'draft',
    start: '',
    questionsStr: '',
    template: 'mcq',
    targetClasses: [] as string[]
  });

  // Editor sub-tab: 'visual' | 'quick_add' | 'raw_json'
  const [activeEditorTab, setActiveEditorTab] = useState<'visual' | 'quick_add' | 'raw_json'>('visual');

  // Question Bank Picker Modal State
  const [isBankPickerOpen, setIsBankPickerOpen] = useState(false);
  const [bankPickerSearch, setBankPickerSearch] = useState('');
  const [bankPickerSubject, setBankPickerSubject] = useState('All');
  const [bankPickerClass, setBankPickerClass] = useState('All');
  const [bankPickerTopic, setBankPickerTopic] = useState('All');
  const [bankPickerDifficulty, setBankPickerDifficulty] = useState('All');
  const [bankPickerType, setBankPickerType] = useState('All');
  const [bankPickerSelectedIds, setBankPickerSelectedIds] = useState<string[]>([]);

  // Random Generator Modal State
  const [isRandomGenOpen, setIsRandomGenOpen] = useState(false);
  const [randomCount, setRandomCount] = useState(10);
  const [randomSubject, setRandomSubject] = useState('All');
  const [randomClass, setRandomClass] = useState('All');
  const [randomTopic, setRandomTopic] = useState('All');
  const [randomEasy, setRandomEasy] = useState(3);
  const [randomMedium, setRandomMedium] = useState(5);
  const [randomHard, setRandomHard] = useState(2);
  const [randomTypes, setRandomTypes] = useState<QuestionType[]>(['mcq', 'true_false', 'fill_blank', 'diagram']);

  const uniqueClasses = Array.from(new Set(data.students.map(s => s.class).filter(Boolean)));
  const bankQuestions: BankQuestion[] = data.questions || [];

  // Parse questions from formData.questionsStr
  const currentQuestions: Question[] = useMemo(() => {
    try {
      const parsed = JSON.parse(formData.questionsStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }, [formData.questionsStr]);

  const totalMarks = useMemo(() => {
    return currentQuestions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0);
  }, [currentQuestions]);

  const updateQuestions = (newQuestions: Question[]) => {
    setFormData(prev => ({
      ...prev,
      questionsStr: JSON.stringify(newQuestions, null, 2)
    }));
  };

  const openForm = (id?: string | number) => {
    if (id) {
      const e = data.exams.find(x => x.id === id);
      if (e) {
        setFormData({
          title: e.title,
          subject: e.subject,
          type: e.type,
          duration: e.duration,
          attempts: e.attempts || 1,
          status: e.status,
          start: e.start || '',
          questionsStr: JSON.stringify(e.questions, null, 2),
          template: 'mcq',
          targetClasses: e.targetClasses || []
        });
      }
    } else {
      setFormData({
        title: '',
        subject: data.subjects[0] || 'Math',
        type: 'CA 1',
        duration: 30,
        attempts: 1,
        status: 'draft',
        start: '',
        questionsStr: JSON.stringify(questionTemplates().mcq, null, 2),
        template: 'mcq',
        targetClasses: uniqueClasses.length > 0 ? [uniqueClasses[0]] : []
      });
    }
    setActiveEditorTab('visual');
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
    showToast('Template loaded');
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
      showToast('Invalid question structure. Please check question fields.');
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

  // Reordering questions in visual editor
  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const list = [...currentQuestions];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    updateQuestions(list);
  };

  const removeQuestionAt = (index: number) => {
    const list = currentQuestions.filter((_, i) => i !== index);
    updateQuestions(list);
    showToast('Question removed from exam');
  };

  // Open Bank Picker Modal initialized with exam's current subject & target class
  const handleOpenBankPicker = () => {
    setBankPickerSubject(formData.subject || 'All');
    setBankPickerClass(formData.targetClasses[0] || 'All');
    setBankPickerTopic('All');
    setBankPickerDifficulty('All');
    setBankPickerType('All');
    setBankPickerSearch('');
    setBankPickerSelectedIds([]);
    setIsBankPickerOpen(true);
  };

  // Filtered bank questions in picker modal
  const filteredBankQuestions = useMemo(() => {
    return bankQuestions.filter(q => {
      if (q.status !== 'active') return false;
      if (bankPickerSubject !== 'All' && q.subject !== bankPickerSubject) return false;
      if (bankPickerClass !== 'All' && q.class !== bankPickerClass) return false;
      if (bankPickerTopic !== 'All' && q.topic !== bankPickerTopic) return false;
      if (bankPickerDifficulty !== 'All' && q.difficulty !== bankPickerDifficulty) return false;
      if (bankPickerType !== 'All' && q.type !== bankPickerType) return false;
      if (bankPickerSearch.trim()) {
        const query = bankPickerSearch.toLowerCase();
        const inQ = q.q.toLowerCase().includes(query);
        const inT = (q.topic || '').toLowerCase().includes(query);
        const inTags = (q.tags || []).some(t => t.toLowerCase().includes(query));
        if (!inQ && !inT && !inTags) return false;
      }
      return true;
    });
  }, [bankQuestions, bankPickerSubject, bankPickerClass, bankPickerTopic, bankPickerDifficulty, bankPickerType, bankPickerSearch]);

  const confirmAddFromBank = () => {
    const selected = bankQuestions.filter(q => bankPickerSelectedIds.includes(q.id));
    if (selected.length === 0) {
      showToast('No questions selected');
      return;
    }
    const newItems = selected.map(bankQuestionToExamQuestion);
    updateQuestions([...currentQuestions, ...newItems]);
    showToast(`Added ${newItems.length} questions from Question Bank`);
    setIsBankPickerOpen(false);
  };

  const addAllFilteredFromBank = () => {
    if (filteredBankQuestions.length === 0) {
      showToast('No questions match the current filters');
      return;
    }
    const newItems = filteredBankQuestions.map(bankQuestionToExamQuestion);
    updateQuestions([...currentQuestions, ...newItems]);
    showToast(`Added ${newItems.length} filtered questions from Question Bank`);
    setIsBankPickerOpen(false);
  };

  // Open Random Generator Modal initialized with exam's current subject & target class
  const handleOpenRandomGen = () => {
    setRandomSubject(formData.subject || 'All');
    setRandomClass(formData.targetClasses[0] || 'All');
    setRandomTopic('All');
    setRandomCount(10);
    setRandomEasy(3);
    setRandomMedium(5);
    setRandomHard(2);
    setRandomTypes(['mcq', 'true_false', 'fill_blank', 'diagram']);
    setIsRandomGenOpen(true);
  };

  const confirmRandomGenerate = () => {
    const selected = generateRandomExamQuestions(bankQuestions, {
      count: randomCount,
      subject: randomSubject,
      class: randomClass,
      topic: randomTopic,
      difficultyDist: {
        Easy: randomEasy,
        Medium: randomMedium,
        Hard: randomHard
      },
      types: randomTypes
    });

    if (selected.length === 0) {
      showToast('No matching questions found in question pool');
      return;
    }

    const newItems = selected.map(bankQuestionToExamQuestion);
    updateQuestions([...currentQuestions, ...newItems]);
    showToast(`Generated and added ${newItems.length} random questions`);
    setIsRandomGenOpen(false);
  };

  const renderTypeIcon = (type: QuestionType) => {
    switch (type) {
      case 'mcq': return <CheckSquare className="w-3.5 h-3.5 text-blue-600" />;
      case 'true_false': return <HelpCircle className="w-3.5 h-3.5 text-purple-600" />;
      case 'fill_blank': return <FileQuestion className="w-3.5 h-3.5 text-cyan-600" />;
      case 'diagram': return <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />;
    }
  };

  return (
    <>
      <div className="flex gap-2 flex-wrap mb-4 justify-between items-center">
        <Button onClick={() => openForm()} className="inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Exam
        </Button>
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
                  <td className="p-3 font-medium text-slate-800">{e.title}</td>
                  <td className="p-3 text-sm text-slate-600">{e.targetClasses?.join(', ') || 'All'}</td>
                  <td className="p-3">{e.subject}</td>
                  <td className="p-3">
                    <Select 
                      className="min-w-[120px] m-0 text-xs py-1" 
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
                  <td className="p-3">
                    <span className="font-bold text-slate-700">{e.questions.length}</span>
                    <span className="text-xs text-slate-400 block">
                      {e.questions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0)} pts
                    </span>
                  </td>
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

      {/* ========================================================================= */}
      {/* EXAM CREATION / EDITING MODAL */}
      {/* ========================================================================= */}
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <h2 className="text-xl font-bold mt-0 mb-4">{editingId ? 'Edit' : 'Create'} Exam</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Label>Title</Label>
            <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Primary 5 Mathematics CA 1" />
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
            <p className="text-slate-500 text-[11px] m-0 mt-0.5">Max allowed submissions per student.</p>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}>
              <option value="active">Active (Available for students)</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
            </Select>
          </div>
        </div>

        <div className="mt-3">
          <Label>Target Classes</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {uniqueClasses.map(c => {
              const checked = formData.targetClasses.includes(c);
              return (
                <button
                  type="button"
                  key={c}
                  onClick={() => toggleClass(c)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-all ${
                    checked ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {checked ? `✓ ${c}` : `+ ${c}`}
                </button>
              );
            })}
          </div>
          {!uniqueClasses.length && <p className="text-xs text-slate-500">No student classes registered yet.</p>}
        </div>

        <Label className="mt-3 block">Start time (optional)</Label>
        <Input type="datetime-local" value={formData.start} onChange={e => setFormData(p => ({ ...p, start: e.target.value }))} className="max-w-xs" />
        
        {/* ========================================================================= */}
        {/* ENHANCED QUESTIONS MANAGEMENT SECTION */}
        {/* ========================================================================= */}
        <div className="mt-6 border border-slate-200 rounded-xl p-4 bg-slate-50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-slate-800 m-0">Exam Questions</h3>
                <span className="bg-indigo-100 text-indigo-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {currentQuestions.length} Questions ({totalMarks} pts)
                </span>
              </div>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Add questions from Question Bank, generate randomly from pool, or use quick add/JSON.
              </p>
            </div>

            {/* Question Bank Expansion Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={handleOpenBankPicker}
                className="text-xs py-1.5 px-3 bg-indigo-600 text-white hover:bg-indigo-700 inline-flex items-center gap-1.5 shadow-sm"
              >
                <BookOpen className="w-3.5 h-3.5" /> Browse Question Bank
              </Button>

              <Button
                variant="secondary"
                onClick={handleOpenRandomGen}
                className="text-xs py-1.5 px-3 bg-amber-400 text-slate-900 font-bold hover:bg-amber-300 inline-flex items-center gap-1.5 shadow-sm"
              >
                <Shuffle className="w-3.5 h-3.5" /> Random Generator
              </Button>

              <input 
                type="file" 
                accept=".json,.csv" 
                id="bulk-upload"
                className="hidden" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const r = new FileReader();
                  r.onload = () => {
                    const text = r.result as string;
                    if (file.name.endsWith('.json')) {
                      try {
                        const parsed = JSON.parse(text);
                        if (Array.isArray(parsed)) {
                          setFormData(p => ({ ...p, questionsStr: JSON.stringify(parsed, null, 2) }));
                          showToast('JSON loaded successfully');
                        } else {
                          showToast('JSON must be an array of questions');
                        }
                      } catch (e) {
                        showToast('Invalid JSON format');
                      }
                    } else if (file.name.endsWith('.csv')) {
                      try {
                        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                        lines.shift();
                        const qs: any[] = [];
                        for (const line of lines) {
                          const parts = line.split(',').map(p => p.trim());
                          if (parts.length >= 2) {
                            const type = parts[0] || 'mcq';
                            const q = parts[1];
                            if (type === 'mcq' && parts.length >= 7) {
                              qs.push({ type, q, options: [parts[2], parts[3], parts[4], parts[5]].filter(Boolean), ans: parseInt(parts[6]) });
                            } else if (type === 'true_false' && parts.length >= 3) {
                              qs.push({ type, q, ans: parseInt(parts[2]) });
                            } else if (type === 'fill_blank' && parts.length >= 3) {
                              qs.push({ type, q, answer: parts[2] });
                            }
                          }
                        }
                        setFormData(p => ({ ...p, questionsStr: JSON.stringify([...JSON.parse(formData.questionsStr || '[]'), ...qs], null, 2) }));
                        showToast('CSV loaded and appended successfully');
                      } catch(e) {
                        showToast('Invalid CSV format. Use: type,q,optA,optB,optC,optD,ans');
                      }
                    }
                  };
                  r.readAsText(file);
                }}
              />
              <Button
                variant="secondary"
                onClick={() => document.getElementById('bulk-upload')?.click()}
                className="text-xs py-1.5 px-2.5"
              >
                Upload File
              </Button>
            </div>
          </div>

          {/* Sub-Tabs: Visual List vs Quick Add vs Raw JSON */}
          <div className="flex border-b border-slate-200 mb-3 text-xs">
            <button
              type="button"
              className={`py-2 px-4 font-bold border-b-2 cursor-pointer transition-colors ${
                activeEditorTab === 'visual'
                  ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setActiveEditorTab('visual')}
            >
              Visual Questions List ({currentQuestions.length})
            </button>
            <button
              type="button"
              className={`py-2 px-4 font-bold border-b-2 cursor-pointer transition-colors ${
                activeEditorTab === 'quick_add'
                  ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setActiveEditorTab('quick_add')}
            >
              + Quick Add Question
            </button>
            <button
              type="button"
              className={`py-2 px-4 font-bold border-b-2 cursor-pointer transition-colors ${
                activeEditorTab === 'raw_json'
                  ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setActiveEditorTab('raw_json')}
            >
              Raw JSON / Direct Editor
            </button>
          </div>

          {/* TAB 1: VISUAL QUESTION LIST */}
          {activeEditorTab === 'visual' && (
            <div>
              {currentQuestions.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-lg border border-slate-200 text-slate-500 text-sm">
                  <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold mb-1">No questions added to this exam yet.</p>
                  <p className="text-xs text-slate-400 mb-3">
                    Use "Browse Question Bank" to select questions, or "Random Generator" to build an exam in seconds.
                  </p>
                  <div className="flex justify-center gap-2">
                    <Button variant="secondary" onClick={handleOpenBankPicker} className="text-xs">
                      Browse Question Bank
                    </Button>
                    <Button variant="secondary" onClick={handleOpenRandomGen} className="text-xs">
                      Random Generator
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {currentQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm flex items-start justify-between gap-3 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {renderTypeIcon(q.type)}
                              <span className="uppercase">{q.type.replace('_', ' ')}</span>
                            </span>
                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {q.marks || 1} {(q.marks || 1) === 1 ? 'pt' : 'pts'}
                            </span>
                            {q.topic && (
                              <span className="text-[11px] text-slate-500">
                                Topic: {q.topic}
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-slate-800 text-sm m-0 line-clamp-2">
                            {q.q}
                          </p>
                          {q.type === 'diagram' && q.image && (
                            <img src={q.image} alt="Diagram" className="h-14 rounded border border-slate-200 mt-1 object-contain" />
                          )}
                        </div>
                      </div>

                      {/* Reorder and Delete Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveQuestion(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveQuestion(idx, 'down')}
                          disabled={idx === currentQuestions.length - 1}
                          className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeQuestionAt(idx)}
                          className="p-1 rounded hover:bg-red-50 text-red-600 cursor-pointer ml-1"
                          title="Remove from Exam"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: QUICK ADD QUESTION */}
          {activeEditorTab === 'quick_add' && (
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="flex flex-col gap-2 max-w-xl">
                <Label>Question Type</Label>
                <Select id="qa_type" defaultValue="mcq" onChange={(e) => {
                  document.querySelectorAll('.qa-field').forEach(el => el.classList.add('hidden'));
                  document.querySelectorAll('.qa-' + e.target.value).forEach(el => el.classList.remove('hidden'));
                }}>
                  <option value="mcq">Multiple Choice</option>
                  <option value="true_false">True / False</option>
                  <option value="fill_blank">Fill in the blank</option>
                  <option value="diagram">Diagram / Image</option>
                </Select>
                
                <Label>Question Text</Label>
                <Input id="qa_q" placeholder="Question text..." />
                
                <div className="qa-field qa-diagram hidden">
                  <Label>Diagram Image</Label>
                  <Input type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const r = new FileReader();
                      r.onload = () => {
                        (document.getElementById('qa_image_data') as HTMLInputElement).value = r.result as string;
                      };
                      r.readAsDataURL(file);
                    }
                  }} />
                  <input type="hidden" id="qa_image_data" />
                </div>

                <div className="qa-field qa-mcq qa-diagram grid grid-cols-2 gap-2 mt-2">
                  <Input id="qa_opt0" placeholder="Option A" />
                  <Input id="qa_opt1" placeholder="Option B" />
                  <Input id="qa_opt2" placeholder="Option C" />
                  <Input id="qa_opt3" placeholder="Option D" />
                </div>
                
                <Select id="qa_ans_mcq" className="qa-field qa-mcq qa-diagram mt-1">
                  <option value="0">Correct Answer: Option A</option>
                  <option value="1">Correct Answer: Option B</option>
                  <option value="2">Correct Answer: Option C</option>
                  <option value="3">Correct Answer: Option D</option>
                </Select>

                <Select id="qa_ans_tf" className="qa-field qa-true_false hidden mt-1">
                  <option value="1">Correct Answer: True</option>
                  <option value="0">Correct Answer: False</option>
                </Select>

                <Input id="qa_ans_blank" className="qa-field qa-fill_blank hidden mt-1" placeholder="Correct Answer text..." />

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <Label>Marks</Label>
                    <Input id="qa_marks" type="number" defaultValue="1" min="1" />
                  </div>
                  <div>
                    <Label>Topic</Label>
                    <Input id="qa_topic" placeholder="e.g. Algebra" />
                  </div>
                </div>
                
                <Button className="mt-3" onClick={() => {
                  const type = (document.getElementById('qa_type') as HTMLSelectElement).value;
                  const q = (document.getElementById('qa_q') as HTMLInputElement).value;
                  const marks = Number((document.getElementById('qa_marks') as HTMLInputElement).value) || 1;
                  const topic = (document.getElementById('qa_topic') as HTMLInputElement).value || '';
                  
                  if (!q) {
                    showToast('Question text is required');
                    return;
                  }
                  
                  let newQ: any = { type, q, marks, topic };
                  
                  if (type === 'mcq' || type === 'diagram') {
                    const o0 = (document.getElementById('qa_opt0') as HTMLInputElement).value;
                    const o1 = (document.getElementById('qa_opt1') as HTMLInputElement).value;
                    const o2 = (document.getElementById('qa_opt2') as HTMLInputElement).value;
                    const o3 = (document.getElementById('qa_opt3') as HTMLInputElement).value;
                    const ans = parseInt((document.getElementById('qa_ans_mcq') as HTMLSelectElement).value);
                    if (!o0 || !o1) {
                      showToast('At least Options A and B are required');
                      return;
                    }
                    newQ.options = [o0, o1, o2, o3].filter(Boolean);
                    newQ.ans = ans;
                    
                    if (type === 'diagram') {
                      const img = (document.getElementById('qa_image_data') as HTMLInputElement).value;
                      if (!img) {
                        showToast('Please select an image for diagram question');
                        return;
                      }
                      newQ.image = img;
                    }
                  } else if (type === 'true_false') {
                    newQ.ans = parseInt((document.getElementById('qa_ans_tf') as HTMLSelectElement).value) === 1;
                  } else if (type === 'fill_blank') {
                    const ans = (document.getElementById('qa_ans_blank') as HTMLInputElement).value;
                    if (!ans) return showToast('Answer is required for fill in the blank');
                    newQ.answer = ans;
                    newQ.answers = [ans];
                  }
                  
                  updateQuestions([...currentQuestions, newQ]);
                  
                  // Clear form
                  (document.getElementById('qa_q') as HTMLInputElement).value = '';
                  (document.getElementById('qa_opt0') as HTMLInputElement).value = '';
                  (document.getElementById('qa_opt1') as HTMLInputElement).value = '';
                  (document.getElementById('qa_opt2') as HTMLInputElement).value = '';
                  (document.getElementById('qa_opt3') as HTMLInputElement).value = '';
                  (document.getElementById('qa_ans_blank') as HTMLInputElement).value = '';
                  (document.getElementById('qa_image_data') as HTMLInputElement).value = '';
                  
                  showToast('Question appended to exam');
                  setActiveEditorTab('visual');
                }}>Append Question to Exam</Button>
              </div>
            </div>
          )}

          {/* TAB 3: RAW JSON EDITOR */}
          {activeEditorTab === 'raw_json' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2">
                  <Select value={formData.template} onChange={e => setFormData(p => ({ ...p, template: e.target.value }))} className="text-xs mt-0">
                    <option value="mcq">MCQ template</option>
                    <option value="fill_blank">Fill-in-the-blanks template</option>
                    <option value="true_false">True/False template</option>
                    <option value="diagram">Diagram-based template</option>
                  </Select>
                  <Button variant="secondary" onClick={loadTemplate} className="text-xs">Replace with Template</Button>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(questionTemplates(), null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'questions_template.json';
                    a.click();
                  }}
                  className="text-xs"
                >
                  Download JSON Template
                </Button>
              </div>

              <Textarea
                rows={10}
                value={formData.questionsStr}
                onChange={e => setFormData(p => ({ ...p, questionsStr: e.target.value }))}
                className="font-mono text-xs bg-white"
              />
              <p className="text-slate-500 text-[11px] m-0">Supported types: mcq, fill_blank, true_false, diagram.</p>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 mt-5">
          <Button onClick={saveExam}>Save Exam</Button>
          <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* QUESTION BANK SELECTOR MODAL (Inside Exam Creator) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isBankPickerOpen}
        onClose={() => setIsBankPickerOpen(false)}
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <div>
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-800 m-0">Select from Question Bank</h3>
            </div>
            <button onClick={() => setIsBankPickerOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filters Bar in Picker */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">Subject:</span>
              <Select value={bankPickerSubject} onChange={e => setBankPickerSubject(e.target.value)} className="text-xs p-1 mt-0">
                <option value="All">All Subjects</option>
                {data.subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>

            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">Class:</span>
              <Select value={bankPickerClass} onChange={e => setBankPickerClass(e.target.value)} className="text-xs p-1 mt-0">
                <option value="All">All Classes</option>
                {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>

            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">Difficulty:</span>
              <Select value={bankPickerDifficulty} onChange={e => setBankPickerDifficulty(e.target.value)} className="text-xs p-1 mt-0">
                <option value="All">All Difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </Select>
            </div>

            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">Type:</span>
              <Select value={bankPickerType} onChange={e => setBankPickerType(e.target.value)} className="text-xs p-1 mt-0">
                <option value="All">All Types</option>
                <option value="mcq">MCQ</option>
                <option value="true_false">True / False</option>
                <option value="fill_blank">Fill in Blank</option>
                <option value="diagram">Diagram</option>
              </Select>
            </div>
          </div>

          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={bankPickerSearch}
              onChange={e => setBankPickerSearch(e.target.value)}
              placeholder="Search question bank by keyword..."
              className="pl-9 mt-0 text-xs"
            />
          </div>

          {/* Quick Selection Toolbar in Picker */}
          <div className="flex items-center justify-between text-xs py-1.5 px-3 bg-indigo-50 border border-indigo-200 rounded-lg mb-3">
            <span className="font-bold text-indigo-900">
              {bankPickerSelectedIds.length} questions selected (of {filteredBankQuestions.length} matching)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (bankPickerSelectedIds.length === filteredBankQuestions.length) {
                    setBankPickerSelectedIds([]);
                  } else {
                    setBankPickerSelectedIds(filteredBankQuestions.map(q => q.id));
                  }
                }}
                className="text-indigo-700 font-semibold underline hover:text-indigo-900"
              >
                {bankPickerSelectedIds.length === filteredBankQuestions.length ? 'Deselect All' : 'Select All Filtered'}
              </button>
            </div>
          </div>

          {/* Questions Pool List */}
          {filteredBankQuestions.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-lg text-slate-500 text-sm">
              No matching questions found in your bank with these filter settings.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredBankQuestions.map(q => {
                const isSelected = bankPickerSelectedIds.includes(q.id);
                const isAlreadyInExam = currentQuestions.some(eq => eq.bankQuestionId === q.id || eq.q.trim().toLowerCase() === q.q.trim().toLowerCase());

                return (
                  <label
                    key={q.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-50/50 border-indigo-500 ring-1 ring-indigo-300'
                        : isAlreadyInExam
                        ? 'bg-slate-50 border-slate-200 opacity-70'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setBankPickerSelectedIds(prev =>
                          prev.includes(q.id) ? prev.filter(x => x !== q.id) : [...prev, q.id]
                        );
                      }}
                      className="mt-1 text-indigo-600 rounded"
                    />

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap text-xs">
                        <span className="font-bold text-slate-800 uppercase">{q.type}</span>
                        <span className="font-semibold text-slate-500">{q.subject} · {q.class}</span>
                        <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                          q.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-800' : q.difficulty === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {q.difficulty}
                        </span>
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-bold text-[10px]">
                          {q.marks || 1} pt
                        </span>
                        {isAlreadyInExam && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                            Already in exam
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-slate-800 text-sm m-0">
                        {q.q}
                      </p>
                      {q.topic && <p className="text-xs text-slate-500 m-0 mt-0.5">Topic: {q.topic}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-200">
            <Button
              variant="secondary"
              onClick={addAllFilteredFromBank}
              className="text-xs"
              disabled={filteredBankQuestions.length === 0}
            >
              Add All Filtered ({filteredBankQuestions.length})
            </Button>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setIsBankPickerOpen(false)}>Cancel</Button>
              <Button onClick={confirmAddFromBank} disabled={bankPickerSelectedIds.length === 0}>
                Add {bankPickerSelectedIds.length} Selected
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* RANDOM EXAM GENERATOR MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isRandomGenOpen}
        onClose={() => setIsRandomGenOpen(false)}
        className="max-w-lg"
      >
        <div>
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Shuffle className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-800 m-0">Randomly Generate Exam</h3>
            </div>
            <button onClick={() => setIsRandomGenOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-slate-500 mb-4">
            Automatically draw a balanced set of questions from your school Question Bank.
          </p>

          <div className="space-y-3">
            <div>
              <Label>Total Number of Questions</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={randomCount}
                onChange={e => setRandomCount(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Subject Pool</Label>
                <Select value={randomSubject} onChange={e => setRandomSubject(e.target.value)}>
                  <option value="All">All Subjects</option>
                  {data.subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>

              <div>
                <Label>Class Pool</Label>
                <Select value={randomClass} onChange={e => setRandomClass(e.target.value)}>
                  <option value="All">All Classes</option>
                  {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
            </div>

            {/* Difficulty Quotas */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <Label className="mt-0 mb-1 text-slate-800">Difficulty Target Breakdown</Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-xs font-semibold text-emerald-700 block mb-1">Easy:</span>
                  <Input
                    type="number"
                    min="0"
                    value={randomEasy}
                    onChange={e => setRandomEasy(Number(e.target.value) || 0)}
                    className="text-xs mt-0 bg-white"
                  />
                </div>
                <div>
                  <span className="text-xs font-semibold text-amber-700 block mb-1">Medium:</span>
                  <Input
                    type="number"
                    min="0"
                    value={randomMedium}
                    onChange={e => setRandomMedium(Number(e.target.value) || 0)}
                    className="text-xs mt-0 bg-white"
                  />
                </div>
                <div>
                  <span className="text-xs font-semibold text-rose-700 block mb-1">Hard:</span>
                  <Input
                    type="number"
                    min="0"
                    value={randomHard}
                    onChange={e => setRandomHard(Number(e.target.value) || 0)}
                    className="text-xs mt-0 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Allowed Question Types */}
            <div>
              <Label>Allowed Question Types</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[
                  { type: 'mcq', label: 'Multiple Choice' },
                  { type: 'true_false', label: 'True / False' },
                  { type: 'fill_blank', label: 'Fill in Blank' },
                  { type: 'diagram', label: 'Diagram / Image' }
                ].map(t => {
                  const checked = randomTypes.includes(t.type as QuestionType);
                  return (
                    <label key={t.type} className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200 text-xs font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setRandomTypes(prev =>
                            checked ? prev.filter(x => x !== t.type) : [...prev, t.type as QuestionType]
                          );
                        }}
                        className="text-indigo-600 rounded"
                      />
                      {t.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <Button variant="secondary" onClick={() => setIsRandomGenOpen(false)}>Cancel</Button>
            <Button onClick={confirmRandomGenerate} className="inline-flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Generate & Add to Exam
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Exam Confirmation Modal */}
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
