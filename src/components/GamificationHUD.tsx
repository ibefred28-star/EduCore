import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import {
  useStudentResultsSubscription,
  useSchoolResultsSubscription,
  useStudentsSubscription
} from '../hooks/useDomainSubscriptions';
import {
  calculateStudentTotalXP,
  getStudentLevel,
  evaluateBadges,
  getDailyQuests,
  buildLeaderboard
} from '../lib/gamification';
import AchievementsModal from './AchievementsModal';
import LeaderboardView from './LeaderboardView';
import {
  Zap,
  Flame,
  Award,
  Trophy,
  Crown,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Target,
  ArrowRight
} from 'lucide-react';

export default function GamificationHUD() {
  const { data, currentUser, currentRole, schoolId } = useStore();
  const student = currentUser as any;
  const currentStudentId = currentUser?.id || '';
  const studentClass = student?.class || '';

  // Real-time results subscription for active student
  const { results: liveStudentResults } = useStudentResultsSubscription(
    schoolId,
    currentRole === 'student' ? currentStudentId : null
  );

  // Real-time results subscription for all school results
  const { results: liveSchoolResults } = useSchoolResultsSubscription(schoolId);
  const { students: liveStudents } = useStudentsSubscription(schoolId);

  const targetStudents = useMemo(() => {
    const map = new Map<string, any>();
    (data.students || []).forEach(s => map.set((s.id || '').trim().toLowerCase(), s));
    (liveStudents || []).forEach(s => map.set((s.id || '').trim().toLowerCase(), s));
    return Array.from(map.values());
  }, [liveStudents, data.students]);

  // Overall effective results for school (merging store and live results)
  const allResults = useMemo(() => {
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

  const studentResults = useMemo(() => {
    const studentIdNorm = currentStudentId.trim().toLowerCase();
    return allResults.filter(r => (r.studentId || '').trim().toLowerCase() === studentIdNorm);
  }, [allResults, currentStudentId]);

  // Gamification stats
  const xpStats = useMemo(() => {
    return calculateStudentTotalXP(currentStudentId, studentResults);
  }, [currentStudentId, studentResults]);

  const levelInfo = useMemo(() => {
    return getStudentLevel(xpStats.totalXP);
  }, [xpStats.totalXP]);

  // Leaderboard ranking
  const leaderboard = useMemo(() => {
    return buildLeaderboard(targetStudents, allResults, currentStudentId, studentClass);
  }, [targetStudents, allResults, currentStudentId, studentClass]);

  const myEntry = leaderboard.currentUserEntry;

  // Badges
  const badges = useMemo(() => {
    return evaluateBadges(currentStudentId, studentResults, myEntry?.rank);
  }, [currentStudentId, studentResults, myEntry?.rank]);

  const unlockedBadges = useMemo(() => {
    return badges.filter(b => b.isUnlocked);
  }, [badges]);

  // Daily Quests
  const dailyQuests = useMemo(() => {
    return getDailyQuests(currentStudentId, studentResults);
  }, [currentStudentId, studentResults]);

  // Modals
  const [showAchievements, setShowAchievements] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  return (
    <>
      <div className="col-span-1 md:col-span-3 lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Level, XP & Streak Hero Widget */}
        <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-[28px] p-6 text-white shadow-lg border border-indigo-500/20 relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center gap-1">
                <span>{levelInfo.badge}</span> Level {levelInfo.level}
              </span>
              
              {/* Daily Streak Flame */}
              <div className="flex items-center gap-1 bg-orange-500/20 border border-orange-500/40 text-orange-300 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm">
                <Flame className="w-3.5 h-3.5 fill-orange-400 text-orange-400 animate-pulse" />
                <span>{xpStats.streakDays} Day Streak!</span>
              </div>
            </div>

            <h3 className="text-xl font-black text-white m-0">
              {levelInfo.title}
            </h3>
            <p className="text-xs text-indigo-200/80 m-0 mt-0.5">
              {xpStats.correctAnswersCount} correct answers &bull; <strong>2 XP each</strong>
            </p>

            {/* XP Counter */}
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-amber-300 font-mono tracking-tight">
                {xpStats.totalXP}
              </span>
              <span className="text-xs text-slate-300 font-medium">Total XP</span>
              <span className="text-xs text-indigo-300 ml-auto font-mono">
                {levelInfo.xpToNextLevel > 0 ? `${levelInfo.xpToNextLevel} XP to Level ${levelInfo.level + 1}` : 'Max Level'}
              </span>
            </div>

            {/* Level Progress Bar */}
            <div className="mt-2 w-full h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${levelInfo.progressPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300 relative z-10">
            <span>Class Rank: <strong>#{myEntry?.rank || 1}</strong></span>
            <button
              onClick={() => setShowLeaderboard(true)}
              className="text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>View Leaderboard</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-1/4 translate-y-1/4">
            <Zap className="w-48 h-48 text-white" />
          </div>
        </div>

        {/* Card 2: Daily Quests / Missions */}
        <div className="bg-white rounded-[28px] p-6 shadow-sm border border-slate-200/90 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
                  <Target className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black text-slate-900 m-0">Daily Quests</h4>
              </div>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                Resets Daily
              </span>
            </div>

            <div className="space-y-2.5">
              {dailyQuests.map(quest => (
                <div
                  key={quest.id}
                  className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    quest.isCompleted
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-slate-50/70 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base">{quest.icon}</span>
                    <div className="min-w-0">
                      <h5 className="text-xs font-bold m-0 truncate">{quest.title}</h5>
                      <p className="text-[11px] text-slate-500 m-0 truncate">{quest.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] font-bold text-amber-600">
                      +{quest.rewardXP} XP
                    </span>
                    {quest.isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-100" />
                    ) : (
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {quest.current}/{quest.target}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 text-[11px] text-slate-400 text-center">
            Complete daily quests to accelerate your climb up the leaderboard!
          </div>
        </div>

        {/* Card 3: Badges Shelf & Next Milestone */}
        <div className="bg-gradient-to-br from-amber-50/80 via-white to-purple-50/80 rounded-[28px] p-6 shadow-sm border border-amber-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                  <Award className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black text-slate-900 m-0">Trophies & Badges</h4>
              </div>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {unlockedBadges.length} / {badges.length} Unlocked
              </span>
            </div>

            {/* Recent Unlocked Badges Preview */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {badges.slice(0, 4).map(b => (
                <div
                  key={b.id}
                  onClick={() => setShowAchievements(true)}
                  className={`p-2 rounded-2xl border text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                    b.isUnlocked
                      ? 'bg-white border-amber-300 shadow-sm hover:scale-105'
                      : 'bg-slate-100/60 border-slate-200 opacity-60 grayscale hover:opacity-100'
                  }`}
                  title={`${b.title}: ${b.description}`}
                >
                  <span className="text-xl mb-0.5">{b.icon}</span>
                  <span className="text-[10px] font-bold text-slate-700 truncate w-full">
                    {b.title}
                  </span>
                </div>
              ))}
            </div>

            {/* Motivational Overtake Hint */}
            {myEntry && myEntry.rank > 1 && myEntry.distanceToAhead !== undefined && (
              <div className="bg-white/90 p-3 rounded-2xl border border-purple-200 text-xs text-purple-950 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <span>
                  Only <strong>{myEntry.distanceToAhead} XP</strong> needed to overtake rank #{myEntry.rank - 1}!
                </span>
              </div>
            )}
            {myEntry && myEntry.rank === 1 && (
              <div className="bg-amber-100/90 p-3 rounded-2xl border border-amber-300 text-xs text-amber-950 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  <strong>You are currently #1 in your class!</strong> Keep leading the pack!
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowAchievements(true)}
            className="w-full mt-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <span>View All {badges.length} Achievement Badges</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* Modals */}
      {showAchievements && (
        <AchievementsModal
          badges={badges}
          totalXP={xpStats.totalXP}
          onClose={() => setShowAchievements(false)}
        />
      )}

      {showLeaderboard && (
        <LeaderboardView
          isModal={true}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
    </>
  );
}
