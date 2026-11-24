(function (root, factory) {
  'use strict';

  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ArenaEngine = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var RACE_MS = 30000;
  var SAVED_DURATIONS = { easy: 45000, normal: RACE_MS, hard: 20000 };
  var PREVIOUS_DURATIONS = { easy: 60000, normal: 45000, hard: 32000 };
  var COUNTDOWN_MS = 3000;
  var REVEAL_MS = 1800;

  function initial() {
    return {
      schema: 1, revision: 0, session: null, phase: 'idle', paused: false,
      pausedAt: null, phaseStartedAt: null, player: '', difficulty: 'normal',
      durationMs: RACE_MS, elapsedMs: 0, startedAt: null, round: 0, human: 0,
      selected: [], errors: 0, hints: 0, hintedRound: null, score: 0,
      winner: null, feedback: null, finishedAt: null, results: []
    };
  }

  function activeElapsed(state, now) {
    var at = state.paused ? state.pausedAt : now;
    var extra = state.phase === 'playing' ? Math.max(0, at - state.phaseStartedAt) : 0;
    return Math.min(state.durationMs, state.elapsedMs + extra);
  }

  function resultFor(state) {
    return {
      session: state.session, name: state.player, score: state.score,
      won: state.winner === 'human', seconds: Math.round(state.elapsedMs) / 1000,
      difficulty: state.difficulty, errors: state.errors, hints: state.hints,
      when: state.finishedAt
    };
  }

  function finish(state, winner, at, reveal) {
    if (state.winner) return state;
    var next = Object.assign({}, state, {
      winner: winner, phase: reveal ? 'reveal' : 'finished', finishedAt: at,
      paused: false, pausedAt: null,
      score: state.score + (winner === 'human' ? Math.floor((state.durationMs - state.elapsedMs) / 100) * 2 : 0)
    });
    if (!next.results.some(function (row) { return row.session === next.session; })) {
      next.results = next.results.concat(resultFor(next)).slice(-200);
    }
    return next;
  }

  // Advance from timestamp boundaries, not from tick arrival times. A sleeping
  // tab therefore resumes the same race as a foreground tab.
  function settle(state, now) {
    if (state.paused) return state;
    var next = state;
    if (next.phase === 'countdown' && now >= next.phaseStartedAt + COUNTDOWN_MS) {
      var startAt = next.phaseStartedAt + COUNTDOWN_MS;
      next = Object.assign({}, next, { phase: 'playing', phaseStartedAt: startAt, startedAt: startAt });
    }
    if (next.phase === 'reveal' && now >= next.phaseStartedAt + REVEAL_MS) {
      var revealEnd = next.phaseStartedAt + REVEAL_MS;
      next = Object.assign({}, next, {
        phase: next.winner ? 'finished' : 'playing', phaseStartedAt: revealEnd,
        round: next.winner ? next.round : next.round + 1,
        selected: [], feedback: null
      });
    }
    if (next.phase === 'playing' && !next.winner && activeElapsed(next, now) >= next.durationMs) {
      var deadline = next.phaseStartedAt + next.durationMs - next.elapsedMs;
      next = finish(Object.assign({}, next, { elapsedMs: next.durationMs, selected: [] }), 'ai', deadline, false);
    }
    return next;
  }

  function reduce(state, command, now) {
    state = state || initial();
    command = command || {};
    now = Number.isFinite(now) ? now : 0;
    var next = settle(state, now);
    var stale = command.type !== 'start' && command.type !== 'clearResults' &&
      command.session != null && command.session !== next.session;
    var staleRound = command.round != null && command.round !== next.round;

    if (!stale) {
      if (command.type === 'start') {
        // Replaying the same start command cannot restart an already-running race.
        if (!(command.session && command.session === next.session)) {
          next = Object.assign(initial(), {
            revision: state.revision, results: next.results,
            session: typeof command.session === 'string' && command.session ? command.session : 'run-' + now + '-' + (state.revision + 1),
            player: String(command.player == null ? next.player : command.player).trim().slice(0, 40) || 'Guest',
            phase: 'countdown', phaseStartedAt: now
          });
        }
      } else if (command.type === 'reset') {
        next = Object.assign(initial(), {
          revision: state.revision, results: next.results,
          player: next.player
        });
      } else if (command.type === 'clearResults') {
        if (next.results.length) next = Object.assign({}, next, { results: [] });
      } else if (command.type === 'pause' && ['countdown', 'playing', 'reveal'].indexOf(next.phase) !== -1) {
        next = next.paused
          ? Object.assign({}, next, { paused: false, pausedAt: null, phaseStartedAt: next.phaseStartedAt + Math.max(0, now - next.pausedAt) })
          : Object.assign({}, next, { paused: true, pausedAt: now });
      } else if (!next.paused && !staleRound && next.phase === 'playing') {
        if (command.type === 'select' && typeof command.id === 'string' && command.id &&
          Array.isArray(command.needs) && command.needs.length === 2 &&
          command.needs.every(function (id) { return typeof id === 'string' && id; }) && command.needs[0] !== command.needs[1]) {
          var selected = next.selected.indexOf(command.id) >= 0
            ? next.selected.filter(function (id) { return id !== command.id; })
            : next.selected.concat(command.id);
          next = Object.assign({}, next, { selected: selected, feedback: { kind: 'selected', id: command.id, at: now } });
          if (selected.length === 2) {
            if (selected.every(function (id) { return command.needs.indexOf(id) >= 0; })) {
              next = Object.assign({}, next, {
                elapsedMs: activeElapsed(next, now), phase: 'reveal', phaseStartedAt: now,
                human: next.human + 1,
                // Keep early penalties even when the visible score was zero.
                score: Math.max(0, (next.human + 1) * 1000 - next.errors * 100 - next.hints * 150),
                feedback: { kind: 'found', at: now }
              });
              if (next.human === 3) next = finish(next, 'human', now, true);
            } else {
              next = Object.assign({}, next, {
                selected: [], errors: next.errors + 1, score: Math.max(0, next.score - 100),
                feedback: { kind: 'wrong', id: command.id, at: now }
              });
            }
          }
        }
      }
    }
    return next === state ? state : Object.assign({}, next, { revision: state.revision + 1 });
  }

  function view(state, now) {
    now = Number.isFinite(now) ? now : 0;
    var current = settle(state || initial(), now);
    var elapsed = activeElapsed(current, now);
    var at = current.paused ? current.pausedAt : now;
    var countdownMs = current.phase === 'countdown' ? Math.max(0, COUNTDOWN_MS - (at - current.phaseStartedAt)) : 0;
    var revealMs = current.phase === 'reveal' ? Math.max(0, REVEAL_MS - (at - current.phaseStartedAt)) : 0;
    var progress = Math.min(1, Math.max(0, elapsed / current.durationMs));
    var canSelect = current.phase === 'playing' && !current.paused && !current.winner;
    return Object.assign({}, current, {
      elapsedMs: elapsed, remainingMs: Math.max(0, current.durationMs - elapsed),
      remainingSeconds: Math.ceil(Math.max(0, current.durationMs - elapsed) / 1000),
      countdown: Math.ceil(countdownMs / 1000), countdownMs: countdownMs, revealMs: revealMs,
      ai: progress >= 1 ? 3 : progress >= 0.66 ? 2 : progress >= 0.32 ? 1 : 0,
      aiProgress: progress, humanProgress: current.human / 3,
      canSelect: canSelect
    });
  }

  function rank(results) {
    return (results || []).slice().sort(function (a, b) {
      return b.score - a.score || a.seconds - b.seconds || a.when - b.when || String(a.session).localeCompare(String(b.session));
    });
  }

  function csv(results) {
    var fields = ['name', 'score', 'won', 'seconds', 'difficulty', 'errors', 'hints', 'when'];
    function cell(value) {
      var text = String(value == null ? '' : value);
      // Spreadsheet applications may treat leading whitespace as insignificant.
      if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return [fields.map(cell).join(',')].concat((results || []).map(function (row) {
      return fields.map(function (field) { return cell(row[field]); }).join(',');
    })).join('\r\n');
  }

  var STORAGE_KEY = 'aims-arena-state-v1';

  function decode(value) {
    try {
      var state = typeof value === 'string' ? JSON.parse(value) : value;
      if (!state || state.schema !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0 ||
        ['idle', 'countdown', 'playing', 'reveal', 'finished'].indexOf(state.phase) === -1 ||
        typeof state.player !== 'string' || typeof state.paused !== 'boolean' ||
        !Object.prototype.hasOwnProperty.call(SAVED_DURATIONS, state.difficulty) ||
        (state.durationMs !== SAVED_DURATIONS[state.difficulty] && state.durationMs !== PREVIOUS_DURATIONS[state.difficulty]) ||
        !Number.isInteger(state.round) || state.round < 0 || state.round > 2 ||
        !Number.isInteger(state.human) || state.human < 0 || state.human > 3 ||
        !Array.isArray(state.selected) || state.selected.length > 2 || !state.selected.every(function (id) { return typeof id === 'string'; }) ||
        !Array.isArray(state.results) ||
        !['score', 'elapsedMs', 'errors', 'hints'].every(function (key) { return Number.isFinite(state[key]) && state[key] >= 0; }) ||
        ![null, 'human', 'ai'].includes(state.winner) ||
        (state.phase !== 'idle' && (typeof state.session !== 'string' || !state.session || !Number.isFinite(state.phaseStartedAt))) ||
        (state.paused && !Number.isFinite(state.pausedAt))) return null;
      var seen = new Set();
      var results = state.results.filter(function (row) {
        if (!row || typeof row.session !== 'string' || seen.has(row.session) || typeof row.name !== 'string' ||
          !Number.isFinite(row.score) || !Number.isFinite(row.seconds) || !Number.isFinite(row.when) ||
          typeof row.won !== 'boolean') return false;
        seen.add(row.session);
        return true;
      }).slice(-200);
      // An existing race keeps its original deadline. The next race uses the new preset.
      return Object.assign(initial(), state, {
        results: results,
        difficulty: state.phase === 'idle' ? 'normal' : state.difficulty,
        durationMs: state.phase === 'idle' ? RACE_MS : state.durationMs
      });
    } catch (_error) { return null; }
  }

  function createStore(options) {
    options = options || {};
    var state = initial();
    var subscribers = new Set();
    var channel = null;
    var storage = null;
    var destroyed = false;
    var store = {
      storageOK: true,
      getState: function () { return state; },
      dispatch: dispatch,
      subscribe: function (listener) {
        if (typeof listener !== 'function' || destroyed) return function () {};
        subscribers.add(listener);
        listener(state);
        return function () { subscribers.delete(listener); };
      },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        subscribers.clear();
        if (typeof root.removeEventListener === 'function') root.removeEventListener('storage', onStorage);
        if (channel) channel.close();
      }
    };

    try {
      storage = root.localStorage;
      if (!storage) store.storageOK = false;
    } catch (_error) { store.storageOK = false; }

    function readFresh() {
      if (!storage) return null;
      try { return decode(storage.getItem(STORAGE_KEY)); }
      catch (_error) { store.storageOK = false; return null; }
    }

    function notify() {
      if (destroyed) return;
      subscribers.forEach(function (listener) { listener(state); });
    }

    function adopt(incoming) {
      if (!destroyed && incoming && incoming.revision > state.revision) {
        state = incoming;
        notify();
      }
    }

    function onStorage(event) {
      if (event.key !== STORAGE_KEY) return;
      // Read the current record rather than trusting an out-of-order event.
      adopt(readFresh());
    }

    function apply(action) {
      if (destroyed) return state;
      var fresh = readFresh();
      var base = fresh && fresh.revision >= state.revision ? fresh : state;
      var next = reduce(base, action, Date.now());
      if (next !== base) {
        if (storage) {
          try {
            storage.setItem(STORAGE_KEY, JSON.stringify(next));
            store.storageOK = true;
          } catch (_error) { store.storageOK = false; }
        }
        state = next;
        notify();
        if (channel) {
          try { channel.postMessage({ state: next }); }
          catch (_error) { /* Storage events still synchronize when broadcasting is unavailable. */ }
        }
      } else if (base.revision > state.revision) {
        state = base;
        notify();
      }
      return state;
    }

    async function dispatch(command) {
      if (destroyed) return state;
      var action = Object.assign({}, command);
      if (action.type !== 'start' && action.type !== 'clearResults' && action.session === undefined) action.session = state.session;
      var locks = root.navigator && root.navigator.locks;
      if (locks && typeof locks.request === 'function') {
        var entered = false;
        try {
          return await locks.request(STORAGE_KEY, function () {
            entered = true;
            return apply(action);
          });
        } catch (error) {
          // Do not replay a mutation if its subscriber threw after the lock ran.
          if (entered) throw error;
        }
      }
      // Best effort fallback: the entire read/reduce/write stays synchronous.
      return apply(action);
    }

    state = readFresh() || state;
    if (typeof root.addEventListener === 'function') root.addEventListener('storage', onStorage);
    if (typeof root.BroadcastChannel === 'function') {
      try {
        channel = new root.BroadcastChannel(STORAGE_KEY);
        channel.onmessage = function (event) {
          var incoming = decode(event.data && event.data.state);
          var fresh = readFresh();
          adopt(fresh && (!incoming || fresh.revision >= incoming.revision) ? fresh : incoming);
        };
      } catch (_error) { channel = null; }
    }
    if (typeof options.onChange === 'function') {
      subscribers.add(options.onChange);
      // The callback runs after createStore returns, so renderers can use store.
      Promise.resolve().then(function () { if (!destroyed) options.onChange(state); });
    }
    return store;
  }

  return { initial: initial, reduce: reduce, view: view, rank: rank, csv: csv, createStore: createStore };
});
