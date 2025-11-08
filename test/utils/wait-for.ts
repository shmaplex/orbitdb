"use strict";

/**
 * Polls a function until its return value equals the expected value.
 *
 * @template T
 * @param {() => Promise<T> | T} valueA - An async or sync function returning the current value.
 * @param {() => Promise<T> | T} toBeValueB - An async or sync function returning the expected value.
 * @param {number} [pollInterval=100] - Interval in milliseconds between polls.
 * @returns {Promise<void>} Resolves when `valueA()` equals `toBeValueB()`.
 */
const waitFor = async <T>(
  valueA: () => Promise<T> | T,
  toBeValueB: () => Promise<T> | T,
  pollInterval = 100
): Promise<void> => {
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      try {
        const currentValue = await valueA();
        const expectedValue = await toBeValueB();
        if (currentValue === expectedValue) {
          clearInterval(interval);
          resolve();
        }
      } catch {
        // ignore errors during polling
      }
    }, pollInterval);
  });
};

export default waitFor;
