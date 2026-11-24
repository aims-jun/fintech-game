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
    if (outcome === 'timeout') await page.setViewportSize({width:844, height:390});
    await page.addInitScript(() => { Math.random = () => 0; });
    await page.clock.install({ time: new Date('2026-01-01T10:00:00Z') });
    const game = await choose(page, 'scan');
    await expect(game.locator('#paper')).toBeEnabled();
    await page.clock.pauseAt(new Date('2026-01-01T10:00:10Z'));
    await game.locator('#paper').tap();
    await page.clock.fastForward(2400);
    const receipt = game.locator('#paper');
    for (let round = 0; round < (outcome === 'clear' ? 3 : 1); round++) {
      await expect(game.locator('#game')).toHaveAttribute('data-phase', 'round');
      if (outcome === 'timeout') {
        await page.clock.fastForward(7501);
      } else {
        if (outcome === 'clear') {
          const delay = await receipt.evaluate((_, index) => {
            for (let t = 0; t <= 2700; t++) {
              if (window.OneShotEngine.sample(index, t, 0).error < .005) return t;
            }
            throw new Error('Alignment not found');
          }, round);
          await page.clock.fastForward(delay);
        }
        // Drive the rule checks on the virtual clock. Physical contact and
        // compositor motion are exercised separately on the browser clock.
        await receipt.press('Enter');
      }
      await expect(game.locator('#game')).toHaveAttribute('data-phase', 'capture');
      await page.clock.fastForward(1951);
    }
    await expect(game.locator('#result-title')).toHaveText(outcome === 'clear' ? '세 번 모두 촬영했어요' : '1단계에서 종료');
    const state = await receipt.evaluate(() => window.OneShotApp.inspect());
    expect(state.records.plays).toBe(1);
    expect(state.shots).toHaveLength(outcome === 'clear' ? 3 : 1);
    await expect(game.locator('#replay')).toBeInViewport({ratio:1});
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
    for (const [name, button] of [['paper','#challenge'],['scan','#paper']]) {
      const card = page.locator('[data-open="' + name + '"]');
      const strip = card.locator('.choice-go');
      const bounds = await card.boundingBox();
      expect(bounds.height).toBeGreaterThanOrEqual(96);
      expect(bounds.width).toBeGreaterThanOrEqual(140);
      const target = name === 'paper' ? card.locator('.choice-icon') : strip;
      await target.tap();
      const game = page.frameLocator('#game-frame');
      await expect(game.locator(button)).toBeEnabled();
      await expect(game.locator(button)).toBeInViewport({ratio:1});
      for (const control of [game.locator(button), page.locator('#menu-back'), game.locator('#fullscreen')]) {
        const rect = await control.boundingBox();
        expect(rect.height).toBeGreaterThanOrEqual(48);
        expect(rect.width).toBeGreaterThanOrEqual(48);
      }
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

test('large document buttons select the original field and close on timeout', async ({ page }) => {
  await page.clock.install();
  const game = await startPaper(page);
  const slot = game.locator('#doc-left');
  const open = slot.locator('.open-fields');
  await open.tap();
  const option = game.locator('.field-option').first();
  await expect(option).toBeVisible();
  const first = await option.textContent();
  await game.locator('#field-next').tap();
  await expect(option).not.toHaveText(first);
  await game.locator('#field-prev').tap();
  await expect(option).toHaveText(first);
  await option.tap();
  await expect(game.locator('#field-picker')).not.toBeVisible();
  await expect(slot.locator('[data-field][aria-pressed="true"]')).toHaveCount(1);
  await open.tap();
  await page.clock.fastForward(46000);
  await expect(game.locator('#field-picker')).not.toBeVisible();
  await expect(game.locator('#result-home')).toBeVisible();
});

for (const input of ['touch', 'mouse']) {
  test('only the receipt captures on ' + input + ' contact', async ({ page }) => {
    const game = await choose(page, 'scan');
    const receipt = game.locator('#paper');
    await expect(game.locator('#action')).toHaveCount(0);
    await receipt.tap();
    await expect(game.locator('#game')).toHaveAttribute('data-phase', 'round');
    const arena = await game.locator('#arena').boundingBox();
    await page.touchscreen.tap(arena.x + 8, arena.y + 8);
    expect(await receipt.evaluate(() => window.OneShotApp.inspect().shots)).toHaveLength(0);
    const rect = await receipt.boundingBox();
    const point = {x:rect.x + rect.width / 2, y:rect.y + rect.height / 2};
    if (input === 'mouse') {
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await expect(game.locator('#game')).toHaveAttribute('data-phase','capture');
      await page.mouse.up();
    } else {
      const client = await page.context().newCDPSession(page);
      await client.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[point]});
      await expect(game.locator('#game')).toHaveAttribute('data-phase','capture');
      await client.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
    }
    expect(await receipt.evaluate(() => window.OneShotApp.inspect().shots)).toHaveLength(1);
  });
}

test('receipt motion and scoring stay in sync after pause and resize', async ({ page }) => {
  const game = await choose(page, 'scan');
  const receipt = game.locator('#paper');
  await receipt.tap();
  await expect(game.locator('#game')).toHaveAttribute('data-phase', 'round');
  await game.locator('#help').tap();
  const remaining = () => receipt.evaluate(() => window.OneShotApp.inspect().remainingMs);
  const pausedAt = await remaining();
  await page.setViewportSize({width:1280, height:800});
  await expect(game.locator('#resume')).toBeInViewport({ratio:1});
  expect(await remaining()).toBe(pausedAt);
  await game.locator('#resume').tap();
  const clockDifference = await receipt.evaluate(el => new Promise(resolve => {
    requestAnimationFrame(() => {
      const motion = el.getAnimations().find(a => a.effect.getTiming().iterations === Infinity);
      const elapsed = window.OneShotEngine.ROUND_MS - window.OneShotApp.inspect().remainingMs;
      resolve(Math.abs(motion.currentTime - elapsed));
    });
  }));
  expect(clockDifference).toBeLessThan(50);
});
