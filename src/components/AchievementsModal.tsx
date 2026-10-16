import React, { useState } from 'react';
import { AchievementBadge } from '../lib/gamification';
import {
  X,
  Award,
  Trophy,
  CheckCircle2,
  Lock,
  Sparkles,
  Zap,
  Flame,
  ShieldCheck,
  Star
} from 'lucide-react';

interface AchievementsModalProps {
  badges: AchievementBadge[];
  onClose: () => void;
  totalXP: number;
}

export default function AchievementsModal({ badges, onClose, totalXP }: AchievementsModalProps) {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const unlockedCount = badges.filter(b => b.isUnlocked).length;
  const totalCount = badges.length;

  const filteredBadges = badges.filter(b => {
    if (filter === 'unlocked' && !b.isUnlocked) return false;
    if (filter === 'locked' && b.isUnlocked) return false;
    if (categoryFilter !== 'all' && b.category !== categoryFilter) return false;
    return true;
  });

  const getRarityBadge = (rarity: AchievementBadge['rarity']) => {
    switch (rarity) {
      case 'legendary':
        return 'bg-gradient-to-r from-amber-500 to-yellow-300 text-slate-950 border-amber-300 shadow-sm';
      case 'epic':
        return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-purple-300';
      case 'rare':
        return 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-blue-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Top Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 text-white flex-shrink-0 relative overflow-hidden">
          <div className="flex items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 shadow-md">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Hall of Achievements
                  </span>
                  <span className="text-xs text-indigo-200">
                    {unlockedCount} of {totalCount} Unlocked
                  </span>
                </div>
                <h2 className="text-xl font-black text-white m-0 mt-1">
                  Badges & Trophies Gallery
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar Header */}
          <div className="mt-4 relative z-10">
            <div className="flex justify-between text-xs text-indigo-200 font-semibold mb-1.5">
              <span>Overall Badges Mastery</span>
              <span>{Math.round((unlockedCount / totalCount) * 100)}%</span>
            </div>
            <div className="w-full h-2.5 bg-black/30 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-rose-400 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>

          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-1/4 translate-y-1/4">
            <Award className="w-64 h-64 text-white" />
          </div>
        </div>

        {/* Filter Controls */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filter === 'all' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setFilter('unlocked')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filter === 'unlocked' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Unlocked ({unlockedCount})
            </button>
            <button
              onClick={() => setFilter('locked')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filter === 'locked' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Locked ({totalCount - unlockedCount})
            </button>
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Categories</option>
            <option value="accuracy">Accuracy & Answers</option>
            <option value="mastery">Level & Mastery</option>
            <option value="streak">Consistency & Streaks</option>
            <option value="leaderboard">Leaderboard Podium</option>
            <option value="resources">Learning Resources</option>
          </select>
        </div>

        {/* Badges Grid */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50">
          {filteredBadges.map(badge => {
            const isUnlocked = badge.isUnlocked;
            const progressPct = Math.min(100, Math.round((badge.progressCurrent / badge.progressTarget) * 100));

            return (
              <div
                key={badge.id}
                className={`p-4 rounded-2xl border transition-all flex items-start gap-4 ${
                  isUnlocked
                    ? 'bg-white border-amber-200/80 shadow-sm hover:shadow-md hover:border-amber-300'
                    : 'bg-slate-100/70 border-slate-200/80 opacity-80'
                }`}
              >
                {/* Badge Icon */}
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm border ${
                  isUnlocked
                    ? 'bg-gradient-to-br from-amber-100 to-yellow-50 border-amber-300 ring-2 ring-amber-400/30 animate-in zoom-in-50'
                    : 'bg-slate-200 border-slate-300 text-slate-400 grayscale'
                }`}>
                  {isUnlocked ? badge.icon : <Lock className="w-6 h-6 text-slate-400" />}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${getRarityBadge(badge.rarity)}`}>
                      {badge.rarity}
                    </span>
                    <span className="text-xs font-bold text-amber-600 flex items-center gap-0.5">
                      <Zap className="w-3 h-3 fill-amber-500" />
                      +{badge.xpReward} XP
                    </span>
                  </div>

                  <h3 className={`text-sm font-bold m-0 ${isUnlocked ? 'text-slate-900' : 'text-slate-600'}`}>
                    {badge.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 mb-2 leading-relaxed">
                    {badge.description}
                  </p>

                  {/* Progress / Status */}
                  {isUnlocked ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg w-fit">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Unlocked & Claimed</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>Progress</span>
                        <span>{badge.progressCurrent} / {badge.progressTarget}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 flex-shrink-0">
          <span>Earn <strong>2 XP</strong> for every correct answer to unlock more trophies!</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
