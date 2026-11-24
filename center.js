(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const operator=new URLSearchParams(location.search).get('mode')!=='display';
  const selectKey='aims-game-center-selection-v1';
  const channelName='aims-game-center-channel-v1';
  const channel=('BroadcastChannel' in window)?new BroadcastChannel(channelName):null;
  const me=Math.random().toString(36).slice(2);
  let current='menu',displayAlive=false,frameReady=false,scanState=null,desired=null;
  let lastDisplayBeat=0;
  try{const saved=localStorage.getItem(selectKey);if(['paper','scan','menu'].includes(saved))current=saved;}catch{}
  const send=(kind,extras={})=>channel?.postMessage({kind,from:me,at:Date.now(),...extras});
  const readScan=()=>{try{return JSON.parse(localStorage.getItem('aims-one-shot-scan-v1')||'null')}catch{return null}};
  const format=n=>Number(n||0).toLocaleString('ko-KR');
  const labels={home:'대기 중',countdown:'시작 준비',round:'촬영 중',capture:'스캔 중',result:'완료',paused:'일시정지'};
  function updateRecord(){if(!operator)return;const v=readScan()||{best:0,plays:0,history:[]};$('scan-best').textContent=format(v.best);$('scan-plays').textContent=format(v.plays);const rows=Array.isArray(v.history)?v.history.slice(0,5):[];$('scan-history').replaceChildren();if(!rows.length){$('scan-history').textContent='아직 기록이 없습니다.';return;}rows.forEach((r,i)=>{const el=document.createElement('div');el.className='history-row';const date=new Date(r.at);el.textContent=`${i+1}. ${date.toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}`;const b=document.createElement('strong');b.textContent=format(r.total)+'점';el.append(b);$('scan-history').append(el);});}
  function updateScanStatus(){if(!operator)return;const s=scanState;const state=s?.phase||'home';$('scan-phase').textContent=labels[state]||state;$('scan-round').textContent=(state==='home'?'–':Math.min(3,s.round||1))+' / 3';$('scan-score').textContent=state==='home'?'대기':format(s?.score||0)+'점';$('scan-details').textContent=displayAlive?(s?'관람객 화면과 연동 중':'관람객 화면 연결됨'):'관람객 화면을 열어주세요.';}
  function updateConnection(){if(!operator)return;const alive=Date.now()-lastDisplayBeat<3400;displayAlive=alive;const label=$('connection');label.classList.toggle('connected',alive);label.querySelector('span').textContent=alive?'관람객 화면 연결됨':'관람객 화면 연결 대기';updateScanStatus();}
  function select(game,announce=true){if(!['paper','scan','menu'].includes(game))return;const prior=current;current=game;try{localStorage.setItem(selectKey,game)}catch{}
    if(operator){document.querySelectorAll('[data-game]').forEach(el=>el.classList.toggle('selected',el.dataset.game===game));$('paper-control').hidden=game!=='paper';$('scan-control').hidden=game!=='scan';$('control-title').textContent=game==='paper'?'PAPER RACE':game==='scan'?'ONE SHOT SCAN':'GAME CENTER';$('active-pill').textContent=game==='paper'?'서류 비교 게임':game==='scan'?'타이밍 게임':'대기';if(announce)send('select',{game});if(prior==='paper'&&game!=='paper'){
      try{const doc=$('paper-operator-frame').contentDocument;const reset=doc?.getElementById('reset-btn');if(reset&&!reset.disabled)reset.click();}catch{}
    }if(prior==='scan'&&game!=='scan')send('scan-control',{cmd:'reset'});
    }else{showDisplay(game);}
  }
  function showDisplay(game){$('shell').classList.toggle('spectator-playing',game==='paper'||game==='scan');$('display-menu').hidden=game!=='menu';$('game-paper').hidden=game!=='paper';$('game-scan').hidden=game!=='scan';if(game==='scan'){
      const frame=$('scan-display-frame');frameReady=Boolean(frame.contentDocument?.readyState==='complete');if(frameReady)frame.contentWindow.focus();
    }
  }
  function command(cmd){if(current!=='scan')select('scan');if(!displayAlive){alert('관람객 화면을 먼저 열어주세요.');return;}send('scan-control',{cmd});}
  function downloadScan(){const records=readScan();if(!records?.history?.length){alert('다운로드할 기록이 없습니다.');return;}
   const rows=[['날짜','총점','위치 점수','위치 판정','각도 점수','각도 판정','크기 점수','크기 판정']];records.history.forEach(r=>rows.push([new Date(r.at).toLocaleString('ko-KR'),r.total,...r.rounds.flatMap(s=>[s.points,s.grade])]));
   const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='AIMS-One-Shot-Scan-records.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function postScan(cmd){const frame=$('scan-display-frame');if(frame.contentWindow&&frameReady)frame.contentWindow.postMessage({aimsCenter:1,cmd},location.origin);else desired=cmd;}
  if(operator){$('operator').hidden=false;$('display').hidden=true;
    $('open-display').addEventListener('click',()=>{const w=window.open('index.html?mode=display','aims-game-center-display');if(!w)alert('팝업이 차단됐습니다. 주소 뒤에 ?mode=display 를 붙여 관람객 화면을 열어주세요.');else w.focus();});
    document.querySelectorAll('[data-game]').forEach(el=>el.addEventListener('click',()=>select(el.dataset.game)));
    document.querySelectorAll('[data-scan]').forEach(el=>el.addEventListener('click',()=>command(el.dataset.scan)));
    $('export-scan').addEventListener('click',downloadScan);
    // The spectator and operator share one PC: Space also works when the operator window has focus.
    document.addEventListener('keydown',event=>{
      if(current!=='scan'||event.code!=='Space'||event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
      if(event.target.closest('button,input,textarea,select,[contenteditable=true]'))return;
      event.preventDefault();command('shoot');
    });
    select(current==='menu'?'paper':current,false);setInterval(()=>{updateConnection();updateRecord();},1100);
  }else{$('operator').hidden=true;$('display').hidden=false;showDisplay(current);$('scan-display-frame').addEventListener('load',()=>{frameReady=true;const next=desired;desired=null;if(next)postScan(next);});
    $('display-fullscreen').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else document.documentElement.requestFullscreen?.().catch(()=>{});});
    document.addEventListener('keydown',event=>{if(event.key.toLowerCase()==='f'&&event.target.tagName!=='IFRAME'){event.preventDefault();$('display-fullscreen').click()}});
    setInterval(()=>send('display-heartbeat',{game:current}),1200);
  }
  if(channel)channel.onmessage=event=>{const m=event.data;if(!m||m.from===me)return;
    if(m.kind==='display-heartbeat'&&operator){lastDisplayBeat=Date.now();if(!displayAlive)send('select',{game:current});updateConnection();}
    if(m.kind==='select'&&!operator)select(m.game,false);
    if(m.kind==='scan-control'&&!operator){if(current!=='scan')select('scan',false);postScan(m.cmd);}
    if(m.kind==='scan-state'&&operator){scanState=m.state;updateScanStatus();}
    if(m.kind==='request-selection'&&operator)send('select',{game:current});
  };
  if(!operator){window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==$('scan-display-frame').contentWindow||event.data?.aimsCenter!==1||event.data.game!=='scan'||event.data.kind!=='state')return;send('scan-state',{state:event.data});});send('request-selection');}
  window.addEventListener('storage',event=>{if(event.key===selectKey&&event.newValue&&!operator)select(event.newValue,false);if(event.key==='aims-one-shot-scan-v1')updateRecord();});
})();
