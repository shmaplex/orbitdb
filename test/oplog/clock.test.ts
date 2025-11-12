import { strictEqual } from "assert";
import { describe, it } from "vitest";
import Clock, { tickClock, compareClocks } from "../../src/oplog/clock";

describe("Clock", () => {
  it("creates a new clock", () => {
    const id = "A";
    const time = 0;
    const clock = Clock(id, time);
    strictEqual(clock.id, id);
    strictEqual(clock.time, time);
  });

  it("creates a new clock with default time", () => {
    const id = "A";
    const time = 0;
    const clock = Clock(id);
    strictEqual(clock.id, id);
    strictEqual(clock.time, time);
  });

  it("creates a new clock with time starting at 1", () => {
    const id = "A";
    const time = 1;
    const clock = Clock(id, time);
    strictEqual(clock.id, id);
    strictEqual(clock.time, time);
  });

  it("advances clock forward 1 tick", () => {
    const time = 1;
    const clock = tickClock(Clock("A"));
    strictEqual(clock.time, time);
  });

  it("advances clock forward 2 ticks", () => {
    const time = 2;
    const clock = tickClock(tickClock(Clock("A")));
    strictEqual(clock.time, time);
  });

  describe("Compare clocks", () => {
    it("compares clocks when clock1's time is 1 less than clock2's", () => {
      const clock1 = Clock("A", 1);
      const clock2 = Clock("B", 2);
      strictEqual(compareClocks(clock1, clock2), -1);
    });

    it("compares clocks when clock1's time is 3 less than clock2's", () => {
      const clock1 = Clock("A", 1);
      const clock2 = Clock("B", 4);
      strictEqual(compareClocks(clock1, clock2), -3);
    });

    it("compares clocks when clock1's time is 1 more than clock2's", () => {
      const clock1 = Clock("A", 2);
      const clock2 = Clock("B", 1);
      strictEqual(compareClocks(clock1, clock2), 1);
    });

    it("compares clocks when clock1's time is 3 more than clock2's", () => {
      const clock1 = Clock("A", 4);
      const clock2 = Clock("B", 1);
      strictEqual(compareClocks(clock1, clock2), 3);
    });

    it("compares clocks when clock1's id is less than clock2's", () => {
      const clock1 = Clock("A", 1);
      const clock2 = Clock("B", 1);
      strictEqual(compareClocks(clock1, clock2), -1);
    });

    it("compares clocks when clock1's id is more than clock2's", () => {
      const clock1 = Clock("B", 1);
      const clock2 = Clock("A", 1);
      strictEqual(compareClocks(clock1, clock2), 1);
    });

    it("compares clocks when clock1 is the same as clock2", () => {
      const clock1 = Clock("A", 1);
      const clock2 = Clock("A", 1);
      strictEqual(compareClocks(clock1, clock2), 0);
    });
  });
});
