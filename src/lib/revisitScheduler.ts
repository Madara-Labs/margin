// ============================================================================
// Spaced Revisits Scheduler (Method 10)
// Evidence base: Dunlosky et al. (2013) — Distributed practice & Interleaving
// Intervals: 1, 3, 7, and 21 days.
// Builds a "revisit" queue from the reader's recall gaps and unanswered prompts,
// and interleaves sections from different chapters (no isolated Q/A flashcards,
// no streak mechanics).
// ============================================================================

import { RevisitIntervalDays, RevisitQueueItem } from '../types/margin';

export const REVISIT_INTERVALS: readonly RevisitIntervalDays[] = [1, 3, 7, 21];

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDaysIso(isoTimestamp: string, days: number): string {
  const dt = new Date(isoTimestamp);
  return new Date(dt.getTime() + days * DAY_MS).toISOString();
}

export interface CreateRevisitInput {
  bookId: string;
  sectionId: string;
  chapterId: string;
  sectionTitle: string;
  gapCount: number;
  unansweredPromptsCount: number;
  nowIso?: string;
}

/**
 * Enqueues or updates a section in the revisit queue when the reader has
 * recall gaps or unanswered prompts. Starts at stage 0 (1 day).
 */
export function buildOrUpdateRevisitItem(
  input: CreateRevisitInput,
  existing?: RevisitQueueItem
): RevisitQueueItem {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const hasGaps = input.gapCount > 0 || input.unansweredPromptsCount > 0;

  let stageIndex = existing ? existing.stageIndex : 0;
  if (!existing) {
    stageIndex = 0;
  } else if (hasGaps) {
    // If gaps persist upon revisit, reset or step back one interval to reinforce
    stageIndex = Math.max(0, existing.stageIndex - 1);
  } else {
    // Advance along 1 -> 3 -> 7 -> 21 day schedule
    stageIndex = Math.min(REVISIT_INTERVALS.length - 1, existing.stageIndex + 1);
  }

  const intervalDays = REVISIT_INTERVALS[stageIndex];
  const dueAt = addDaysIso(nowIso, intervalDays);
  const completedCount = existing ? existing.completedCount + 1 : 0;

  // Alternate between free_recall and retrieval_map across revisits
  const recommendedMode: 'free_recall' | 'retrieval_map' =
    completedCount % 2 === 0 ? 'free_recall' : 'retrieval_map';

  return {
    id: existing?.id ?? `rev-${input.bookId}-${input.sectionId}`,
    bookId: input.bookId,
    sectionId: input.sectionId,
    chapterId: input.chapterId,
    sectionTitle: input.sectionTitle,
    gapCount: input.gapCount,
    unansweredPromptsCount: input.unansweredPromptsCount,
    recommendedMode,
    intervalDays,
    stageIndex,
    lastAttemptAt: nowIso,
    dueAt,
    completedCount,
  };
}

/**
 * Advances a revisit item after a completed session.
 */
export function advanceRevisitItem(
  item: RevisitQueueItem,
  remainingGapCount: number,
  nowIso?: string
): RevisitQueueItem {
  const now = nowIso ?? new Date().toISOString();
  const nextStage =
    remainingGapCount === 0
      ? Math.min(REVISIT_INTERVALS.length - 1, item.stageIndex + 1)
      : Math.max(0, item.stageIndex - 1);

  const intervalDays = REVISIT_INTERVALS[nextStage];
  return {
    ...item,
    gapCount: remainingGapCount,
    stageIndex: nextStage,
    intervalDays,
    lastAttemptAt: now,
    dueAt: addDaysIso(now, intervalDays),
    completedCount: item.completedCount + 1,
    recommendedMode:
      item.recommendedMode === 'free_recall' ? 'retrieval_map' : 'free_recall',
  };
}

/**
 * Interleaves due (or upcoming) revisit items across different chapters so
 * two sections from the same chapter are not studied back-to-back when other
 * chapters are available (Rohrer & Taylor, 2007; Dunlosky et al., 2013).
 */
export function interleaveRevisitQueue(
  items: RevisitQueueItem[]
): RevisitQueueItem[] {
  if (items.length <= 1) return [...items];

  // Sort first by due date ascending, then by gapCount descending
  const sorted = [...items].sort((a, b) => {
    const tDiff = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    if (tDiff !== 0) return tDiff;
    return b.gapCount - a.gapCount;
  });

  const result: RevisitQueueItem[] = [];
  const pool = [...sorted];

  while (pool.length > 0) {
    const lastChapter =
      result.length > 0 ? result[result.length - 1].chapterId : null;
    // Prefer the earliest due item from a different chapter than the previous item
    const diffChapterIdx =
      lastChapter !== null
        ? pool.findIndex((item) => item.chapterId !== lastChapter)
        : 0;

    const pickIdx = diffChapterIdx >= 0 ? diffChapterIdx : 0;
    result.push(pool[pickIdx]);
    pool.splice(pickIdx, 1);
  }

  return result;
}
