(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.OneShotEngine = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const ROUND_MS = 7500;
  const ROUNDS = Object.freeze([
    Object.freeze({ id: 'position', label: 'LEVEL 1', cycleMs: 2700, maxError: 0.46, perfectError: 0.09, greatError: 0.25 }),
    Object.freeze({ id: 'angle', label: 'LEVEL 2', cycleMs: 1850, maxError: 0.28, perfectError: 0.06, greatError: 0.16 }),
    Object.freeze({ id: 'scale', label: 'FINAL', cycleMs: 980, maxError: 0.115, perfectError: 0.020, greatError: 0.050 })
  ]);

  function roundIndex(index) {
    return Number.isInteger(index) && index >= 0 && index < ROUNDS.length ? index : 0;
  }

  function elapsedTime(value) {
    return Number.isFinite(value) ? Math.min(ROUND_MS, Math.max(0, value)) : 0;
  }

  function startPhase(index, seed) {
    // Mix the seed so neighboring game seeds get visibly different starts.
    let hash = (Number.isFinite(seed) ? Math.trunc(seed) : 0) ^ Math.imul(index + 1, 0x9e3779b9);
    hash = Math.imul(hash ^ (hash >>> 16), 0x21f0aaad);
    hash = Math.imul(hash ^ (hash >>> 15), 0x735a2d97);
    hash ^= hash >>> 15;
    const fraction = (hash >>> 1) / 0x80000000;
    // Keep initial phases in the outer arcs: |sin(phase)| >= sqrt(1/2).
    return Math.PI * (0.25 + fraction * 0.5 + (hash & 1));
  }

  function sample(index, elapsedMs, seed = 0) {
    const selected = roundIndex(index);
    const elapsed = elapsedTime(elapsedMs);
    const phase = startPhase(selected, seed) + (elapsed / ROUNDS[selected].cycleMs) * 2 * Math.PI;
    const value = Math.sin(phase);
    return {
      value,
      error: Math.abs(value),
      remainingMs: ROUND_MS - elapsed,
      progress: elapsed / ROUND_MS
    };
  }

  function isStageCleared(shot) {
    return Boolean(shot && !shot.timedOut && shot.grade !== 'MISS');
  }

  function score(error, timedOut = false, index = 0) {
    const level = ROUNDS[roundIndex(index)];
    if (timedOut || !Number.isFinite(error) || error < 0 || error > level.maxError) {
      return { points: 0, grade: 'MISS' };
    }
    if (error <= level.perfectError) return { points: 1000, grade: 'PERFECT' };
    return {
      points: Math.round(1000 * (1 - error)),
      grade: error <= level.greatError ? 'GREAT' : 'GOOD'
    };
  }

  class RoundClock {
    #index;
    #seed;
    #startTime;
    #pausedAt = null;
    #pausedMs = 0;
    #shot = null;

    constructor(index = 0, seed = 0, startTime = 0) {
      this.#index = roundIndex(index);
      this.#seed = seed;
      this.#startTime = Number.isFinite(startTime) ? startTime : 0;
    }

    get captured() { return this.#shot !== null; }
    get paused() { return this.#pausedAt !== null; }

    #elapsed(now) {
      if (this.#shot) return this.#shot.elapsedMs;
      const instant = this.paused ? this.#pausedAt : Number.isFinite(now) ? now : this.#startTime;
      return elapsedTime(instant - this.#startTime - this.#pausedMs);
    }

    snapshot(now) {
      return sample(this.#index, this.#elapsed(now), this.#seed);
    }

    capture(now) {
      if (this.captured || this.paused || !Number.isFinite(now)) return null;
      const elapsedMs = this.#elapsed(now);
      const state = sample(this.#index, elapsedMs, this.#seed);
      const timedOut = elapsedMs >= ROUND_MS;
      const result = score(state.error, timedOut, this.#index);
      this.#shot = Object.freeze({
        roundIndex: this.#index,
        value: state.value,
        error: state.error,
        elapsedMs,
        remainingMs: state.remainingMs,
        points: result.points,
        grade: result.grade,
        timedOut
      });
      return this.#shot;
    }

    pause(now) {
      if (this.captured || this.paused || !Number.isFinite(now)) return;
      this.#pausedAt = Math.max(this.#startTime + this.#pausedMs, now);
    }

    resume(now) {
      if (this.captured || !this.paused || !Number.isFinite(now)) return;
      this.#pausedMs += Math.max(0, now - this.#pausedAt);
      this.#pausedAt = null;
    }
  }

  return Object.freeze({ ROUND_MS, ROUNDS, sample, score, isStageCleared, RoundClock });
});
