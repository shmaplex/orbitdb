import { compareClocks } from "./clock";
import type { Entry } from "./entry";

/**
 * Last-Write-Wins comparator.
 *
 * Last Write Wins is a conflict resolution strategy for sorting elements
 * where the element with a greater clock (latest) is chosen as the winner.
 *
 * @param a First entry
 * @param b Second entry
 * @returns 1 if a is latest, -1 if b is latest
 * @private
 */
function LastWriteWins(a: Entry, b: Entry): number {
  // Ultimate conflict resolution: take the first/left argument
  const First = (_a: Entry, _b: Entry) => 1;

  // Sort two entries by their clock id; if same, take the first
  const sortById = (a: Entry, b: Entry) => SortByClockId(a, b, First);

  // Sort two entries by their clock time; if concurrent, resolve using sortById
  const sortByEntryClocks = (a: Entry, b: Entry) =>
    SortByClocks(a, b, sortById);

  return sortByEntryClocks(a, b);
}

/**
 * Sort entries by clock time.
 * @param a First entry
 * @param b Second entry
 * @param resolveConflict Function to resolve concurrent entries
 * @returns 1 if a is greater, -1 if b is greater
 * @private
 */
function SortByClocks(
  a: Entry,
  b: Entry,
  resolveConflict: (a: Entry, b: Entry) => number
): number {
  const diff = compareClocks(a.clock, b.clock);
  return diff === 0 ? resolveConflict(a, b) : diff;
}

/**
 * Sort entries by clock id.
 * @param a First entry
 * @param b Second entry
 * @param resolveConflict Function to resolve identical clock ids
 * @returns 1 if a is greater, -1 if b is greater
 * @private
 */
function SortByClockId(
  a: Entry,
  b: Entry,
  resolveConflict: (a: Entry, b: Entry) => number
): number {
  if (a.clock.id === b.clock.id) return resolveConflict(a, b);
  return a.clock.id < b.clock.id ? -1 : 1;
}

/**
 * Wrapper to ensure a comparator never returns 0.
 * @param func Comparator function
 * @returns Comparator that throws if zero is returned
 * @throws Error if func returns 0
 * @private
 */
function NoZeroes(
  func: (a: Entry, b: Entry) => number
): (a: Entry, b: Entry) => number {
  const msg = `Your log's tiebreaker function, ${func.name}, returned zero and cannot be used.`;

  return (a: Entry, b: Entry) => {
    const result = func(a, b);
    if (result === 0) throw new Error(msg);
    return result;
  };
}

/** Conflict resolution utilities */
const ConflictResolution = {
  SortByClocks,
  SortByClockId,
  LastWriteWins,
  NoZeroes,
};

export type ConflictResolutionType = typeof ConflictResolution;

export default ConflictResolution;
