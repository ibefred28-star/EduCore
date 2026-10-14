import { useState, useMemo, useRef, type ChangeEvent } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Button, Input, Label, Modal, Select, Textarea, SkeletonCard, SkeletonRow } from '../components/ui';
import { BankQuestion, QuestionType, QuestionDifficulty, BankQuestionStatus, Exam } from '../types';
import { CLASS_OPTIONS } from '../constants';
import {
  getQuestionExamUsage,
  exportQuestionBankToCsv,
  parseQuestionsCsv,
  downloadFile,
  bankQuestionToExamQuestion
} from '../lib/questionBankUtils';
import {
  Search,
  Plus,
  Filter,
  Download,
  Upload,
  Copy,
  Trash2,
  Edit3,
  Eye,
  CheckCircle2,
  HelpCircle,
  Image as ImageIcon,
  CheckSquare,
  FileQuestion,
  Layers,
  Sparkles,
  BookOpen,
  X,
  FileSpreadsheet,
  FileCode,
  Tag,
  GraduationCap,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { useQuestionBankSubscription } from '../hooks/useDomainSubscriptions';
import { QuestionBankRepository } from '../lib/firestore/repositories/questionBankRepository';
import { compressImageFile } from '../lib/imageUtils';

export default function QuestionBankView() {
  const { data, currentUser, currentRole, updateData, schoolId } = useStore();
  const showToast = useToastStore(s => s.showToast);

  const { questions: liveQuestions, loading: questionsLoading } = useQuestionBankSubscription(schoolId);
  const questions: BankQuestion[] = useMemo(() => {
    const map = new Map<string, BankQuestion>();
    (data.questions || []).forEach(q => map.set(String(q.id), q));
    (liveQuestions || []).forEach(q => {
      const existing = map.get(String(q.id));
      map.set(String(q.id), {
        ...existing,
        ...q,
        image: q.image || existing?.image || '',
        subtopic: q.subtopic || existing?.subtopic || ''
      } as BankQuestion);
    });
    return Array.from(map.values());
  }, [liveQuestions, data.questions]);
  const exams: Exam[] = data.exams || [];

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('All');
  const [filterClass, setFilterClass] = useState('All');
  const [filterTopic, setFilterTopic] = useState('All');
  const [filterDifficulty, setFilterDifficulty] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterUsage, setFilterUsage] = useState('All'); // 'All' | 'used' | 'unused'
  const [filterStatus, setFilterStatus] = useState('All'); // 'All' | 'active' | 'draft' | 'archived'

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<BankQuestion | null>(null);
  
  const [previewQuestion, setPreviewQuestion] = useState<BankQuestion | null>(null);
  const [showTeacherSolution, setShowTeacherSolution] = useState(false);

  const [usageModalQuestion, setUsageModalQuestion] = useState<BankQuestion | null>(null);
  
  const [isAddToExamOpen, setIsAddToExamOpen] = useState(false);
  const [addToExamTarget, setAddToExamTarget] = useState<'existing' | 'new'>('existing');
  const [selectedExamId, setSelectedExamId] = useState<string | number>('');
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamSubject, setNewExamSubject] = useState('');
  const [newExamClass, setNewExamClass] = useState('');
  const [newExamDuration, setNewExamDuration] = useState(30);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{ valid: BankQuestion[]; errors: string[] } | null>(null);
  const [importFileName, setImportFileName] = useState('');

  const [deleteConfirmQuestion, setDeleteConfirmQuestion] = useState<BankQuestion | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  // Layout View mode: cards or table
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Subjects & Topics dynamic collections
  const uniqueSubjects = useMemo(() => {
    const set = new Set<string>();
    data.subjects.forEach(s => set.add(s));
    questions.forEach(q => { if (q.subject) set.add(q.subject); });
    return Array.from(set);
  }, [data.subjects, questions]);

  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    CLASS_OPTIONS.forEach(c => set.add(c));
    data.students.forEach(s => { if (s.class) set.add(s.class); });
    questions.forEach(q => { if (q.class) set.add(q.class); });
    return Array.from(set);
  }, [data.students, questions]);

  const availableTopics = useMemo(() => {
    const filtered = questions.filter(q => {
      if (filterSubject !== 'All' && q.subject !== filterSubject) return false;
      if (filterClass !== 'All' && q.class !== filterClass) return false;
      return true;
    });
    const set = new Set<string>();
    filtered.forEach(q => { if (q.topic) set.add(q.topic); });
    return Array.from(set);
  }, [questions, filterSubject, filterClass]);

  // Map each question's usage count for instant lookup
  const questionUsageMap = useMemo(() => {
    const map = new Map<string, Exam[]>();
    questions.forEach(q => {
      map.set(q.id, getQuestionExamUsage(q, exams));
    });
    return map;
  }, [questions, exams]);

  // Filtered Questions
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      // Search query matches question text, topic, subtopic, tags, options, explanation
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const inText = q.q.toLowerCase().includes(query);
        const inTopic = (q.topic || '').toLowerCase().includes(query);
        const inSubtopic = (q.subtopic || '').toLowerCase().includes(query);
        const inExpl = (q.explanation || '').toLowerCase().includes(query);
        const inTags = (q.tags || []).some(t => t.toLowerCase().includes(query));
        const inOptions = (q.options || []).some(o => o.toLowerCase().includes(query));
        const inAnswer = (q.answer || '').toLowerCase().includes(query);
        if (!inText && !inTopic && !inSubtopic && !inExpl && !inTags && !inOptions && !inAnswer) {
          return false;
        }
      }

      if (filterSubject !== 'All') {
        const sub1 = String(q.subject || '').trim().toLowerCase();
        const sub2 = String(filterSubject || '').trim().toLowerCase();
        if (sub1 !== sub2) return false;
      }
      if (filterClass !== 'All' && q.class !== filterClass) return false;
      if (filterTopic !== 'All' && q.topic !== filterTopic) return false;
      if (filterDifficulty !== 'All' && q.difficulty !== filterDifficulty) return false;
      if (filterType !== 'All' && q.type !== filterType) return false;
      if (filterStatus !== 'All' && q.status !== filterStatus) return false;

      if (filterUsage === 'used') {
        const usage = questionUsageMap.get(q.id) || [];
        if (usage.length === 0) return false;
      } else if (filterUsage === 'unused') {
        const usage = questionUsageMap.get(q.id) || [];
        if (usage.length > 0) return false;
      }

      return true;
    });
  }, [questions, searchQuery, filterSubject, filterClass, filterTopic, filterDifficulty, filterType, filterStatus, filterUsage, questionUsageMap]);

  // Active filters count
  const activeFiltersCount = [
    filterSubject !== 'All',
    filterClass !== 'All',
    filterTopic !== 'All',
    filterDifficulty !== 'All',
    filterType !== 'All',
    filterUsage !== 'All',
    filterStatus !== 'All',
    Boolean(searchQuery.trim())
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearchQuery('');
    setFilterSubject('All');
    setFilterClass('All');
    setFilterTopic('All');
    setFilterDifficulty('All');
    setFilterType('All');
    setFilterUsage('All');
    setFilterStatus('All');
  };

  // Selection helpers
  const isAllSelected = filteredQuestions.length > 0 && filteredQuestions.every(q => selectedIds.includes(q.id));
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredQuestions.map(q => q.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Question CRUD Operations
  const handleOpenCreate = () => {
    setEditingQuestion({
      id: `qb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'mcq',
      q: '',
      subject: filterSubject !== 'All' ? filterSubject : (uniqueSubjects[0] || 'General'),
      class: filterClass !== 'All' ? filterClass : (uniqueClasses[0] || 'Primary 5'),
      topic: filterTopic !== 'All' ? filterTopic : '',
      subtopic: '',
      difficulty: 'Medium',
      tags: [],
      options: ['', '', '', ''],
      ans: 0,
      answer: '',
      answers: [],
      explanation: '',
      image: '',
      marks: 1,
      createdBy: currentUser?.name || currentUser?.id || 'Teacher',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    });
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (q: BankQuestion) => {
    setEditingQuestion(JSON.parse(JSON.stringify(q)));
    setIsEditorOpen(true);
  };

  const handleDuplicate = (q: BankQuestion) => {
    const clone: BankQuestion = {
      ...JSON.parse(JSON.stringify(q)),
      id: `qb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      q: `${q.q} (Copy)`,
      createdBy: currentUser?.name || currentUser?.id || 'Teacher',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    updateData(draft => {
      if (!Array.isArray(draft.questions)) draft.questions = [];
      draft.questions.unshift(clone);
    });
    if (schoolId) {
      QuestionBankRepository.upsertQuestion(schoolId, clone).catch(console.warn);
    }
    showToast('Question duplicated');
  };

  const handleDeletePrompt = (q: BankQuestion) => {
    setDeleteConfirmQuestion(q);
  };

  const confirmDeleteQuestion = () => {
    if (!deleteConfirmQuestion) return;
    const qId = deleteConfirmQuestion.id;
    updateData(draft => {
      draft.questions = (draft.questions || []).filter(q => q.id !== qId);
    });
    setSelectedIds(prev => prev.filter(id => id !== qId));
    if (schoolId) {
      QuestionBankRepository.deleteQuestion(schoolId, qId).catch(console.warn);
    }
    showToast('Question deleted from Question Bank');
    setDeleteConfirmQuestion(null);
  };

  const confirmBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const idsToDelete = [...selectedIds];
    updateData(draft => {
      draft.questions = (draft.questions || []).filter(q => !idsToDelete.includes(q.id));
    });
    if (schoolId) {
      idsToDelete.forEach(id => {
        QuestionBankRepository.deleteQuestion(schoolId, id).catch(console.warn);
      });
    }
    showToast(`Deleted ${idsToDelete.length} questions`);
    setSelectedIds([]);
    setIsBulkDeleteConfirmOpen(false);
  };

  const handleBulkChangeStatus = (status: BankQuestionStatus) => {
    if (selectedIds.length === 0) return;
    const ids = [...selectedIds];
    updateData(draft => {
      (draft.questions || []).forEach(q => {
        if (ids.includes(q.id)) {
          q.status = status;
          q.updatedAt = new Date().toISOString();
          if (schoolId) {
            QuestionBankRepository.upsertQuestion(schoolId, q).catch(console.warn);
          }
        }
      });
    });
    showToast(`Updated status of ${ids.length} questions to "${status}"`);
  };

  // Add selected to exam
  const handleOpenAddToExam = (specificQuestion?: BankQuestion) => {
    if (specificQuestion) {
      setSelectedIds([specificQuestion.id]);
    }
    if (exams.length > 0) {
      setSelectedExamId(exams[0].id);
    }
    setNewExamTitle('');
    setNewExamSubject(uniqueSubjects[0] || 'General');
    setNewExamClass(uniqueClasses[0] || 'Primary 5');
    setNewExamDuration(30);
    setIsAddToExamOpen(true);
  };

  const confirmAddToExam = () => {
    const questionsToAdd = questions.filter(q => selectedIds.includes(q.id));
    if (questionsToAdd.length === 0) {
      showToast('No questions selected');
      return;
    }

    if (addToExamTarget === 'existing') {
      if (!selectedExamId) {
        showToast('Please choose an existing exam');
        return;
      }
      updateData(draft => {
        const targetExam = draft.exams.find(e => String(e.id) === String(selectedExamId));
        if (targetExam) {
          if (!Array.isArray(targetExam.questions)) targetExam.questions = [];
          
          let addedCount = 0;
          questionsToAdd.forEach(bq => {
            const alreadyExists = targetExam.questions.some(eq => 
              (eq.bankQuestionId && eq.bankQuestionId === bq.id) ||
              (eq.q && eq.q.trim().toLowerCase() === bq.q.trim().toLowerCase())
            );
            if (!alreadyExists) {
              targetExam.questions.push(bankQuestionToExamQuestion(bq));
              addedCount++;
            }
          });

          showToast(`Added ${addedCount} questions to "${targetExam.title}"`);
        }
      });
      setIsAddToExamOpen(false);
    } else {
      // Create new exam
      if (!newExamTitle.trim()) {
        showToast('Please enter an exam title');
        return;
      }
      const newExam: Exam = {
        id: `exam_${Date.now()}`,
        title: newExamTitle.trim(),
        subject: newExamSubject || 'General',
        type: 'CA 1',
        duration: Number(newExamDuration) || 30,
        attempts: 1,
        status: 'draft',
        targetClasses: newExamClass ? [newExamClass] : ['Primary 5'],
        questions: questionsToAdd.map(bankQuestionToExamQuestion),
        createdBy: currentUser?.name || currentUser?.id || 'Teacher'
      };

      updateData(draft => {
        if (!Array.isArray(draft.exams)) draft.exams = [];
        draft.exams.push(newExam);
      });

      showToast(`Created new exam "${newExam.title}" with ${questionsToAdd.length} questions`);
      setIsAddToExamOpen(false);
    }
  };

  // Export functions
  const handleExportCsv = (selectedOnly = false) => {
    const list = selectedOnly ? questions.filter(q => selectedIds.includes(q.id)) : filteredQuestions;
    if (list.length === 0) {
      showToast('No questions to export');
      return;
    }
    const csv = exportQuestionBankToCsv(list);
    downloadFile(csv, `educore_question_bank_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
    showToast(`Exported ${list.length} questions to CSV`);
  };

  const handleExportJson = (selectedOnly = false) => {
    const list = selectedOnly ? questions.filter(q => selectedIds.includes(q.id)) : filteredQuestions;
    if (list.length === 0) {
      showToast('No questions to export');
      return;
    }
    const jsonStr = JSON.stringify(list, null, 2);
    downloadFile(jsonStr, `educore_question_bank_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    showToast(`Exported ${list.length} questions to JSON`);
  };

  const downloadSampleTemplate = () => {
    const sampleCsv = `Type,Question,Subject,Class,Topic,Subtopic,Difficulty,Marks,Options,CorrectAnswer,AcceptedAnswers,Explanation,Tags,Image,Status\r\nmcq,"What is the capital city of France?",General,Primary 5,Geography,Capitals,Easy,1,"London | Berlin | Paris | Madrid",2,,"Paris is the capital and largest city of France.","Geography; Europe",,active\r\ntrue_false,"Light travels faster than sound in air.",Basic Science,Primary 5,Physics,Optics,Easy,1,,True,,"Light travels at ~300,000 km/s while sound travels at ~343 m/s.","Physics; Waves",,active\r\nfill_blank,"Water is composed of hydrogen and ________.",Basic Science,Primary 5,Chemistry,Molecules,Medium,2,,oxygen,"oxygen | O2","H2O consists of two hydrogen atoms and one oxygen atom.","Chemistry; Water",,active\r\ndiagram,"Identify the green pigment responsible for absorbing sunlight in this leaf cell.",Basic Science,Primary 5,Plant Biology,Photosynthesis,Medium,2,"Chloroplast | Chlorophyll | Mitochondria | Ribosome",1,,"Chlorophyll is the green pigment within chloroplasts.","Biology; Plants","https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=800&auto=format&fit=crop&q=80",active`;
    downloadFile(sampleCsv, 'educore_question_bank_template.csv', 'text/csv;charset=utf-8;');
    showToast('Downloaded CSV sample template');
  };

  // Import file handler
  const handleImportFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            const validList: BankQuestion[] = parsed.map((item, idx) => ({
              id: item.id || `qb_imp_${Date.now()}_${idx}`,
              type: item.type || 'mcq',
              q: item.q || 'Question Text',
              subject: item.subject || (filterSubject !== 'All' ? filterSubject : (uniqueSubjects[0] || 'General')),
              class: item.class || (filterClass !== 'All' ? filterClass : (uniqueClasses[0] || 'Primary 5')),
              topic: item.topic || 'General',
              subtopic: item.subtopic || 'General',
              difficulty: item.difficulty || 'Medium',
              tags: Array.isArray(item.tags) ? item.tags : ['Imported'],
              options: item.options || (item.type === 'mcq' ? ['A', 'B', 'C', 'D'] : undefined),
              ans: item.ans !== undefined ? item.ans : (item.type === 'true_false' ? true : 0),
              answer: item.answer || '',
              answers: item.answers || (item.answer ? [item.answer] : []),
              explanation: item.explanation || '',
              image: item.image || '',
              marks: Number(item.marks) || 1,
              createdBy: currentUser?.name || 'Import',
              createdAt: item.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              status: item.status || 'active'
            }));
            setImportPreview({ valid: validList, errors: [] });
          } else {
            setImportPreview({ valid: [], errors: ['JSON root must be an array of questions.'] });
          }
        } catch (err: any) {
          setImportPreview({ valid: [], errors: [`Invalid JSON: ${err.message}`] });
        }
      } else {
        // Parse CSV
        const parsed = parseQuestionsCsv(
          content,
          currentUser?.name || 'Teacher',
          uniqueSubjects[0] || 'General',
          uniqueClasses[0] || 'Primary 5'
        );
        setImportPreview(parsed);
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = async () => {
    if (!importPreview || importPreview.valid.length === 0) {
      showToast('No valid questions to import');
      return;
    }
    const imported = importPreview.valid;
    updateData(draft => {
      if (!Array.isArray(draft.questions)) draft.questions = [];
      draft.questions.unshift(...imported);
    });
    if (schoolId) {
      try {
        await Promise.all(
          imported.map(q => QuestionBankRepository.upsertQuestion(schoolId, q))
        );
        showToast(`Successfully imported and persisted ${imported.length} questions into Question Bank`);
      } catch (err: any) {
        console.error('Error persisting imported questions:', err);
        showToast(`Imported locally, but Firestore persistence failed: ${err.message || ''}`);
      }
    } else {
      showToast(`Successfully imported ${imported.length} questions into Question Bank`);
    }
    setIsImportModalOpen(false);
    setImportPreview(null);
    setImportFileName('');
  };

  // Helper badge renderers
  const renderDifficultyBadge = (diff: QuestionDifficulty) => {
    const styles = {
      Easy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Medium: 'bg-amber-50 text-amber-700 border-amber-200',
      Hard: 'bg-rose-50 text-rose-700 border-rose-200'
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${styles[diff] || styles.Medium}`}>
        {diff}
      </span>
    );
  };

  const renderTypeBadge = (type: QuestionType) => {
    switch (type) {
      case 'mcq':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-200">
            <CheckSquare className="w-3 h-3" /> MCQ
          </span>
        );
      case 'true_false':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md bg-purple-50 text-purple-700 border border-purple-200">
            <HelpCircle className="w-3 h-3" /> True/False
          </span>
        );
      case 'fill_blank':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200">
            <FileQuestion className="w-3 h-3" /> Fill Blank
          </span>
        );
      case 'diagram':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
            <ImageIcon className="w-3 h-3" /> Diagram
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner / Stats Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-slate-800 m-0">Reusable Question Bank</h2>
              <span className="bg-indigo-100 text-indigo-800 text-xs px-2.5 py-1 rounded-full font-bold">
                {questions.length} Total
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-1 mb-0">
              Create, curate, filter, and reuse assessment items across examinations and quizzes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleOpenCreate} className="inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create Question
            </Button>
            <Button variant="secondary" onClick={() => setIsImportModalOpen(true)} className="inline-flex items-center gap-2">
              <Upload className="w-4 h-4" /> Import CSV/JSON
            </Button>
            <div className="relative inline-block">
              <Button
                variant="secondary"
                onClick={() => handleExportCsv(false)}
                className="inline-flex items-center gap-2"
                title="Export filtered questions to Excel-compatible CSV"
              >
                <Download className="w-4 h-4" /> Export CSV
              </Button>
            </div>
            <Button
              variant="secondary"
              onClick={downloadSampleTemplate}
              className="inline-flex items-center gap-2 text-xs"
              title="Download empty CSV template format"
            >
              <FileSpreadsheet className="w-4 h-4" /> CSV Template
            </Button>
          </div>
        </div>

        {/* Quick Stats Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100 text-sm">
          <div className="bg-slate-50 rounded-lg p-2.5 flex items-center justify-between">
            <span className="text-slate-500">Active Questions</span>
            <span className="font-bold text-emerald-700">{questions.filter(q => q.status === 'active').length}</span>
          </div>
          <div className="bg-slate-50 rounded-lg p-2.5 flex items-center justify-between">
            <span className="text-slate-500">Drafts</span>
            <span className="font-bold text-amber-700">{questions.filter(q => q.status === 'draft').length}</span>
          </div>
          <div className="bg-slate-50 rounded-lg p-2.5 flex items-center justify-between">
            <span className="text-slate-500">Subjects Covered</span>
            <span className="font-bold text-indigo-700">{uniqueSubjects.length}</span>
          </div>
          <div className="bg-slate-50 rounded-lg p-2.5 flex items-center justify-between">
            <span className="text-slate-500">Used in Exams</span>
            <span className="font-bold text-blue-700">
              {questions.filter(q => (questionUsageMap.get(q.id) || []).length > 0).length}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by question text, topic, subtopic, tags, options, explanation..."
              className="pl-9 mt-0"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex border border-slate-200 rounded-lg p-1 bg-slate-50">
              <button
                className={`px-3 py-1.5 text-xs font-semibold rounded ${viewMode === 'cards' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                onClick={() => setViewMode('cards')}
              >
                Cards View
              </button>
              <button
                className={`px-3 py-1.5 text-xs font-semibold rounded ${viewMode === 'table' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                onClick={() => setViewMode('table')}
              >
                Table View
              </button>
            </div>

            {activeFiltersCount > 0 && (
              <Button variant="secondary" onClick={resetFilters} className="text-xs py-2 px-3 text-rose-600">
                Reset ({activeFiltersCount})
              </Button>
            )}
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-500 font-medium block mb-1">Subject:</span>
            <Select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="text-xs p-1.5 mt-0">
              <option value="All">All Subjects</option>
              {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>

          <div>
            <span className="text-slate-500 font-medium block mb-1">Class:</span>
            <Select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="text-xs p-1.5 mt-0">
              <option value="All">All Classes</option>
              {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>

          <div>
            <span className="text-slate-500 font-medium block mb-1">Topic:</span>
            <Select value={filterTopic} onChange={e => setFilterTopic(e.target.value)} className="text-xs p-1.5 mt-0">
              <option value="All">All Topics</option>
              {availableTopics.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>

          <div>
            <span className="text-slate-500 font-medium block mb-1">Difficulty:</span>
            <Select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)} className="text-xs p-1.5 mt-0">
              <option value="All">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </Select>
          </div>

          <div>
            <span className="text-slate-500 font-medium block mb-1">Question Type:</span>
            <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-xs p-1.5 mt-0">
              <option value="All">All Types</option>
              <option value="mcq">Multiple Choice</option>
              <option value="true_false">True / False</option>
              <option value="fill_blank">Fill in the blank</option>
              <option value="diagram">Diagram / Image</option>
            </Select>
          </div>

          <div>
            <span className="text-slate-500 font-medium block mb-1">Exam Usage:</span>
            <Select value={filterUsage} onChange={e => setFilterUsage(e.target.value)} className="text-xs p-1.5 mt-0">
              <option value="All">All Questions</option>
              <option value="used">Used in Exams</option>
              <option value="unused">Unused in Exams</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-900 text-white p-3 rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="bg-indigo-700 text-indigo-100 font-bold px-3 py-1 rounded-md text-sm">
              {selectedIds.length} {selectedIds.length === 1 ? 'question' : 'questions'} selected
            </span>
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-indigo-300 hover:text-white underline cursor-pointer"
            >
              Clear selection
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => handleOpenAddToExam()}
              className="text-xs py-1.5 px-3 bg-amber-400 text-slate-900 font-bold hover:bg-amber-300 inline-flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" /> Add Selected to Exam
            </Button>

            <Select
              className="text-xs py-1.5 px-2 bg-indigo-800 text-white border-indigo-700 mt-0 w-auto"
              defaultValue=""
              onChange={e => {
                if (e.target.value) {
                  handleBulkChangeStatus(e.target.value as BankQuestionStatus);
                  e.target.value = '';
                }
              }}
            >
              <option value="" disabled>Change Status...</option>
              <option value="active">Set Active</option>
              <option value="draft">Set Draft</option>
              <option value="archived">Set Archived</option>
            </Select>

            <Button
              variant="secondary"
              onClick={() => handleExportCsv(true)}
              className="text-xs py-1.5 px-3 bg-indigo-800 text-white hover:bg-indigo-700 border-indigo-700"
            >
              Export Selected
            </Button>

            <Button
              variant="danger"
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              className="text-xs py-1.5 px-3 inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          </div>
        </div>
      )}

      {/* Questions Listing */}
      {questionsLoading && filteredQuestions.length === 0 ? (
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <FileQuestion className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-700 mb-1">No questions found</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-5">
            {activeFiltersCount > 0
              ? 'No questions match the selected filter criteria. Try resetting filters or changing your search terms.'
              : 'Your question bank is empty. Get started by creating your first question or importing a CSV template.'}
          </p>
          <div className="flex justify-center gap-3">
            {activeFiltersCount > 0 ? (
              <Button variant="secondary" onClick={resetFilters}>Reset All Filters</Button>
            ) : (
              <>
                <Button onClick={handleOpenCreate}>+ Create First Question</Button>
                <Button variant="secondary" onClick={() => setIsImportModalOpen(true)}>Import Sample CSV</Button>
              </>
            )}
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQuestions.map(q => {
            const isSelected = selectedIds.includes(q.id);
            const usage = questionUsageMap.get(q.id) || [];

            return (
              <div
                key={q.id}
                className={`bg-white rounded-xl border p-4 shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                  isSelected ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50/20' : 'border-slate-200'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(q.id)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      {renderTypeBadge(q.type)}
                      {renderDifficultyBadge(q.difficulty)}
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {q.marks || 1} {q.marks === 1 ? 'mark' : 'marks'}
                      </span>
                      {q.status !== 'active' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-200 text-slate-700">
                          {q.status}
                        </span>
                      )}
                    </div>

                    {/* Usage Badge */}
                    <button
                      onClick={() => setUsageModalQuestion(q)}
                      className={`text-xs px-2 py-0.5 rounded-md font-medium border cursor-pointer transition-colors inline-flex items-center gap-1 ${
                        usage.length > 0
                          ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                      title={usage.length > 0 ? `Used in ${usage.length} exams. Click to view.` : 'Not used in any exams yet'}
                    >
                      <Layers className="w-3 h-3" />
                      {usage.length > 0 ? `${usage.length} exam${usage.length > 1 ? 's' : ''}` : 'Unused'}
                    </button>
                  </div>

                  {/* Subject, Class & Topic Breadcrumb */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 flex-wrap">
                    <span className="font-semibold text-slate-700">{q.subject}</span>
                    <span>·</span>
                    <span className="text-indigo-600 font-medium">{q.class}</span>
                    {q.topic && (
                      <>
                        <span>·</span>
                        <span className="text-slate-600">{q.topic}</span>
                      </>
                    )}
                    {q.subtopic && (
                      <>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-500">{q.subtopic}</span>
                      </>
                    )}
                  </div>

                  {/* Question Text */}
                  <h4 className="text-base font-bold text-slate-800 line-clamp-3 my-1">
                    {q.q}
                  </h4>

                  {/* Diagram thumbnail if diagram */}
                  {q.type === 'diagram' && q.image && (
                    <div className="my-2 p-1 bg-slate-50 border border-slate-200 rounded-lg inline-block">
                      <img
                        src={q.image}
                        alt="Diagram thumbnail"
                        className="h-24 max-w-full object-contain rounded"
                      />
                    </div>
                  )}

                  {/* Tags */}
                  {q.tags && q.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {q.tags.map((tag, i) => (
                        <span key={i} className="inline-flex items-center gap-0.5 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          <Tag className="w-2.5 h-2.5 text-slate-400" /> {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
                  <div className="text-[11px] text-slate-400">
                    By {q.createdBy || 'Teacher'} · {new Date(q.updatedAt || q.createdAt).toLocaleDateString()}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setPreviewQuestion(q); setShowTeacherSolution(false); }}
                      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
                      title="Preview question (Student & Teacher view)"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenAddToExam(q)}
                      className="p-1.5 rounded-md hover:bg-slate-100 text-indigo-600 transition-colors"
                      title="Add to an exam"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(q)}
                      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
                      title="Edit question"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(q)}
                      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
                      title="Duplicate question"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePrompt(q)}
                      className="p-1.5 rounded-md hover:bg-red-50 text-red-600 transition-colors"
                      title="Delete question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="p-3 font-semibold">Question</th>
                <th className="p-3 font-semibold">Type</th>
                <th className="p-3 font-semibold">Subject & Class</th>
                <th className="p-3 font-semibold">Topic</th>
                <th className="p-3 font-semibold">Difficulty</th>
                <th className="p-3 font-semibold">Usage</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuestions.map(q => {
                const isSelected = selectedIds.includes(q.id);
                const usage = questionUsageMap.get(q.id) || [];

                return (
                  <tr
                    key={q.id}
                    className={`border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors ${
                      isSelected ? 'bg-indigo-50/30' : ''
                    }`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(q.id)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 max-w-md">
                      <div className="font-semibold text-slate-800 line-clamp-2">{q.q}</div>
                      {q.tags && q.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {q.tags.slice(0, 2).map((t, idx) => (
                            <span key={idx} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">{renderTypeBadge(q.type)}</td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-medium text-slate-800">{q.subject}</div>
                      <div className="text-xs text-indigo-600 font-medium">{q.class}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-slate-800">{q.topic || '—'}</div>
                      {q.subtopic && <div className="text-xs text-slate-500">{q.subtopic}</div>}
                    </td>
                    <td className="p-3 whitespace-nowrap">{renderDifficultyBadge(q.difficulty)}</td>
                    <td className="p-3 whitespace-nowrap">
                      <button
                        onClick={() => setUsageModalQuestion(q)}
                        className={`text-xs px-2 py-0.5 rounded font-medium border ${
                          usage.length > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}
                      >
                        {usage.length > 0 ? `${usage.length} exams` : '0 exams'}
                      </button>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setPreviewQuestion(q); setShowTeacherSolution(false); }}
                          className="p-1 rounded hover:bg-slate-100 text-slate-600"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenAddToExam(q)}
                          className="p-1 rounded hover:bg-slate-100 text-indigo-600"
                          title="Add to Exam"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(q)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-600"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(q)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-600"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePrompt(q)}
                          className="p-1 rounded hover:bg-red-50 text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE / EDIT QUESTION MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        {editingQuestion && (
          <QuestionEditorForm
            question={editingQuestion}
            subjects={uniqueSubjects}
            classes={uniqueClasses}
            existingTopics={availableTopics}
            onCancel={() => setIsEditorOpen(false)}
            onSave={async (updated) => {
              updateData(draft => {
                if (!Array.isArray(draft.questions)) draft.questions = [];
                const idx = draft.questions.findIndex(x => x.id === updated.id);
                if (idx >= 0) {
                  draft.questions[idx] = updated;
                } else {
                  draft.questions.unshift(updated);
                }
              });
              if (schoolId) {
                try {
                  await QuestionBankRepository.upsertQuestion(schoolId, updated);
                  showToast('Question saved and persisted successfully to Bank');
                } catch (err: any) {
                  console.error('Error saving question to Firestore:', err);
                  showToast(`Saved locally, but Firestore persistence failed: ${err.message || ''}`);
                }
              } else {
                showToast('Question saved successfully to Bank');
              }
              setIsEditorOpen(false);
            }}
          />
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* QUESTION PREVIEW MODAL (Student Simulator + Teacher Solution Panel) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!previewQuestion}
        onClose={() => setPreviewQuestion(null)}
        className="max-w-2xl"
      >
        {previewQuestion && (
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                {renderTypeBadge(previewQuestion.type)}
                {renderDifficultyBadge(previewQuestion.difficulty)}
                <span className="text-xs text-slate-500 font-medium">
                  {previewQuestion.subject} · {previewQuestion.class}
                </span>
              </div>
              <button
                onClick={() => setPreviewQuestion(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Student Exam Simulation Box */}
            <div className="bg-slate-50 border-2 border-indigo-100 rounded-xl p-5 mb-4">
              <div className="flex justify-between items-start gap-4 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                  Assessment Question Preview
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                  {previewQuestion.marks || 1} {(previewQuestion.marks || 1) === 1 ? 'Point' : 'Points'}
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-900 mt-1 mb-4 leading-relaxed">
                {previewQuestion.q}
              </h3>

              {/* Diagram Render */}
              {previewQuestion.type === 'diagram' && previewQuestion.image && (
                <div className="mb-4 text-center">
                  <img
                    src={previewQuestion.image}
                    alt="Diagram"
                    className="max-h-64 max-w-full inline-block rounded-xl border border-slate-200 shadow-sm"
                  />
                </div>
              )}

              {/* MCQ Options / Diagram Options */}
              {(previewQuestion.type === 'mcq' || previewQuestion.type === 'diagram') && (
                <div className="space-y-2">
                  {(previewQuestion.options || []).map((opt, i) => (
                    <label
                      key={i}
                      className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <input type="radio" name="preview_choice" className="text-indigo-600" />
                      <span className="font-semibold text-xs text-slate-400 uppercase w-4">{String.fromCharCode(65 + i)}</span>
                      <span className="text-sm text-slate-800">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* True / False */}
              {previewQuestion.type === 'true_false' && (
                <div className="grid grid-cols-2 gap-3">
                  {['True', 'False'].map(opt => (
                    <label
                      key={opt}
                      className="flex items-center justify-center p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 text-center font-bold text-sm"
                    >
                      <input type="radio" name="preview_tf" className="mr-2" />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {/* Fill in the blank */}
              {previewQuestion.type === 'fill_blank' && (
                <div>
                  <Input placeholder="Type student answer here..." className="bg-white" disabled />
                </div>
              )}
            </div>

            {/* Teacher Solution & Key Inspector Toggle */}
            <div className="bg-slate-100 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Teacher Solution Key & Metadata</span>
                <Button
                  variant="secondary"
                  onClick={() => setShowTeacherSolution(p => !p)}
                  className="text-xs py-1 px-3"
                >
                  {showTeacherSolution ? 'Hide Solution' : 'Reveal Solution Key'}
                </Button>
              </div>

              {showTeacherSolution && (
                <div className="mt-3 pt-3 border-t border-slate-200 text-xs space-y-2 text-slate-700">
                  <div>
                    <span className="font-bold">Correct Answer: </span>
                    <span className="font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                      {previewQuestion.type === 'true_false'
                        ? (previewQuestion.ans ? 'True' : 'False')
                        : previewQuestion.type === 'fill_blank'
                        ? previewQuestion.answer
                        : (previewQuestion.options?.[Number(previewQuestion.ans)] || `Option ${previewQuestion.ans}`)}
                    </span>
                  </div>

                  {previewQuestion.type === 'fill_blank' && previewQuestion.answers && previewQuestion.answers.length > 0 && (
                    <div>
                      <span className="font-bold">Accepted Alternatives: </span>
                      <span>{previewQuestion.answers.join(', ')}</span>
                    </div>
                  )}

                  {previewQuestion.explanation && (
                    <div>
                      <span className="font-bold">Explanation / Solution: </span>
                      <p className="mt-0.5 text-slate-600 bg-white p-2 rounded border border-slate-200">
                        {previewQuestion.explanation}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-slate-500 pt-2 border-t border-slate-200">
                    <div>Topic: <strong className="text-slate-700">{previewQuestion.topic || '—'}</strong></div>
                    <div>Subtopic: <strong className="text-slate-700">{previewQuestion.subtopic || '—'}</strong></div>
                    <div>Created by: <strong className="text-slate-700">{previewQuestion.createdBy}</strong></div>
                    <div>Usage count: <strong className="text-slate-700">{(questionUsageMap.get(previewQuestion.id) || []).length} exams</strong></div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  handleOpenAddToExam(previewQuestion);
                  setPreviewQuestion(null);
                }}
              >
                Add to Exam
              </Button>
              <Button onClick={() => setPreviewQuestion(null)}>Close Preview</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* EXAM USAGE MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!usageModalQuestion}
        onClose={() => setUsageModalQuestion(null)}
        className="max-w-lg"
      >
        {usageModalQuestion && (
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-800 m-0">Question Usage in Exams</h3>
              </div>
              <button
                onClick={() => setUsageModalQuestion(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              Question: <strong className="text-slate-700 line-clamp-1">{usageModalQuestion.q}</strong>
            </p>

            {(() => {
              const usageExams = questionUsageMap.get(usageModalQuestion.id) || [];
              if (usageExams.length === 0) {
                return (
                  <div className="p-6 text-center bg-slate-50 rounded-xl text-slate-500 text-sm">
                    This question is not currently attached to any examination.
                  </div>
                );
              }

              return (
                <div className="max-h-72 overflow-y-auto space-y-2 mb-4">
                  {usageExams.map(ex => (
                    <div
                      key={ex.id}
                      className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{ex.title}</div>
                        <div className="text-xs text-slate-500">
                          {ex.subject} · {ex.type} · Classes: {ex.targetClasses?.join(', ') || 'All'}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                        ex.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {ex.status}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="flex justify-end">
              <Button onClick={() => setUsageModalQuestion(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* ADD SELECTED QUESTIONS TO EXAM MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddToExamOpen}
        onClose={() => setIsAddToExamOpen(false)}
        className="max-w-md"
      >
        <div>
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 m-0">Add Questions to Exam</h3>
            <button onClick={() => setIsAddToExamOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-slate-500 mb-4">
            Adding <strong className="text-indigo-600">{selectedIds.length}</strong> selected questions.
          </p>

          <div className="flex gap-2 mb-4 border border-slate-200 p-1 rounded-lg bg-slate-50">
            <button
              className={`flex-1 py-1.5 text-xs font-bold rounded ${
                addToExamTarget === 'existing' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'
              }`}
              onClick={() => setAddToExamTarget('existing')}
            >
              Add to Existing Exam
            </button>
            <button
              className={`flex-1 py-1.5 text-xs font-bold rounded ${
                addToExamTarget === 'new' ? 'bg-white shadow text-indigo-700' : 'text-slate-500'
              }`}
              onClick={() => setAddToExamTarget('new')}
            >
              Create New Exam
            </button>
          </div>

          {addToExamTarget === 'existing' ? (
            <div className="space-y-3 mb-5">
              <Label>Select Target Examination</Label>
              {exams.length === 0 ? (
                <p className="text-xs text-slate-500">No exams created yet. Please select "Create New Exam".</p>
              ) : (
                <Select
                  value={selectedExamId}
                  onChange={e => setSelectedExamId(e.target.value)}
                >
                  {exams.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({e.subject} - {e.questions?.length || 0} questions - {e.status})
                    </option>
                  ))}
                </Select>
              )}
            </div>
          ) : (
            <div className="space-y-3 mb-5">
              <div>
                <Label>New Exam Title</Label>
                <Input
                  value={newExamTitle}
                  onChange={e => setNewExamTitle(e.target.value)}
                  placeholder="e.g., Primary 5 Mid-Term Mathematics"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Subject</Label>
                  <Select value={newExamSubject} onChange={e => setNewExamSubject(e.target.value)}>
                    {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Class</Label>
                  <Select value={newExamClass} onChange={e => setNewExamClass(e.target.value)}>
                    {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
              </div>

              <div>
                <Label>Duration (Minutes)</Label>
                <Input
                  type="number"
                  min="1"
                  value={newExamDuration}
                  onChange={e => setNewExamDuration(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsAddToExamOpen(false)}>Cancel</Button>
            <Button onClick={confirmAddToExam}>
              {addToExamTarget === 'existing' ? 'Append to Exam' : 'Create & Populate Exam'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* IMPORT MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => { setIsImportModalOpen(false); setImportPreview(null); }}
        className="max-w-2xl"
      >
        <div>
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-800 m-0">Import Questions into Bank</h3>
            </div>
            <button
              onClick={() => { setIsImportModalOpen(false); setImportPreview(null); }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center mb-4 bg-slate-50">
            <input
              type="file"
              accept=".csv,.json"
              id="qb-file-input"
              className="hidden"
              onChange={handleImportFileChange}
            />
            <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 mb-1">
              Select or drop a CSV or JSON file
            </p>
            <p className="text-xs text-slate-500 mb-3">
              Supports standard CSV column layout or legacy EduCore question export formats.
            </p>
            <div className="flex justify-center gap-2">
              <Button
                variant="secondary"
                onClick={() => document.getElementById('qb-file-input')?.click()}
                className="text-xs"
              >
                Choose File...
              </Button>
              <Button
                variant="secondary"
                onClick={downloadSampleTemplate}
                className="text-xs"
              >
                Download CSV Sample
              </Button>
            </div>
            {importFileName && (
              <p className="text-xs font-bold text-indigo-600 mt-2">
                Selected: {importFileName}
              </p>
            )}
          </div>

          {importPreview && (
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-700">
                  ✓ Valid questions detected: {importPreview.valid.length}
                </span>
                {importPreview.errors.length > 0 && (
                  <span className="font-bold text-rose-600">
                    ⚠ Issues encountered: {importPreview.errors.length}
                  </span>
                )}
              </div>

              {importPreview.errors.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg max-h-24 overflow-y-auto">
                  {importPreview.errors.map((e, idx) => <div key={idx}>• {e}</div>)}
                </div>
              )}

              {importPreview.valid.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-2">Type</th>
                        <th className="p-2">Question</th>
                        <th className="p-2">Subject</th>
                        <th className="p-2">Difficulty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.valid.slice(0, 10).map((q, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="p-2 font-mono uppercase">{q.type}</td>
                          <td className="p-2 font-semibold line-clamp-1">{q.q}</td>
                          <td className="p-2">{q.subject}</td>
                          <td className="p-2">{q.difficulty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importPreview.valid.length > 10 && (
                    <div className="p-2 text-center text-slate-400 bg-slate-50 border-t border-slate-200">
                      ...and {importPreview.valid.length - 10} more questions
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => { setIsImportModalOpen(false); setImportPreview(null); }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmImport}
              disabled={!importPreview || importPreview.valid.length === 0}
            >
              Import {importPreview ? importPreview.valid.length : 0} Questions
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODALS */}
      {/* ========================================================================= */}
      {deleteConfirmQuestion && (
        <Modal
          isOpen={!!deleteConfirmQuestion}
          onClose={() => setDeleteConfirmQuestion(null)}
          className="max-w-md text-center"
        >
          <div className="p-2">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Delete Question?</h3>
            <p className="text-xs text-slate-500 mb-3">
              Are you sure you want to remove this question from the Question Bank?
            </p>

            {(() => {
              const usage = questionUsageMap.get(deleteConfirmQuestion.id) || [];
              if (usage.length > 0) {
                return (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs text-left mb-4">
                    <strong>Warning:</strong> This question is currently used in <strong>{usage.length}</strong> active exams (e.g. {usage.map(u => u.title).slice(0, 2).join(', ')}). Existing exam copies will remain preserved.
                  </div>
                );
              }
              return null;
            })()}

            <div className="flex justify-center gap-2">
              <Button variant="secondary" onClick={() => setDeleteConfirmQuestion(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDeleteQuestion}>Yes, Delete Question</Button>
            </div>
          </div>
        </Modal>
      )}

      {isBulkDeleteConfirmOpen && (
        <Modal
          isOpen={isBulkDeleteConfirmOpen}
          onClose={() => setIsBulkDeleteConfirmOpen(false)}
          className="max-w-md text-center"
        >
          <div className="p-2">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Bulk Delete Questions?</h3>
            <p className="text-xs text-slate-500 mb-4">
              Are you sure you want to permanently delete <strong>{selectedIds.length}</strong> selected questions from your school Question Bank?
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="secondary" onClick={() => setIsBulkDeleteConfirmOpen(false)}>Cancel</Button>
              <Button variant="danger" onClick={confirmBulkDelete}>Delete {selectedIds.length} Questions</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * Question Editor Form Component
 */
function QuestionEditorForm({
  question,
  subjects,
  classes,
  existingTopics,
  onSave,
  onCancel
}: {
  question: BankQuestion;
  subjects: string[];
  classes: string[];
  existingTopics: string[];
  onSave: (q: BankQuestion) => void;
  onCancel: () => void;
}) {
  const showToast = useToastStore(s => s.showToast);

  const [form, setForm] = useState<BankQuestion>({ ...question });
  const [tagInput, setTagInput] = useState('');

  const handleTypeChange = (newType: QuestionType) => {
    setForm(prev => {
      const updated = { ...prev, type: newType };
      if (newType === 'mcq' || newType === 'diagram') {
        if (!updated.options || updated.options.length < 2) {
          updated.options = ['Option A', 'Option B', 'Option C', 'Option D'];
        }
        updated.ans = 0;
      } else if (newType === 'true_false') {
        updated.ans = true;
      } else if (newType === 'fill_blank') {
        if (!updated.answer) updated.answer = '';
        if (!updated.answers) updated.answers = [];
      }
      return updated;
    });
  };

  const handleAddOption = () => {
    setForm(prev => ({
      ...prev,
      options: [...(prev.options || []), `Option ${String.fromCharCode(65 + (prev.options?.length || 0))}`]
    }));
  };

  const handleRemoveOption = (index: number) => {
    setForm(prev => {
      const opts = (prev.options || []).filter((_, i) => i !== index);
      let ans = typeof prev.ans === 'number' ? prev.ans : 0;
      if (ans >= opts.length) ans = Math.max(0, opts.length - 1);
      return { ...prev, options: opts, ans };
    });
  };

  const handleOptionChange = (index: number, val: string) => {
    setForm(prev => {
      const opts = [...(prev.options || [])];
      opts[index] = val;
      return { ...prev, options: opts };
    });
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    const clean = tagInput.trim().replace(/^#/, '');
    if (!form.tags.includes(clean)) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, clean] }));
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const handleAddAcceptedAnswer = (val: string) => {
    if (!val.trim()) return;
    const clean = val.trim();
    if (!form.answers?.includes(clean)) {
      setForm(prev => ({ ...prev, answers: [...(prev.answers || []), clean] }));
    }
  };

  const handleRemoveAcceptedAnswer = (val: string) => {
    setForm(prev => ({ ...prev, answers: (prev.answers || []).filter(a => a !== val) }));
  };

  const handleImageFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImageFile(file, 800, 800, 0.8);
      setForm(prev => ({ ...prev, image: compressedDataUrl }));
    } catch (err) {
      console.warn('Image compression fallback:', err);
      const reader = new FileReader();
      reader.onload = () => {
        setForm(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!form.q.trim()) {
      showToast('Question text is required');
      return;
    }

    if (!form.subject.trim()) {
      showToast('Subject is required');
      return;
    }

    if (!form.class.trim()) {
      showToast('Class is required');
      return;
    }

    if (form.type === 'mcq' || form.type === 'diagram') {
      if (!form.options || form.options.length < 2) {
        showToast('At least 2 options are required');
        return;
      }
      if (form.options.some(o => !o.trim())) {
        showToast('All option fields must have text');
        return;
      }
      if (form.type === 'diagram' && !form.image) {
        showToast('Please upload an image or provide an image URL for the diagram question');
        return;
      }
    } else if (form.type === 'fill_blank') {
      if (!form.answer?.trim()) {
        showToast('Primary correct answer is required for fill in the blank');
        return;
      }
    }

    onSave({
      ...form,
      updatedAt: new Date().toISOString()
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
        <h3 className="text-xl font-bold text-slate-800 m-0">
          {form.id.includes('imp') || form.id.includes('qb_') ? 'Edit Question' : 'Create Question'}
        </h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Question Type Selection */}
        <div>
          <Label>Question Type</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
            {[
              { type: 'mcq', label: 'Multiple Choice', icon: CheckSquare },
              { type: 'true_false', label: 'True / False', icon: HelpCircle },
              { type: 'fill_blank', label: 'Fill in Blank', icon: FileQuestion },
              { type: 'diagram', label: 'Diagram / Image', icon: ImageIcon }
            ].map(item => {
              const Icon = item.icon;
              const isSelected = form.type === item.type;
              return (
                <button
                  type="button"
                  key={item.type}
                  onClick={() => handleTypeChange(item.type as QuestionType)}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-200'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question Text */}
        <div>
          <Label>Question Text *</Label>
          <Textarea
            rows={3}
            value={form.q}
            onChange={e => setForm(prev => ({ ...prev, q: e.target.value }))}
            placeholder="Type your question prompt here..."
          />
        </div>

        {/* Core Metadata Row: Subject, Class, Topic, Subtopic */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>Subject *</Label>
            <Select
              value={form.subject}
              onChange={e => setForm(prev => ({ ...prev, subject: e.target.value }))}
            >
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>

          <div>
            <Label>Class *</Label>
            <Select
              value={form.class}
              onChange={e => setForm(prev => ({ ...prev, class: e.target.value }))}
            >
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>

          <div>
            <Label>Topic</Label>
            <Input
              value={form.topic}
              onChange={e => setForm(prev => ({ ...prev, topic: e.target.value }))}
              placeholder="e.g. Fractions, Grammar"
              list="topic-datalist"
            />
            <datalist id="topic-datalist">
              {existingTopics.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>

          <div>
            <Label>Subtopic</Label>
            <Input
              value={form.subtopic}
              onChange={e => setForm(prev => ({ ...prev, subtopic: e.target.value }))}
              placeholder="e.g. Simplification"
            />
          </div>
        </div>

        {/* Difficulty, Marks, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Difficulty</Label>
            <Select
              value={form.difficulty}
              onChange={e => setForm(prev => ({ ...prev, difficulty: e.target.value as QuestionDifficulty }))}
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </Select>
          </div>

          <div>
            <Label>Marks</Label>
            <Input
              type="number"
              min="0.5"
              step="0.5"
              value={form.marks}
              onChange={e => setForm(prev => ({ ...prev, marks: Number(e.target.value) || 1 }))}
            />
          </div>

          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onChange={e => setForm(prev => ({ ...prev, status: e.target.value as BankQuestionStatus }))}
            >
              <option value="active">Active (Available for exams)</option>
              <option value="draft">Draft (Work in progress)</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
        </div>

        {/* Diagram Image Upload / URL Input (if Diagram type) */}
        {form.type === 'diagram' && (
          <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-3">
            <Label className="text-indigo-900 mt-0">Diagram / Reference Image *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-slate-500 block mb-1">Upload from computer:</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
                />
              </div>
              <div>
                <span className="text-xs text-slate-500 block mb-1">Or paste image URL:</span>
                <Input
                  value={form.image}
                  onChange={e => setForm(prev => ({ ...prev, image: e.target.value }))}
                  placeholder="https://example.com/diagram.png"
                  className="bg-white text-xs mt-0"
                />
              </div>
            </div>

            {form.image && (
              <div className="mt-2 text-center p-2 bg-white rounded-lg border border-indigo-100 relative inline-block">
                <img
                  src={form.image}
                  alt="Diagram preview"
                  className="max-h-40 max-w-full rounded object-contain"
                />
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, image: '' }))}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700"
                  title="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Question Answers & Options Config */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <Label className="text-slate-800 mt-0 mb-2">Options & Answer Key</Label>

          {/* MCQ and Diagram Options */}
          {(form.type === 'mcq' || form.type === 'diagram') && (
            <div className="space-y-2">
              <span className="text-xs text-slate-500 block mb-2">
                Provide options and click the radio button beside the correct answer:
              </span>
              {(form.options || []).map((opt, i) => {
                const isCorrect = form.ans === i;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <label
                      className={`flex items-center justify-center w-8 h-9 rounded-lg border font-bold text-xs cursor-pointer ${
                        isCorrect ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-600 border-slate-300'
                      }`}
                      title={isCorrect ? 'Correct answer' : 'Click to mark as correct answer'}
                    >
                      <input
                        type="radio"
                        name="correct_option"
                        checked={isCorrect}
                        onChange={() => setForm(prev => ({ ...prev, ans: i }))}
                        className="hidden"
                      />
                      {String.fromCharCode(65 + i)}
                    </label>

                    <Input
                      value={opt}
                      onChange={e => handleOptionChange(i, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + i)} text`}
                      className={`mt-0 ${isCorrect ? 'border-emerald-500 bg-emerald-50/20' : 'bg-white'}`}
                    />

                    {(form.options?.length || 0) > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(i)}
                        className="p-2 text-slate-400 hover:text-red-600"
                        title="Delete option"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}

              {(form.options?.length || 0) < 6 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddOption}
                  className="text-xs mt-2"
                >
                  + Add Option ({String.fromCharCode(65 + (form.options?.length || 0))})
                </Button>
              )}
            </div>
          )}

          {/* True / False Options */}
          {form.type === 'true_false' && (
            <div className="grid grid-cols-2 gap-3">
              {[true, false].map((val) => {
                const isCorrect = form.ans === val;
                return (
                  <label
                    key={String(val)}
                    className={`flex items-center justify-center p-3 rounded-lg border text-sm font-bold cursor-pointer transition-all ${
                      isCorrect
                        ? 'bg-emerald-100 border-emerald-500 text-emerald-800 ring-2 ring-emerald-200'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tf_answer"
                      checked={isCorrect}
                      onChange={() => setForm(prev => ({ ...prev, ans: val }))}
                      className="mr-2 text-emerald-600"
                    />
                    {val ? 'True' : 'False'}
                  </label>
                );
              })}
            </div>
          )}

          {/* Fill in the blank Answers */}
          {form.type === 'fill_blank' && (
            <div className="space-y-3">
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1">Primary Correct Answer *</span>
                <Input
                  value={form.answer || ''}
                  onChange={e => setForm(prev => ({ ...prev, answer: e.target.value }))}
                  placeholder="e.g. Abuja"
                  className="bg-white"
                />
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-600 block mb-1">
                  Accepted Alternative Answers (case-insensitive, synonyms, spelling variants):
                </span>
                <div className="flex gap-2">
                  <Input
                    id="new-accepted-alt"
                    placeholder="Type alternate answer and press Add..."
                    className="bg-white text-xs mt-0"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value;
                        handleAddAcceptedAnswer(val);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-xs"
                    onClick={() => {
                      const input = document.getElementById('new-accepted-alt') as HTMLInputElement;
                      if (input) {
                        handleAddAcceptedAnswer(input.value);
                        input.value = '';
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>

                {form.answers && form.answers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.answers.map((alt, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-xs bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-full shadow-sm"
                      >
                        {alt}
                        <button
                          type="button"
                          onClick={() => handleRemoveAcceptedAnswer(alt)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Explanation / Teacher Working */}
        <div>
          <Label>Explanation / Solution Notes (optional)</Label>
          <Textarea
            rows={2}
            value={form.explanation || ''}
            onChange={e => setForm(prev => ({ ...prev, explanation: e.target.value }))}
            placeholder="Explain why the answer is correct and list step-by-step solutions..."
          />
        </div>

        {/* Tags */}
        <div>
          <Label>Tags</Label>
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              placeholder="e.g. WAEC, Mental Math, Term 1 (Press Enter to add)"
              className="mt-0"
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={handleAddTag} className="text-xs">
              Add Tag
            </Button>
          </div>
          {form.tags && form.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-1 rounded-full"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-indigo-400 hover:text-indigo-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-200">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit}>Save to Question Bank</Button>
      </div>
    </div>
  );
}
