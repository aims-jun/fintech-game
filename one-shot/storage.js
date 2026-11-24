(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OneShotStorage = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const STORAGE_KEY = 'aims-one-shot-scan-v1';
  const GRADES = ['PERFECT', 'GREAT', 'GOOD', 'MISS'];
  const validInt = (n, max) => Number.isInteger(n) && n >= 0 && n <= max;
  const fresh = () => ({ version: 1, best: 0, plays: 0, history: [], sound: false });
  const copy = value => JSON.parse(JSON.stringify(value));
  function validRounds(rounds) {
    return Array.isArray(rounds) && rounds.length >= 1 && rounds.length <= 3 && rounds.every(r =>
      r && validInt(r.points, 1000) && GRADES.includes(r.grade));
  }
  class RecordStore {
    constructor(storage) {
      this.storage = storage;
      this.persistent = Boolean(storage);
      this.data = fresh();
      try {
        const raw = storage?.getItem(STORAGE_KEY);
        if (raw) {
          let data;
          try { data = JSON.parse(raw); } catch { data = null; }
          if (data && data.version === 1) {
            this.data.best = validInt(data.best, 3000) ? data.best : 0;
            this.data.plays = validInt(data.plays, 1e9) ? data.plays : 0;
            this.data.sound = data.sound === true;
            this.data.history = (Array.isArray(data.history) ? data.history : []).filter(r =>
              r && validRounds(r.rounds) && validInt(r.total, 3000) && Number.isFinite(r.at) && r.at >= 0 &&
              r.total === r.rounds.reduce((sum, round) => sum + round.points, 0)
            ).slice(0, 10).map(r => ({ total: r.total, at: r.at, rounds: r.rounds.map(s => ({ points: s.points, grade: s.grade })) }));
            this.data.best = Math.max(this.data.best, ...this.data.history.map(r => r.total));
          }
        }
      } catch { this.persistent = false; }
    }
    persist() {
      try {
        if (!this.storage) throw new Error('Storage unavailable');
        this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this.persistent = true;
      } catch { this.persistent = false; }
    }
    getState() { return { ...copy(this.data), persistent: this.persistent }; }
    setSound(value) { this.data.sound = value === true; this.persist(); }
    record(rounds, at = Date.now()) {
      if (!validRounds(rounds) || !Number.isFinite(at) || at < 0) throw new TypeError('A record needs three valid shots and a timestamp.');
      const cleanRounds = rounds.map(({ points, grade }) => ({ points, grade }));
      const entry = { total: cleanRounds.reduce((sum, shot) => sum + shot.points, 0), rounds: cleanRounds, at };
      this.data.best = Math.max(this.data.best, entry.total);
      this.data.plays = Math.min(1e9, this.data.plays + 1);
      this.data.history.unshift(entry);
      this.data.history.length = Math.min(10, this.data.history.length);
      this.persist();
      return copy(entry);
    }
  }
  return Object.freeze({ STORAGE_KEY, RecordStore });
});
