import { Result, Student } from '../types';
import { FirestoreResultDoc } from './firestore/models';

export type GamifiedResultItem = Result | FirestoreResultDoc;

export const XP_PER_CORRECT_ANSWER = 2;
export const XP_PER_RESOURCE_READ = 2;
export const XP_DAILY_QUEST_BONUS = 10;

export interface StudentLevelInfo {
  level: number;
  title: string;
  badge: string;
  currentXP: number;
  minXP: number;
  maxXP: number;
  progressPercent: number;
  xpToNextLevel: number;
  color: string;
  bgGradient: string;
}

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'accuracy' | 'streak' | 'mastery' | 'resources' | 'leaderboard';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  xpReward: number;
  isUnlocked: boolean;
  unlockedAt?: string;
  progressCurrent: number;
  progressTarget: number;
}

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  icon: string;
  rewardXP: number;
  current: number;
  target: number;
  isCompleted: boolean;
}

export interface GamificationUserData {
  streakDays: number;
  lastActiveDate: string;
  readResourceIds: string[];
  completedQuestIds: string[];
  lastQuestDate: string;
  bonusXP: number;
}

// Level Milestones
const LEVEL_TIERS = [
  { level: 1, title: 'Novice Scholar', badge: '🌱', minXP: 0, maxXP: 50, color: 'text-emerald-500', bgGradient: 'from-emerald-500 to-teal-600' },
  { level: 2, title: 'Curious Apprentice', badge: '⚡', minXP: 50, maxXP: 100, color: 'text-blue-500', bgGradient: 'from-blue-500 to-indigo-600' },
  { level: 3, title: 'Knowledge Seeker', badge: '🧭', minXP: 100, maxXP: 200, color: 'text-indigo-500', bgGradient: 'from-indigo-500 to-purple-600' },
  { level: 4, title: 'Rising Prodigy', badge: '🚀', minXP: 200, maxXP: 350, color: 'text-purple-500', bgGradient: 'from-purple-500 to-pink-600' },
  { level: 5, title: 'Academic Knight', badge: '🛡️', minXP: 350, maxXP: 550, color: 'text-amber-500', bgGradient: 'from-amber-500 to-orange-600' },
  { level: 6, title: 'Master Mind', badge: '🔮', minXP: 550, maxXP: 800, color: 'text-rose-500', bgGradient: 'from-rose-500 to-red-600' },
  { level: 7, title: 'Grand Scholar', badge: '👑', minXP: 800, maxXP: 1200, color: 'text-yellow-400', bgGradient: 'from-amber-400 to-yellow-500' },
  { level: 8, title: 'EduCore Legend', badge: '🌌', minXP: 1200, maxXP: 2000, color: 'text-cyan-400', bgGradient: 'from-cyan-400 to-indigo-700' }
];

export function getStudentLevel(xp: number): StudentLevelInfo {
  const safeXP = Math.max(0, Math.round(xp));
  let tier = LEVEL_TIERS[0];

  for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
    if (safeXP >= LEVEL_TIERS[i].minXP) {
      tier = LEVEL_TIERS[i];
      break;
    }
  }

  const range = tier.maxXP - tier.minXP;
  const progressInsideTier = Math.max(0, safeXP - tier.minXP);
  const progressPercent = Math.min(100, Math.round((progressInsideTier / range) * 100));
  const xpToNextLevel = Math.max(0, tier.maxXP - safeXP);

  return {
    level: tier.level,
    title: tier.title,
    badge: tier.badge,
    currentXP: safeXP,
    minXP: tier.minXP,
    maxXP: tier.maxXP,
    progressPercent,
    xpToNextLevel,
    color: tier.color,
    bgGradient: tier.bgGradient
  };
}

/**
 * Calculates correct answers and corresponding XP (2 XP per correct answer)
 */
export function calculateResultStats(results: GamifiedResultItem[]): {
  correctAnswersCount: number;
  totalQuestionsCount: number;
  examXP: number;
  perfectCount: number;
  distinctSubjects: string[];
  cleanViolationsExamsCount: number;
  highScoreExamsCount: number;
} {
  let correctAnswersCount = 0;
  let totalQuestionsCount = 0;
  let perfectCount = 0;
  let cleanViolationsExamsCount = 0;
  let highScoreExamsCount = 0;
  const subjectsSet = new Set<string>();

  results.forEach(r => {
    if (r.subject) subjectsSet.add(r.subject);
    const pct = typeof r.percentage === 'number' ? r.percentage : 0;
    if (pct === 100) perfectCount++;
    if (pct >= 80) highScoreExamsCount++;
    if (!r.violations || r.violations === 0) cleanViolationsExamsCount++;

    let breakdownCorrect = 0;
    if (Array.isArray(r.breakdown) && r.breakdown.length > 0) {
      r.breakdown.forEach(b => {
        totalQuestionsCount++;
        if (b.isCorrect === true || (typeof b.awardedMarks === 'number' && b.awardedMarks > 0)) {
          breakdownCorrect++;
        }
      });
    }

    const raw = typeof r.raw === 'number' ? Math.max(0, r.raw) : 0;
    const rawMax = typeof r.rawMax === 'number' && r.rawMax > 0
      ? r.rawMax
      : (Array.isArray(r.breakdown) && r.breakdown.length > 0 ? r.breakdown.length : raw);

    // Fallback: if breakdown didn't have correct items but percentage or raw is positive
    let resolvedCorrect = Math.max(breakdownCorrect, raw);
    if (resolvedCorrect === 0 && pct > 0 && rawMax > 0) {
      resolvedCorrect = Math.round((pct / 100) * rawMax);
    }

    correctAnswersCount += resolvedCorrect;
    if (!Array.isArray(r.breakdown) || r.breakdown.length === 0) {
      totalQuestionsCount += (rawMax || resolvedCorrect || 1);
    }
  });

  const examXP = correctAnswersCount * XP_PER_CORRECT_ANSWER;

  return {
    correctAnswersCount,
    totalQuestionsCount,
    examXP,
    perfectCount,
    distinctSubjects: Array.from(subjectsSet),
    cleanViolationsExamsCount,
    highScoreExamsCount
  };
}

/**
 * Retrieves persisted gamification state for a student
 */
export function getGamificationUserData(studentId: string): GamificationUserData {
  if (typeof window === 'undefined' || !studentId) {
    return {
      streakDays: 1,
      lastActiveDate: new Date().toISOString().split('T')[0],
      readResourceIds: [],
      completedQuestIds: [],
      lastQuestDate: new Date().toISOString().split('T')[0],
      bonusXP: 0
    };
  }

  const key = `educore_gamification_${studentId}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      const initial: GamificationUserData = {
        streakDays: 1,
        lastActiveDate: new Date().toISOString().split('T')[0],
        readResourceIds: [],
        completedQuestIds: [],
        lastQuestDate: new Date().toISOString().split('T')[0],
        bonusXP: 0
      };
      localStorage.setItem(key, JSON.stringify(initial));
      return initial;
    }

    const data: GamificationUserData = JSON.parse(raw);
    const today = new Date().toISOString().split('T')[0];

    // Reset daily quests if date changed
    if (data.lastQuestDate !== today) {
      data.completedQuestIds = [];
      data.lastQuestDate = today;
    }

    // Check streak
    if (data.lastActiveDate !== today) {
      const last = new Date(data.lastActiveDate);
      const curr = new Date(today);
      const diffDays = Math.round((curr.getTime() - last.getTime()) / (1000 * 3600 * 24));

      if (diffDays === 1) {
        data.streakDays = (data.streakDays || 1) + 1;
      } else if (diffDays > 1) {
        data.streakDays = 1; // streak broke
      }
      data.lastActiveDate = today;
      localStorage.setItem(key, JSON.stringify(data));
    }

    return data;
  } catch (e) {
    return {
      streakDays: 1,
      lastActiveDate: new Date().toISOString().split('T')[0],
      readResourceIds: [],
      completedQuestIds: [],
      lastQuestDate: new Date().toISOString().split('T')[0],
      bonusXP: 0
    };
  }
}

/**
 * Saves gamification data to localStorage
 */
export function saveGamificationUserData(studentId: string, data: GamificationUserData) {
  if (typeof window === 'undefined' || !studentId) return;
  try {
    localStorage.setItem(`educore_gamification_${studentId}`, JSON.stringify(data));
  } catch (e) {
    // ignore
  }
}

/**
 * Awards bonus XP for engaging with a learning resource (reading or listening in British English)
 */
export function recordResourceReadEngagement(studentId: string, resourceId: string): { awarded: boolean; newXP: number } {
  if (!studentId || !resourceId) return { awarded: false, newXP: 0 };
  const user = getGamificationUserData(studentId);
  if (!user.readResourceIds.includes(resourceId)) {
    user.readResourceIds.push(resourceId);
    user.bonusXP = (user.bonusXP || 0) + XP_PER_RESOURCE_READ;
    saveGamificationUserData(studentId, user);
    return { awarded: true, newXP: XP_PER_RESOURCE_READ };
  }
  return { awarded: false, newXP: 0 };
}

/**
 * Computes overall XP for a student
 */
export function calculateStudentTotalXP(studentId: string, results: GamifiedResultItem[]): {
  totalXP: number;
  examXP: number;
  correctAnswersCount: number;
  bonusXP: number;
  resourceCount: number;
  streakDays: number;
} {
  const stats = calculateResultStats(results);
  const user = getGamificationUserData(studentId);

  const resourceBonus = (user.readResourceIds?.length || 0) * XP_PER_RESOURCE_READ;
  const questBonus = (user.bonusXP || 0);
  const totalBonus = resourceBonus + questBonus;
  const totalXP = stats.examXP + totalBonus;

  return {
    totalXP,
    examXP: stats.examXP,
    correctAnswersCount: stats.correctAnswersCount,
    bonusXP: totalBonus,
    resourceCount: user.readResourceIds?.length || 0,
    streakDays: user.streakDays || 1
  };
}

/**
 * Evaluates achievement badges for a student
 */
export function evaluateBadges(studentId: string, results: GamifiedResultItem[], currentRank?: number): AchievementBadge[] {
  const stats = calculateResultStats(results);
  const user = getGamificationUserData(studentId);
  const totalXP = stats.examXP + (user.readResourceIds?.length || 0) * XP_PER_RESOURCE_READ + (user.bonusXP || 0);

  const badgesList: AchievementBadge[] = [
    {
      id: 'badge_first_answer',
      title: 'First Spark',
      description: 'Answer your first correct question in any assessment (+2 XP)',
      icon: '🎯',
      category: 'accuracy',
      rarity: 'common',
      xpReward: 10,
      isUnlocked: stats.correctAnswersCount >= 1,
      progressCurrent: Math.min(1, stats.correctAnswersCount),
      progressTarget: 1
    },
    {
      id: 'badge_xp_novice',
      title: '50 XP Milestone',
      description: 'Accumulate 50 XP by answering questions correctly',
      icon: '⚡',
      category: 'mastery',
      rarity: 'common',
      xpReward: 15,
      isUnlocked: totalXP >= 50,
      progressCurrent: Math.min(50, totalXP),
      progressTarget: 50
    },
    {
      id: 'badge_century_thinker',
      title: 'Century Thinker',
      description: 'Answer 50 questions correctly across your examinations',
      icon: '🧠',
      category: 'accuracy',
      rarity: 'rare',
      xpReward: 25,
      isUnlocked: stats.correctAnswersCount >= 50,
      progressCurrent: Math.min(50, stats.correctAnswersCount),
      progressTarget: 50
    },
    {
      id: 'badge_perfectionist',
      title: 'Perfectionist',
      description: 'Score a flawless 100% on any examination',
      icon: '💯',
      category: 'accuracy',
      rarity: 'epic',
      xpReward: 30,
      isUnlocked: stats.perfectCount >= 1,
      progressCurrent: Math.min(1, stats.perfectCount),
      progressTarget: 1
    },
    {
      id: 'badge_streak_master',
      title: 'Consistency Flame',
      description: 'Maintain a 3-day continuous active learning streak',
      icon: '🔥',
      category: 'streak',
      rarity: 'rare',
      xpReward: 20,
      isUnlocked: user.streakDays >= 3,
      progressCurrent: Math.min(3, user.streakDays),
      progressTarget: 3
    },
    {
      id: 'badge_podium_master',
      title: 'Podium Champion',
      description: 'Climb into the Top 3 on the School Leaderboard',
      icon: '🏆',
      category: 'leaderboard',
      rarity: 'epic',
      xpReward: 35,
      isUnlocked: typeof currentRank === 'number' && currentRank <= 3 && currentRank > 0,
      progressCurrent: (typeof currentRank === 'number' && currentRank <= 3 && currentRank > 0) ? 1 : 0,
      progressTarget: 1
    },
    {
      id: 'badge_resource_scholar',
      title: 'British Audio Scholar',
      description: 'Explore and listen to 3 Learning Resources in British English',
      icon: '📚',
      category: 'resources',
      rarity: 'common',
      xpReward: 15,
      isUnlocked: (user.readResourceIds?.length || 0) >= 3,
      progressCurrent: Math.min(3, user.readResourceIds?.length || 0),
      progressTarget: 3
    },
    {
      id: 'badge_honor_roll',
      title: 'Honor Guardian',
      description: 'Complete 3 examinations with zero integrity violations',
      icon: '🛡️',
      category: 'mastery',
      rarity: 'rare',
      xpReward: 20,
      isUnlocked: stats.cleanViolationsExamsCount >= 3,
      progressCurrent: Math.min(3, stats.cleanViolationsExamsCount),
      progressTarget: 3
    },
    {
      id: 'badge_polymath',
      title: 'Polymath Prodigy',
      description: 'Excel in assessments across 3 or more distinct school subjects',
      icon: '🌟',
      category: 'mastery',
      rarity: 'epic',
      xpReward: 30,
      isUnlocked: stats.distinctSubjects.length >= 3,
      progressCurrent: Math.min(3, stats.distinctSubjects.length),
      progressTarget: 3
    },
    {
      id: 'badge_educore_titan',
      title: 'EduCore Titan',
      description: 'Amass over 250 XP to establish academic dominance',
      icon: '👑',
      category: 'mastery',
      rarity: 'legendary',
      xpReward: 50,
      isUnlocked: totalXP >= 250,
      progressCurrent: Math.min(250, totalXP),
      progressTarget: 250
    }
  ];

  return badgesList;
}

/**
 * Returns daily quests for today
 */
export function getDailyQuests(studentId: string, results: GamifiedResultItem[]): DailyQuest[] {
  const stats = calculateResultStats(results);
  const user = getGamificationUserData(studentId);

  const quest1Completed = stats.correctAnswersCount >= 5;
  const quest2Completed = (user.readResourceIds?.length || 0) >= 1;
  const quest3Completed = stats.highScoreExamsCount >= 1;

  return [
    {
      id: 'quest_daily_accuracy',
      title: 'Sharp Mind',
      description: 'Answer at least 5 correct questions in exams (+2 XP each)',
      icon: '🎯',
      rewardXP: 10,
      current: Math.min(5, stats.correctAnswersCount),
      target: 5,
      isCompleted: quest1Completed
    },
    {
      id: 'quest_british_audio',
      title: 'British Audio Quest',
      description: 'Listen to any lesson document in British English',
      icon: '🇬🇧',
      rewardXP: 5,
      current: Math.min(1, user.readResourceIds?.length || 0),
      target: 1,
      isCompleted: quest2Completed
    },
    {
      id: 'quest_high_score',
      title: 'Excellence Standard',
      description: 'Achieve 80% or higher on any assessment',
      icon: '⭐',
      rewardXP: 10,
      current: Math.min(1, stats.highScoreExamsCount),
      target: 1,
      isCompleted: quest3Completed
    }
  ];
}

export interface LeaderboardEntry {
  rank: number;
  student: Student;
  totalXP: number;
  examXP: number;
  correctAnswersCount: number;
  levelInfo: StudentLevelInfo;
  badgeCount: number;
  streakDays: number;
  isCurrentUser: boolean;
  distanceToAhead?: number;
}

/**
 * Generates sorted leaderboard rankings for students
 */
export function buildLeaderboard(
  students: Student[],
  results: GamifiedResultItem[],
  currentStudentId?: string,
  classFilter?: string
): {
  entries: LeaderboardEntry[];
  currentUserEntry: LeaderboardEntry | null;
  totalParticipants: number;
} {
  let targetStudents = students;

  if (classFilter && classFilter !== 'all') {
    const cfNorm = classFilter.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    targetStudents = students.filter(s => {
      const sNorm = (s.class || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return sNorm === cfNorm || sNorm.includes(cfNorm) || cfNorm.includes(sNorm);
    });
  }

  const entries: LeaderboardEntry[] = targetStudents.map(student => {
    const studentIdNorm = (student.id || '').trim().toLowerCase();
    const studentResults = results.filter(
      r => (r.studentId || '').trim().toLowerCase() === studentIdNorm
    );
    const xpStats = calculateStudentTotalXP(student.id, studentResults);
    const levelInfo = getStudentLevel(xpStats.totalXP);
    const badges = evaluateBadges(student.id, studentResults);
    const unlockedBadges = badges.filter(b => b.isUnlocked).length;

    return {
      rank: 0,
      student,
      totalXP: xpStats.totalXP,
      examXP: xpStats.examXP,
      correctAnswersCount: xpStats.correctAnswersCount,
      levelInfo,
      badgeCount: unlockedBadges,
      streakDays: xpStats.streakDays,
      isCurrentUser: (student.id || '').trim().toLowerCase() === (currentStudentId || '').trim().toLowerCase()
    };
  });

  // Sort descending by totalXP, tie-break by correctAnswersCount
  entries.sort((a, b) => {
    if (b.totalXP !== a.totalXP) return b.totalXP - a.totalXP;
    return b.correctAnswersCount - a.correctAnswersCount;
  });

  // Assign ranks
  entries.forEach((e, idx) => {
    e.rank = idx + 1;
    if (idx > 0) {
      e.distanceToAhead = entries[idx - 1].totalXP - e.totalXP;
    }
  });

  const currentUserEntry = entries.find(e => e.isCurrentUser) || null;

  return {
    entries,
    currentUserEntry,
    totalParticipants: entries.length
  };
}
