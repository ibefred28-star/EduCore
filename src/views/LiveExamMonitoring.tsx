import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { Card, Button, Input, Label, Select, Modal } from '../components/ui';
import { Exam, Student } from '../types';
import { isStudentInTeacherClasses } from '../lib/classUtils';
import {
  LiveStudentSession,
  LiveConnectionStatus,
  computeConnectionStatus,
  subscribeToExamLiveSessions,
  completeStudentLiveSession
} from '../lib/liveExamService';
import {
  useExamsSubscription,
  useExamAttemptsSubscription,
  useStudentsSubscription,
  useSchoolResultsSubscription
} from '../hooks/useDomainSubscriptions';
import { FirestoreAttemptDoc } from '../lib/firestore/models';
import {
  Activity,
  Radio,
  Wifi,
  WifiOff,
  Clock,
  AlertTriangle,
  CheckCircle2,
  User,
  Search,
  Filter,
  Eye,
  Send,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Check,
  FileCheck,
  X
} from 'lucide-react';

export default function LiveExamMonitoring() {
  const { data, currentRole, currentUser, schoolId } = useStore();
  const showToast = useToastStore(s => s.showToast);

  // Live exams subscription
  const { exams: liveExams } = useExamsSubscription(schoolId);
  // Live students subscription
  const { students: liveStudents } = useStudentsSubscription(schoolId);
  // Live results subscription for all candidates
  const { results: liveResults } = useSchoolResultsSubscription(schoolId);

  // Teacher class boundary
  const teacher = currentRole === 'teacher'
    ? data.teachers.find(t => (t.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase()) || (currentUser as any)
    : null;
  const teacherClasses: string[] = teacher?.classes || [];

  // Filter exams available to this user
  const availableExams = useMemo(() => {
    let list = (liveExams && liveExams.length > 0) ? (liveExams as Exam[]) : (data.exams || []);
    if (currentRole === 'teacher') {
      list = list.filter(e => {
        if (!e.targetClasses || e.targetClasses.length === 0) return true;
        return e.targetClasses.some(c => isStudentInTeacherClasses(c, teacherClasses));
      });
    }
    return list;
  }, [liveExams, data.exams, currentRole, teacherClasses]);

  // Active exams first, or any exam
  const activeExams = useMemo(() => {
    return availableExams.filter(e => e.status === 'active');
  }, [availableExams]);

  // Selected Exam State
  const [selectedExamId, setSelectedExamId] = useState<string | number>(() => {
    if (activeExams.length > 0) return activeExams[0].id;
    if (availableExams.length > 0) return availableExams[0].id;
    return '';
  });

  // Keep selected exam updated if list changes
  useEffect(() => {
    if (!selectedExamId && activeExams.length > 0) {
      setSelectedExamId(activeExams[0].id);
    } else if (!selectedExamId && availableExams.length > 0) {
      setSelectedExamId(availableExams[0].id);
    }
  }, [activeExams, availableExams, selectedExamId]);

  const selectedExam: Exam | undefined = useMemo(() => {
    return availableExams.find(e => String(e.id) === String(selectedExamId));
  }, [availableExams, selectedExamId]);

  // Live sessions received in real time from Firestore listener
  const [liveSessions, setLiveSessions] = useState<LiveStudentSession[]>([]);
  // Local time state to refresh connection presence and remaining time every 5 seconds without database reads
  const [nowTime, setNowTime] = useState<number>(Date.now());

  // Real-time authoritative attempts subscription for the selected exam
  const { attempts: liveAttempts } = useExamAttemptsSubscription(schoolId, selectedExamId);

  // Subscribe to real-time Firestore listener for selected exam proctoring
  useEffect(() => {
    if (!selectedExamId) {
      setLiveSessions([]);
      return;
    }

    const unsub = subscribeToExamLiveSessions(schoolId, selectedExamId, sessions => {
      setLiveSessions(sessions);
    });

    // Refresh presence indicator locally every 5s
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 5000);

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [schoolId, selectedExamId]);

  // Eligible Registered Students for this Exam
  const eligibleStudents: Student[] = useMemo(() => {
    if (!selectedExam) return [];

    // Combine roster from live Firestore students and local store
    const studentMap = new Map<string, Student>();
    const baseList: Student[] = (liveStudents && liveStudents.length > 0)
      ? (liveStudents as Student[])
      : (data.students || []);

    baseList.forEach(s => {
      studentMap.set((s.id || '').trim().toLowerCase(), s);
    });

    // Include any student that has an active liveSession or liveAttempt for this exam
    liveSessions.forEach(ls => {
      const key = (ls.studentId || '').trim().toLowerCase();
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          id: ls.studentId,
          name: ls.studentName || `Pupil ${ls.studentId}`,
          class: ls.studentClass || 'Primary 5',
          photo: ls.photo || '',
          password: ''
        });
      }
    });

    liveAttempts.forEach(la => {
      const key = (la.studentId || '').trim().toLowerCase();
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          id: la.studentId,
          name: la.studentName || `Pupil ${la.studentId}`,
          class: la.studentClass || 'Primary 5',
          photo: '',
          password: ''
        });
      }
    });

    let list = Array.from(studentMap.values());

    // Filter by exam's target classes, but preserve any student with an active session
    if (selectedExam.targetClasses && selectedExam.targetClasses.length > 0) {
      list = list.filter(s => {
        const key = (s.id || '').trim().toLowerCase();
        const hasActiveSession = liveSessions.some(ls => (ls.studentId || '').trim().toLowerCase() === key) ||
          liveAttempts.some(la => (la.studentId || '').trim().toLowerCase() === key);
        if (hasActiveSession) return true;
        return selectedExam.targetClasses!.some(c => isStudentInTeacherClasses(s.class, [c]));
      });
    }

    // Role boundary: teachers strictly see students in their assigned classes (or actively writing)
    if (currentRole === 'teacher' && teacherClasses.length > 0) {
      list = list.filter(s => {
        const key = (s.id || '').trim().toLowerCase();
        const hasActiveSession = liveSessions.some(ls => (ls.studentId || '').trim().toLowerCase() === key) ||
          liveAttempts.some(la => (la.studentId || '').trim().toLowerCase() === key);
        if (hasActiveSession) return true;
        return isStudentInTeacherClasses(s.class, teacherClasses);
      });
    }

    return list;
  }, [selectedExam, liveStudents, data.students, liveSessions, liveAttempts, currentRole, teacherClasses]);

  // Effective results combining live Firestore results and local store
  const allResults = useMemo(() => {
    const map = new Map<string, any>();
    (data.results || []).forEach(r => map.set(String(r.id), r));
    (liveResults || []).forEach(r => map.set(String(r.id), r));
    return Array.from(map.values());
  }, [data.results, liveResults]);

  // Map of student live states combining proctoring sessions and authoritative Firestore attempts
  const combinedStudentStates = useMemo(() => {
    const sessionMap = new Map<string, LiveStudentSession>();
    liveSessions.forEach(s => sessionMap.set((s.studentId || '').trim().toLowerCase(), s));

    const attemptMap = new Map<string, FirestoreAttemptDoc>();
    liveAttempts.forEach(a => attemptMap.set((a.studentId || '').trim().toLowerCase(), a));

    const totalQuestions = selectedExam?.questions?.length || 0;

    return eligibleStudents.map(student => {
      const studentKey = (student.id || '').trim().toLowerCase();
      const live = sessionMap.get(studentKey);
      const attempt = attemptMap.get(studentKey);

      // Check if student has submitted in all results
      const matchedResult = allResults.find(
        r => (r.studentId || '').trim().toLowerCase() === studentKey &&
             String(r.examId) === String(selectedExam?.id)
      );

      let attemptStatus: 'not_started' | 'in_progress' | 'submitted' | 'auto_submitted' = 'not_started';
      let submissionStatus: 'pending' | 'submitted' | 'auto_submitted' = 'pending';
      let progressPercent = 0;
      let answeredCount = 0;
      let currentQuestionIndex = 0;
      let startTime = '';
      let expiryTime = '';
      let lastHeartbeat = 0;
      let violationsCount = 0;
      let submittedAt: string | undefined = undefined;
      let answersSynced = false;
      let gradingStatus: 'pending' | 'in_progress' | 'graded' = 'pending';
      let finalScore: number | undefined = undefined;
      let finalPercentage: number | undefined = undefined;

      if (matchedResult) {
        attemptStatus = 'submitted';
        submissionStatus = 'submitted';
        progressPercent = 100;
        answeredCount = matchedResult.rawMax || totalQuestions;
        violationsCount = matchedResult.violations || 0;
        submittedAt = matchedResult.submittedAt;
        answersSynced = true;
        gradingStatus = 'graded';
        finalScore = matchedResult.raw;
        finalPercentage = matchedResult.percentage;
      } else if (attempt) {
        attemptStatus = attempt.status === 'abandoned' ? 'not_started' : attempt.status;
        submissionStatus = (attempt.status === 'submitted' || attempt.status === 'auto_submitted') ? attempt.status : 'pending';
        answeredCount = attempt.answers ? Object.keys(attempt.answers).length : (live?.answeredCount || 0);
        progressPercent = totalQuestions > 0 ? Math.min(100, Math.round((answeredCount / totalQuestions) * 100)) : 0;
        currentQuestionIndex = attempt.currentQuestionIndex || 0;
        startTime = attempt.startTime || attempt.startedAt || live?.startTime || '';
        expiryTime = attempt.expiryTime || live?.expiryTime || '';
        lastHeartbeat = attempt.lastHeartbeat || live?.lastHeartbeat || 0;
        violationsCount = attempt.violationsCount || live?.violationsCount || 0;
        submittedAt = attempt.submittedAt || live?.submittedAt;
        answersSynced = !!attempt.answers && Object.keys(attempt.answers).length > 0;
        gradingStatus = attempt.gradingStatus || ((attempt.status === 'submitted' || attempt.status === 'auto_submitted') ? 'graded' : 'in_progress');
        finalScore = (live?.finalScore !== undefined) ? live.finalScore : undefined;
        finalPercentage = (live?.finalPercentage !== undefined) ? live.finalPercentage : undefined;
      } else if (live) {
        attemptStatus = live.attemptStatus || 'in_progress';
        submissionStatus = live.submissionStatus || 'pending';
        progressPercent = live.progressPercent || 0;
        answeredCount = live.answeredCount || 0;
        currentQuestionIndex = live.currentQuestionIndex || 0;
        startTime = live.startTime || '';
        expiryTime = live.expiryTime || '';
        lastHeartbeat = live.lastHeartbeat || 0;
        violationsCount = live.violationsCount || 0;
        submittedAt = live.submittedAt;
        answersSynced = live.answeredCount > 0;
        gradingStatus = (live.attemptStatus === 'submitted' || live.attemptStatus === 'auto_submitted') ? 'graded' : 'in_progress';
        finalScore = live.finalScore;
        finalPercentage = live.finalPercentage;
      }

      const sessionObj: LiveStudentSession = {
        schoolId: schoolId || 'default',
        examId: selectedExam ? selectedExam.id : '',
        studentId: student.id,
        studentName: student.name,
        studentClass: student.class,
        photo: student.photo,
        progressPercent,
        answeredCount,
        totalQuestions,
        currentQuestionIndex,
        attemptStatus,
        startTime,
        expiryTime,
        lastHeartbeat,
        violationsCount,
        submissionStatus,
        submittedAt,
        updatedAt: live ? live.updatedAt : (attempt ? new Date(attempt.updatedAt).getTime() : 0),
        answersSynced,
        gradingStatus,
        finalScore,
        finalPercentage
      };

      const conn = computeConnectionStatus(sessionObj, nowTime);
      return {
        ...sessionObj,
        connectionStatus: conn
      };
    });
  }, [eligibleStudents, liveSessions, liveAttempts, selectedExam, data.results, schoolId, nowTime]);

  // Overall Exam Real-Time Metrics
  const examMetrics = useMemo(() => {
    const total = combinedStudentStates.length;
    let notStarted = 0;
    let writing = 0;
    let submitted = 0;
    let autoSubmitted = 0;
    let disconnected = 0;
    let totalProgress = 0;
    let progressContributors = 0;

    combinedStudentStates.forEach(s => {
      if (s.attemptStatus === 'submitted') {
        submitted += 1;
        totalProgress += 100;
        progressContributors += 1;
      } else if (s.attemptStatus === 'auto_submitted') {
        autoSubmitted += 1;
        totalProgress += 100;
        progressContributors += 1;
      } else if (s.attemptStatus === 'not_started') {
        notStarted += 1;
      } else {
        // In Progress
        if (s.connectionStatus === 'active') {
          writing += 1;
        } else {
          disconnected += 1;
        }
        totalProgress += s.progressPercent;
        progressContributors += 1;
      }
    });

    const averageProgress = progressContributors > 0
      ? Math.round(totalProgress / progressContributors)
      : 0;

    return {
      total,
      notStarted,
      writing,
      submitted,
      autoSubmitted,
      disconnected,
      averageProgress
    };
  }, [combinedStudentStates]);

  // Filtering Controls
  type FilterTab = 'all' | 'writing' | 'submitted' | 'not_started' | 'offline' | 'flagged';
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered Student List
  const filteredStudents = useMemo(() => {
    return combinedStudentStates.filter(s => {
      // Tab filter
      if (activeTab === 'writing') {
        if (s.connectionStatus !== 'active' || s.attemptStatus !== 'in_progress') return false;
      } else if (activeTab === 'submitted') {
        if (s.attemptStatus !== 'submitted' && s.attemptStatus !== 'auto_submitted') return false;
      } else if (activeTab === 'not_started') {
        if (s.attemptStatus !== 'not_started') return false;
      } else if (activeTab === 'offline') {
        if (s.connectionStatus !== 'disconnected' && s.connectionStatus !== 'offline') return false;
      } else if (activeTab === 'flagged') {
        if (s.violationsCount <= 0) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inName = s.studentName.toLowerCase().includes(q);
        const inId = s.studentId.toLowerCase().includes(q);
        const inClass = s.studentClass.toLowerCase().includes(q);
        if (!inName && !inId && !inClass) return false;
      }

      return true;
    });
  }, [combinedStudentStates, activeTab, searchQuery]);

  // Detail Modal / Drawer State
  const [inspectStudent, setInspectStudent] = useState<LiveStudentSession | null>(null);

  // Force Auto-Submit Handler
  const handleForceSubmit = async (s: LiveStudentSession) => {
    if (!selectedExam) return;
    await completeStudentLiveSession(schoolId, selectedExam.id, s.studentId, true);
    showToast(`Force-submitted assessment for ${s.studentName}`);
    setInspectStudent(null);
  };

  // Connection badge helper
  const renderConnectionBadge = (status: LiveConnectionStatus, lastHeartbeat: number) => {
    const secondsAgo = lastHeartbeat ? Math.max(0, Math.round((nowTime - lastHeartbeat) / 1000)) : null;

    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Active {secondsAgo !== null && `(${secondsAgo}s ago)`}
          </span>
        );
      case 'disconnected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <WifiOff className="w-3 h-3 text-amber-600" />
            Lagging / Disconnected {secondsAgo !== null && `(${secondsAgo}s)`}
          </span>
        );
      case 'offline':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <WifiOff className="w-3 h-3 text-rose-600" />
            Offline {secondsAgo !== null && `(${Math.round(secondsAgo / 60)}m)`}
          </span>
        );
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            Submitted
          </span>
        );
      case 'not_started':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300">
            <Clock className="w-3 h-3 text-slate-400" />
            Not Started
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Exam Selector */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
              </span>
              <h2 className="text-2xl font-black text-slate-800 m-0">Live Exam Monitoring</h2>
              <span className="bg-red-100 text-red-700 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Real-Time Stream
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-1 mb-0">
              Real-time student heartbeat presence, progress synchronization, and proctoring surveillance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="min-w-[260px]">
              <span className="text-xs font-bold text-slate-500 block mb-1">Select Active Examination:</span>
              <Select
                value={selectedExamId}
                onChange={e => setSelectedExamId(e.target.value)}
                className="font-bold text-sm bg-slate-50 border-slate-300 mt-0"
              >
                {availableExams.length === 0 && <option value="">No examinations available</option>}
                {availableExams.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.status === 'active' ? '🟢 ' : '⚪ '}
                    {ex.title} ({ex.subject} - {ex.targetClasses?.join(', ') || 'All'})
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* Selected Exam Information Header & Real-Time Stats Bar */}
        {selectedExam ? (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <span className="text-lg font-black text-slate-900">{selectedExam.title}</span>
                <span className="text-xs text-slate-500 ml-2">
                  Subject: <strong className="text-slate-700">{selectedExam.subject}</strong> · Classes: <strong className="text-indigo-600">{selectedExam.targetClasses?.join(', ') || 'All Classes'}</strong> · Duration: <strong className="text-slate-700">{selectedExam.duration} min</strong>
                </span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                selectedExam.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                Exam Status: {selectedExam.status}
              </span>
            </div>

            {/* Real-time KPI Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-medium block mb-1">Registered</span>
                <span className="text-2xl font-black text-slate-800">{examMetrics.total}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-medium block mb-1">Not Started</span>
                <span className="text-2xl font-black text-slate-600">{examMetrics.notStarted}</span>
              </div>

              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <span className="text-emerald-700 font-bold block mb-1">Currently Writing</span>
                <span className="text-2xl font-black text-emerald-700">{examMetrics.writing}</span>
              </div>

              <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                <span className="text-blue-700 font-bold block mb-1">Submitted</span>
                <span className="text-2xl font-black text-blue-700">{examMetrics.submitted}</span>
              </div>

              <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
                <span className="text-purple-700 font-bold block mb-1">Auto-Submitted</span>
                <span className="text-2xl font-black text-purple-700">{examMetrics.autoSubmitted}</span>
              </div>

              <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
                <span className="text-rose-700 font-bold block mb-1">Offline / Dropped</span>
                <span className="text-2xl font-black text-rose-700">{examMetrics.disconnected}</span>
              </div>

              <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200">
                <span className="text-indigo-700 font-bold block mb-1">Average Progress</span>
                <span className="text-2xl font-black text-indigo-700">{examMetrics.averageProgress}%</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 p-8 text-center bg-slate-50 rounded-xl text-slate-500 text-sm">
            Please select an examination above to view real-time proctoring telemetry.
          </div>
        )}
      </div>

      {/* Filter Tabs and Search Bar */}
      {selectedExam && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { id: 'all', label: `All (${combinedStudentStates.length})` },
                { id: 'writing', label: `Writing (${examMetrics.writing})` },
                { id: 'submitted', label: `Submitted (${examMetrics.submitted + examMetrics.autoSubmitted})` },
                { id: 'not_started', label: `Not Started (${examMetrics.notStarted})` },
                { id: 'offline', label: `Offline (${examMetrics.disconnected})` },
                { id: 'flagged', label: `Flagged (${combinedStudentStates.filter(s => s.violationsCount > 0).length})` }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as FilterTab)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search student or ID..."
                className="pl-9 mt-0 text-xs py-1.5"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Student Roster Grid */}
      {selectedExam && (
        <div className="space-y-3">
          {filteredStudents.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-sm text-slate-500">
              <Radio className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold mb-1">No students match this filter.</p>
              <p className="text-xs text-slate-400">
                Try clicking "All" to view all enrolled students.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStudents.map(student => {
                const totalQ = student.totalQuestions || selectedExam.questions?.length || 0;
                const isWriting = student.connectionStatus === 'active' && student.attemptStatus === 'in_progress';
                const hasViolations = student.violationsCount > 0;

                return (
                  <div
                    key={student.studentId}
                    className={`bg-white rounded-2xl p-4 border shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                      hasViolations
                        ? 'border-rose-300 ring-2 ring-rose-100 bg-rose-50/20'
                        : isWriting
                        ? 'border-emerald-300 ring-1 ring-emerald-100'
                        : 'border-slate-200'
                    }`}
                  >
                    <div>
                      {/* Card Top: Avatar, Name, ID, Presence Badge */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          {student.photo ? (
                            <img
                              src={student.photo}
                              alt={student.studentName}
                              className="w-10 h-10 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm border border-slate-200">
                              {student.studentName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm m-0 line-clamp-1">
                              {student.studentName}
                            </h4>
                            <span className="text-xs text-slate-400 block">
                              {student.studentId} · {student.studentClass}
                            </span>
                          </div>
                        </div>

                        {renderConnectionBadge(student.connectionStatus || 'not_started', student.lastHeartbeat)}
                      </div>

                      {/* Progress Bar & Question Position */}
                      <div className="space-y-1.5 my-3">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-600">
                            Progress: {student.answeredCount} / {totalQ} questions
                          </span>
                          <span className="text-indigo-600 font-black">{student.progressPercent}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              student.attemptStatus === 'submitted' || student.attemptStatus === 'auto_submitted'
                                ? 'bg-blue-600'
                                : student.progressPercent >= 80
                                ? 'bg-emerald-500'
                                : 'bg-indigo-600'
                            }`}
                            style={{ width: `${student.progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Telemetry info row */}
                      <div className="grid grid-cols-2 gap-2 text-xs py-2 border-t border-slate-100 text-slate-500">
                        <div>
                          <span className="block text-[10px] uppercase text-slate-400">Current Position:</span>
                          <span className="font-bold text-slate-700">
                            {student.attemptStatus === 'not_started'
                              ? 'Not Started'
                              : student.attemptStatus === 'submitted' || student.attemptStatus === 'auto_submitted'
                              ? 'Finished'
                              : `Question ${(student.currentQuestionIndex || 0) + 1}`}
                          </span>
                        </div>

                        <div>
                          <span className="block text-[10px] uppercase text-slate-400">Time Started:</span>
                          <span className="font-medium text-slate-700">
                            {student.startTime ? new Date(student.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                        </div>

                        <div>
                          <span className="block text-[10px] uppercase text-slate-400">Answers Synced:</span>
                          <span className="font-semibold text-slate-700 inline-flex items-center gap-1">
                            {student.answersSynced ? (
                              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px] font-bold border border-emerald-200 inline-flex items-center gap-0.5">
                                <Check className="w-3 h-3 text-emerald-600" /> Synced ({student.answeredCount})
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">Pending ({student.answeredCount})</span>
                            )}
                          </span>
                        </div>

                        <div>
                          <span className="block text-[10px] uppercase text-slate-400">Time Remaining:</span>
                          <span className="font-semibold text-slate-700">
                            {student.expiryTime && (student.attemptStatus === 'in_progress') ? (() => {
                              const sec = Math.max(0, Math.floor((new Date(student.expiryTime).getTime() - nowTime) / 1000));
                              const m = Math.floor(sec / 60);
                              const s = sec % 60;
                              return `${m}m ${s < 10 ? '0' : ''}${s}s`;
                            })() : (student.attemptStatus === 'submitted' || student.attemptStatus === 'auto_submitted') ? (
                              <span className="text-blue-600 font-medium">Submitted</span>
                            ) : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Grading Status & Results Pill if available */}
                      {student.gradingStatus && (
                        <div className="flex items-center justify-between text-xs py-1.5 px-2 bg-slate-50 rounded-lg border border-slate-100">
                          <span className="text-[10px] uppercase text-slate-400 font-bold">Grading Status:</span>
                          {student.gradingStatus === 'graded' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                              <FileCheck className="w-3 h-3 text-emerald-600" /> Graded {student.finalScore !== undefined ? `(${student.finalScore} pts · ${student.finalPercentage}%)` : ''}
                            </span>
                          ) : student.gradingStatus === 'in_progress' ? (
                            <span className="text-[11px] font-semibold text-amber-700">Grading / Processing</span>
                          ) : (
                            <span className="text-[11px] text-slate-500">Pending</span>
                          )}
                        </div>
                      )}

                      {/* Anti-cheat Violations Indicator */}
                      {hasViolations && (
                        <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-xs text-rose-800">
                          <span className="flex items-center gap-1 font-bold">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            {student.violationsCount} {student.violationsCount === 1 ? 'Violation' : 'Violations'} Detected
                          </span>
                          <span className="text-[10px] bg-rose-200 px-1.5 py-0.5 rounded font-mono font-bold">
                            Tab Switch
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Action Drawer Button */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-400">
                        Status: <strong className="text-slate-600 capitalize">{student.attemptStatus.replace('_', ' ')}</strong>
                      </span>

                      <Button
                        variant="secondary"
                        onClick={() => setInspectStudent(student)}
                        className="text-xs py-1 px-2.5 inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Inspect
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAILED STUDENT MONITORING MODAL / DRAWER */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!inspectStudent}
        onClose={() => setInspectStudent(null)}
        className="max-w-lg"
      >
        {inspectStudent && (
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-800 m-0">Student Proctor Telemetry</h3>
              </div>
              <button
                onClick={() => setInspectStudent(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Header */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4">
              <div className="flex items-center gap-3">
                {inspectStudent.photo ? (
                  <img
                    src={inspectStudent.photo}
                    alt={inspectStudent.studentName}
                    className="w-12 h-12 rounded-full object-cover border"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-lg">
                    {inspectStudent.studentName.charAt(0)}
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-slate-900 m-0 text-base">{inspectStudent.studentName}</h4>
                  <span className="text-xs text-slate-500 block">
                    ID: <strong>{inspectStudent.studentId}</strong> · Class: <strong>{inspectStudent.studentClass}</strong>
                  </span>
                </div>
              </div>

              {renderConnectionBadge(inspectStudent.connectionStatus || 'not_started', inspectStudent.lastHeartbeat)}
            </div>

            {/* Telemetry Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 block mb-0.5 uppercase text-[10px] font-bold">Progress Completed:</span>
                <span className="text-xl font-black text-indigo-600">
                  {inspectStudent.progressPercent}%
                </span>
                <span className="text-slate-500 block mt-0.5">
                  {inspectStudent.answeredCount} of {inspectStudent.totalQuestions} questions answered
                </span>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 block mb-0.5 uppercase text-[10px] font-bold">Current Screen:</span>
                <span className="text-xl font-black text-slate-800">
                  {inspectStudent.attemptStatus === 'not_started'
                    ? 'Offline'
                    : inspectStudent.attemptStatus === 'submitted' || inspectStudent.attemptStatus === 'auto_submitted'
                    ? 'Submitted'
                    : `Question ${(inspectStudent.currentQuestionIndex || 0) + 1}`}
                </span>
                <span className="text-slate-500 block mt-0.5">Active viewport position</span>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 block mb-0.5 uppercase text-[10px] font-bold">Exam Session Start:</span>
                <span className="font-bold text-slate-800 text-sm">
                  {inspectStudent.startTime ? new Date(inspectStudent.startTime).toLocaleTimeString() : 'Not Started'}
                </span>
                <span className="text-slate-400 block text-[11px] mt-0.5">
                  {inspectStudent.submittedAt ? `Submitted: ${new Date(inspectStudent.submittedAt).toLocaleTimeString()}` : 'In progress'}
                </span>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 block mb-0.5 uppercase text-[10px] font-bold">Authoritative Time Remaining:</span>
                <span className="font-bold text-slate-800 text-sm">
                  {inspectStudent.expiryTime && inspectStudent.attemptStatus === 'in_progress' ? (() => {
                    const sec = Math.max(0, Math.floor((new Date(inspectStudent.expiryTime).getTime() - nowTime) / 1000));
                    const m = Math.floor(sec / 60);
                    const s = sec % 60;
                    return `${m}m ${s < 10 ? '0' : ''}${s}s remaining`;
                  })() : inspectStudent.attemptStatus === 'submitted' || inspectStudent.attemptStatus === 'auto_submitted' ? (
                    'Submitted'
                  ) : '—'}
                </span>
                <span className="text-slate-400 block text-[11px] mt-0.5">
                  Expiry: {inspectStudent.expiryTime ? new Date(inspectStudent.expiryTime).toLocaleTimeString() : '—'}
                </span>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 block mb-0.5 uppercase text-[10px] font-bold">Answers Synchronization:</span>
                <div className="flex items-center gap-1.5 mt-1">
                  {inspectStudent.answersSynced ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-xs border border-emerald-200">
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Answers Synced
                    </span>
                  ) : (
                    <span className="text-slate-500 text-xs">Awaiting client push</span>
                  )}
                </div>
                <span className="text-slate-500 block text-[11px] mt-1">
                  {inspectStudent.answeredCount} answers recorded in attempt
                </span>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="text-slate-400 block mb-0.5 uppercase text-[10px] font-bold">Grading & Result Status:</span>
                <div className="mt-1">
                  {inspectStudent.gradingStatus === 'graded' ? (
                    <span className="inline-flex items-center gap-1 text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded text-xs border border-blue-200">
                      <FileCheck className="w-3.5 h-3.5 text-blue-600" /> Graded {inspectStudent.finalScore !== undefined ? `(${inspectStudent.finalScore} pts · ${inspectStudent.finalPercentage}%)` : ''}
                    </span>
                  ) : inspectStudent.gradingStatus === 'in_progress' ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded text-xs border border-amber-200">
                      Grading In Progress
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">Pending Submission</span>
                  )}
                </div>
              </div>
            </div>

            {/* Anti-cheat Violations Panel */}
            <div className={`p-4 rounded-xl border mb-5 ${
              inspectStudent.violationsCount > 0
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  Anti-Cheat Proctoring Log:
                </span>
                <span className="font-bold text-xs">
                  {inspectStudent.violationsCount} Recorded Violations
                </span>
              </div>
              <p className="text-xs m-0 mt-1 opacity-90">
                {inspectStudent.violationsCount > 0
                  ? `Student triggered ${inspectStudent.violationsCount} window unfocus or tab switch events during this active session.`
                  : 'Zero integrity infractions detected. Full browser fullscreen discipline observed.'}
              </p>
            </div>

            {/* Teacher Proctoring Actions */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
              {inspectStudent.attemptStatus === 'in_progress' ? (
                <Button
                  variant="danger"
                  onClick={() => handleForceSubmit(inspectStudent)}
                  className="text-xs inline-flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" /> Force Auto-Submit Session
                </Button>
              ) : (
                <span className="text-xs text-slate-400">Assessment is no longer in progress</span>
              )}

              <Button onClick={() => setInspectStudent(null)}>Close Drawer</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
