(function () {
  'use strict';
  const E = window.OneShotEngine;
  const L = window.OneShotLayout;
  const $ = id => document.getElementById(id);
  const money = value => Math.round(value).toLocaleString('ko-KR');
  const kiosk = window.parent !== window && new URLSearchParams(location.search).has('kiosk');
  const now = () => performance.now();
  const COUNTDOWN_MS = 2400, CAPTURE_MS = 1950;
  const TITLES = ['1단계 · 위치 맞추기', '2단계 · 각도 맞추기', '3단계 · 최종 스캔'];
  const HINTS = ['천천히 움직입니다. 가운데에서 터치', '조금 더 빠릅니다. 똑바로 설 때 터치', '최종 단계. 테두리와 정확하게 맞는 순간 터치'];
  const LABELS = ['위치', '각도', '크기'];
  const RECEIPT = ({
    number: 'R-0612-032', days: '3일', patient: '홍길동', date: '2026.06.12',
    gross: '18,500원', covered: '5,500원', insurer: '11,000원', noncovered: '2,000원',
    paid: '7,500원', registration: '000-00-00000', address: '가상시 새봄로 12, 1층',
    provider: '가람빛약국', pharmacist: '이서준'
  });
  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  const records = new window.OneShotStorage.RecordStore(storage);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false;
  const state = {
    phase: 'home', phaseAt: now(), roundIndex: 0, seed: 0, shots: [], clock: null,
    spaceDown: false, lastTick: -1, lastCount: -1, captureAligned: false, scanStarted: false,
    previousPhase: null, pauseAt: 0, modal: null, previousFocus: null,
    bestBefore: 0, total: 0, resultSaved: false, sound: records.getState().sound,
    toastUntil: 0, running: true, frameId: 0
  };
  let fit = L.fitStage(1100, 420);
  const game = $('game'), arena = $('arena'), paper = $('paper'), action = $('action');
  const stepNodes = [...document.querySelectorAll('.shot-step')];

  const sound = {
    context: null,
    unlock() {
      if (!state.sound) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.context ||= new AudioContext();
        if (this.context.state === 'suspended') this.context.resume()?.catch(() => {});
      } catch { /* Audio is optional; gameplay must still work. */ }
    },
    tone(frequency, duration = .07, delay = 0, volume = .045) {
      if (!state.sound || !this.context || this.context.state !== 'running') return;
      try {
        const oscillator = this.context.createOscillator(), gain = this.context.createGain();
        const start = this.context.currentTime + delay;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(volume, start + .006);
        gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
        oscillator.connect(gain); gain.connect(this.context.destination);
        oscillator.start(start); oscillator.stop(start + duration + .01);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      } catch { /* Browser or device audio failure does not affect timing. */ }
    },
    shot(grade) {
      if (grade === 'MISS') { this.tone(170, .13); return; }
      this.tone(950, .035, 0, .035);
      this.tone(grade === 'PERFECT' ? 1320 : 1050, .15, .045, .04);
    },
    finish() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, .2, i * .09, .035)); }
  };

  function announce(text) { $('announcement').textContent = text; }
  function setPhase(phase, instant = now()) {
    state.phase = phase;
    state.phaseAt = instant;
    game.dataset.phase = phase;
  }
  function displayToast(text) {
    $('toast').textContent = text;
    $('toast').hidden = false;
    state.toastUntil = now() + 3200;
  }
  function makeReceipt() {
    const boxes = [
      ['number', [353, 135, 385, 59]], ['days', [937, 135, 103, 59]],
      ['patient', [353, 199, 688, 60]], ['date', [353, 264, 688, 59]],
      ['gross', [421, 328, 620, 59], 'money'], ['covered', [421, 392, 620, 57], 'money'],
      ['insurer', [421, 453, 620, 57], 'money'], ['noncovered', [421, 515, 620, 57], 'money'],
      ['paid', [617, 580, 424, 56], 'money'], ['—', [617, 644, 424, 53], 'money'],
      ['—', [617, 703, 424, 53], 'money'], ['paid', [617, 762, 424, 57], 'money'],
      ['—', [617, 826, 424, 50]], ['—', [617, 884, 424, 51]],
      ['registration', [357, 942, 684, 61]], ['address', [357, 1009, 684, 91]],
      ['provider', [357, 1107, 684, 60]], ['pharmacist', [357, 1174, 684, 57]],
      ['date', [357, 1238, 684, 56]], ['상기 금액을 영수합니다.', [64, 1311, 961, 34]],
      ['전시용 가상 서식 · 실제 증빙으로 사용할 수 없습니다.', [64, 1363, 961, 31], 'fiction']
    ];
    const fragment = document.createDocumentFragment();
    for (const [key, [x, y, width, height], align = ''] of boxes) {
      const span = document.createElement('span');
      span.className = 'receipt-field ' + align;
      span.dataset.field = key;
      Object.assign(span.style, { left: x / 1086 * 100 + '%', top: y / 1448 * 100 + '%', width: width / 1086 * 100 + '%', height: height / 1448 * 100 + '%' });
      span.textContent = RECEIPT[key] || key;
      fragment.appendChild(span);
    }
    $('receipt-fields').appendChild(fragment);
    const data = [['약국명', 'provider'], ['조제일', 'date'], ['총 납부금액', 'paid']];
    for (const [label, key] of data) {
      const row = document.createElement('div'); row.className = 'data-row';
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = RECEIPT[key]; dd.dataset.sourceField = key;
      row.append(dt, dd); $('extracted-data').appendChild(row);
    }
  }
  function resize() {
    const rect = arena.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    fit = L.fitStage(rect.width, rect.height);
    arena.style.setProperty('--paper-w', fit.paperWidth.toFixed(3) + 'px');
    arena.style.setProperty('--paper-h', fit.paperHeight.toFixed(3) + 'px');
    arena.style.setProperty('--paper-type', (fit.paperWidth / 1086 * 31).toFixed(3) + 'px');
    if (state.phase === 'round') applyPose(state.roundIndex, state.clock.snapshot(now()).value);
  }
  function applyPose(round, value) {
    const pose = L.transformFor(round, value, fit);
    paper.style.setProperty('--dx', pose.x.toFixed(3) + 'px');
    paper.style.setProperty('--angle', pose.angle.toFixed(3) + 'deg');
    paper.style.setProperty('--scale', pose.scale.toFixed(5));
    arena.classList.toggle('is-aligned', state.phase === 'round' && Math.abs(value) <= E.ROUNDS[state.roundIndex].maxError);
  }
  function updateSteps() {
    stepNodes.forEach((node, i) => {
      const shot = state.shots[i];
      node.classList.toggle('is-current', !shot && i === state.roundIndex);
      node.classList.toggle('is-done', Boolean(shot));
      node.classList.toggle('is-perfect', Boolean(shot && E.isStageCleared(shot)));
      node.querySelector('.step-number').textContent = shot ? (E.isStageCleared(shot) ? '✓' : '×') : String(i + 1);
      node.querySelector('.step-score').textContent = shot ? (E.isStageCleared(shot) ? '성공' : '실패') : '';
      node.setAttribute('aria-label', `${i + 1}단계 ${LABELS[i]}${shot ? ', ' + (E.isStageCleared(shot) ? '성공' : '실패') : ''}`);
    });
  }
  function soundUI() {
    $('sound').setAttribute('aria-pressed', String(state.sound));
    $('sound').setAttribute('aria-label', state.sound ? '소리 끄기' : '소리 켜기');
  }
  function focusGameplay() {
    if (state.modal) return;
    const primary = state.phase === 'result' ? game : !action.disabled ? action : game;
    primary.focus({ preventScroll: true });
  }
  function toggleSound() {
    state.sound = !state.sound;
    records.setSound(state.sound);
    soundUI(); sound.unlock(); sound.tone(780, .08);
    displayToast(state.sound ? '소리 켜짐' : '소리 꺼짐');
    focusGameplay();
  }
  function updateScorePanel() {
    const home = state.phase === 'home';
    $('score-caption').textContent = home ? '3단계 도전' : '단계 진행';
    $('live-score').textContent = home ? 'READY' : `${state.shots.filter(E.isStageCleared).length} / 3`;
  }
  function showHome() {
    closeModal(false);
    setPhase('home');
    state.clock = null; state.shots = []; state.roundIndex = 0;
    state.resultSaved = false; state.lastCount = -1;
    game.classList.remove('scan-active', 'feedback-active');
    delete game.dataset.grade;
    game.dataset.round = '1';
    $('play-screen').hidden = false; $('result-screen').hidden = true;
    $('eyebrow').innerHTML = '<span class="live-dot"></span>3 LEVEL CHALLENGE';
    $('prompt').innerHTML = '3단계를 모두 통과하세요.';
    $('subcopy').textContent = '프레임에 맞을 때 화면을 터치';
    $('arena-label').textContent = 'ALIGN THE RECEIPT';
    $('action-label').textContent = '시작하기'; action.disabled = false;
    $('frame-caption').textContent = '이 안에 딱 맞게';
    updateSteps(); updateScorePanel(); resize();
    focusGameplay();
    announce('원샷 스캔. 시작하기를 터치하세요.');
  }
  function start() {
    if (state.phase !== 'home' || state.modal) return;
    sound.unlock();
    const instant = now();
    setPhase('countdown', instant);
    state.shots = []; state.roundIndex = 0; state.clock = null;
    state.seed = Math.floor(Math.random() * 0x7fffffff);
    RECEIPT.patient = Math.random() < .5 ? '홍길동' : '김철수';
    document.querySelectorAll('[data-field="patient"]').forEach(el => { el.textContent = RECEIPT.patient; });
    state.bestBefore = records.getState().best;
    state.total = 0; state.resultSaved = false; state.lastCount = -1;
    game.classList.remove('scan-active', 'feedback-active');
    delete game.dataset.grade; game.dataset.round = '1';
    $('play-screen').hidden = false; $('result-screen').hidden = true;
    $('eyebrow').textContent = 'READY FOR YOUR SHOT?';
    $('prompt').textContent = '터치 준비.';
    $('subcopy').textContent = '프레임에 맞을 때 화면을 터치';
    $('action-label').textContent = '준비'; action.disabled = true;
    updateSteps(); updateScorePanel(); resize(); applyPose(0, 0);
    updateCountdown(instant);
    announce('곧 시작합니다. 첫 번째는 위치를 맞춥니다.');
  }
  function updateCountdown(instant) {
    const elapsed = instant - state.phaseAt;
    if (elapsed >= COUNTDOWN_MS) { startRound(instant); return; }
    const digit = Math.max(1, 3 - Math.floor(elapsed / 800));
    if (digit !== state.lastCount) {
      state.lastCount = digit;
      const number = $('countdown-number');
      number.textContent = String(digit);
      number.classList.remove('pop'); void number.offsetWidth; number.classList.add('pop');
      sound.tone(digit === 1 ? 880 : 600, .07);
    }
  }
  function startRound(instant) {
    state.clock = new E.RoundClock(state.roundIndex, state.seed, instant);
    state.lastTick = -1;
    setPhase('round', instant);
    game.classList.remove('scan-active', 'feedback-active');
    delete game.dataset.grade; game.dataset.round = String(state.roundIndex + 1);
    $('eyebrow').textContent = state.roundIndex === 2 ? 'FINAL LEVEL · 03 / 03' : `LEVEL 0${state.roundIndex + 1} / 03`;
    $('prompt').textContent = TITLES[state.roundIndex];
    $('subcopy').textContent = HINTS[state.roundIndex];
    $('arena-label').textContent = E.ROUNDS[state.roundIndex].label;
    $('action-label').textContent = '지금 찍기'; action.disabled = false;
    updateSteps(); updateTimer(E.ROUND_MS, true);
    applyPose(state.roundIndex, state.clock.snapshot(instant).value);
    announce(`${TITLES[state.roundIndex]}. 성공해야 다음 단계로 넘어갑니다.`);
    sound.tone(1050, .11);
  }
  function updateTimer(remaining, silent = false) {
    $('time').textContent = Math.max(0, remaining / 1000).toFixed(1);
    $('dial-value').style.strokeDashoffset = String(125.664 * (1 - remaining / E.ROUND_MS));
    $('time-display').classList.toggle('urgent', remaining <= 2500);
    const second = Math.ceil(remaining / 1000);
    if (second !== state.lastTick) {
      const display = $('time-display');
      display.classList.remove('tick'); void display.offsetWidth; display.classList.add('tick');
      if (!silent && state.lastTick !== -1 && remaining > 0) sound.tone(remaining <= 2500 ? 760 : 420, .028, 0, .018);
      state.lastTick = second;
    }
  }
  function capture(instant) {
    if (state.phase !== 'round') return;
    const shot = state.clock.capture(instant);
    if (!shot) return;
    state.shots.push(shot);
    setPhase('capture', instant);
    state.captureAligned = false; state.scanStarted = false;
    game.dataset.grade = E.isStageCleared(shot) ? 'SUCCESS' : 'MISS';
    $('scan-stamp-path').setAttribute('d', E.isStageCleared(shot) ? 'm5 12 5 5L20 7' : 'M5 5L19 19M19 5L5 19');
    game.classList.add('feedback-active');
    arena.classList.remove('is-aligned');
    applyPose(state.roundIndex, shot.value);
    $('grade').textContent = E.isStageCleared(shot) ? 'SUCCESS' : 'FAIL';
    $('shot-points').textContent = ''; 
    $('shot-feedback').setAttribute('aria-hidden', 'false');
    $('prompt').textContent = !E.isStageCleared(shot) ? '단계 실패' :
      (state.roundIndex === 2 ? '최종 단계 성공!' : `${state.roundIndex + 1}단계 통과!`);
    $('subcopy').textContent = !E.isStageCleared(shot) ? '이번 참가자의 도전이 종료됩니다.' :
      state.roundIndex < 2 ? '다음 단계는 더 어렵습니다.' : '전체 미션 완료!';
    $('scan-message').querySelector('span').textContent = !E.isStageCleared(shot) ? '스캔 실패' : state.roundIndex === 2 ? 'FINAL CLEAR' : 'NEXT LEVEL UNLOCKED';
    $('action-label').textContent = '찰칵!'; action.disabled = true;
    updateSteps(); updateScorePanel(); updateTimer(shot.remainingMs, true);
    announce(E.isStageCleared(shot) ? `${state.roundIndex + 1}단계 성공.` : `${state.roundIndex + 1}단계 실패. 미션 종료.`);
    sound.shot(shot.grade);
  }
  function updateCapture(instant) {
    const elapsed = instant - state.phaseAt;
    if (elapsed >= 380 && !state.captureAligned) {
      state.captureAligned = true; applyPose(state.roundIndex, 0);
    }
    if (elapsed >= 700 && !state.scanStarted) {
      state.scanStarted = true;
      game.classList.remove('feedback-active'); game.classList.add('scan-active');
      $('shot-feedback').setAttribute('aria-hidden', 'true');
      sound.tone(620, .16, 0, .018);
    }
    if (elapsed >= CAPTURE_MS) {
      if (!E.isStageCleared(state.shots.at(-1))) { showResult(instant); }
      else if (state.roundIndex < 2) { state.roundIndex += 1; startRound(instant); }
      else showResult(instant);
    }
  }
  function showResult(instant) {
    if (state.resultSaved) return;
    state.total = state.shots.reduce((sum, shot) => sum + shot.points, 0);
    records.record(state.shots);
    state.resultSaved = true;
    setPhase('result', instant);
    game.classList.remove('scan-active', 'feedback-active');
    $('play-screen').hidden = true; $('result-screen').hidden = false;
    const newBest = state.total > state.bestBefore;
    const perfect = state.shots.every(shot => shot.grade === 'PERFECT');
    const cleared = state.shots.length === 3 && state.shots.every(E.isStageCleared);
    $('result-data-check').textContent = cleared ? '✓' : '×';
    $('data-card').classList.toggle('is-failed', !cleared);
    $('result-kicker').textContent = cleared ? 'ALL LEVELS CLEARED' : 'CHALLENGE ENDED';
    $('result-title').textContent = cleared ? '최종 클리어!' : `${state.shots.length}단계에서 종료`;
    $('result-score').textContent = cleared ? 'CLEAR' : 'END';
    $('result-score').setAttribute('aria-label', cleared ? '미션 성공' : '미션 종료');
    $('result-meter-fill').style.width = '0%';
    $('result-rounds').replaceChildren();
    state.shots.forEach((shot, i) => {
      const item = document.createElement('div');
      item.className = 'result-round' + (shot.grade === 'PERFECT' ? ' perfect' : '');
      const label = document.createElement('span'), grade = document.createElement('b'), points = document.createElement('strong');
      label.textContent = `LEVEL 0${i + 1} · ${LABELS[i]}`; grade.textContent = E.isStageCleared(shot) ? '성공' : '실패'; points.textContent = ''; 
      item.append(label, grade, points); $('result-rounds').appendChild(item);
    });
    $('best-score').textContent = money(records.getState().best);
    $('record-badge').textContent = newBest ? 'NEW BEST' : 'BEST';
    $('record-badge').parentElement.classList.toggle('is-new', newBest);
    const saved = records.getState().persistent;
    $('record-detail').textContent = saved ? '이 PC 최고 기록' : '이번 실행 중 최고 기록';
    $('save-status').textContent = cleared ? '3단계 모두 통과했습니다.' : '실패 시 종료 · 재도전은 없습니다.';
    sound.finish();
    announce(cleared ? '3단계를 모두 완료했습니다.' : '미션이 종료됐습니다.');
  }
  function activePhase(phase = state.phase) { return ['countdown', 'round', 'capture'].includes(phase); }
  function pause(kind = 'pause') {
    if (state.modal || !activePhase()) return;
    openModal(kind);
  }
  function openModal(kind) {
    if (state.modal) return;
    state.previousFocus = document.activeElement;
    if (activePhase()) {
      state.previousPhase = state.phase;
      state.pauseAt = now();
      state.clock?.pause(state.pauseAt);
      state.phase = 'paused'; game.dataset.paused = 'true';
    } else state.previousPhase = null;
    state.modal = kind;
    $('modal').hidden = false; game.inert = true;
    $('resume').querySelector('span').textContent = state.previousPhase ? '계속하기' : '확인';
    $('go-home').hidden = kiosk || !state.previousPhase;
    if (kind === 'pause') {
      $('modal-kicker').textContent = 'ON HOLD';
      $('modal-title').textContent = '잠깐 멈췄어요.';
      $('modal-content').innerHTML = '<p class="pause-copy">시간도 함께 멈춰 있어요.<br>준비되면 계속하기를 터치하세요.</p>';
    } else if (kind === 'help') {
      $('modal-kicker').textContent = 'HOW TO PLAY';
      $('modal-title').textContent = '3단계 스캔 챌린지';
      $('modal-content').innerHTML = '<ol class="how-to"><li><b>1</b><div><strong>가운데에 오면</strong><span>좌우로 움직이는 영수증을 멈춰주세요.</span></div></li><li><b>2</b><div><strong>똑바로 서면</strong><span>기울어진 영수증을 반듯하게 맞춰주세요.</span></div></li><li><b>3</b><div><strong>테두리에 맞으면</strong><span>커졌다 작아지는 영수증의 크기를 맞춰주세요.</span></div></li></ol><p class="modal-note">영수증 영역을 터치해 촬영 · 각 단계는 한 번만 도전합니다.<br>각 단계 7.5초 · 단계마다 속도 증가 · 실패 즉시 종료.<br>기록은 이 브라우저에만 저장됩니다. 실제 OCR 성능을 측정하지 않는 체험용 게임입니다.</p>';
    } else {
      $('modal-kicker').textContent = 'LOCAL RECORDS';
      $('modal-title').textContent = '이 PC의 최근 기록';
      $('modal-content').replaceChildren();
      const list = document.createElement('ol'); list.className = 'history-list';
      records.getState().history.slice(0, 5).forEach((record, index) => {
        const item = document.createElement('li');
        const order = document.createElement('small'), date = document.createElement('span'), total = document.createElement('b');
        order.textContent = String(index + 1).padStart(2, '0');
        date.textContent = new Date(record.at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        total.textContent = money(record.total); item.append(order, date, total); list.appendChild(item);
      });
      const note = document.createElement('p'); note.className = 'modal-note';
      note.textContent = `총 ${money(records.getState().plays)}판 · 최근 5판 표시 · 이름은 수집하지 않습니다.`;
      $('modal-content').append(list, note);
    }
    $('resume').focus({ preventScroll: true });
  }
  function closeModal(resume = true) {
    if (!state.modal) return;
    $('modal').hidden = true; game.inert = false;
    delete game.dataset.paused;
    if (state.previousPhase && resume) {
      const instant = now();
      state.phaseAt += instant - state.pauseAt;
      state.clock?.resume(instant);
      state.phase = state.previousPhase;
      game.dataset.phase = state.phase;
      sound.unlock();
    }
    state.modal = null; state.previousPhase = null;
    state.previousFocus = null;
    // This is a one-button game: closing a tool returns Space to gameplay.
    // Restoring an auxiliary button would make the next Space reopen that tool.
    focusGameplay();
  }
  function activate() {
    sound.unlock();
    if (state.modal) { closeModal(true); return; }
    if (state.phase === 'home') start();
    else if (state.phase === 'round') capture(now());
  }
  function toggleFullscreen() {
    focusGameplay();
    try {
      const screen = kiosk ? parent.document : document;
      const entering = !screen.fullscreenElement && !screen.webkitFullscreenElement;
      const operation = entering ? (screen.documentElement.requestFullscreen || screen.documentElement.webkitRequestFullscreen) : (screen.exitFullscreen || screen.webkitExitFullscreen);
      if (!operation) { displayToast('브라우저 메뉴에서 전체 화면을 켜주세요.'); return; }
      const result = operation.call(entering ? screen.documentElement : screen);
      result?.catch?.(() => displayToast('브라우저 메뉴에서 전체 화면을 켜주세요.'));
    } catch { displayToast('브라우저 메뉴에서 전체 화면을 켜주세요.'); }
  }
  function frame(instant) {
    if (!state.running) return;
    if (state.toastUntil && instant >= state.toastUntil) { $('toast').hidden = true; state.toastUntil = 0; }
    if (state.phase === 'home' && !state.modal) {
      // The first animation frame can be timestamped before initialization.
      const elapsed = Math.max(0, instant - state.phaseAt);
      const round = Math.floor(elapsed / 4200) % 3;
      const value = reducedMotion ? 0 : Math.sin(elapsed / 1050) * .68;
      applyPose(round, value);
      $('arena-label').textContent = `0${round + 1} / ${E.ROUNDS[round].label}`;
    } else if (state.phase === 'countdown') updateCountdown(instant);
    else if (state.phase === 'round') {
      const current = state.clock.snapshot(instant);
      applyPose(state.roundIndex, current.value); updateTimer(current.remainingMs);
      if (current.remainingMs <= 0) capture(instant);
    } else if (state.phase === 'capture') updateCapture(instant);
    else if (state.phase === 'result') {
      const progress = reducedMotion ? 1 : Math.min(1, (instant - state.phaseAt) / 1000);
      const eased = 1 - Math.pow(1 - progress, 3);
      $('result-score').textContent = state.shots.length === 3 && state.shots.every(E.isStageCleared) ? 'CLEAR' : 'END';
      $('result-meter-fill').style.width = '0%';
    }
    state.frameId = requestAnimationFrame(frame);
  }
  function keydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const element = event.target instanceof Element ? event.target : null;
    if (element?.closest('input,textarea,select,[contenteditable=true]')) return;
    const isSpace = event.code === 'Space' || event.key === ' ';
    if (isSpace) {
      if (state.phase === 'result') { event.preventDefault(); return; }
      const button = element?.closest('button');
      if (button && !['action', 'resume'].includes(button.id)) return;
      event.preventDefault();
      if (event.repeat || state.spaceDown) return;
      state.spaceDown = true;
      action.classList.add('pressed');
      activate(); return;
    }
    if (event.repeat) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (state.modal) closeModal(true); else pause();
    } else if (event.key.toLowerCase() === 'f') { event.preventDefault(); toggleFullscreen(); }
    else if (event.key.toLowerCase() === 'm') { event.preventDefault(); toggleSound(); }
    else if (event.key === 'Tab' && state.modal) {
      const focusables = [...$('modal').querySelectorAll('button:not([hidden])')].filter(el => !el.disabled);
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
  // StandbyME kiosk: one touch anywhere in the receipt area means one shutter press.
  let lastTouchShot=0;
  arena.addEventListener('pointerup', event => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    if (event.isPrimary === false || state.phase !== 'round' || state.modal) return;
    const t=now();if(t-lastTouchShot<450)return;lastTouchShot=t;
    event.preventDefault();capture(t);
  });
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', event => {
    if (event.code === 'Space' || event.key === ' ') { state.spaceDown = false; action.classList.remove('pressed'); }
  });
  window.addEventListener('blur', () => { state.spaceDown = false; action.classList.remove('pressed'); if (window.parent === window) pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && window.parent === window) pause(); });
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(arena);
  document.fonts?.ready?.then(resize);
  document.addEventListener('fullscreenchange', () => {
    $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? '전체 화면 나가기' : '전체 화면'); resize();
  });
  action.addEventListener('click', activate);
  $('replay').addEventListener('click', () => {
    if (kiosk) window.parent.postMessage({aimsKiosk:'home'}, location.origin);
    else showHome();
  });
  $('sound').addEventListener('click', toggleSound);
  $('fullscreen').addEventListener('click', toggleFullscreen);
  $('help').addEventListener('click', () => openModal('help'));
  $('history').addEventListener('click', () => openModal('history'));
  $('resume').addEventListener('click', () => closeModal(true));
  $('modal-close').addEventListener('click', () => closeModal(true));
  $('go-home').addEventListener('click', showHome);
  $('result-home').addEventListener('click', showHome);
  window.addEventListener('pagehide', () => { pause(); state.running = false; cancelAnimationFrame(state.frameId); });
  window.addEventListener('pageshow', () => { if (!state.running) { state.running = true; state.frameId = requestAnimationFrame(frame); } });

  makeReceipt(); soundUI(); showHome();
  state.frameId = requestAnimationFrame(frame);

  // Game Center bridge: the spectator iframe is the only active game instance.
  // Host sends commands via postMessage; this frame periodically reports state.
  function reportToCenter() {
    if (kiosk || window.parent === window) return;
    try { window.parent.postMessage({aimsCenter:1,game:'scan',kind:'state',phase:state.phase,
      round:state.roundIndex+1,score:state.shots.reduce((sum,shot)=>sum+shot.points,0),clear:state.phase==='result' && state.shots.length===3 && state.shots.every(s=>!s.timedOut && s.grade!=='MISS'),
      remainingMs:state.clock?.snapshot(now()).remainingMs ?? 7500,
      best:records.getState().best,plays:records.getState().plays,
      modal:Boolean(state.modal)}, location.origin); } catch (_) {}
  }
  window.addEventListener('message',event=>{
    if(kiosk || event.source!==window.parent||event.origin!==location.origin||event.data?.aimsCenter!==1)return;
    const cmd=event.data.cmd;
    if(cmd==='start') { if(state.modal)closeModal(false); start(); }
    if(cmd==='pause' && activePhase() && !state.modal)pause();
    if(cmd==='resume' && state.modal)closeModal(true);
    if(cmd==='reset')showHome();
    if(cmd==='shoot')activate();
    if(cmd==='snapshot')reportToCenter();
    reportToCenter();
  });
  if (!kiosk && window.parent !== window) setInterval(reportToCenter,450);
  reportToCenter();

  // Read-only snapshots support operator diagnostics and nonvisual event tests.
  window.OneShotApp = Object.freeze({
    inspect: () => ({ phase: state.phase, roundIndex: state.roundIndex, shots: state.shots.map(s => ({ ...s })),
      remainingMs: state.clock?.snapshot(now()).remainingMs ?? E.ROUND_MS,
      records: records.getState(), modal: state.modal, fit: { ...fit }, sampleReceipt: { ...RECEIPT } })
  });
})();
