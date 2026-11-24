(() => {
  'use strict';
  const menu = document.getElementById('menu');
  const play = document.getElementById('play');
  const handoff = document.getElementById('handoff');
  const dialog = document.getElementById('exit-dialog');
  const routes = {paper: 'paper-race', scan: 'one-shot'};
  const turnKey = 'aims-kiosk-turn';
  let frame;

  function home() {
    if (dialog.open) dialog.close();
    frame?.remove();
    frame = null;
    try { sessionStorage.removeItem(turnKey); } catch {}
    play.hidden = handoff.hidden = true;
    menu.hidden = false;
  }

  function openGame(game) {
    if (frame || menu.hidden || !routes[game]) return;
    try { sessionStorage.setItem(turnKey, game); } catch {}
    menu.hidden = true;
    play.hidden = false;
    frame = document.createElement('iframe');
    frame.id = 'game-frame';
    frame.title = game === 'paper' ? 'PAPER RACE' : 'ONE SHOT SCAN';
    frame.allow = 'fullscreen';
    frame.src = routes[game] + '/index.html?kiosk=1';
    frame.addEventListener('load', event => {
      const back = event.currentTarget.contentDocument?.getElementById('menu-back');
      if (!back) return;
      back.hidden = false;
      back.addEventListener('click', requestExit);
    });
    play.append(frame);
  }

  for (const button of menu.querySelectorAll('[data-open]')) {
    button.addEventListener('click', () => openGame(button.dataset.open));
    button.disabled = false;
  }
  function requestExit() {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else if (confirm('현재 참가자의 차례를 종료할까요?')) home();
  }
  document.getElementById('exit-cancel').addEventListener('click', () => dialog.close());
  document.getElementById('exit-confirm').addEventListener('click', home);
  document.getElementById('next-player').addEventListener('click', home);
  window.addEventListener('message', event => {
    if (event.origin === location.origin && frame && event.source === frame.contentWindow &&
        event.data?.aimsKiosk === 'home') home();
  });
  try {
    if (sessionStorage.getItem(turnKey)) {
      menu.hidden = true;
      handoff.hidden = false;
    }
  } catch {}
})();
