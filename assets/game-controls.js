(() => {
  // Use the existing kiosk key so operator and player controls share a preference.
  const muteKey = 'aims-arena-muted';
  const speaker = '<path d="M11 4 6 8H3v8h3l5 4Z"/>';
  const paths = {
    on: speaker + '<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    off: speaker + '<path d="m16 9 5 6m0-6-5 6"/>',
    enter: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
    exit: '<path d="M3 9h6V3m6 0v6h6M3 15h6v6m6 0v-6h6"/>',
  };
  function soundEnabled() {
    try {
      const muted = localStorage.getItem(muteKey);
      if (muted !== null) return muted === 'false';
      return JSON.parse(localStorage.getItem('aims-one-shot-scan-v1'))?.sound === true;
    } catch { return false; }
  }
  function paint(button, icon, label, pressed) {
    button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24">' + paths[icon] + '</svg>';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(pressed));
  }
  function mount({soundButton, fullscreenButton, screen, onSound, onError}) {
    let enabled;
    const syncSound = (value, tapped) => {
      enabled = value;
      paint(soundButton, enabled ? 'on' : 'off', enabled ? '소리 끄기' : '소리 켜기', enabled);
      onSound(enabled, tapped);
    };
    syncSound(soundEnabled(), false);
    soundButton.addEventListener('click', () => {
      const next = !enabled;
      try { localStorage.setItem(muteKey, String(!next)); } catch {}
      syncSound(next, true);
    });
    window.addEventListener('storage', event => {
      if (!event.key || event.key === muteKey) syncSound(soundEnabled(), false);
    });
    const full = () => Boolean(screen.fullscreenElement || screen.webkitFullscreenElement);
    const syncFull = () => paint(fullscreenButton, full() ? 'exit' : 'enter', full() ? '전체 화면 나가기' : '전체 화면', full());
    syncFull();
    screen.addEventListener('fullscreenchange', syncFull);
    screen.addEventListener('webkitfullscreenchange', syncFull);
    // A kiosk frame can be opened repeatedly inside the same parent document.
    window.addEventListener('pagehide', event => {
      if (event.persisted) return;
      screen.removeEventListener('fullscreenchange', syncFull);
      screen.removeEventListener('webkitfullscreenchange', syncFull);
    });
    window.addEventListener('pageshow', event => {
      if (event.persisted) { syncSound(soundEnabled(), false); syncFull(); }
    });
    fullscreenButton.addEventListener('click', async () => {
      try {
        if (full()) await (screen.exitFullscreen || screen.webkitExitFullscreen).call(screen);
        else await (screen.documentElement.requestFullscreen || screen.documentElement.webkitRequestFullscreen).call(screen.documentElement);
      } catch { onError('브라우저 메뉴에서 전체 화면을 켜주세요.'); }
    });
  }
  window.GameControls = {mount};
})();
