import type { EntryType } from ".";
import { type ClockType, compareClocks } from "./clock";

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
function LastWriteWins(a: EntryType, b: EntryType): number {
  // Ultimate conflict resolution: take the first/left argument
  const First = (_a: EntryType, _b: EntryType) => 1;

  // Sort two entries by their clock id; if same, take the first
  const sortById = (a: EntryType, b: EntryType) => SortByClockId(a, b, First);

  // Sort two entries by their clock time; if concurrent, resolve using sortById
  const sortByEntryClocks = (a: EntryType, b: EntryType) =>
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
  a: EntryType | number,
  b: EntryType | number,
  resolveConflict: (a: EntryType, b: EntryType) => number
): number {
  const defaultClock: ClockType = { id: "", time: 0 };

  // Extract clocks safely
  const aClock: ClockType =
    typeof a === "number" ? defaultClock : a.clock ?? defaultClock;
  const bClock: ClockType =
    typeof b === "number" ? defaultClock : b.clock ?? defaultClock;

  const diff = compareClocks(aClock, bClock);

  if (diff === 0) {
    // Only call resolveConflict if both a and b are Entry
    if (typeof a === "number" || typeof b === "number") return 0;
    return resolveConflict(a, b);
  }

  return diff;
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
  a: EntryType,
  b: EntryType,
  resolveConflict: (a: EntryType, b: EntryType) => number
): number {
  const aClock = a.clock ?? ({ id: "", time: 0 } as ClockType);
  const bClock = b.clock ?? ({ id: "", time: 0 } as ClockType);

  if (aClock.id === bClock.id) return resolveConflict(a, b);
  return aClock.id < bClock.id ? -1 : 1;
}

/**
 * Wrapper to ensure a comparator never returns 0.
 * @param func Comparator function
 * @returns Comparator that throws if zero is returned
 * @throws Error if func returns 0
 * @private
 */
function NoZeroes(
  func: (a: EntryType | number, b: EntryType | number) => number
): (a: EntryType | number, b: EntryType | number) => number {
  const msg = `Your log's tiebreaker function, ${func.name}, has returned zero and therefore cannot be used.`;

  return (a: EntryType | number, b: EntryType | number) => {
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
