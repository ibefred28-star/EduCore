import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Card, Button, Input, Label, Select, Modal } from '../components/ui';
import {
  Bar,
  Line,
  Doughnut
} from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import {
  filterResults,
  calculateStudentAnalytics,
  calculateSchoolAndClassAnalytics,
  calculateQuestionAnalytics,
  getResultPercentage,
  AnalyticsFilter
} from '../lib/analyticsUtils';
import { isStudentInTeacherClasses } from '../lib/classUtils';
import { CLASS_OPTIONS } from '../constants';
import {
  TrendingUp,
  TrendingDown,
  Award,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  BarChart3,
  PieChart,
  Users,
  BookOpen,
  Calendar,
  Filter,
  X,
  Activity,
  Layers,
  Sparkles,
  Search,
  CheckSquare,
  FileQuestion,
  GraduationCap
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function AnalyticsView() {
  const { data, currentRole, currentUser, config } = useStore();

  // Role context
  const teacher = currentRole === 'teacher'
    ? data.teachers.find(t => (t.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase()) || (currentUser as any)
    : null;
  const teacherClasses: string[] = teacher?.classes || [];

  // Filter State
  const [filterSession, setFilterSession] = useState('All');
  const [filterTerm, setFilterTerm] = useState('All');
  const [filterClass, setFilterClass] = useState('All');
  const [filterSubject, setFilterSubject] = useState('All');
  const [filterExamId, setFilterExamId] = useState('All');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Active sub-tab for Admin and Teacher
  const [adminTab, setAdminTab] = useState<'overview' | 'comparison' | 'participation' | 'students' | 'questions'>('overview');
  const [teacherTab, setTeacherTab] = useState<'overview' | 'completion' | 'questions'>('overview');

  // Question Analytics Table Filter & Search
  const [questionViewMode, setQuestionViewMode] = useState<'missed' | 'all'>('missed');
  const [questionSearchQuery, setQuestionSearchQuery] = useState('');
  const [selectedQuestionDetail, setSelectedQuestionDetail] = useState<any>(null);

  // Dynamic filter options
  const sessions = useMemo(() => {
    const set = new Set<string>();
    data.students.forEach(s => { if (s.reportSession) set.add(s.reportSession); });
    if (set.size === 0) {
      set.add('2025/2026');
      set.add('2026/2027');
    }
    return Array.from(set);
  }, [data.students]);

  const terms = useMemo(() => {
    const set = new Set<string>();
    data.students.forEach(s => { if (s.reportTerm) set.add(s.reportTerm); });
    if (set.size === 0) {
      set.add('First Term');
      set.add('Second Term');
      set.add('Third Term');
    }
    return Array.from(set);
  }, [data.students]);

  const availableClasses = useMemo(() => {
    if (currentRole === 'teacher') {
      return teacherClasses.length > 0 ? teacherClasses : ['Primary 5'];
    }
    const set = new Set<string>();
    CLASS_OPTIONS.forEach(c => set.add(c));
    data.students.forEach(s => { if (s.class) set.add(s.class); });
    return Array.from(set);
  }, [currentRole, teacherClasses, data.students]);

  const availableExams = useMemo(() => {
    if (currentRole === 'student') {
      return data.exams.filter(e => data.results.some(r => r.studentId === currentUser?.id && r.examId === e.id));
    }
    if (currentRole === 'teacher') {
      return data.exams.filter(e => {
        if (e.targetClasses && e.targetClasses.length > 0) {
          return e.targetClasses.some(c => isStudentInTeacherClasses(c, teacherClasses));
        }
        return true;
      });
    }
    return data.exams;
  }, [data.exams, data.results, currentRole, currentUser, teacherClasses]);

  // Active filters count
  const activeFiltersCount = [
    filterSession !== 'All',
    filterTerm !== 'All',
    filterClass !== 'All',
    filterSubject !== 'All',
    filterExamId !== 'All',
    Boolean(filterStartDate),
    Boolean(filterEndDate)
  ].filter(Boolean).length;

  const resetFilters = () => {
    setFilterSession('All');
    setFilterTerm('All');
    setFilterClass('All');
    setFilterSubject('All');
    setFilterExamId('All');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  // Compile active filter object
  const activeFilter: AnalyticsFilter = useMemo(() => ({
    session: filterSession,
    term: filterTerm,
    class: filterClass,
    subject: filterSubject,
    examId: filterExamId,
    startDate: filterStartDate,
    endDate: filterEndDate
  }), [filterSession, filterTerm, filterClass, filterSubject, filterExamId, filterStartDate, filterEndDate]);

  // Filtered Results with strict Role Isolation
  const filteredResults = useMemo(() => {
    return filterResults(
      data.results,
      data.students,
      data.exams,
      activeFilter,
      currentRole === 'student' ? currentUser?.id : undefined,
      currentRole === 'teacher' ? teacherClasses : undefined
    );
  }, [data.results, data.students, data.exams, activeFilter, currentRole, currentUser, teacherClasses]);

  // Aggregated Analytics
  const schoolAnalytics = useMemo(() => {
    // For admin and teacher, compute overall school/class level analytics
    const targetStudents = currentRole === 'teacher'
      ? data.students.filter(s => isStudentInTeacherClasses(s.class, teacherClasses))
      : data.students;

    return calculateSchoolAndClassAnalytics(filteredResults, targetStudents, data.attendance, availableExams);
  }, [filteredResults, data.students, data.attendance, availableExams, currentRole, teacherClasses]);

  // Question Analytics
  const questionAnalytics = useMemo(() => {
    const targetExams = availableExams;
    return calculateQuestionAnalytics(targetExams, filteredResults, data.questions || []);
  }, [availableExams, filteredResults, data.questions]);

  // Question list filtered by search and view mode
  const displayedQuestions = useMemo(() => {
    let list = questionViewMode === 'missed'
      ? questionAnalytics.mostMissedQuestions
      : questionAnalytics.questionStats;

    if (questionSearchQuery.trim()) {
      const q = questionSearchQuery.toLowerCase().trim();
      list = list.filter(item =>
        (item.qText || '').toLowerCase().includes(q) ||
        (item.topic || '').toLowerCase().includes(q) ||
        (item.subject || '').toLowerCase().includes(q) ||
        (item.examTitle || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [questionAnalytics, questionViewMode, questionSearchQuery]);

  // Student-specific analytics
  const studentAnalytics = useMemo(() => {
    if (currentRole !== 'student' || !currentUser) return null;
    return calculateStudentAnalytics(
      currentUser.id,
      filteredResults,
      data.attendance,
      data.exams,
      config
    );
  }, [currentRole, currentUser, filteredResults, data.attendance, data.exams, config]);

  return (
    <div className="space-y-5">
      {/* ========================================================================= */}
      {/* FILTER CONTROLS BAR */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span className="font-bold text-slate-800 text-sm">Analytics Filters</span>
            {activeFiltersCount > 0 && (
              <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full font-bold">
                {activeFiltersCount} Active
              </span>
            )}
          </div>
          {activeFiltersCount > 0 && (
            <button
              onClick={resetFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 underline cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs pt-2 border-t border-slate-100">
          <div>
            <span className="text-slate-500 font-medium block mb-1">Session:</span>
            <Select value={filterSession} onChange={e => setFilterSession(e.target.value)} className="text-xs p-1.5 mt-0">
              <option value="All">All Sessions</option>
              {sessions.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>

          <div>
            <span className="text-slate-500 font-medium block mb-1">Term:</span>
            <Select value={filterTerm} onChange={e => setFilterTerm(e.target.value)} className="text-xs p-1.5 mt-0">
              <option value="All">All Terms</option>
              {terms.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>

          {currentRole !== 'student' && (
            <div>
              <span className="text-slate-500 font-medium block mb-1">Class:</span>
              <Select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="text-xs p-1.5 mt-0">
                <option value="All">{currentRole === 'teacher' ? 'All My Classes' : 'All Classes'}</option>
                {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          )}

          <div>
            <span className="text-slate-500 font-medium block mb-1">Subject:</span>
            <Select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="text-xs p-1.5 mt-0">
              <option value="All">All Subjects</option>
              {data.subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>

          <div>
            <span className="text-slate-500 font-medium block mb-1">Exam:</span>
            <Select value={filterExamId} onChange={e => setFilterExamId(e.target.value)} className="text-xs p-1.5 mt-0">
              <option value="All">All Assessments</option>
              {availableExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </Select>
          </div>

          <div>
            <span className="text-slate-500 font-medium block mb-1">Start Date:</span>
            <Input
              type="date"
              value={filterStartDate}
              onChange={e => setFilterStartDate(e.target.value)}
              className="text-xs p-1 mt-0 bg-white"
            />
          </div>

          <div>
            <span className="text-slate-500 font-medium block mb-1">End Date:</span>
            <Input
              type="date"
              value={filterEndDate}
              onChange={e => setFilterEndDate(e.target.value)}
              className="text-xs p-1 mt-0 bg-white"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. STUDENT ANALYTICS DASHBOARD */}
      {/* ========================================================================= */}
      {currentRole === 'student' && studentAnalytics && (
        <div className="space-y-5">
          {/* Header Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Overall Average Score</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-black text-indigo-600">
                  {studentAnalytics.averagePercentage}%
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  studentAnalytics.averagePercentage >= 50 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {studentAnalytics.averagePercentage >= 50 ? 'Passing' : 'Needs Work'}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Assessments Taken</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-black text-slate-800">
                  {studentAnalytics.resultsCount}
                </span>
                <span className="text-xs text-slate-400">Total</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-emerald-700">🌟 Strongest Subject</span>
              <div className="mt-2">
                <div className="text-xl font-bold text-slate-800 truncate">
                  {studentAnalytics.strongestSubject}
                </div>
                <div className="text-xs font-bold text-emerald-600">
                  {studentAnalytics.strongestSubjectAvg}% Average
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-amber-700">🎯 Focus Area / Lowest</span>
              <div className="mt-2">
                <div className="text-xl font-bold text-slate-800 truncate">
                  {studentAnalytics.weakestSubject}
                </div>
                <div className="text-xs font-bold text-amber-600">
                  {studentAnalytics.weakestSubjectAvg}% Average
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row: Score Trend Line Chart & Subject Averages Bar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Score & Percentage Trend */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 m-0">Score Trajectory Over Time</h3>
                  <p className="text-xs text-slate-500 m-0">Performance progression across examinations</p>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                  studentAnalytics.percentageTrend === 'improving' ? 'bg-emerald-100 text-emerald-800' :
                  studentAnalytics.percentageTrend === 'declining' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                }`}>
                  {studentAnalytics.percentageTrend === 'improving' ? <TrendingUp className="w-3.5 h-3.5" /> :
                   studentAnalytics.percentageTrend === 'declining' ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                  {studentAnalytics.percentageTrend.toUpperCase()} ({studentAnalytics.trendDelta > 0 ? `+${studentAnalytics.trendDelta}%` : `${studentAnalytics.trendDelta}%`})
                </span>
              </div>
              <div className="h-64">
                <Line
                  data={{
                    labels: studentAnalytics.sortedResults.map((r, i) => `${r.subject} (${new Date(r.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})`),
                    datasets: [
                      {
                        label: 'Score %',
                        data: studentAnalytics.sortedResults.map(r => getResultPercentage(r)),
                        borderColor: '#4f46e5',
                        backgroundColor: 'rgba(79, 70, 229, 0.1)',
                        fill: true,
                        tension: 0.35,
                        pointRadius: 5,
                        pointHoverRadius: 7
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' } },
                      x: { grid: { display: false } }
                    }
                  }}
                />
              </div>
            </div>

            {/* Subject Averages */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-800 m-0">Subject Mastery Averages</h3>
                <p className="text-xs text-slate-500 m-0">Average percentage achieved across curriculum areas</p>
              </div>
              <div className="h-64">
                <Bar
                  data={{
                    labels: studentAnalytics.subjectAverages.map(s => s.subject),
                    datasets: [
                      {
                        label: 'Subject Average %',
                        data: studentAnalytics.subjectAverages.map(s => s.average),
                        backgroundColor: studentAnalytics.subjectAverages.map(s =>
                          s.average >= 75 ? 'rgba(16, 185, 129, 0.8)' :
                          s.average >= 50 ? 'rgba(99, 102, 241, 0.8)' : 'rgba(239, 68, 68, 0.8)'
                        ),
                        borderRadius: 6
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' } },
                      x: { grid: { display: false } }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Attendance vs Performance Analysis Card */}
          {studentAnalytics.attendancePercent !== null && (
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white m-0 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-amber-400" /> Attendance vs Academic Performance
                  </h3>
                  <p className="text-slate-300 text-xs mt-1 max-w-xl">
                    Regular attendance is directly tied to exam mastery and confidence.
                    {studentAnalytics.attendancePercent >= 90
                      ? ' Your exceptional attendance is powering your academic success!'
                      : ' Increasing consistent attendance will directly strengthen your exam results.'}
                  </p>
                </div>

                <div className="flex items-center gap-6 bg-white/10 px-6 py-3 rounded-xl border border-white/20">
                  <div className="text-center">
                    <span className="text-xs text-slate-300 block">Class Attendance</span>
                    <span className="text-2xl font-black text-amber-300">{studentAnalytics.attendancePercent}%</span>
                  </div>
                  <div className="w-px h-8 bg-white/20" />
                  <div className="text-center">
                    <span className="text-xs text-slate-300 block">Exam Average</span>
                    <span className="text-2xl font-black text-emerald-400">{studentAnalytics.averagePercentage}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Exam History Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-800 m-0">Detailed Assessment History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Subject</th>
                    <th className="p-3">Assessment Type</th>
                    <th className="p-3">Score</th>
                    <th className="p-3">Percentage</th>
                    <th className="p-3">Attempt</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {studentAnalytics.sortedResults.map(r => {
                    const pct = getResultPercentage(r);
                    return (
                      <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="p-3 text-slate-600">{new Date(r.submittedAt).toLocaleDateString()}</td>
                        <td className="p-3 font-semibold text-slate-800">{r.subject}</td>
                        <td className="p-3 text-slate-600">{r.type}</td>
                        <td className="p-3 text-slate-800">{r.raw}/{r.rawMax}</td>
                        <td className="p-3 font-bold">{pct}%</td>
                        <td className="p-3 text-slate-500">{r.attempt || 1}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                            pct >= 50 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {pct >= 50 ? 'Passed' : 'Needs Review'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TEACHER & ADMIN ANALYTICS DASHBOARD */}
      {/* ========================================================================= */}
      {currentRole !== 'student' && (
        <div className="space-y-5">
          {/* Sub-Tabs Navigation for Teacher / Admin */}
          <div className="flex border-b border-slate-200 text-sm font-bold gap-2">
            {currentRole === 'admin' ? (
              <>
                <button
                  onClick={() => setAdminTab('overview')}
                  className={`py-2 px-4 border-b-2 cursor-pointer transition-colors ${
                    adminTab === 'overview' ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  School Overview & Trends
                </button>
                <button
                  onClick={() => setAdminTab('comparison')}
                  className={`py-2 px-4 border-b-2 cursor-pointer transition-colors ${
                    adminTab === 'comparison' ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Class & Subject Comparisons
                </button>
                <button
                  onClick={() => setAdminTab('participation')}
                  className={`py-2 px-4 border-b-2 cursor-pointer transition-colors ${
                    adminTab === 'participation' ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Assessment Participation
                </button>
                <button
                  onClick={() => setAdminTab('students')}
                  className={`py-2 px-4 border-b-2 cursor-pointer transition-colors ${
                    adminTab === 'students' ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Top Performers & Intervention
                </button>
                <button
                  onClick={() => setAdminTab('questions')}
                  className={`py-2 px-4 border-b-2 cursor-pointer transition-colors ${
                    adminTab === 'questions' ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Question Analytics & Topics
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setTeacherTab('overview')}
                  className={`py-2 px-4 border-b-2 cursor-pointer transition-colors ${
                    teacherTab === 'overview' ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Assigned Classes Overview
                </button>
                <button
                  onClick={() => setTeacherTab('completion')}
                  className={`py-2 px-4 border-b-2 cursor-pointer transition-colors ${
                    teacherTab === 'completion' ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Roster & Completion Rates
                </button>
                <button
                  onClick={() => setTeacherTab('questions')}
                  className={`py-2 px-4 border-b-2 cursor-pointer transition-colors ${
                    teacherTab === 'questions' ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Question & Topic Performance
                </button>
              </>
            )}
          </div>

          {/* OVERVIEW TAB (Admin Overview OR Teacher Overview) */}
          {((currentRole === 'admin' && adminTab === 'overview') || (currentRole === 'teacher' && teacherTab === 'overview')) && (
            <div className="space-y-5">
              {/* Top Key Performance Indicators */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">
                    {currentRole === 'admin' ? 'School-Wide Average' : 'Class Average Score'}
                  </span>
                  <div className="text-3xl font-black text-indigo-600 mt-2">
                    {schoolAnalytics.schoolWideAverage}%
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">Total Submissions</span>
                  <div className="text-3xl font-black text-slate-800 mt-2">
                    {schoolAnalytics.totalResultsCount}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <span className="text-xs font-semibold text-emerald-700">Pass Rate (≥50%)</span>
                  <div className="text-3xl font-black text-emerald-600 mt-2">
                    {schoolAnalytics.passRate}%
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    {schoolAnalytics.passCount} passed · {schoolAnalytics.failCount} failed
                  </span>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">
                    {currentRole === 'admin' ? 'Active Classes' : 'Assigned Classes'}
                  </span>
                  <div className="text-3xl font-black text-slate-800 mt-2">
                    {currentRole === 'admin' ? schoolAnalytics.classComparison.length : teacherClasses.length}
                  </div>
                </div>
              </div>

              {/* Charts Row: Performance Over Time & Pass/Fail Grade Spread */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Performance Trajectory Line Chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-800 m-0">Performance Trend Over Time</h3>
                      <p className="text-xs text-slate-500 m-0">Academic score trajectory by examination date</p>
                    </div>
                  </div>
                  <div className="h-64">
                    <Line
                      data={{
                        labels: filteredResults.slice(0, 15).map(r => new Date(r.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
                        datasets: [
                          {
                            label: 'Submission %',
                            data: filteredResults.slice(0, 15).map(r => getResultPercentage(r)),
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            fill: true,
                            tension: 0.35,
                            pointRadius: 4
                          }
                        ]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' } },
                          x: { grid: { display: false } }
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Grade Distribution Doughnut */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-slate-800 m-0">Grade Distribution</h3>
                    <p className="text-xs text-slate-500 m-0">Distribution across letter grades</p>
                  </div>
                  <div className="h-56 relative flex items-center justify-center">
                    <Doughnut
                      data={{
                        labels: ['A (≥75%)', 'B (≥65%)', 'C (≥55%)', 'D (≥45%)', 'E (≥40%)', 'F (<40%)'],
                        datasets: [
                          {
                            data: [
                              schoolAnalytics.gradeCounts.A,
                              schoolAnalytics.gradeCounts.B,
                              schoolAnalytics.gradeCounts.C,
                              schoolAnalytics.gradeCounts.D,
                              schoolAnalytics.gradeCounts.E,
                              schoolAnalytics.gradeCounts.F
                            ],
                            backgroundColor: [
                              '#10b981', // A (Emerald)
                              '#3b82f6', // B (Blue)
                              '#6366f1', // C (Indigo)
                              '#f59e0b', // D (Amber)
                              '#f97316', // E (Orange)
                              '#ef4444'  // F (Red)
                            ]
                          }
                        ]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Attendance vs Performance Relationship Insight Box */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 m-0 mb-1">
                  Attendance & Academic Performance Relationship
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Empirical comparison showing how student attendance correlates with examination test averages:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-800 mb-1">
                      <span>High Attendance (≥90%)</span>
                      <span>{schoolAnalytics.attendancePerformanceCorrelation.highAttendanceCount} students</span>
                    </div>
                    <div className="text-3xl font-black text-emerald-700">
                      {schoolAnalytics.attendancePerformanceCorrelation.highAttendanceAvg}%
                    </div>
                    <span className="text-[11px] text-emerald-600 block mt-1">Average Academic Score</span>
                  </div>

                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-800 mb-1">
                      <span>Moderate Attendance (75-89%)</span>
                      <span>{schoolAnalytics.attendancePerformanceCorrelation.moderateAttendanceCount} students</span>
                    </div>
                    <div className="text-3xl font-black text-amber-700">
                      {schoolAnalytics.attendancePerformanceCorrelation.moderateAttendanceAvg}%
                    </div>
                    <span className="text-[11px] text-amber-600 block mt-1">Average Academic Score</span>
                  </div>

                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
                    <div className="flex items-center justify-between text-xs font-bold text-rose-800 mb-1">
                      <span>Low Attendance (&lt;75%)</span>
                      <span>{schoolAnalytics.attendancePerformanceCorrelation.lowAttendanceCount} students</span>
                    </div>
                    <div className="text-3xl font-black text-rose-700">
                      {schoolAnalytics.attendancePerformanceCorrelation.lowAttendanceAvg}%
                    </div>
                    <span className="text-[11px] text-rose-600 block mt-1">Average Academic Score</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CLASS & SUBJECT COMPARISON TAB (Admin) */}
          {currentRole === 'admin' && adminTab === 'comparison' && (
            <div className="space-y-5">
              {/* Class Comparison Chart and Table */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-800 m-0">Cross-Class Average Comparison</h3>
                  <p className="text-xs text-slate-500 m-0">Performance benchmarking across academic classes</p>
                </div>
                <div className="h-64 mb-6">
                  <Bar
                    data={{
                      labels: schoolAnalytics.classComparison.map(c => c.className),
                      datasets: [
                        {
                          label: 'Class Average %',
                          data: schoolAnalytics.classComparison.map(c => c.average),
                          backgroundColor: 'rgba(79, 70, 229, 0.8)',
                          borderRadius: 6
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' } },
                        x: { grid: { display: false } }
                      }
                    }}
                  />
                </div>

                <div className="overflow-x-auto border-t border-slate-100 pt-4">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs">
                      <tr>
                        <th className="p-3">Class</th>
                        <th className="p-3">Students</th>
                        <th className="p-3">Submissions</th>
                        <th className="p-3">Average %</th>
                        <th className="p-3">Highest %</th>
                        <th className="p-3">Lowest %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schoolAnalytics.classComparison.map(c => (
                        <tr key={c.className} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="p-3 font-bold text-indigo-700">{c.className}</td>
                          <td className="p-3">{c.studentCount}</td>
                          <td className="p-3">{c.totalAssessments}</td>
                          <td className="p-3 font-bold text-slate-800">{c.average}%</td>
                          <td className="p-3 text-emerald-600 font-semibold">{c.highestPercentage}%</td>
                          <td className="p-3 text-rose-600 font-semibold">{c.lowestPercentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Subject Comparison Chart and Table */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-800 m-0">Cross-Subject Average Comparison</h3>
                  <p className="text-xs text-slate-500 m-0">Academic achievement by curriculum subject</p>
                </div>
                <div className="h-64 mb-6">
                  <Bar
                    data={{
                      labels: schoolAnalytics.subjectComparison.map(s => s.subject),
                      datasets: [
                        {
                          label: 'Subject Average %',
                          data: schoolAnalytics.subjectComparison.map(s => s.average),
                          backgroundColor: 'rgba(16, 185, 129, 0.8)',
                          borderRadius: 6
                        }
                      ]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { beginAtZero: true, max: 100, grid: { color: '#f1f5f9' } },
                        x: { grid: { display: false } }
                      }
                    }}
                  />
                </div>

                <div className="overflow-x-auto border-t border-slate-100 pt-4">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs">
                      <tr>
                        <th className="p-3">Subject</th>
                        <th className="p-3">Submissions</th>
                        <th className="p-3">Subject Average %</th>
                        <th className="p-3">Proficiency Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schoolAnalytics.subjectComparison.map(s => (
                        <tr key={s.subject} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-800">{s.subject}</td>
                          <td className="p-3 text-slate-600">{s.totalSubmissions}</td>
                          <td className="p-3 font-bold text-indigo-700">{s.average}%</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                              s.average >= 75 ? 'bg-emerald-100 text-emerald-800' :
                              s.average >= 50 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {s.average >= 75 ? 'High Mastery' : s.average >= 50 ? 'Proficient' : 'Needs Reinforcement'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ASSESSMENT PARTICIPATION TAB (Admin) */}
          {currentRole === 'admin' && adminTab === 'participation' && (
            <div className="space-y-5">
              {/* Participation KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">Overall Participation Rate</span>
                  <div className="text-3xl font-black text-indigo-600 mt-2">
                    {schoolAnalytics.participation.overallParticipationRate}%
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Across all enrolled learners & assessments
                  </span>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">Participating Learners</span>
                  <div className="text-3xl font-black text-slate-800 mt-2">
                    {schoolAnalytics.participation.uniqueParticipantsCount} / {schoolAnalytics.participation.totalEnrolledStudents}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Learners with at least 1 completed assessment
                  </span>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">Total Monitored Exams</span>
                  <div className="text-3xl font-black text-slate-800 mt-2">
                    {schoolAnalytics.participation.examParticipation.length}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Active academic assessments analyzed
                  </span>
                </div>
              </div>

              {/* Assessment Level Participation Breakdown */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-800 m-0">Assessment Participation Rates</h3>
                  <p className="text-xs text-slate-500 m-0">Engagement and turnout breakdown for each school examination</p>
                </div>

                {schoolAnalytics.participation.examParticipation.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-sm">
                    No examination records found for the selected filter criteria.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600 text-xs">
                        <tr>
                          <th className="p-3">Exam Title</th>
                          <th className="p-3">Subject</th>
                          <th className="p-3">Target Classes</th>
                          <th className="p-3">Eligible Students</th>
                          <th className="p-3">Submissions</th>
                          <th className="p-3">Participation %</th>
                          <th className="p-3">Average Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schoolAnalytics.participation.examParticipation.map(e => (
                          <tr key={e.examId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-800">{e.examTitle}</td>
                            <td className="p-3 text-slate-600">{e.subject}</td>
                            <td className="p-3 text-xs text-indigo-700 font-medium">
                              {e.targetClasses.length > 0 ? e.targetClasses.join(', ') : 'All Classes'}
                            </td>
                            <td className="p-3">{e.eligibleCount}</td>
                            <td className="p-3 font-semibold">{e.participatedCount}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      e.participationRate >= 80 ? 'bg-emerald-500' :
                                      e.participationRate >= 50 ? 'bg-indigo-600' : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${e.participationRate}%` }}
                                  />
                                </div>
                                <span className="font-bold text-xs">{e.participationRate}%</span>
                              </div>
                            </td>
                            <td className="p-3 font-bold text-slate-800">{e.averageScore}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Class Level Participation Breakdown */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-800 m-0">Class Participation Breakdown</h3>
                  <p className="text-xs text-slate-500 m-0">Learner turnout across assigned academic classes</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs">
                      <tr>
                        <th className="p-3">Academic Class</th>
                        <th className="p-3">Enrolled Learners</th>
                        <th className="p-3">Active Assessment Takers</th>
                        <th className="p-3">Turnout Rate</th>
                        <th className="p-3">Participation Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schoolAnalytics.participation.classParticipation.map(cp => (
                        <tr key={cp.className} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="p-3 font-bold text-indigo-700">{cp.className}</td>
                          <td className="p-3 text-slate-700">{cp.enrolledCount}</td>
                          <td className="p-3 font-semibold text-slate-800">{cp.participatedCount}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    cp.participationRate >= 80 ? 'bg-emerald-500' :
                                    cp.participationRate >= 50 ? 'bg-indigo-600' : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${cp.participationRate}%` }}
                                />
                              </div>
                              <span className="font-bold text-xs">{cp.participationRate}%</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                              cp.participationRate >= 80 ? 'bg-emerald-100 text-emerald-800' :
                              cp.participationRate >= 50 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {cp.participationRate >= 80 ? 'High Turnout' : cp.participationRate >= 50 ? 'Moderate' : 'Low Participation'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TOP PERFORMERS & INTERVENTIONS TAB (Admin) */}
          {currentRole === 'admin' && adminTab === 'students' && (
            <div className="space-y-5">
              {/* Top Performing Students */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 m-0 flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-500" /> Top-Performing Students (Honor Roll)
                    </h3>
                    <p className="text-xs text-slate-500 m-0">Highest scoring learners across the school</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs">
                      <tr>
                        <th className="p-3">Rank</th>
                        <th className="p-3">Student Name</th>
                        <th className="p-3">Class</th>
                        <th className="p-3">Overall Average %</th>
                        <th className="p-3">Strongest Subject</th>
                        <th className="p-3">Pass Rate</th>
                        <th className="p-3">Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schoolAnalytics.topPerformingStudents.map((s, idx) => (
                        <tr key={s.studentId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="p-3 font-black text-slate-400">
                            {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
                          </td>
                          <td className="p-3 font-bold text-slate-800">{s.studentName}</td>
                          <td className="p-3 text-indigo-700 font-medium">{s.studentClass}</td>
                          <td className="p-3 font-black text-indigo-600 text-base">{s.averagePercentage}%</td>
                          <td className="p-3 text-emerald-700 font-semibold">{s.strongestSubject}</td>
                          <td className="p-3">{s.passRate}%</td>
                          <td className="p-3 font-semibold text-slate-700">{s.attendancePercent !== null ? `${s.attendancePercent}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Students Needing Intervention */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-rose-700 m-0 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-rose-600" /> Early Academic Intervention Roster
                    </h3>
                    <p className="text-xs text-slate-500 m-0">Students performing below 50% or experiencing academic challenges</p>
                  </div>
                  <span className="bg-rose-100 text-rose-800 text-xs font-bold px-2.5 py-1 rounded-full">
                    {schoolAnalytics.studentsNeedingIntervention.length} Flagged
                  </span>
                </div>

                {schoolAnalytics.studentsNeedingIntervention.length === 0 ? (
                  <div className="p-6 text-center bg-emerald-50 rounded-xl text-emerald-800 text-sm">
                    ✓ All registered students are currently meeting the 50% academic pass benchmark.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-rose-50 text-rose-800 text-xs">
                        <tr>
                          <th className="p-3">Student Name</th>
                          <th className="p-3">Class</th>
                          <th className="p-3">Average %</th>
                          <th className="p-3">Failed Assessments</th>
                          <th className="p-3">Weakest Subject</th>
                          <th className="p-3">Attendance %</th>
                          <th className="p-3">Recommended Intervention</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schoolAnalytics.studentsNeedingIntervention.map(s => (
                          <tr key={s.studentId} className="border-b border-rose-100 last:border-0 hover:bg-rose-50/40">
                            <td className="p-3 font-bold text-slate-800">{s.studentName}</td>
                            <td className="p-3 text-slate-700">{s.studentClass}</td>
                            <td className="p-3 font-bold text-rose-600">{s.averagePercentage}%</td>
                            <td className="p-3 text-rose-700 font-semibold">{s.failCount} of {s.totalExams}</td>
                            <td className="p-3 text-slate-700">{s.weakestSubject}</td>
                            <td className="p-3">
                              {s.attendancePercent !== null ? (
                                <span className={s.attendancePercent < 75 ? 'text-rose-600 font-bold' : ''}>
                                  {s.attendancePercent}%
                                </span>
                              ) : '—'}
                            </td>
                            <td className="p-3 text-xs text-slate-600">
                              {s.attendancePercent && s.attendancePercent < 80
                                ? 'Attendance intervention & parent conference'
                                : `Targeted tutoring in ${s.weakestSubject}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ROSTER & ASSESSMENT COMPLETION TAB (Teacher) */}
          {currentRole === 'teacher' && teacherTab === 'completion' && (
            <div className="space-y-5">
              {/* Assessment Completion Rate */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-800 m-0">Assessment Completion Status</h3>
                  <p className="text-xs text-slate-500 m-0">Submission and completion progress across your classes</p>
                </div>

                <div className="space-y-3">
                  {availableExams.map(ex => {
                    const eligibleStudents = data.students.filter(s =>
                      ex.targetClasses && ex.targetClasses.length > 0
                        ? ex.targetClasses.some(c => isStudentInTeacherClasses(s.class, [c]))
                        : isStudentInTeacherClasses(s.class, teacherClasses)
                    );
                    const completedResults = data.results.filter(r => String(r.examId) === String(ex.id));
                    const completedStudentIds = new Set(completedResults.map(r => r.studentId));
                    const completionRate = eligibleStudents.length > 0
                      ? Math.round((completedStudentIds.size / eligibleStudents.length) * 100)
                      : 0;

                    return (
                      <div key={ex.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <div>
                            <span className="font-bold text-slate-800 text-sm">{ex.title}</span>
                            <span className="text-xs text-slate-500 ml-2">
                              {ex.subject} · {ex.type} · Target: {ex.targetClasses?.join(', ') || 'All'}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-indigo-700">
                            {completedStudentIds.size} / {eligibleStudents.length} Students ({completionRate}%)
                          </div>
                        </div>

                        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              completionRate === 100 ? 'bg-emerald-500' : completionRate >= 50 ? 'bg-indigo-600' : 'bg-amber-500'
                            }`}
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Student Roster Table for Teacher's Classes */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-800 m-0">Student Academic Roster</h3>
                  <p className="text-xs text-slate-500 m-0">Performance summary for learners in your assigned classes</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs">
                      <tr>
                        <th className="p-3">Student Name</th>
                        <th className="p-3">Class</th>
                        <th className="p-3">Assessments</th>
                        <th className="p-3">Average %</th>
                        <th className="p-3">Strongest Subject</th>
                        <th className="p-3">Focus Subject</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schoolAnalytics.studentSummaries.map(s => (
                        <tr key={s.studentId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-800">{s.studentName}</td>
                          <td className="p-3 text-indigo-600 font-medium">{s.studentClass}</td>
                          <td className="p-3">{s.totalExams}</td>
                          <td className="p-3 font-bold text-slate-900">{s.averagePercentage}%</td>
                          <td className="p-3 text-emerald-700 font-semibold">{s.strongestSubject}</td>
                          <td className="p-3 text-amber-700">{s.weakestSubject}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                              s.averagePercentage >= 50 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {s.averagePercentage >= 50 ? 'On Track' : 'Needs Support'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* QUESTION ANALYTICS TAB (Admin & Teacher) */}
          {((currentRole === 'admin' && adminTab === 'questions') || (currentRole === 'teacher' && teacherTab === 'questions')) && (
            <div className="space-y-5">
              {/* Question Analytics Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">Overall Question Accuracy</span>
                  <div className="text-3xl font-black text-indigo-600 mt-2">
                    {questionAnalytics.overallAccuracy}%
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">Evaluated Questions</span>
                  <div className="text-3xl font-black text-slate-800 mt-2">
                    {questionAnalytics.questionStats.length}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <span className="text-xs font-semibold text-rose-600">Most Challenging Question</span>
                  <div className="text-xl font-bold text-rose-700 mt-2 truncate">
                    {questionAnalytics.mostMissedQuestions[0]?.percentageCorrect !== undefined
                      ? `${questionAnalytics.mostMissedQuestions[0].percentageCorrect}% correct`
                      : 'None'}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500">Topics Monitored</span>
                  <div className="text-3xl font-black text-slate-800 mt-2">
                    {questionAnalytics.topicPerformance.length}
                  </div>
                </div>
              </div>

              {/* Topic Performance Mastery */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-800 m-0">Topic Mastery & Performance</h3>
                  <p className="text-xs text-slate-500 m-0">Student curriculum comprehension aggregated by topic</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs">
                      <tr>
                        <th className="p-3">Topic</th>
                        <th className="p-3">Subject</th>
                        <th className="p-3">Questions Count</th>
                        <th className="p-3">Total Attempts</th>
                        <th className="p-3">Correct %</th>
                        <th className="p-3">Mastery Tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questionAnalytics.topicPerformance.map(t => (
                        <tr key={t.topic} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-800">{t.topic}</td>
                          <td className="p-3 text-slate-600">{t.subject}</td>
                          <td className="p-3">{t.totalQuestions}</td>
                          <td className="p-3">{t.totalAttempts}</td>
                          <td className="p-3 font-bold text-indigo-700">{t.percentageCorrect}%</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                              t.performanceTier === 'High Mastery' ? 'bg-emerald-100 text-emerald-800' :
                              t.performanceTier === 'Moderate' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {t.performanceTier}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Question Analytics Table & Inspector */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 m-0 flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-indigo-600" />
                      {questionViewMode === 'missed' ? 'Most-Missed Assessment Questions' : 'Evaluated Question Performance Directory'}
                    </h3>
                    <p className="text-xs text-slate-500 m-0">
                      {questionViewMode === 'missed'
                        ? 'Questions with the lowest correct response rates requiring academic revision'
                        : 'Comprehensive item analysis across all active curriculum assessments'}
                    </p>
                  </div>

                  {/* Mode Toggle & Search */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                      <button
                        onClick={() => setQuestionViewMode('missed')}
                        className={`px-3 py-1 font-semibold rounded-md transition-colors ${
                          questionViewMode === 'missed' ? 'bg-white text-rose-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Top Most-Missed ({questionAnalytics.mostMissedQuestions.length})
                      </button>
                      <button
                        onClick={() => setQuestionViewMode('all')}
                        className={`px-3 py-1 font-semibold rounded-md transition-colors ${
                          questionViewMode === 'all' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        All Evaluated Questions ({questionAnalytics.questionStats.length})
                      </button>
                    </div>

                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Search questions or topics..."
                        value={questionSearchQuery}
                        onChange={e => setQuestionSearchQuery(e.target.value)}
                        className="text-xs py-1 px-2.5 w-44 bg-white mt-0"
                      />
                    </div>
                  </div>
                </div>

                {displayedQuestions.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    No questions match the current filter or search criteria.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600 text-xs">
                        <tr>
                          <th className="p-3">Question Text</th>
                          <th className="p-3">Exam / Subject</th>
                          <th className="p-3">Topic</th>
                          <th className="p-3">Tagged Diff.</th>
                          <th className="p-3">Empirical Diff.</th>
                          <th className="p-3">Attempts</th>
                          <th className="p-3">Correct %</th>
                          <th className="p-3">Wrong %</th>
                          <th className="p-3">Unanswered %</th>
                          <th className="p-3 text-right">Inspect</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedQuestions.map(q => (
                          <tr
                            key={q.id}
                            className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                          >
                            <td className="p-3 font-semibold text-slate-800 max-w-xs truncate" title={q.qText}>
                              {q.qText}
                            </td>
                            <td className="p-3 text-xs">
                              <div className="font-medium text-slate-700">{q.examTitle}</div>
                              <div className="text-slate-400">{q.subject}</div>
                            </td>
                            <td className="p-3 text-xs text-slate-600">{q.topic}</td>
                            <td className="p-3 text-xs font-semibold">{q.taggedDifficulty}</td>
                            <td className="p-3 text-xs">
                              <span className={`px-2 py-0.5 rounded-full font-bold ${
                                q.empiricalDifficulty === 'Hard' ? 'bg-rose-100 text-rose-800' :
                                q.empiricalDifficulty === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {q.empiricalDifficulty}
                              </span>
                            </td>
                            <td className="p-3 text-xs font-semibold">{q.timesAttempted}</td>
                            <td className="p-3 font-bold text-emerald-600">{q.percentageCorrect}%</td>
                            <td className="p-3 font-bold text-rose-600">{q.percentageWrong}%</td>
                            <td className="p-3 text-xs text-slate-500">{q.unansweredRate}%</td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => setSelectedQuestionDetail(q)}
                                className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold rounded-md cursor-pointer transition-colors"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Question Item Analysis Modal */}
              {selectedQuestionDetail && (
                <Modal
                  isOpen={Boolean(selectedQuestionDetail)}
                  onClose={() => setSelectedQuestionDetail(null)}
                >
                  <div className="space-y-4 text-sm">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <h3 className="text-base font-bold text-slate-800 m-0">Question Item & Performance Analysis</h3>
                      <button
                        onClick={() => setSelectedQuestionDetail(null)}
                        className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-400 block uppercase mb-1">Question Prompt</span>
                      <p className="font-semibold text-slate-900 m-0">{selectedQuestionDetail.qText}</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block">Subject & Exam</span>
                        <span className="font-bold text-slate-800">{selectedQuestionDetail.subject}</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block">Curriculum Topic</span>
                        <span className="font-bold text-slate-800">{selectedQuestionDetail.topic}</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block">Tagged Difficulty</span>
                        <span className="font-bold text-slate-800">{selectedQuestionDetail.taggedDifficulty}</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-slate-400 block">Empirical Difficulty</span>
                        <span className="font-bold text-indigo-700">{selectedQuestionDetail.empiricalDifficulty}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Item Response Distribution</h4>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                          <span className="text-xs text-emerald-700 block">Correct Answers</span>
                          <span className="text-2xl font-black text-emerald-600">{selectedQuestionDetail.timesCorrect}</span>
                          <span className="text-[11px] text-emerald-800 block font-semibold">{selectedQuestionDetail.percentageCorrect}%</span>
                        </div>
                        <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg">
                          <span className="text-xs text-rose-700 block">Wrong Answers</span>
                          <span className="text-2xl font-black text-rose-600">{selectedQuestionDetail.timesWrong}</span>
                          <span className="text-[11px] text-rose-800 block font-semibold">{selectedQuestionDetail.percentageWrong}%</span>
                        </div>
                        <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg">
                          <span className="text-xs text-slate-600 block">Unanswered</span>
                          <span className="text-2xl font-black text-slate-700">{selectedQuestionDetail.timesUnanswered}</span>
                          <span className="text-[11px] text-slate-600 block font-semibold">{selectedQuestionDetail.unansweredRate}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button variant="secondary" onClick={() => setSelectedQuestionDetail(null)}>
                        Close
                      </Button>
                    </div>
                  </div>
                </Modal>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
