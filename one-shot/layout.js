(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OneShotLayout = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  function fitStage(width, height) {
    const w = Math.max(1, Number(width) || 1), h = Math.max(1, Number(height) || 1);
    // Reserve room for the largest scale (1.32) and all rotated corners.
    // Horizontal travel is included in the width constraint, not clipped away.
    const paperHeight = Math.max(1, Math.min(1120, (h - 48) / 1.34, (w - 48) / 1.62));
    const paperWidth = paperHeight * .75;
    const travel = Math.max(0, Math.min(paperWidth * .56, (w - paperWidth) / 2 - 20));
    return Object.freeze({ paperWidth, paperHeight, travel });
  }
  function transformFor(round, value, fit) {
    const v = Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
    return { x: round === 0 ? v * fit.travel : 0, angle: round === 1 ? v * 24 : 0, scale: round === 2 ? 1 + v * .32 : 1 };
  }
  return Object.freeze({ fitStage, transformFor });
});
