import { useStore } from '../store';
import { Card, Input, Label, Select, Button, Modal } from '../components/ui';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { useState, useMemo, useEffect } from 'react';
import { useToastStore } from '../store/toast';
import { isStudentInTeacherClasses } from '../lib/classUtils';
import { useAnnouncementsSubscription, useStudentResultsSubscription, useLearningResourcesSubscription } from '../hooks/useDomainSubscriptions';
import { Bell, Megaphone, Info, BookOpen, Volume2, Sparkles, Trophy, Crown, ArrowRight, Zap, Flame, Award } from 'lucide-react';
import GamificationHUD from '../components/GamificationHUD';
import LeaderboardView from '../components/LeaderboardView';
import { calculateStudentTotalXP, getStudentLevel } from '../lib/gamification';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function getComponentMax(type: string, config: any) {
  if (type === 'CA 1') return config.ca1;
  if (type === 'CA 2') return config.ca2;
  if (type === 'Examination') return config.exam;
  return null;
}

interface DashboardHomeProps {
  onNavigate?: (tab: string) => void;
}

export default function DashboardHome({ onNavigate }: DashboardHomeProps = {}) {
  const { data, currentRole, currentUser, config, schoolId, updateData } = useStore();
  
  // Real-time school announcements listener
  const roleForAnnouncements = currentRole === 'student' ? 'student' : currentRole === 'teacher' ? 'teacher' : 'admin';
  const { announcements } = useAnnouncementsSubscription(schoolId, roleForAnnouncements);

  const teacher = currentRole === 'teacher' 
    ? data.teachers.find(t => (t.id || '').trim().toLowerCase() === (currentUser?.id || '').trim().toLowerCase()) || (currentUser as any)
    : null;
  const teacherClasses = teacher?.classes || [];
  
  // Filter students: if teacher, only students in their classes
  const students = currentRole === 'teacher' 
    ? data.students.filter(s => isStudentInTeacherClasses(s.class, teacherClasses))
    : data.students;

  const studentClass = currentUser && currentRole === 'student' ? (currentUser as any).class : '';

  // Real-time student results subscription (reflects teacher result deletions instantaneously)
  const { results: liveStudentResults } = useStudentResultsSubscription(
    schoolId,
    currentRole === 'student' ? currentUser?.id : null
  );

  // Real-time learning resources subscription
  const { resources: liveLearningResources } = useLearningResourcesSubscription(
    schoolId,
    studentClass
  );

  // Available learning resources count for current student or school
  const studentResourcesCount = useMemo(() => {
    const list = liveLearningResources && liveLearningResources.length > 0
      ? liveLearningResources
      : data.learningResources || [];
    if (currentRole === 'student' && studentClass) {
      const studentNorm = studentClass.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return list.filter(r => {
        if (!r.targetClass || r.targetClass === 'All' || r.targetClass.toLowerCase() === 'all') return true;
        const targetNorm = r.targetClass.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        return targetNorm === studentNorm || studentNorm.includes(targetNorm) || targetNorm.includes(studentNorm);
      }).length;
    }
    return list.length;
  }, [liveLearningResources, data.learningResources, currentRole, studentClass]);

  // Reconciled student results (if teacher deleted a result, liveStudentResults won't have it!)
  const effectiveStudentResults = useMemo(() => {
    if (liveStudentResults !== null && liveStudentResults !== undefined) {
      return liveStudentResults;
    }
    return (data.results || []).filter(r => r.studentId === currentUser?.id);
  }, [liveStudentResults, data.results, currentUser?.id]);

  // Prune any results locally that were deleted by a teacher in Firestore
  useEffect(() => {
    if (currentRole === 'student' && currentUser?.id && liveStudentResults !== null && liveStudentResults !== undefined) {
      const liveIds = new Set(liveStudentResults.map(r => String(r.id)));
      const hasOrphanLocal = data.results.some(
        r => r.studentId === currentUser.id && !liveIds.has(String(r.id))
      );
      if (hasOrphanLocal) {
        updateData(draft => {
          draft.results = draft.results.filter(
            r => r.studentId !== currentUser.id || liveIds.has(String(r.id))
          );
        });
      }
    }
  }, [currentRole, currentUser?.id, liveStudentResults, data.results, updateData]);

  // Filter results: if student, only theirs. if teacher, only students in their classes.
  const results = currentRole === 'student' 
    ? effectiveStudentResults
    : currentRole === 'teacher'
    ? data.results.filter(r => {
        const student = data.students.find(s => s.id === r.studentId);
        return student && isStudentInTeacherClasses(student.class, teacherClasses);
      })
    : data.results;

  // Compute student-specific active exams matching MyExams logic
  const studentActiveExamsCount = currentRole === 'student'
    ? data.exams.filter(e => {
        const status = String(e.status || '').trim().toLowerCase();
        if (!['active', 'published', 'open', 'ongoing'].includes(status)) return false;
        if (e.targetClasses && e.targetClasses.length > 0 && studentClass) {
          const studentClassNorm = String(studentClass).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          return e.targetClasses.some(tc => {
            const tcNorm = String(tc || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!tcNorm || tcNorm === 'all' || tcNorm.startsWith('all') || tcNorm === 'general') return true;
            return tcNorm === studentClassNorm || studentClassNorm.includes(tcNorm) || tcNorm.includes(studentClassNorm);
          });
        }
        return true;
      }).length
    : data.exams.length;

  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);

  const chartData = {
    labels: data.subjects.length > 0 ? data.subjects : ['None'],
    datasets: [
      {
        label: 'Average %',
        data: data.subjects.length > 0 ? data.subjects.map(s => {
          const rs = results.filter(r => r.subject === s && getComponentMax(r.type, config));
          if (!rs.length) return 0;
          return Math.round(rs.reduce((a, r) => a + (r.scaled || 0) / (getComponentMax(r.type, config) || 1) * 100, 0) / rs.length);
        }) : [0],
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderRadius: 8,
      }
    ]
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-[minmax(140px,auto)]">
      
      {/* Realtime Announcement Banner if present */}
      {announcements && announcements.length > 0 && (
        <div className="col-span-1 md:col-span-3 lg:col-span-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-[20px] p-4 flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl flex-shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-indigo-950 text-sm">{announcements[0].title}</span>
              <span className="text-[10px] bg-indigo-200/60 text-indigo-800 font-semibold px-2 py-0.5 rounded-full">Live Notice</span>
            </div>
            <p className="text-xs text-indigo-900/80 m-0 truncate mt-0.5">{announcements[0].content}</p>
          </div>
        </div>
      )}

      {/* Welcome Widget (spans 2 cols) */}
      <div className="col-span-1 md:col-span-2 bg-slate-900 rounded-[24px] p-6 text-white shadow-sm flex flex-col justify-center relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-2 mt-0 text-white">Welcome back, {currentUser?.name || 'User'}</h2>
          <p className="text-slate-300 m-0">Here's your {currentRole} overview for today.</p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
          <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
      </div>

      {/* Gamification HUD for Students (Level, Streaks, Daily Quests, Badges) */}
      {currentRole === 'student' && <GamificationHUD />}

      {/* Stats Widgets */}
      {currentRole !== 'student' && (
        <div className="bg-white rounded-[24px] p-6 shadow-sm flex flex-col justify-center border border-slate-100">
          <span className="text-slate-500 font-medium mb-1">
            {currentRole === 'teacher' ? 'My Students' : 'Total Students'}
          </span>
          <h2 className="text-4xl font-extrabold text-slate-800 m-0">{students.length}</h2>
        </div>
      )}

      {currentRole === 'admin' && (
        <div className="bg-white rounded-[24px] p-6 shadow-sm flex flex-col justify-center border border-slate-100">
          <span className="text-slate-500 font-medium mb-1">Total Teachers</span>
          <h2 className="text-4xl font-extrabold text-slate-800 m-0">{data.teachers.length}</h2>
        </div>
      )}

      <div 
        onClick={() => onNavigate?.(currentRole === 'student' ? 'My Exams' : 'Exams')}
        className="bg-indigo-50 hover:bg-indigo-100/80 rounded-[24px] p-6 shadow-sm flex flex-col justify-center text-indigo-900 border border-indigo-100 transition-all cursor-pointer group"
      >
        <span className="font-medium mb-1 opacity-80 group-hover:opacity-100 transition-opacity">Available Exams</span>
        <h2 className="text-4xl font-extrabold m-0">
          {currentRole === 'student' ? studentActiveExamsCount : data.exams.length}
        </h2>
      </div>

      {/* Chart Widget (spans full or 3 cols, and taller) */}
      <div className={`col-span-1 md:col-span-3 lg:col-span-3 row-span-2 bg-white rounded-[24px] p-6 shadow-sm border border-slate-100 ${currentRole === 'student' ? 'lg:col-span-2' : ''}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800 m-0">Performance Overview</h3>
        </div>
        <div className="h-[250px] w-full">
          <Bar 
            data={chartData} 
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

      {currentRole === 'student' && (
        <div className="col-span-1 md:col-span-3 lg:col-span-2 row-span-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[24px] p-6 shadow-sm text-white overflow-hidden relative">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-bold m-0 flex items-center gap-2">
                <span>🏆</span> XP Leaderboard
              </h3>
              <span className="text-[10px] text-indigo-100 font-mono">
                ⚡ 2 XP per correct answer
              </span>
            </div>
            <button
              onClick={() => setShowLeaderboardModal(true)}
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl text-white font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
            >
              <span>Full Podium</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-2.5 relative z-10">
            {data.students
              .map(s => {
                const sResults = s.id === currentUser?.id && currentRole === 'student' && liveStudentResults !== null && liveStudentResults !== undefined
                  ? liveStudentResults
                  : data.results.filter(r => r.studentId === s.id);
                const xpStats = calculateStudentTotalXP(s.id, sResults);
                const levelInfo = getStudentLevel(xpStats.totalXP);
                return { ...s, xp: xpStats.totalXP, levelInfo, correctAnswers: xpStats.correctAnswersCount };
              })
              .sort((a, b) => b.xp - a.xp)
              .slice(0, 5)
              .map((s, idx) => (
                <div key={s.id} className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${s.id === currentUser?.id ? 'bg-white/25 font-bold border border-white/40 shadow-sm' : 'bg-black/10'}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base font-black w-6 text-center opacity-90 flex-shrink-0">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </span>
                    {s.photo ? (
                      <img src={s.photo} alt={s.name} className="w-8 h-8 rounded-full object-cover bg-white/20 flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {s.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="truncate max-w-[120px] block leading-tight text-xs font-bold">{s.name.split(' ')[0]}</span>
                      <span className="text-[10px] opacity-75 font-normal block truncate">{s.levelInfo.badge} Lvl {s.levelInfo.level}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1 font-mono justify-end text-xs font-bold">
                      <span className="text-amber-300">⚡</span>
                      {Math.round(s.xp)} XP
                    </div>
                    <span className="text-[10px] opacity-75 font-mono">{s.correctAnswers} correct</span>
                  </div>
                </div>
              ))}
          </div>
          <div className="absolute -right-10 -bottom-10 opacity-10 text-9xl">👑</div>
        </div>
      )}

      {/* Learning Resources Widget */}
      <div 
        onClick={() => onNavigate?.(currentRole === 'student' ? 'My Learning Resources' : 'Learning Resources')}
        className="bg-gradient-to-br from-indigo-900 to-slate-900 hover:from-indigo-800 hover:to-slate-800 rounded-[24px] p-6 shadow-sm flex flex-col justify-between text-white border border-indigo-800/40 relative overflow-hidden transition-all cursor-pointer group"
      >
        <div>
          <div className="flex items-center gap-1.5 text-xs text-rose-400 font-bold uppercase tracking-wider mb-1">
            <span>🇬🇧</span>
            <span>British Audio Ready</span>
          </div>
          <span className="text-slate-300 font-medium text-sm group-hover:text-white transition-colors">Learning Resources</span>
          <h2 className="text-4xl font-extrabold m-0 text-white mt-1">{studentResourcesCount}</h2>
        </div>
        <p className="text-[11px] text-slate-400 group-hover:text-slate-300 m-0 mt-3 transition-colors flex items-center gap-1">
          <span>{currentRole === 'student' ? 'Open & listen to resources' : 'Manage learning resources'}</span>
          <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
        </p>
        <div className="absolute right-2 bottom-2 opacity-10 group-hover:opacity-20 transition-opacity">
          <BookOpen className="w-24 h-24 text-white" />
        </div>
      </div>

      {/* Additional Stats */}
      <div 
        onClick={() => onNavigate?.(currentRole === 'student' ? 'My Results' : 'Results')}
        className="bg-emerald-500 hover:bg-emerald-600 rounded-[24px] p-6 shadow-sm flex flex-col justify-center text-white transition-all cursor-pointer group"
      >
        <span className="text-emerald-100 font-medium mb-1 group-hover:text-white transition-colors">Recorded Results</span>
        <h2 className="text-4xl font-extrabold m-0">{results.length}</h2>
      </div>

      <div 
        onClick={() => currentRole === 'admin' && onNavigate?.('Subjects')}
        className={`bg-amber-100 rounded-[24px] p-6 shadow-sm flex flex-col justify-center text-amber-900 border border-amber-200 ${currentRole === 'admin' ? 'hover:bg-amber-200/80 cursor-pointer transition-all' : ''}`}
      >
        <span className="font-medium mb-1 opacity-80">Active Subjects</span>
        <h2 className="text-4xl font-extrabold m-0">{data.subjects.length}</h2>
      </div>

      {/* Full Gamified Leaderboard Modal */}
      {showLeaderboardModal && (
        <LeaderboardView
          isModal={true}
          onClose={() => setShowLeaderboardModal(false)}
        />
      )}
    </div>
  );
}

export function AnalyticsView() {
  const { data, config } = useStore();
  
  const chartData = {
    labels: data.subjects,
    datasets: [
      {
        label: 'Average %',
        data: data.subjects.map(s => {
          const rs = data.results.filter(r => r.subject === s && getComponentMax(r.type, config));
          if (!rs.length) return 0;
          return Math.round(rs.reduce((a, r) => a + (r.scaled || 0) / (getComponentMax(r.type, config) || 1) * 100, 0) / rs.length);
        }),
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
      }
    ]
  };

  return (
    <Card>
      <h3 className="mt-0 text-xl font-bold mb-4">Subject Performance</h3>
      <div className="h-[400px]">
        <Bar 
          data={chartData} 
          options={{ 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, max: 100 } }
          }} 
        />
      </div>
    </Card>
  );
}
