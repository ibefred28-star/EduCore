import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import {
  useStudentResultsSubscription,
  useSchoolResultsSubscription,
  useStudentsSubscription
} from '../hooks/useDomainSubscriptions';
import { buildLeaderboard, evaluateBadges, LeaderboardEntry } from '../lib/gamification';
import AchievementsModal from './AchievementsModal';
import {
  Trophy,
  Crown,
  Medal,
  Flame,
  Zap,
  Search,
  Filter,
  Users,
  Award,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  ArrowUp,
  Shield
} from 'lucide-react';

interface LeaderboardViewProps {
  onClose?: () => void;
  isModal?: boolean;
}

export default function LeaderboardView({ onClose, isModal = false }: LeaderboardViewProps) {
  const { data, currentUser, currentRole, schoolId } = useStore();
  const student = currentUser as any;
  const currentStudentId = currentUser?.id;
  const studentClass = student?.class || '';

  // Real-time results subscription for current student
  const { results: liveStudentResults } = useStudentResultsSubscription(
    schoolId,
    currentRole === 'student' ? currentStudentId : null
  );

  // Real-time results subscription for all school results
  const { results: liveSchoolResults } = useSchoolResultsSubscription(schoolId);
  // Real-time students subscription
  const { students: liveStudents } = useStudentsSubscription(schoolId);

  // Build effective results array merging live results across all sources
  const effectiveResults = useMemo(() => {
    const map = new Map<string, any>();
    (data.results || []).forEach(r => map.set(String(r.id), r));
    (liveSchoolResults || []).forEach(r => map.set(String(r.id), r));
    (liveStudentResults || []).forEach(r => map.set(String(r.id), r));
    return Array.from(map.values()).map(r => {
      const typeStr = String(r.type || '').trim().toUpperCase();
      if (typeStr === 'AFL' || typeStr === 'CA 1' || typeStr === 'CA1') {
        return { ...r, type: 'CA 1' };
      }
      return r;
    });
  }, [data.results, liveSchoolResults, liveStudentResults]);

  const targetStudents = useMemo(() => {
    const map = new Map<string, any>();
    (data.students || []).forEach(s => map.set((s.id || '').trim().toLowerCase(), s));
    (liveStudents || []).forEach(s => map.set((s.id || '').trim().toLowerCase(), s));
    return Array.from(map.values());
  }, [liveStudents, data.students]);

  const [scopeFilter, setScopeFilter] = useState<'class' | 'all'>(() => {
    return currentRole === 'student' && studentClass ? 'class' : 'all';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showBadgesModal, setShowBadgesModal] = useState(false);

  // Build leaderboard
  const { entries, currentUserEntry, totalParticipants } = useMemo(() => {
    const classFilter = scopeFilter === 'class' && studentClass ? studentClass : 'all';
    return buildLeaderboard(targetStudents, effectiveResults, currentStudentId, classFilter);
  }, [targetStudents, effectiveResults, currentStudentId, scopeFilter, studentClass]);

  // Filter by search
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(e =>
      e.student.name.toLowerCase().includes(q) ||
      (e.student.class && e.student.class.toLowerCase().includes(q))
    );
  }, [entries, searchQuery]);

  // Top 3 for podium
  const topThree = entries.slice(0, 3);

  // Current student badges for modal
  const studentBadges = useMemo(() => {
    if (!currentStudentId) return [];
    const myResults = effectiveResults.filter(r => r.studentId === currentStudentId);
    return evaluateBadges(currentStudentId, myResults, currentUserEntry?.rank);
  }, [currentStudentId, effectiveResults, currentUserEntry?.rank]);

  const content = (
    <div className="space-y-6">
      
      {/* Gamified Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-[28px] p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" /> Official Gamified Leaderboard
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-indigo-200">
                ⚡ 2 XP Per Correct Answer
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white m-0 tracking-tight">
              Champions of Academic Excellence
            </h1>
            <p className="text-slate-300 text-sm mt-2 mb-0 leading-relaxed">
              Every correct answer earns <strong>+2 XP</strong>. Read learning resources, maintain daily streaks,
              and complete assessments to rise through the ranks to #1!
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setShowBadgesModal(true)}
              className="px-5 py-3 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 font-black rounded-2xl text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-950/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Award className="w-4 h-4" />
              <span>Achievements Gallery</span>
              <span className="bg-slate-950/20 px-2 py-0.5 rounded-full text-xs">
                {studentBadges.filter(b => b.isUnlocked).length} / {studentBadges.length}
              </span>
            </button>
          </div>
        </div>

        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-1/6 translate-y-1/6">
          <Trophy className="w-80 h-80 text-white" />
        </div>
      </div>

      {/* Motivational "Your Position" Card (if current student is logged in) */}
      {currentUserEntry && (
        <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border-2 border-indigo-500/30 rounded-3xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md border-2 border-white/50">
                #{currentUserEntry.rank}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                    Your Current Standing
                  </span>
                  <span className="text-xs font-semibold text-slate-600">
                    {currentUserEntry.levelInfo.badge} Level {currentUserEntry.levelInfo.level} ({currentUserEntry.levelInfo.title})
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900 m-0 mt-1">
                  {currentUserEntry.student.name} &bull; {currentUserEntry.totalXP} XP
                </h3>
                <p className="text-xs text-slate-500 m-0 mt-0.5">
                  {currentUserEntry.correctAnswersCount} correct answers recorded ({currentUserEntry.examXP} XP from exams)
                </p>
              </div>
            </div>

            <div className="text-right sm:border-l sm:border-slate-200 sm:pl-6 w-full sm:w-auto">
              {currentUserEntry.rank === 1 ? (
                <div className="flex items-center gap-2 text-amber-600 font-extrabold text-sm">
                  <Crown className="w-5 h-5 fill-amber-500" />
                  <span>You are #1 on the Leaderboard! Protect your crown! 👑</span>
                </div>
              ) : currentUserEntry.distanceToAhead !== undefined ? (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700">
                    <TrendingUp className="w-4 h-4" />
                    <span>{currentUserEntry.distanceToAhead} XP to pass #{currentUserEntry.rank - 1}!</span>
                  </div>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    That's just {Math.ceil(currentUserEntry.distanceToAhead / 2)} more correct answers
                  </span>
                </div>
              ) : null}
            </div>

          </div>
        </div>
      )}

      {/* Podium for Top 3 Students */}
      {topThree.length >= 2 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
          <div className="text-center mb-6">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
              Podium of Top Performers
            </span>
            <h2 className="text-lg font-black text-slate-900 m-0 mt-0.5">
              School Hall of Fame
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-6 items-end max-w-xl mx-auto pt-8 pb-4">
            
            {/* Rank 2 (Silver) */}
            {topThree[1] && (
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-2">
                  {topThree[1].student.photo ? (
                    <img
                      src={topThree[1].student.photo}
                      alt={topThree[1].student.name}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover ring-4 ring-slate-300 shadow-md"
                    />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-200 text-slate-700 font-black text-lg flex items-center justify-center ring-4 ring-slate-300 shadow-md">
                      {topThree[1].student.name.charAt(0)}
                    </div>
                  )}
                  <span className="absolute -bottom-2 -right-1 w-6 h-6 rounded-full bg-slate-300 text-slate-800 text-xs font-black flex items-center justify-center shadow">
                    🥈
                  </span>
                </div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[90px] sm:max-w-[120px]">
                  {topThree[1].student.name.split(' ')[0]}
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  {topThree[1].totalXP} XP
                </span>
                <div className="w-full bg-slate-100 border border-slate-200 rounded-2xl h-24 sm:h-28 mt-3 flex items-center justify-center font-black text-2xl text-slate-400">
                  2
                </div>
              </div>
            )}

            {/* Rank 1 (Gold - Center & Tallest) */}
            {topThree[0] && (
              <div className="flex flex-col items-center text-center -mt-6">
                <div className="relative mb-2">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl animate-bounce">
                    👑
                  </div>
                  {topThree[0].student.photo ? (
                    <img
                      src={topThree[0].student.photo}
                      alt={topThree[0].student.name}
                      className="w-18 h-18 sm:w-20 sm:h-20 rounded-full object-cover ring-4 ring-amber-400 shadow-xl"
                    />
                  ) : (
                    <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 font-black text-2xl flex items-center justify-center ring-4 ring-amber-300 shadow-xl">
                      {topThree[0].student.name.charAt(0)}
                    </div>
                  )}
                  <span className="absolute -bottom-2 -right-1 w-7 h-7 rounded-full bg-amber-400 text-slate-950 text-sm font-black flex items-center justify-center shadow">
                    🥇
                  </span>
                </div>
                <span className="text-sm sm:text-base font-extrabold text-slate-900 truncate max-w-[100px] sm:max-w-[140px]">
                  {topThree[0].student.name.split(' ')[0]}
                </span>
                <span className="text-xs font-mono font-black text-amber-600">
                  {topThree[0].totalXP} XP
                </span>
                <div className="w-full bg-gradient-to-b from-amber-200/60 to-yellow-100 border border-amber-300 rounded-2xl h-32 sm:h-36 mt-3 flex items-center justify-center font-black text-3xl text-amber-600 shadow-sm">
                  1
                </div>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {topThree[2] && (
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-2">
                  {topThree[2].student.photo ? (
                    <img
                      src={topThree[2].student.photo}
                      alt={topThree[2].student.name}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover ring-4 ring-amber-600/60 shadow-md"
                    />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-amber-100 text-amber-900 font-black text-lg flex items-center justify-center ring-4 ring-amber-600/40 shadow-md">
                      {topThree[2].student.name.charAt(0)}
                    </div>
                  )}
                  <span className="absolute -bottom-2 -right-1 w-6 h-6 rounded-full bg-amber-700 text-white text-xs font-black flex items-center justify-center shadow">
                    🥉
                  </span>
                </div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[90px] sm:max-w-[120px]">
                  {topThree[2].student.name.split(' ')[0]}
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  {topThree[2].totalXP} XP
                </span>
                <div className="w-full bg-amber-50/60 border border-amber-200/80 rounded-2xl h-20 sm:h-24 mt-3 flex items-center justify-center font-black text-2xl text-amber-700">
                  3
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {studentClass && (
              <button
                onClick={() => setScopeFilter('class')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  scopeFilter === 'class' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                My Class ({studentClass})
              </button>
            )}
            <button
              onClick={() => setScopeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                scopeFilter === 'all' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Whole School
            </button>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search student name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Full Leaderboard Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 text-center w-16">Rank</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Level & Rank Title</th>
                <th className="py-3 px-4 text-center">Correct Qs</th>
                <th className="py-3 px-4 text-center">Badges</th>
                <th className="py-3 px-4 text-center">Streak</th>
                <th className="py-3 px-4 text-right">Total XP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.map(entry => {
                const isMe = entry.isCurrentUser;
                return (
                  <tr
                    key={entry.student.id}
                    className={`transition-colors ${
                      isMe
                        ? 'bg-indigo-50/80 font-semibold ring-1 ring-inset ring-indigo-200'
                        : 'hover:bg-slate-50/60'
                    }`}
                  >
                    {/* Rank */}
                    <td className="py-3.5 px-4 text-center">
                      {entry.rank === 1 ? (
                        <span className="text-xl">🥇</span>
                      ) : entry.rank === 2 ? (
                        <span className="text-xl">🥈</span>
                      ) : entry.rank === 3 ? (
                        <span className="text-xl">🥉</span>
                      ) : (
                        <span className="font-mono font-bold text-slate-500 text-xs">
                          #{entry.rank}
                        </span>
                      )}
                    </td>

                    {/* Student Name & Avatar */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {entry.student.photo ? (
                          <img
                            src={entry.student.photo}
                            alt={entry.student.name}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                            {entry.student.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <span className="text-slate-900 font-bold block text-xs sm:text-sm">
                            {entry.student.name}
                            {isMe && (
                              <span className="ml-2 text-[10px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded-full">
                                You
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            ID: {entry.student.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Class */}
                    <td className="py-3.5 px-4 text-xs text-slate-600 font-medium">
                      {entry.student.class || 'General'}
                    </td>

                    {/* Level */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{entry.levelInfo.badge}</span>
                        <div>
                          <span className="text-xs font-bold text-slate-800 block leading-tight">
                            Lvl {entry.levelInfo.level}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {entry.levelInfo.title}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Correct Answers */}
                    <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-700 font-semibold">
                      {entry.correctAnswersCount}
                    </td>

                    {/* Badges */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                        <Award className="w-3 h-3 text-amber-600" />
                        {entry.badgeCount}
                      </span>
                    </td>

                    {/* Streak */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600">
                        <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
                        {entry.streakDays}d
                      </span>
                    </td>

                    {/* Total XP */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-sm font-black font-mono text-indigo-700 flex items-center justify-end gap-1">
                        <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                        {entry.totalXP} XP
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Badges Modal */}
      {showBadgesModal && (
        <AchievementsModal
          badges={studentBadges}
          totalXP={currentUserEntry?.totalXP || 0}
          onClose={() => setShowBadgesModal(false)}
        />
      )}

    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h3 className="font-extrabold text-slate-800 m-0">Gamified School Leaderboard</h3>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
          <div className="p-6 overflow-y-auto flex-1">
            {content}
          </div>
        </div>
      </div>
    );
  }

  return content;
}
