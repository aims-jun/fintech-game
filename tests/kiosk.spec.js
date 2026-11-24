const { test: base, expect } = require('@playwright/test');

const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack));
    page.on('response', response => {
      if (response.status() >= 400) errors.push(response.status() + ' ' + response.url());
    });
    page.on('requestfailed', request => {
      if (request.failure().errorText !== 'net::ERR_ABORTED') errors.push(request.url() + ' ' + request.failure().errorText);
    });
    await page.goto('/');
    await use(page);
    expect(errors).toEqual([]);
  },
});

async function choose(page, game) {
  await page.locator('[data-open="' + game + '"]').tap();
  return page.frameLocator('#game-frame');
}

async function startPaper(page) {
  const game = await choose(page, 'paper');
  await game.locator('#challenge').tap();
  await game.locator('#practice-a').tap();
  await game.locator('#practice-b').tap();
  await expect(game.locator('#practice-feedback')).toContainText('맞아요');
  await game.locator('#start-race').tap();
  await expect(game.locator('[data-field]').first()).toBeEnabled();
  return game;
}

for (const viewport of [{width:1920,height:1080}, {width:720,height:1280}]) {
  test('PAPER RACE completes three pairs at ' + viewport.width, async ({ page }) => {
    await page.setViewportSize(viewport);
    const game = await startPaper(page);
    const zoom = game.locator('[data-photo-zoom]').first();
    await zoom.tap();
    await expect(zoom).toHaveAttribute('aria-pressed', 'true');
    await zoom.tap();
    await game.locator('#hint-btn').tap();
    for (let round = 0; round < 3; round++) {
      await expect(game.locator('#round-label')).toHaveText('ROUND 0' + (round + 1));
      const needs = await game.locator('body').evaluate(() => {
        const state = JSON.parse(localStorage.getItem('aims-arena-state-v1'));
        return window.AIMS_CASEBOOK.forSession(state.session)[state.round].needs;
      });
      if (!round) {
        const other = game.locator('[data-field]').filter({visible:true});
        const id = (await other.evaluateAll(els => els.map(el => el.dataset.field))).find(id => !needs.includes(id));
        await game.locator('[data-field="' + id + '"]').tap();
        await game.locator('[data-field="' + needs[0] + '"]').tap();
        await expect(game.locator('#round-feedback')).toHaveClass(/error/);
      }
      for (const id of needs) await game.locator('[data-field="' + id + '"]').tap();
    }
    await expect(game.locator('#reward-message')).toContainText('미션 성공');
    await game.locator('#result-home').tap();
    await expect(page.locator('#menu')).toBeVisible();
    const next = await choose(page, 'paper');
    await expect(next.locator('#challenge')).toBeVisible();
  });
}

test('PAPER RACE times out and hands off once', async ({ page }) => {
  await page.clock.install();
  const game = await startPaper(page);
  await page.clock.fastForward(46000);
  await expect(game.locator('#reward-message')).toContainText('미션 종료');
  await game.locator('#result-home').tap();
  await expect(page.locator('#menu')).toBeVisible();
  const results = await page.evaluate(() => JSON.parse(localStorage.getItem('aims-arena-state-v1')).results);
  expect(results.map(r => r.won)).toEqual([false]);
});

for (const outcome of ['clear', 'miss', 'timeout']) {
  test('ONE SHOT SCAN ' + outcome, async ({ page }) => {
    await page.addInitScript(() => { Math.random = () => 0; });
    await page.clock.install({ time: new Date('2026-01-01T10:00:00Z') });
    const game = await choose(page, 'scan');
    await expect(game.locator('#action')).toBeEnabled();
    await page.clock.pauseAt(new Date('2026-01-01T10:00:10Z'));
    await game.locator('#action').tap();
    await page.clock.fastForward(2400);
    const arena = game.locator('#arena');
    for (let round = 0; round < (outcome === 'clear' ? 3 : 1); round++) {
      await expect(game.locator('#game')).toHaveAttribute('data-phase', 'round');
      if (outcome === 'timeout') {
        await page.clock.fastForward(7501);
      } else {
        if (outcome === 'clear') {
          const delay = await arena.evaluate((_, index) => {
            for (let t = 0; t <= 2700; t++) {
              if (window.OneShotEngine.sample(index, t, 0).error < .005) return t;
            }
            throw new Error('Alignment not found');
          }, round);
          await page.clock.fastForward(delay);
        }
        await arena.tap();
        await arena.tap();
      }
      await expect(game.locator('#game')).toHaveAttribute('data-phase', 'capture');
      await page.clock.fastForward(1951);
    }
    await expect(game.locator('#result-title')).toHaveText(outcome === 'clear' ? '최종 클리어!' : '1단계에서 종료');
    const state = await arena.evaluate(() => window.OneShotApp.inspect());
    expect(state.records.plays).toBe(1);
    expect(state.shots).toHaveLength(outcome === 'clear' ? 3 : 1);
    await game.locator('#replay').tap();
    await expect(page.locator('#menu')).toBeVisible();
  });
}

test('staff exit, cancellation and refresh handoff', async ({ page }) => {
  const game = await startPaper(page);
  await page.locator('#menu-back').tap();
  await page.locator('#exit-cancel').tap();
  await expect(game.locator('#arena')).toBeVisible();
  await page.locator('#menu-back').tap();
  await page.locator('#exit-confirm').tap();
  const next = await choose(page, 'paper');
  await expect(next.locator('#challenge')).toBeVisible();
  await page.reload();
  await expect(page.locator('#handoff')).toBeVisible();
  await page.locator('#next-player').tap();
  await expect(page.locator('#menu')).toBeVisible();
});

for (const [width,height] of [[3840,2160],[1280,720],[1080,1920],[390,844],[844,390]]) {
  test('touch viewport ' + width + ' × ' + height, async ({ page }) => {
    await page.setViewportSize({width,height});
    for (const [name, button] of [['paper','#challenge'],['scan','#action']]) {
      const game = await choose(page, name);
      await expect(game.locator(button)).toBeEnabled();
      await expect(game.locator(button)).toBeInViewport({ratio:1});
      for (const body of [page.locator('body'), game.locator('body')]) {
        const size = await body.evaluate(() => {
          const root = document.scrollingElement;
          return [root.scrollWidth - innerWidth, root.scrollHeight - innerHeight];
        });
        expect(size).toEqual([0,0]);
      }
      await page.locator('#menu-back').tap();
      await page.locator('#exit-confirm').tap();
    }
  });
}
