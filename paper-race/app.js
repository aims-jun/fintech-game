(async function () {
  'use strict';
  if (new URLSearchParams(location.search).get('view') === 'operator') {
    location.replace('operator.html' + location.search); return;
  }
  const E = window.ArenaEngine, bank = window.AIMS_CASEBOOK, forms = window.AIMS_DOCUMENTS;
  let cases = bank.forSession(null);
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons = {
    sound:'<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M15 8c3 2 3 6 0 8M18 5c5 4 5 10 0 14"/></svg>',
    muted:'<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4Z"/><path d="m16 9 5 6m0-6-5 6"/></svg>',
    fullscreen:'<svg viewBox="0 0 24 24"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>',
    pause:'<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14" stroke-width="3"/></svg>',
    play:'<svg viewBox="0 0 24 24"><path d="m8 4 12 8-12 8Z"/></svg>'
  };
  let localScene = 'home', renderedScene = '', renderedDoc = '', lastFeedback = '', lastSession = '', lastSecond = -1, lastCountdown = -1, lastAi = -1, lastScore = -1;
  let context = null, muted = false, practice = new Set(), frameId = 0, connectionFrame = 0, tickBusy = false, lastTick = 0, hadInteraction = false;
  try {muted = localStorage.getItem('aims-arena-muted') === 'true';} catch (_) {}
  const store = E.createStore();
  const kiosk = window.parent !== window && new URLSearchParams(location.search).has('kiosk');
  if (kiosk) {
    document.body.classList.add('kiosk');
    // A newly opened kiosk frame belongs to a new participant. Keep past results.
    if (store.getState().phase !== 'idle') await store.dispatch({type:'reset'});
    $('home-mark').removeAttribute('href');
    $('home-mark').setAttribute('aria-label', 'AIMS');
  }
  function sound(freq, duration=.05, gain=.05, type='sine', delay=0) {
    if(muted || !context || context.state !== 'running' || !document.hasFocus())return;
    const oscillator=context.createOscillator(), volume=context.createGain(), at=context.currentTime+delay;
    oscillator.type=type; oscillator.frequency.setValueAtTime(freq,at);
    volume.gain.setValueAtTime(0,at);volume.gain.linearRampToValueAtTime(gain,at+.005);volume.gain.exponentialRampToValueAtTime(.0001,at+duration);
    oscillator.connect(volume);volume.connect(context.destination);oscillator.start(at);oscillator.stop(at+duration+.01);
  }
  function unlockAudio(){hadInteraction=true;if(!context){const C=window.AudioContext||window.webkitAudioContext;if(C)context=new C();}context?.resume().catch(()=>{});}
  function updateSound(){ $('sound-toggle').innerHTML=icons[muted?'muted':'sound'];$('sound-toggle').setAttribute('aria-label',muted?'소리 켜기':'소리 끄기');$('sound-toggle').title=(muted?'소리 켜기':'소리 끄기')+' · M';$('sound-toggle').setAttribute('aria-pressed',String(!muted));}
  function toggleSound(){unlockAudio();muted=!muted;try{localStorage.setItem('aims-arena-muted',String(muted));}catch(_){}updateSound();if(!muted)sound(660,.1);}
  function dispatch(command){return store.dispatch({session:store.getState().session,...command}).catch(error=>{console.error('게임 상태 변경 실패',error);$('footer-note').textContent='상태를 저장하지 못했어요. 운영자 화면을 확인해주세요.';});}
  function startRace(){if (store.getState().phase !== 'idle' || localScene !== 'tutorial') return; unlockAudio();lastSecond=-1;lastCountdown=-1;lastAi=-1;practice.clear();localScene='home';const state=store.getState();return store.dispatch({type:'start',player:state.player||'관람객',difficulty:state.difficulty,session:bank.createSessionId()});}
  function showScene(name){
    if(name===renderedScene)return;
    renderedScene=name;
    for(const id of ['home','tutorial','arena','result'])$(id).hidden=id!==name;
    if(name==='result' && store.getState().winner==='human')confetti();
    if(name==='home'){$('hero-seconds').textContent=String(store.getState().durationMs/1000);}
  }
  function documentHTML(doc,index,peer){
    return forms.render(doc,{side:index,mode:'player',peer});
  }
  const picker = $('field-picker');
  let pickerFields = [], pickerPage = 0;
  function openFields(slot, doc) {
    const buttons = [...slot.querySelectorAll('[data-field]')];
    if (!buttons.some(button => !button.disabled)) return;
    const byId = new Map(buttons.map(button => [button.dataset.field, button]));
    const rows = doc.rows.map(row => byId.get(row.id)).filter(Boolean);
    pickerFields = [...new Set([...rows, ...buttons])];
    pickerPage = 0;
    $('field-picker-title').textContent = doc.title;
    renderFields();
    picker.showModal();
  }
  function renderFields() {
    const size = innerHeight < 500 ? 4 : 6;
    const pages = Math.max(1, Math.ceil(pickerFields.length / size));
    pickerPage = Math.max(0, Math.min(pickerPage, pages - 1));
    $('field-options').replaceChildren(...pickerFields.slice(pickerPage * size, (pickerPage + 1) * size).map(source => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'field-option';
      option.setAttribute('aria-pressed', source.getAttribute('aria-pressed'));
      const label = document.createElement('span'), value = document.createElement('strong');
      label.textContent = source.parentElement.querySelector('.field-description').textContent;
      value.textContent = source.dataset.value;
      option.append(label, value);
      option.addEventListener('click', () => {
        picker.close();
        if (source.isConnected && !source.disabled) source.click();
      });
      return option;
    }));
    $('field-page').textContent = (pickerPage + 1) + ' / ' + pages;
    $('field-prev').disabled = pickerPage === 0;
    $('field-next').disabled = pickerPage === pages - 1;
  }
  $('field-close').addEventListener('click', () => picker.close());
  $('field-prev').addEventListener('click', () => { pickerPage--; renderFields(); });
  $('field-next').addEventListener('click', () => { pickerPage++; renderFields(); });
  window.addEventListener('resize', () => { if (picker.open) renderFields(); });
  function renderDocs(v){
    const key=v.session+'-'+v.round;
    if(key===renderedDoc)return;
    renderedDoc=key;
    const current=cases[v.round];
    $('doc-left').innerHTML=documentHTML(current.docs[0],0,current.docs[1]);$('doc-right').innerHTML=documentHTML(current.docs[1],1,current.docs[0]);
    if (kiosk) {
      for (const [index, slot] of [...$('documents').querySelectorAll('.paper-slot')].entries()) {
        const tools = document.createElement('div');
        tools.className = 'paper-tools';
        const choose = document.createElement('button');
        choose.type = 'button';
        choose.className = 'open-fields';
        choose.textContent = '항목 크게 보기';
        choose.setAttribute('aria-label', current.docs[index].title + ' 항목 크게 보기');
        choose.addEventListener('click', () => openFields(slot, current.docs[index]));
        tools.append(choose);
        const zoom = document.createElement('button');
        zoom.type = 'button';
        zoom.className = 'photo-zoom-button';
        zoom.dataset.photoZoom = '';
        tools.append(zoom);
        slot.prepend(tools);
      }
    }
    forms.mountPhotos($('documents'));
    $('mission-title').textContent=current.title;$('round-label').textContent='ROUND 0'+(v.round+1);$('round-category').textContent=current.label;
    $('mission-instruction').textContent=current.instruction;
    $('evidence-lines').innerHTML='';$('documents').classList.remove('correct');
    document.querySelectorAll('[data-field]').forEach(button=>button.addEventListener('click',()=>{
      unlockAudio();
      dispatch({type:'select',id:button.dataset.field,needs:current.needs,round:v.round,session:v.session});
    }));
    document.querySelectorAll('.document-row').forEach(row=>row.addEventListener('click',event=>{if(!event.target.closest('button'))row.querySelector('button').click();}));
  }
  function render(v){
    if (picker.open && (!v.canSelect || renderedDoc !== v.session + '-' + v.round)) picker.close();
    if(v.session!==lastSession){cases=bank.forSession(v.session);lastSession=v.session;lastFeedback='';lastSecond=-1;lastCountdown=-1;lastAi=-1;lastScore=-1;renderedDoc='';}
    if(v.phase!=='idle'){localScene='home';if($('ranking-dialog').open)$('ranking-dialog').close();}
    const scene=v.phase==='idle'?localScene:v.phase==='finished'?'result':'arena';
    showScene(scene);
    const active=['countdown','playing','reveal'].includes(v.phase);
    $('pause-control').hidden=!active;
    $('pause-control').innerHTML=icons[v.paused?'play':'pause'];$('pause-control').setAttribute('aria-label',v.paused?'이어하기':'일시정지');
    $('countdown-screen').hidden=v.phase!=='countdown';$('pause-screen').hidden=!v.paused;
    document.body.classList.toggle('paused',v.paused);
    if(active){
      renderDocs(v);
      $('player-name').textContent=v.player||'관람객';
      $('human-count').innerHTML=v.human+'<span> / 3</span>';
      $('human-fill').style.width=(v.humanProgress*100)+'%';
      document.querySelectorAll('[data-human-pip]').forEach(el=>el.classList.toggle('complete',Number(el.dataset.humanPip)<v.human));
      document.querySelectorAll('[data-field]').forEach(button=>{
        const order=v.selected.indexOf(button.dataset.field);
        button.disabled=!v.canSelect;button.classList.toggle('selected',order>=0);button.classList.toggle('second',order===1);button.classList.toggle('found',v.phase==='reveal'&&order>=0);button.setAttribute('aria-pressed',String(order>=0));
      });
      $('selection-one').classList.toggle('on',v.selected.length>=1);$('selection-two').classList.toggle('on',v.selected.length>=2);
      $('hint-btn').disabled=!v.canHint;
      $('hint-btn').innerHTML=v.hinted?'힌트 사용 중':'힌트';
      if(lastScore!==v.score){$('live-score').textContent=v.score.toLocaleString();$('live-score').classList.remove('score-pop');void $('live-score').offsetWidth;$('live-score').classList.add('score-pop');lastScore=v.score;}
      const current=cases[v.round], fb=v.feedback;
      const feedbackKey=v.session+'-'+v.round+'-'+(fb?.kind||'')+'-'+(fb?.at||0);
      if(feedbackKey!==lastFeedback){
        lastFeedback=feedbackKey;
        $('round-feedback').className='round-feedback';
        if(fb?.kind==='wrong'){
          $('round-feedback').textContent='선택한 두 칸은 이번 비교 항목이 아니에요. 다시 선택하세요.';$('round-feedback').classList.add('error');
          const el=document.querySelector(`[data-field="${CSS.escape(fb.id)}"]`);el?.closest('.document-row').classList.remove('wrong');if(el){void el.offsetWidth;el.closest('.document-row').classList.add('wrong');}
          sound(155,.14,.045,'triangle');
        } else if(fb?.kind==='hint'){$('round-feedback').textContent=current.hint;sound(520,.08,.025);}
        else if(fb?.kind==='found'){
          $('round-feedback').textContent=current.reveal+' · '+current.explanation;$('round-feedback').classList.add('success');
          $('documents').classList.add('correct');scheduleConnection();
          [523,659,784].forEach((hz,i)=>sound(hz,.16,.04,'sine',i*.075));
        } else {
          $('round-feedback').textContent=v.hinted?current.hint:v.selected.length?'첫 번째 선택 완료! 다른 서류에서 비교할 칸을 눌러주세요.':'안내된 항목 두 곳을 눌러 비교하세요.';
          if(fb?.kind==='selected')sound(v.selected.length?440:330,.04,.025,'sine');
        }
      }
      $('documents').classList.toggle('correct',v.phase==='reveal');
      if(v.phase!=='reveal')$('evidence-lines').innerHTML='';
    }
    if(scene==='result')renderResult(v);
    if(!store.storageOK)$('footer-note').textContent='기록 저장이 막혀 있어요. 브라우저 저장 설정을 확인해주세요.';
  }
  function scheduleConnection(){
    if(connectionFrame || E.view(store.getState(),Date.now()).phase!=='reveal')return;
    connectionFrame=requestAnimationFrame(()=>{connectionFrame=0;drawConnection();});
  }
  function drawConnection(){
    const v=E.view(store.getState(),Date.now());
    if(v.phase!=='reveal'||v.selected.length!==2)return;
    const nodes=v.selected.map(id=>document.querySelector(`[data-field="${CSS.escape(id)}"]`));if(nodes.some(n=>!n))return;
    const base=$('documents').getBoundingClientRect(), boxes=nodes.map(n=>n.getBoundingClientRect()), same=nodes[0].closest('.paper-slot')===nodes[1].closest('.paper-slot');
    let a,b,path;
    if(same){a={x:boxes[0].right-base.left,y:boxes[0].top+boxes[0].height/2-base.top};b={x:boxes[1].right-base.left,y:boxes[1].top+boxes[1].height/2-base.top};path=`M${a.x},${a.y} C${a.x+65},${a.y} ${b.x+65},${b.y} ${b.x},${b.y}`;}
    else{const sorted=boxes.slice().sort((x,y)=>x.left-y.left);a={x:sorted[0].right-base.left,y:sorted[0].top+sorted[0].height/2-base.top};b={x:sorted[1].left-base.left,y:sorted[1].top+sorted[1].height/2-base.top};const mid=(a.x+b.x)/2;path=`M${a.x},${a.y} C${mid},${a.y} ${mid},${b.y} ${b.x},${b.y}`;}
    const lines=$('evidence-lines');
    lines.setAttribute('viewBox',`0 0 ${base.width} ${base.height}`);
    if(!lines.firstElementChild)lines.innerHTML='<path/><circle r="4"/><circle r="4"/>';
    lines.children[0].setAttribute('d',path);
    [a,b].forEach((point,index)=>{lines.children[index+1].setAttribute('cx',point.x);lines.children[index+1].setAttribute('cy',point.y);});
  }
  let renderedResult='';
  function renderResult(v){
    if(renderedResult===v.session)return;renderedResult=v.session;
    const win=v.winner==='human';
    $('result-title').innerHTML=win?'YOU<br><span class="outline-type">WIN.</span>':'NICE<br><span class="outline-type">TRY.</span>';
    $('result-kicker').innerHTML=(win?'<i class="live-dot"></i> HUMAN WINS':'RACE COMPLETE');
    $('result-subtitle').textContent=win?'세 가지 단서를 모두 찾았습니다.':`단서 ${v.human}/3개 발견 · 이번 게임 종료`;
    $('reward-message').textContent=win?'미션 성공 · 3/3 완료':'미션 종료 · 3문제 미완료';
    $('paper-final-score').textContent=v.score.toLocaleString('ko-KR');
    const difficulty={easy:'여유롭게',normal:'보통',hard:'빠르게'}[v.difficulty];
    $('result-facts').innerHTML=`<span><b>${(v.elapsedMs/1000).toFixed(1)}</b>초</span><span><b>${v.human}/3</b>발견</span><span>${difficulty}</span>`;
    if(win)[523,659,784,1047].forEach((hz,i)=>sound(hz,.27,.04,'sine',i*.12));else sound(294,.3,.025,'sine');
  }
  function clock(v){
    if(['countdown','playing','reveal'].includes(v.phase)){
      const seconds=v.remainingSeconds;
      if(seconds!==lastSecond){
        $('time-digits').textContent=String(seconds).padStart(2,'0');$('timepiece').classList.remove('tick');void $('timepiece').offsetWidth;$('timepiece').classList.add('tick');
        if(v.phase==='playing'&&!v.paused&&lastSecond>=0)sound(seconds<=10?920:680,seconds<=10?.035:.022,seconds<=10?.036:.011,'square');
        lastSecond=seconds;
      }
      $('timer-progress').style.strokeDashoffset=String(276.46*v.aiProgress);
      $('timepiece').classList.toggle('urgent',seconds<=10&&!v.paused);
      $('ai-fill').style.width=(v.aiProgress*100)+'%';$('ai-runner').style.left=(v.aiProgress*100)+'%';
      if(v.ai!==lastAi){$('ai-count').innerHTML=v.ai+'<span> / 3</span>';document.querySelectorAll('[data-ai-pip]').forEach(el=>el.classList.toggle('complete',Number(el.dataset.aiPip)<v.ai));lastAi=v.ai;}
      $('ai-status').textContent=v.paused?'잠시 멈춤':v.phase==='reveal'?'정답 확인 중':v.ai===0?'서류 읽는 중...':v.ai===1?'정보 비교 중...':'마지막 확인 중...';
    }
    if(v.phase==='countdown'&&v.countdown!==lastCountdown){$('countdown-number').textContent=v.countdown;$('countdown-number').classList.remove('beat');void $('countdown-number').offsetWidth;$('countdown-number').classList.add('beat');if(!v.paused)sound(v.countdown===1?740:520,.13,.06,'sine');lastCountdown=v.countdown;}
  }
  function confetti(){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    $('particles').innerHTML='';
    for(let i=0;i<42;i++){const p=document.createElement('i');p.className='particle';p.style.cssText=`--x:${8+Math.random()*84}%;--duration:${2.5+Math.random()*1.8}s;--delay:${Math.random()*.5}s;--drift:${-140+Math.random()*280}px;--spin:${Math.random()*720}deg`;p.addEventListener('animationend',()=>p.remove(),{once:true});$('particles').append(p);}
  }
  function practiceClick(id){unlockAudio();practice.has(id)?practice.delete(id):practice.add(id);for(const key of ['a','b'])$('practice-'+key).classList.toggle('chosen',practice.has(key));$('practice-feedback').textContent=practice.size===2?'맞아요! 이 두 날짜처럼, 본 게임에서는 단서 3개를 찾아요.':practice.size===1?'좋아요. 나머지 날짜도 눌러보세요.':'두 곳을 누르면 한 문제 완료.';sound(practice.size===2?784:440,.08,.03);}
  function ranking(){
    const results=store.getState().results;
    $('ranking-list').innerHTML=['normal','easy','hard'].map(level=>{const rows=E.rank(results.filter(r=>r.difficulty===level)).slice(0,5);if(!rows.length)return '';return `<h3 style="font-size:11px;color:#879771;margin:22px 0 8px">${{normal:'보통 · 45초',easy:'여유롭게 · 60초',hard:'빠르게 · 32초'}[level]}</h3>`+rows.map((r,i)=>`<div class="ranking-row"><span class="place">${String(i+1).padStart(2,'0')}</span><span class="rank-name">${esc(r.name)} <small>${r.won?'WIN':''}</small></span><b>${r.score.toLocaleString()}</b></div>`).join('');}).join('')||'<p class="rank-empty">첫 번째 기록의 주인공이 되어보세요.</p>';
    $('ranking-dialog').showModal();
  }
  async function fullscreen(){try{const screen=kiosk?parent.document:document;if(screen.fullscreenElement)await screen.exitFullscreen();else await screen.documentElement.requestFullscreen();}catch(_){$('footer-note').textContent='브라우저 메뉴에서 전체화면을 켤 수 있어요.';}}
  $('fullscreen').innerHTML=icons.fullscreen;$('fullscreen').addEventListener('click',fullscreen);
  if (!kiosk) $('home-mark').addEventListener('click',event=>{event.preventDefault();localScene='home';dispatch({type:'reset'});});
  $('sound-toggle').addEventListener('click',toggleSound);updateSound();
  $('challenge').addEventListener('click',()=>{unlockAudio();practice.clear();for(const key of ['a','b'])$('practice-'+key).classList.remove('chosen');$('practice-feedback').textContent='두 곳을 누르면 한 문제 완료.';localScene='tutorial';render(E.view(store.getState(),Date.now()));});
  $('back-home').addEventListener('click',()=>{localScene='home';render(E.view(store.getState(),Date.now()));});
  $('practice-a').addEventListener('click',()=>practiceClick('a'));$('practice-b').addEventListener('click',()=>practiceClick('b'));
  $('start-race').addEventListener('click',startRace);
  $('result-home').addEventListener('click',async () => {
    await dispatch({type:'reset'});
    if (kiosk) window.parent.postMessage({aimsKiosk:'home'}, location.origin);
  });
  $('pause-control').addEventListener('click',()=>dispatch({type:'pause'}));$('resume').addEventListener('click',()=>{unlockAudio();dispatch({type:'pause'});});
  $('hint-btn').addEventListener('click',()=>{const v=E.view(store.getState(),Date.now());dispatch({type:'hint',round:v.round,session:v.session});});
  $('show-ranking')?.addEventListener('click',ranking);$('close-ranking').addEventListener('click',()=>$('ranking-dialog').close());
  $('ranking-dialog').addEventListener('click',e=>{if(e.target===$('ranking-dialog')){const b=e.target.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)e.target.close();}});
  window.addEventListener('keydown',e=>{
    if(e.target.closest('input,select,textarea')||e.repeat||$('ranking-dialog').open)return;
    if(e.key.toLowerCase()==='f'){e.preventDefault();fullscreen();}
    if(e.key.toLowerCase()==='m')toggleSound();
    if(e.code==='Space'&&!e.target.closest('button,a,[role="button"]')){e.preventDefault();unlockAudio();const s=store.getState();if(['playing','countdown','reveal'].includes(s.phase))dispatch({type:'pause'});else if(s.phase==='finished'){if(!new URLSearchParams(location.search).has('kiosk'))startRace();}else if(localScene==='tutorial')startRace();else $('challenge').click();}
  });
  $('documents').addEventListener('receiptphotolayout',scheduleConnection);
  window.addEventListener('resize',scheduleConnection);
  window.addEventListener('storage',event=>{if(event.key==='aims-arena-muted'){muted=event.newValue==='true';updateSound();}});
  $('challenge').disabled = false;
  store.subscribe(state=>render(E.view(state,Date.now())));
  function frame(time){
    const raw=store.getState(), v=E.view(raw,Date.now());
    const wanted=v.phase==='idle'?localScene:v.phase==='finished'?'result':'arena';
    if(v.phase!==raw.phase||wanted!==renderedScene||renderedDoc!==v.session+'-'+v.round&&wanted==='arena')render(v);
    clock(v);
    if(time-lastTick>100&&!tickBusy&&['countdown','playing','reveal'].includes(raw.phase)&&!raw.paused){lastTick=time;tickBusy=true;store.dispatch({type:'tick',session:raw.session}).finally(()=>{tickBusy=false;});}
    frameId=requestAnimationFrame(frame);
  }
  frameId=requestAnimationFrame(frame);
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frameId);cancelAnimationFrame(connectionFrame);connectionFrame=0;}, {once:true});
  // The store survives a reload. A page returning from bfcache resumes rendering.
  window.addEventListener('pageshow',event=>{if(event.persisted){cancelAnimationFrame(frameId);frameId=requestAnimationFrame(frame);}});
})();
