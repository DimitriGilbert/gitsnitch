import type {
  CollaborationInsight,
  DevelopmentRhythmInsight,
  FocusTimeInsight,
  PeakDayInsight,
  PeakHourInsight,
  ProductivityInsights,
  VelocityInsight,
} from "./analysis.js";
import type { CommitRecord } from "./commits.js";
import type { ContributorSummary } from "./contributors.js";

const millisecondsPerDay = 86_400_000;
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** Generates productivity insights from public commit and contributor data. */
export function generateProductivityInsights(
  commits: readonly CommitRecord[],
  contributors: readonly ContributorSummary[],
  periodDays: number,
): ProductivityInsights {
  return {
    contributorCount: contributors.length,
    peakHours: findPeakHours(commits),
    peakDays: findPeakDays(commits),
    velocity: calculateVelocity(commits, periodDays),
    rhythm: analyzeDevelopmentRhythm(commits),
    collaboration: calculateCollaborationScore(commits),
    focusTime: calculateFocusTime(commits),
  };
}

/** Finds the UTC hour with the most commits. Ties choose the earliest hour. */
export function findPeakHours(commits: readonly CommitRecord[]): PeakHourInsight {
  if (commits.length === 0) {
    return { hour: 0, hourFormatted: "00:00", commits: 0, percentage: 0 };
  }

  const counts = Array.from({ length: 24 }, () => 0);
  for (const commit of commits) {
    const hour = new Date(commit.committedAt).getUTCHours();
    counts[hour] = countAt(counts, hour) + 1;
  }

  const peak = findPeakIndex(counts);
  return {
    hour: peak.index,
    hourFormatted: `${String(peak.index).padStart(2, "0")}:00`,
    commits: peak.count,
    percentage: percentage(peak.count, commits.length),
  };
}

/** Finds the UTC day of week with the most commits. Ties choose the earliest day. */
export function findPeakDays(commits: readonly CommitRecord[]): PeakDayInsight {
  if (commits.length === 0) {
    return { day: 0, dayName: "Unknown", commits: 0, percentage: 0 };
  }

  const counts = Array.from({ length: 7 }, () => 0);
  for (const commit of commits) {
    const day = new Date(commit.committedAt).getUTCDay();
    counts[day] = countAt(counts, day) + 1;
  }

  const peak = findPeakIndex(counts);
  const dayName = dayNames[peak.index] ?? "Unknown";
  return {
    day: peak.index,
    dayName,
    commits: peak.count,
    percentage: percentage(peak.count, commits.length),
  };
}

/** Calculates commit and added-line velocity over the requested period. */
export function calculateVelocity(commits: readonly CommitRecord[], periodDays: number): VelocityInsight {
  const totalLines = commits.reduce((sum, commit) => sum + commit.files.reduce((fileSum, file) => fileSum + file.additions, 0), 0);
  if (commits.length === 0 || periodDays <= 0) {
    return { linesPerDay: 0, commitsPerDay: 0, velocity: "unknown", totalLines };
  }

  const linesPerDay = Math.round(totalLines / periodDays);
  const commitsPerDay = roundTo(commits.length / periodDays, 2);
  let velocity: VelocityInsight["velocity"] = "low";
  if (linesPerDay > 500) {
    velocity = "high";
  } else if (linesPerDay > 200) {
    velocity = "medium";
  }

  return { linesPerDay, commitsPerDay, velocity, totalLines };
}

/** Analyzes the consistency of time intervals between commits. */
export function analyzeDevelopmentRhythm(commits: readonly CommitRecord[]): DevelopmentRhythmInsight {
  if (commits.length < 2) {
    return { consistency: "unknown", avgDaysBetweenCommits: 0, rhythmScore: 0, standardDeviation: 0 };
  }

  const sortedTimes = commits.map((commit) => new Date(commit.committedAt).getTime()).sort((left, right) => left - right);
  const intervals = sortedTimes.slice(1).map((time, index) => (time - countAt(sortedTimes, index)) / millisecondsPerDay);
  const avgInterval = intervals.reduce(sumNumbers, 0) / intervals.length;
  const variance = intervals.reduce((sum, interval) => sum + (interval - avgInterval) ** 2, 0) / intervals.length;
  const standardDeviation = Math.sqrt(variance);
  const rhythmScore = Math.round(Math.max(0, 100 - standardDeviation * 10));

  return {
    consistency: consistencyForScore(rhythmScore),
    avgDaysBetweenCommits: roundTo(avgInterval, 2),
    rhythmScore,
    standardDeviation: roundTo(standardDeviation, 2),
  };
}

/** Calculates how often files are touched by more than one contributor. */
export function calculateCollaborationScore(commits: readonly CommitRecord[]): CollaborationInsight {
  if (commits.length === 0) {
    return { score: 0, multiAuthorFiles: 0, totalFiles: 0, collaborationLevel: "none" };
  }

  const fileAuthors = new Map<string, Set<string>>();
  for (const commit of commits) {
    const author = commit.author.email.trim().toLowerCase() || commit.author.name.trim();
    for (const file of commit.files) {
      const authors = fileAuthors.get(file.path) ?? new Set<string>();
      authors.add(author);
      fileAuthors.set(file.path, authors);
    }
  }

  const totalFiles = fileAuthors.size;
  const multiAuthorFiles = [...fileAuthors.values()].filter((authors) => authors.size > 1).length;
  const score = totalFiles > 0 ? percentage(multiAuthorFiles, totalFiles) : 0;

  return {
    score,
    multiAuthorFiles,
    totalFiles,
    collaborationLevel: collaborationLevelForScore(score, totalFiles),
  };
}

/** Classifies commits into weekday working hours, after-hours, and weekend buckets. */
export function calculateFocusTime(commits: readonly CommitRecord[]): FocusTimeInsight {
  if (commits.length === 0) {
    return {
      workingHoursCommits: 0,
      workingHoursPercent: 0,
      afterHoursCommits: 0,
      afterHoursPercent: 0,
      weekendCommits: 0,
      weekendPercent: 0,
      workLifeBalance: "unknown",
    };
  }

  let workingHoursCommits = 0;
  let afterHoursCommits = 0;
  let weekendCommits = 0;

  for (const commit of commits) {
    const date = new Date(commit.committedAt);
    const hour = date.getUTCHours();
    const day = date.getUTCDay();
    if (day === 0 || day === 6) {
      weekendCommits += 1;
    } else if (hour >= 9 && hour < 18) {
      workingHoursCommits += 1;
    } else {
      afterHoursCommits += 1;
    }
  }

  const afterHoursPercent = percentage(afterHoursCommits, commits.length);
  const weekendPercent = percentage(weekendCommits, commits.length);
  return {
    workingHoursCommits,
    workingHoursPercent: percentage(workingHoursCommits, commits.length),
    afterHoursCommits,
    afterHoursPercent,
    weekendCommits,
    weekendPercent,
    workLifeBalance: workLifeBalanceFor(afterHoursPercent, weekendPercent),
  };
}

function findPeakIndex(counts: readonly number[]): { readonly index: number; readonly count: number } {
  return counts.reduce(
    (peak, count, index) => (count > peak.count ? { index, count } : peak),
    { index: 0, count: 0 },
  );
}

function countAt(values: readonly number[], index: number): number {
  return values[index] ?? 0;
}

function percentage(part: number, total: number): number {
  return total > 0 ? roundTo((part / total) * 100, 1) : 0;
}

function roundTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function sumNumbers(sum: number, value: number): number {
  return sum + value;
}

function consistencyForScore(score: number): DevelopmentRhythmInsight["consistency"] {
  if (score > 70) {
    return "highly-consistent";
  }
  if (score > 50) {
    return "consistent";
  }
  if (score > 30) {
    return "somewhat-consistent";
  }
  return "irregular";
}

function collaborationLevelForScore(score: number, totalFiles: number): CollaborationInsight["collaborationLevel"] {
  if (totalFiles === 0) {
    return "none";
  }
  if (score > 50) {
    return "high";
  }
  if (score > 25) {
    return "medium";
  }
  return "low";
}

function workLifeBalanceFor(afterHoursPercent: number, weekendPercent: number): FocusTimeInsight["workLifeBalance"] {
  if (afterHoursPercent > 40 || weekendPercent > 30) {
    return "poor";
  }
  if (afterHoursPercent > 25 || weekendPercent > 15) {
    return "fair";
  }
  return "good";
}
