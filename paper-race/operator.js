(function () {
  'use strict';

  const E = window.ArenaEngine;
  const bank = window.AIMS_CASEBOOK;
  const forms = window.AIMS_DOCUMENTS;
  let cases = bank.forSession(null);
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const levels = { easy:'여유롭게', normal:'보통', hard:'빠르게' };
  const settingsKey = 'aims-arena-operator-settings-v1';
  const soundKey = 'aims-arena-muted';
  const radios = Array.from(document.querySelectorAll('input[name="difficulty"]'));
  const store = E.createStore();
  let preferencesOK = true;
  let muted = false;
  let rankLevel = 'normal';
  let documentKey = '';
  let rankingKey = '';
  let renderKey = '';
  let lastFeedback = '';
  let lastCountdown = -1;
  let lastSecond = -1;
  let lastSession = null;
  let announcedResult = null;
  let audioContext = null;
  let tickBusy = false;
  let lastTick = 0;
  let frameID = 0;
  let toastTimer = 0;
  let firstRender = true;

  function nickname(value) {
    return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16) || '관람객';
  }

  function draft() {
    return { player: $('nickname').value.slice(0, 16), difficulty: radios.find(radio => radio.checked)?.value || 'normal' };
  }

  function loadPreferences() {
    const current = store.getState();
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(settingsKey) || 'null');
      muted = localStorage.getItem(soundKey) === 'true';
    } catch (_) { preferencesOK = false; }
    $('nickname').value = nickname(saved?.player ?? current.player);
    const level = Object.hasOwn(levels, saved?.difficulty) ? saved.difficulty : current.difficulty;
    radios.forEach(radio => { radio.checked = radio.value === level; });
    rankLevel = level;
  }

  function persistDraft() {
    try { localStorage.setItem(settingsKey, JSON.stringify(draft())); }
    catch (_) { preferencesOK = false; }
    updateStorage();
  }

  function updateStorage() {
    const ok = store.storageOK && preferencesOK;
    $('storage-warning').hidden = ok;
    $('storage-chip').classList.toggle('failed', !ok);
    $('storage-chip').innerHTML = '<i aria-hidden="true"></i>' + (ok ? '이 브라우저에 기록 저장' : '기록 저장 확인 필요');
  }

  function toast(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4200);
  }

  function unlockAudio() {
    if (!audioContext) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (Audio) {
        try { audioContext = new Audio(); } catch (_) { return; }
      }
    }
    audioContext?.resume().catch(() => {});
  }

  function sound(frequency, duration = .06, volume = .025, delay = 0, type = 'sine') {
    if (muted || !document.hasFocus() || !audioContext || audioContext.state !== 'running') return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const at = audioContext.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + .005);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(at);
    oscillator.stop(at + duration + .015);
  }

  function updateSound() {
    const paths = muted
      ? '<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="m16 9 5 6m0-6-5 6"/>'
      : '<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M15 8c3 2 3 6 0 8M18 5c5 4 5 10 0 14"/>';
    $('sound-toggle').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg>';
    $('sound-toggle').setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
    $('sound-toggle').setAttribute('aria-pressed', String(!muted));
    $('sound-toggle').title = (muted ? '소리 켜기' : '소리 끄기') + ' · M';
  }

  function toggleSound() {
    unlockAudio();
    muted = !muted;
    try { localStorage.setItem(soundKey, String(muted)); }
    catch (_) { preferencesOK = false; updateStorage(); }
    updateSound();
    if (!muted) sound(660, .1);
  }

  async function dispatch(action) {
    try { return await store.dispatch(action); }
    catch (_) { toast('상태를 바꾸지 못했어요. 잠시 후 다시 눌러주세요.'); }
    finally { updateStorage(); }
  }

  async function start() {
    const current = E.view(store.getState(), Date.now());
    if (['countdown', 'playing', 'reveal'].includes(current.phase)) return;
    unlockAudio();
    const next = draft();
    next.player = nickname(next.player);
    $('nickname').value = next.player;
    persistDraft();
    const session = bank.createSessionId();
    await dispatch({ type:'start', player:next.player, difficulty:next.difficulty, session });
  }

  function togglePause() {
    unlockAudio();
    const current = store.getState();
    if (['countdown', 'playing', 'reveal'].includes(current.phase)) dispatch({ type:'pause', session:current.session });
  }

  function documentHTML(doc, index, view) {
    return forms.render(doc,{side:index,mode:'operator',session:view.session,round:view.round,peer:cases[view.round].docs[1-index]});
  }

  function renderDocuments(view) {
    const current = cases[view.round];
    const nextKey = view.session + ':' + view.round;
    if (nextKey !== documentKey) {
      documentKey = nextKey;
      $('manual-documents').innerHTML = current.docs.map((doc, index) => documentHTML(doc, index, view)).join('');
      forms.mountPhotos?.($('manual-documents'));
      $('document-kicker').textContent = 'ROUND 0' + (view.round + 1) + ' · ' + current.label;
      $('document-heading').textContent = current.title;
      $('document-instruction').textContent = current.instruction;
    }
    $('manual-documents').querySelectorAll('[data-field]').forEach(button => {
      const selected = view.selected.includes(button.dataset.field);
      button.disabled = !view.canSelect;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('found', selected && view.phase === 'reveal');
    });
    $('selection-counter').textContent = view.selected.length + ' / 2 선택';
    const feedback = view.feedback;
    let message;
    if (view.phase === 'idle') message = '경기가 시작되면 서류의 모든 값을 선택할 수 있어요.';
    else if (view.paused) message = '경기와 시간이 멈췄어요. 이어하기를 눌러 재개하세요.';
    else if (view.phase === 'countdown') message = '곧 시작합니다. 참가자 화면에서도 같은 서류가 보여요.';
    else if (view.phase === 'finished') message = view.winner === 'human' ? '세 단서를 모두 찾았어요. 다음 참가자를 준비해주세요.' : '경기가 끝났어요. 다음 도전을 준비해주세요.';
    else if (feedback?.kind === 'found') message = current.reveal + ' · ' + current.explanation;
    else if (feedback?.kind === 'wrong') message = '선택한 두 칸은 비교 대상이 아니에요. 안내된 항목을 다시 골라주세요.';
    else message = view.selected.length ? '한 곳을 선택했어요. 함께 비교할 나머지 한 곳을 눌러주세요.' : '이름이나 숫자가 적힌 칸을 눌러주세요.';
    $('round-feedback').textContent = message;
    $('round-feedback').className = !view.paused && feedback?.kind === 'wrong' ? 'error' : feedback?.kind === 'found' ? 'success' : '';

    const feedbackKey = view.session + ':' + view.round + ':' + feedback?.kind + ':' + feedback?.at;
    if (!firstRender && !view.paused && feedbackKey !== lastFeedback) {
      if (feedback?.kind === 'selected') sound(view.selected.length ? 440 : 330, .04);
      else if (feedback?.kind === 'wrong') sound(155, .14, .04, 0, 'triangle');
      else if (feedback?.kind === 'found') [523, 659, 784].forEach((frequency, index) => sound(frequency, .16, .035, index * .075));
    }
    lastFeedback = feedbackKey;
  }

  function renderRankings(results, force = false) {
    const nextKey = rankLevel + ':' + JSON.stringify(results);
    if (!force && nextKey === rankingKey) return;
    rankingKey = nextKey;
    const rows = E.rank(results.filter(row => row.difficulty === rankLevel));
    document.querySelectorAll('[data-rank-level]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.rankLevel === rankLevel)));
    $('record-count').textContent = rows.length ? levels[rankLevel] + ' ' + rows.length + '개 · 전체 ' + results.length + '개 기록' : '이 난이도의 첫 기록을 기다려요.';
    $('ranking-body').innerHTML = rows.length ? rows.map((row, index) => `<tr><td>${String(index + 1).padStart(2, '0')}</td><td>${esc(row.name)}</td><td>${row.score.toLocaleString()}</td><td>${row.seconds.toFixed(1)}초</td><td><span class="rank-result${row.won ? ' win' : ''}">${row.won ? 'WIN' : 'TRY'}</span></td></tr>`).join('') : '<tr><td class="empty-ranking" colspan="5">첫 번째 기록의 주인공을 기다리고 있어요.</td></tr>';
    $('export-csv').disabled = !results.length;
    $('clear-results').disabled = !results.length;
  }

  function stamp(view) {
    return [view.revision, view.session, view.phase, view.round, view.paused, view.winner].join(':');
  }

  function render(view) {
    renderKey = stamp(view);
    if (view.session !== lastSession) {
      cases = bank.forSession(view.session);
      lastSession = view.session;
      lastSecond = -1;
      lastCountdown = -1;
      lastFeedback = '';
    }
    const active = ['countdown', 'playing', 'reveal'].includes(view.phase);
    $('open-casebook').disabled = active;
    if (active && $('casebook-dialog').open) $('casebook-dialog').close();
    const labels = { idle:'대기 중', countdown:'시작 준비', playing:'경기 진행', reveal:'정답 확인', finished:view.winner === 'human' ? '미션 성공' : '미션 종료' };
    $('phase-badge').textContent = view.paused ? '일시정지' : labels[view.phase];
    $('phase-badge').dataset.phase = view.phase;
    $('phase-badge').dataset.paused = String(view.paused);
    $('live-player').textContent = view.phase === 'idle' ? '다음 참가자를 준비해주세요.' : view.player + ' · ' + levels[view.difficulty] + ' ' + (view.durationMs / 1000) + '초';
    const statuses = { idle:'READY WHEN YOU ARE.', countdown:'READY, SET…', playing:'HUMAN vs. AI', reveal:view.winner ? 'HUMAN WINS.' : 'NICE FIND.', finished:view.winner === 'human' ? '미션 성공' : '미션 종료' };
    $('live-status').textContent = view.paused ? 'TAKE A BREATH.' : statuses[view.phase];
    $('live-caption').textContent = view.paused ? '두 화면의 경기 시간이 함께 멈췄어요.' : view.phase === 'idle' ? '경기 시작 후 3초의 준비 시간이 있어요.' : view.phase === 'finished' ? '이번 경기 결과예요. 새 참가자로 바로 시작할 수 있어요.' : view.phase === 'reveal' ? '정답을 확인하는 동안 경기 시간은 멈춰요.' : '세 문제를 모두 찾으면 도전 성공입니다.';
    $('start-btn').disabled = active;
    $('start-label').textContent = active ? '경기 진행 중' : view.phase === 'finished' ? '다음 참가자 시작' : '경기 시작';
    $('pause-btn').disabled = !active;
    $('pause-label').textContent = view.paused ? '이어하기' : '일시정지';
    $('reset-btn').disabled = view.phase === 'idle';
    $('round-stat').innerHTML = (view.phase === 'idle' ? '—' : '0' + (view.round + 1)) + '<small> / 03</small>';
    $('score-stat').innerHTML = view.score.toLocaleString() + '<small> PTS</small>';
    $('attempt-stat').textContent = view.errors;
    $('human-fill').style.width = view.humanProgress * 100 + '%';
    $('human-count').textContent = view.human + ' / 3';
    renderDocuments(view);
    renderRankings(view.results);
    if (!firstRender && view.phase === 'finished' && announcedResult !== view.session) {
      announcedResult = view.session;
      if (view.winner === 'human') [523, 659, 784, 1047].forEach((frequency, index) => sound(frequency, .25, .035, index * .12));
      else sound(294, .3, .025);
    }
    firstRender = false;
    updateStorage();
  }

  function clock(view) {
    const seconds = view.remainingSeconds;
    if (seconds !== lastSecond) {
      $('clock-seconds').textContent = String(seconds).padStart(2, '0');
      if (view.phase === 'playing' && !view.paused && lastSecond >= 0) sound(seconds <= 10 ? 920 : 680, seconds <= 10 ? .04 : .025, seconds <= 10 ? .035 : .011, 0, 'square');
      lastSecond = seconds;
    }
    $('live-clock').classList.toggle('urgent', view.phase === 'playing' && !view.paused && seconds <= 10);
    $('ai-fill').style.width = view.aiProgress * 100 + '%';
    $('ai-count').textContent = view.ai + ' / 3';
    if (view.phase === 'countdown' && view.countdown !== lastCountdown) {
      if (!view.paused) sound(view.countdown === 1 ? 740 : 520, .13, .045);
      lastCountdown = view.countdown;
      $('live-status').textContent = view.paused ? 'TAKE A BREATH.' : view.countdown + '초 후 시작';
    }
  }

  function exportCSV() {
    const results = store.getState().results;
    if (!results.length) return;
    const blob = new Blob(['\uFEFF', E.csv(E.rank(results))], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'aims-arena-results-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('전체 ' + results.length + '개 기록의 CSV 다운로드를 시작했어요.');
  }

  let previewCase = null;
  let previewVariant = 0;
  let previewAnswer = false;
  let previewSelected = [];
  function updateCasePreview(message) {
    $('casebook-documents').querySelectorAll('[data-field]').forEach(button => {
      const selected = previewSelected.includes(button.dataset.field);
      const found = previewAnswer && previewCase.needs.includes(button.dataset.field);
      button.disabled = false;
      button.classList.toggle('selected', selected);
      button.classList.toggle('found', found);
      button.setAttribute('aria-pressed', String(selected || found));
    });
    $('casebook-answer').textContent = previewAnswer ? '정답 숨기기' : '정답 보기';
    $('casebook-explanation').textContent = message ?? (previewAnswer
      ? previewCase.reveal + ' · ' + previewCase.explanation
      : '서류에서 서로 맞지 않는 두 값을 눌러보세요. 정답 보기로 확인할 수도 있어요.');
  }
  function renderCasePreview() {
    const id = $('casebook-select').value || bank.currentCatalog[0].id;
    previewCase = bank.previewCurrent(id, 'operator-preview-' + previewVariant);
    if (!previewCase) return;
    previewAnswer = false;
    previewSelected = [];
    $('casebook-title').textContent = previewCase.title;
    $('casebook-instruction').textContent = previewCase.instruction;
    $('casebook-documents').innerHTML = previewCase.docs.map((doc,index)=>forms.render(doc,{side:index,mode:'operator',session:'preview',round:0,peer:previewCase.docs[1-index]})).join('');
    forms.mountPhotos?.($('casebook-documents'));
    const sourceLinks = previewCase.docs.map(doc=>forms.sourceFor(doc)).filter(Boolean);
    $('casebook-sources').innerHTML = sourceLinks.length ? '참고한 원본 서식 ' + sourceLinks.map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.label)}</a>`).join(' · ') : '병원 기록표와 접수 조회서 형태로 구성한 가상 서류입니다.';
    $('casebook-explanation').setAttribute('aria-live', 'polite');
    updateCasePreview();
  }
  function openCasebook() {
    const v = E.view(store.getState(), Date.now());
    if (['countdown','playing','reveal'].includes(v.phase)) return;
    const groupNames = {easy:'첫 번째 · 쉬운 비교',compare:'두 번째 · 금액과 횟수',review:'세 번째 · 중복 확인'};
    $('casebook-select').innerHTML = ['easy','compare','review'].map(group=>`<optgroup label="${groupNames[group]}">${bank.currentCatalog.filter(item=>item.group===group).map(item=>`<option value="${esc(item.id)}">${esc(item.title)}</option>`).join('')}</optgroup>`).join('');
    $('casebook-count').textContent = bank.currentCatalog.length + ' CASES';
    renderCasePreview();
    $('casebook-dialog').showModal();
    forms.mountPhotos?.($('casebook-documents'));
  }
  function revealCasePreview() {
    if (!previewCase) return;
    previewSelected = [];
    previewAnswer = !previewAnswer;
    updateCasePreview();
  }
  function selectCasePreview(event) {
    const button = event.target?.closest?.('[data-field]');
    if (!previewCase || !button || button.disabled || !$('casebook-dialog').open || !$('casebook-documents').contains(button)) return;
    if (previewAnswer) {
      previewAnswer = false;
      previewSelected = [];
    }
    const id = button.dataset.field;
    previewSelected = previewSelected.includes(id) ? previewSelected.filter(value => value !== id) : previewSelected.concat(id);
    let message;
    if (previewSelected.length === 2) {
      const correct = previewCase.needs.length === 2 && previewCase.needs.every(value => previewSelected.includes(value));
      previewSelected = [];
      previewAnswer = correct;
      message = correct
        ? '맞았어요! ' + previewCase.reveal + ' · ' + previewCase.explanation
        : '이 조합은 아니에요. 서로 맞지 않는 두 값을 다시 선택해주세요.';
    } else if (previewSelected.length) {
      message = '한 곳을 선택했어요. 함께 비교할 나머지 한 곳을 눌러주세요.';
    }
    updateCasePreview(message);
  }

  function openClearDialog() {
    if (!store.getState().results.length) return;
    if (typeof $('clear-dialog').showModal === 'function') $('clear-dialog').showModal();
    else if (window.confirm('세 난이도의 경기 기록을 모두 지울까요? 이 작업은 되돌릴 수 없습니다.')) dispatch({ type:'clearResults' });
  }

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (_) { toast('브라우저 메뉴에서 전체화면을 켤 수 있어요.'); }
  }

  loadPreferences();
  updateSound();
  $('file-note').hidden = location.protocol !== 'file:';
  $('setup-form').addEventListener('submit', event => { event.preventDefault(); start(); });
  $('nickname').addEventListener('input', persistDraft);
  radios.forEach(radio => radio.addEventListener('change', persistDraft));
  $('pause-btn').addEventListener('click', togglePause);
  $('reset-btn').addEventListener('click', () => dispatch({ type:'reset', session:store.getState().session }));
  $('manual-documents').addEventListener('click', event => {
    const button = event.target?.closest?.('[data-field]');
    if (!button || button.disabled || !Number.isInteger(Number(button.dataset.round))) return;
    unlockAudio();
    const round = Number(button.dataset.round);
    const selectedCase = bank.forSession(button.dataset.session)[round];
    if (!selectedCase) return;
    dispatch({ type:'select', id:button.dataset.field, needs:selectedCase.needs, round, session:button.dataset.session });
  });
  document.querySelectorAll('[data-rank-level]').forEach(button => button.addEventListener('click', () => {
    rankLevel = button.dataset.rankLevel;
    renderRankings(store.getState().results, true);
  }));
  $('open-rankings').addEventListener('click', () => $('operator-rankings').showModal());
  $('close-rankings').addEventListener('click', () => $('operator-rankings').close());
  $('open-casebook').addEventListener('click', openCasebook);
  $('close-casebook').addEventListener('click', () => $('casebook-dialog').close());
  $('casebook-select').addEventListener('change', renderCasePreview);
  $('casebook-variant').addEventListener('click', () => {previewVariant++;renderCasePreview();});
  $('casebook-answer').addEventListener('click', revealCasePreview);
  $('casebook-documents').addEventListener('click', selectCasePreview);
  $('export-csv').addEventListener('click', exportCSV);
  $('clear-results').addEventListener('click', openClearDialog);
  $('cancel-clear').addEventListener('click', () => $('clear-dialog').close());
  $('confirm-clear').addEventListener('click', async () => {
    await dispatch({ type:'clearResults' });
    $('clear-dialog').close();
    toast('경기 기록을 모두 지웠어요.');
  });
  $('sound-toggle').addEventListener('click', toggleSound);
  $('fullscreen').addEventListener('click', fullscreen);
  window.addEventListener('pointerdown', unlockAudio, { passive:true });
  window.addEventListener('storage', event => {
    if (event.key === soundKey) { muted = event.newValue === 'true'; updateSound(); }
  });
  window.addEventListener('keydown', event => {
    if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || ($('clear-dialog').open || $('operator-rankings').open || $('casebook-dialog').open) || event.target.closest('input,select,textarea,[contenteditable="true"]')) return;
    const key = event.key.toLowerCase();
    if (key === 'f') { event.preventDefault(); fullscreen(); }
    else if (key === 'm') { event.preventDefault(); toggleSound(); }
    else if (event.code === 'Space' && !event.target.closest('button,a')) {
      event.preventDefault();
      const phase = E.view(store.getState(), Date.now()).phase;
      if (['countdown', 'playing', 'reveal'].includes(phase)) togglePause();
      else start();
    }
  });
  store.subscribe(state => { const view = E.view(state, Date.now()); render(view); clock(view); });

  function frame(time) {
    const raw = store.getState();
    const view = E.view(raw, Date.now());
    if (stamp(view) !== renderKey) render(view);
    clock(view);
    if (time - lastTick >= 100 && !tickBusy && !raw.paused && ['countdown', 'playing', 'reveal'].includes(raw.phase)) {
      lastTick = time;
      tickBusy = true;
      dispatch({ type:'tick', session:raw.session }).finally(() => { tickBusy = false; });
    }
    frameID = requestAnimationFrame(frame);
  }
  frameID = requestAnimationFrame(frame);
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frameID); clearTimeout(toastTimer); });
  window.addEventListener('pageshow', event => {
    if (event.persisted) { cancelAnimationFrame(frameID); frameID = requestAnimationFrame(frame); }
  });
})();
