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
    await expect(game.locator('.open-fields, [data-photo-zoom], #hint-btn, #field-picker')).toHaveCount(0);
    for (let round = 0; round < 3; round++) {
      await expect(game.locator('#round-label')).toHaveText('ROUND 0' + (round + 1));
      const needs = await game.locator('body').evaluate((_, displayedRound) => {
        const state = JSON.parse(localStorage.getItem('aims-arena-state-v1'));
        return window.AIMS_CASEBOOK.forSession(state.session)[displayedRound].needs;
      }, round);
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

test('PAPER RACE keeps the documents hidden through 3, 2, 1 and a pause', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.clock.install({time:new Date('2026-01-01T12:00:00Z')});
  const game = await choose(page, 'paper');
  for (const id of ['challenge', 'practice-a', 'practice-b']) await game.locator('#' + id).tap();
  await page.clock.pauseAt(new Date('2026-01-01T12:00:05Z'));
  await game.locator('#start-race').tap();
  const arena = game.locator('#arena');
  const digit = game.locator('#countdown-number');
  for (const seconds of [3, 2, 1]) {
    await expect(digit).toBeVisible();
    await expect(digit).toHaveText(String(seconds));
    await expect(arena).toBeHidden();
    await expect(game.locator('[data-field]:visible')).toHaveCount(0);
    if (seconds === 2) {
      await game.locator('#pause-control').tap();
      await expect(game.locator('#pause-screen')).toBeVisible();
      await page.clock.fastForward(2000);
      await expect(digit).toHaveText('2');
      await expect(arena).toBeHidden();
      await game.locator('#resume').tap();
      await expect(game.locator('#pause-screen')).toBeHidden();
    }
    await page.clock.fastForward(1000);
  }
  await expect(digit).toBeHidden();
  await expect(arena).toBeVisible();
  const field = game.locator('[data-field]').first();
  await field.tap();
  await expect(field).toHaveAttribute('aria-pressed','true');
});

test('PAPER RACE shows the entire AI status beside the score at every race stage', async ({ page }) => {
  await page.clock.install();
  const game = await startPaper(page);
  const status = game.locator('#ai-status');
  for (const label of ['서류 읽는 중', '정보 비교 중', '마지막 확인 중']) {
    await expect(status).toContainText(label);
    for (const [width,height] of [[3840,2160], [1920,1080], [844,390], [390,844], [320,640]]) {
      await page.setViewportSize({width,height});
      await expect.poll(() => status.evaluate(() => [innerWidth, innerHeight])).toEqual([width, height]);
      await expect.poll(() => status.evaluate(el => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const text = range.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        const heading = el.closest('.racer-heading').getBoundingClientRect();
        const score = document.getElementById('ai-count').getBoundingClientRect();
        return text.left >= heading.left - 1 && text.right <= heading.right + 1 &&
          text.right <= box.right + 1 && (text.right <= score.left || text.top >= score.bottom);
      }), {message:label + ' at ' + width}).toBe(true);
    }
    if (label !== '마지막 확인 중') await page.clock.fastForward(10000);
  }
});

test('PAPER RACE times out and hands off once', async ({ page }) => {
  await page.clock.install();
  const game = await startPaper(page);
  await expect(game.locator('#mission-title')).toBeVisible();
  await expect(game.locator('#mission-instruction')).toHaveCount(0);
  await page.clock.fastForward(30000);
  await expect(game.locator('#reward-message')).toContainText('미션 종료');
  await game.locator('#result-home').tap();
  await expect(page.locator('#menu')).toBeVisible();
  const results = await page.evaluate(() => JSON.parse(localStorage.getItem('aims-arena-state-v1')).results);
  expect(results.map(r => [r.won, r.seconds])).toEqual([[false, 30]]);
});

for (const [outcome, grades] of Object.entries({
  clear:['PERFECT', 'GREAT', 'GOOD'], partial:['GOOD', 'MISS'], miss:['MISS'], timeout:['MISS'],
})) {
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
    for (let round = 0; round < grades.length; round++) {
      await expect(game.locator('#game')).toHaveAttribute('data-phase', 'round');
      if (outcome === 'timeout') {
        await page.clock.fastForward(7501);
      } else {
        if (grades[round] !== 'MISS') {
          const delay = await receipt.evaluate((_, {index, grade}) => {
            const engine = window.OneShotEngine;
            for (let t = 0; t <= 2700; t++) {
              if (engine.score(engine.sample(index, t, 0).error, false, index).grade === grade) return t;
            }
            throw new Error('Alignment not found');
          }, {index:round, grade:grades[round]});
          await page.clock.fastForward(delay);
        }
        // Drive the rule checks on the virtual clock. Physical contact and
        // compositor motion are exercised separately on the browser clock.
        await receipt.press('Enter');
      }
      await expect(game.locator('#game')).toHaveAttribute('data-phase', 'capture');
      await page.clock.fastForward(1951);
    }
    await expect(game.locator('#result-title')).toHaveText(outcome === 'clear' ? '세 번 모두 촬영했어요' : `${grades.length}단계에서 종료`);
    const state = await receipt.evaluate(() => window.OneShotApp.inspect());
    expect(state.records.plays).toBe(1);
    expect(state.shots.map(shot => shot.grade)).toEqual(grades);
    const badges = game.locator('#result-rounds .result-round > b');
    await expect(badges).toHaveText(grades.map(grade => grade === 'MISS' ? '실패' : '성공'));
    for (const [index, grade] of grades.entries()) {
      await expect(badges.nth(index)).toHaveCSS('background-color',
        grade === 'MISS' ? 'rgb(251, 232, 231)' : 'rgb(216, 243, 72)');
    }
    await expect(game.locator('#replay')).toBeInViewport({ratio:1});
    await game.locator('#replay').tap();
    await expect(page.locator('#menu')).toBeVisible();
  });
}

test('staff exit, cancellation and refresh handoff', async ({ page }) => {
  const game = await startPaper(page);
  await game.locator('#menu-back').tap();
  await page.locator('#exit-cancel').tap();
  await expect(game.locator('#arena')).toBeVisible();
  await game.locator('#menu-back').tap();
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
      for (const control of [game.locator(button), game.locator('#menu-back'), game.locator('#fullscreen')]) {
        const rect = await control.boundingBox();
        expect(rect.height).toBeGreaterThanOrEqual(48);
        expect(rect.width).toBeGreaterThanOrEqual(48);
      }
      const back = game.locator('header #menu-back');
      await expect(back).toBeInViewport({ratio:1});
      if (name === 'paper') {
        await expect.poll(() => game.locator('.hero-visual').evaluate(panel => {
          const outer = panel.getBoundingClientRect();
          return [...panel.querySelectorAll('.hero-sheet, .hero-clock')].every(part => {
            const box = part.getBoundingClientRect();
            return box.left >= outer.left && box.right <= outer.right &&
              box.top >= outer.top && box.bottom <= outer.bottom;
          });
        })).toBe(true);
      }
      if (name === 'scan') {
        const gaps = await game.locator('.shot-step').evaluateAll(steps => steps.map(step =>
          step.querySelector('.step-label').getBoundingClientRect().left -
          step.querySelector('.step-number').getBoundingClientRect().right));
        expect(Math.min(...gaps)).toBeGreaterThan(3);
      }
      for (const body of [page.locator('body'), game.locator('body')]) {
        const size = await body.evaluate(() => {
          const root = document.scrollingElement;
          return [root.scrollWidth - innerWidth, root.scrollHeight - innerHeight];
        });
        expect(size).toEqual([0,0]);
      }
      await game.locator('#menu-back').tap();
      await page.locator('#exit-confirm').tap();
    }
  });
}

test('sound and fullscreen controls are shared across games', async ({ page }) => {
  let initialBounds;
  for (const [gameName, enabled] of [['paper',false], ['scan',true], ['paper',false]]) {
    const game = await choose(page, gameName);
    const sound = game.getByRole('button', {name: enabled ? '소리 끄기' : '소리 켜기', exact:true});
    await expect(sound).toHaveAttribute('aria-pressed', String(enabled));
    await sound.tap();
    const full = game.locator('#fullscreen');
    const bounds = await full.locator('svg').boundingBox();
    expect(bounds.width).toBeGreaterThan(20);
    if (initialBounds) expect(bounds).toEqual(initialBounds);
    initialBounds = bounds;
    await full.tap();
    await expect(full).toHaveAccessibleName('전체 화면 나가기');
    await full.tap();
    await expect(full).toHaveAccessibleName('전체 화면');
    await game.locator('#menu-back').tap();
    await page.locator('#exit-confirm').tap();
  }
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
