/**
 * @namespace module:Log~Clock
 * @memberof module:Log
 * @description
 * The Lamport clock implementation.
 * @private
 */

/**
 * Represents a Lamport clock.
 */
export interface ClockType {
  /** A unique identifier for the clock */
  id: string;
  /** The logical timestamp of the clock */
  time: number;
}

/**
 * Compares two clocks by time and then by id if times are equal.
 *
 * compareClocks should never return zero (0). If it does, a and b refer to the
 * same clock.
 * @param a The first clock.
 * @param b The second clock.
 * @returns Returns a negative number if a < b, otherwise a positive number.
 * @memberof module:Log~Clock
 */
const compareClocks = (a: ClockType, b: ClockType): number => {
  const dist = a.time - b.time;

  if (dist === 0 && a.id !== b.id) return a.id < b.id ? -1 : 1;

  return dist;
};

/**
 * Advances a clock's time by 1 and returns a new clock instance.
 * @param clock The clock to advance.
 * @returns A new clock instance with time incremented by 1.
 * @memberof module:Log~Clock
 */
const tickClock = (clock: ClockType): ClockType => {
  return Clock(clock.id, clock.time + 1);
};

/**
 * Creates a new Lamport clock instance.
 * @param id A unique identifier for the clock.
 * @param time Initial timestamp (defaults to 0).
 * @returns A new clock instance.
 * @memberof module:Log~Clock
 */
const Clock = (id: string, time = 0) => {
  return {
    id,
    time,
  };
};

export { Clock as default, compareClocks, tickClock };
