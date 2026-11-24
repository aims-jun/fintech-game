/* Source-shaped printed forms with live, equally selectable fictional values. */
(function(root,factory){
 'use strict'; const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.AIMS_DOCUMENTS=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const kinds=new Set(['claim','receipt','detail','confirmation','record','history']);
 const sources={
  claim:{label:'삼성화재 보험금 청구서',url:'https://www.samsungfire.com/download/claim/claim_new.pdf'},
  receipt:{label:'국가법령정보센터 진료비 계산서·영수증',url:'https://www.law.go.kr/LSW/flDownload.do?flSeq=171466439'},
  detail:{label:'라이나생명 공개 진료비 세부산정내역 서식',url:'https://m.lina.co.kr/upload/docs/claim/exam/medical_expense_detail.pdf'}
 };
 const photoSources={
  hospital:{label:'국내 병원 영수증 발급 예시',url:'https://insmaster.co.kr/site_info/278'},
  pharmacy:{label:'국내 약국 영수증 발급 예시',url:'https://small.ssu.ac.kr/api/resource/download/7584'}
 };
 const formPhotoRenderer=()=>typeof module==='object'&&module.exports?require('./form-photos.js'):root.AIMS_FORM_PHOTOS;
 const photoRenderer=()=>typeof module==='object'&&module.exports?require('./receipt-photos.js'):root.AIMS_RECEIPT_PHOTOS;
 function sourceFor(docOrKind){
  const kind=typeof docOrKind==='string'?docOrKind:docOrKind?.kind;
  if(kind==='receipt'&&typeof docOrKind==='object'){
   const photos=photoRenderer();
   if(photos?.supports(docOrKind))return photoSources[photos.profileFor(docOrKind).type];
  }
  return sources[kind]||null;
 }
 function grouping(doc){
  const rows=Array.isArray(doc.rows)?doc.rows:[],g={identity:[],body:[],summary:[]};
  if(rows.some(r=>['identity','body','summary'].includes(r.zone))){
   rows.forEach(r=>g[Object.hasOwn(g,r.zone)?r.zone:'body'].push(r));
  }else{
   rows.forEach(r=>{
    const label=String(r.label).replace(/\s/g,'');
    if(/^(환자성명|피보험자|성명|진료일)$/.test(label))g.identity.push(r);
    else if(/(진료비합계|총수납금액|청구금액|확인항목수)$/.test(label))g.summary.push(r);
    else g.body.push(r);
   });
  }
  return g;
 }
 function render(doc,options={}){
  const kind=kinds.has(doc.kind)?doc.kind:'claim',mode=options.mode==='operator'?'operator':'player';
  const side=options.side===1?'오른쪽':'왼쪽',groups=grouping(doc),used=new Set();
  const rows=Array.isArray(doc.rows)?doc.rows:[];
  const prefix=String(rows[0]?.id||doc.serial||'form');
  const token=String(doc.serial||'000001').replace(/[^a-zA-Z0-9]/g,'').slice(-6).padStart(6,'0');
  let ordinal=0;
  const context=(role,label,value)=>({id:prefix+'-ctx-'+String(role).replace(/[^a-zA-Z0-9_-]/g,'_'),label,value,zone:'context'});
  function field(row){
   if(!row)return '<span class="print-empty">—</span>';
   if(used.has(row.id))throw new Error('Repeated document field: '+row.id);
   used.add(row.id);ordinal++;
   const display=(kind==='receipt'||kind==='detail')&&/^[0-9,]+원$/.test(String(row.value))?String(row.value).slice(0,-1):row.value;
   const aria=escape(side+' '+ordinal+' '+String(row.label??'')+' '+String(row.value??''));
   const attrs=`data-field="${escape(row.id)}" data-value="${escape(row.value)}" aria-label="${aria}" aria-pressed="false"`;
   if(mode==='operator')return `<div class="document-row print-field"><button class="manual-field" type="button" ${attrs} data-session="${escape(options.session??'')}" data-round="${escape(options.round??0)}" disabled><span class="manual-label field-description">${escape(row.label)}</span><span class="manual-value">${escape(display)}</span></button></div>`;
   return `<div class="document-row print-field"><span class="field-label field-description">${escape(row.label)}</span><button class="field-value" type="button" ${attrs}>${escape(display)}</button></div>`;
  }
  const original=(pattern)=>rows.find(row=>!used.has(row.id)&&pattern.test(String(row.label).replace(/\s/g,'')));
  const cells=(row,span=1)=>`<td${span>1?` colspan="${span}"`:''}>${field(row)}</td>`;
  const blank=(span=1)=>`<td class="blank-cell"${span>1?` colspan="${span}"`:''}>&nbsp;</td>`;
  const table=(name,widths,body,head='')=>`<table class="print-table ${name}"><colgroup>${widths.map(w=>`<col style="width:${w}%">`).join('')}</colgroup>${head?`<thead>${head}</thead>`:''}<tbody>${body}</tbody></table>`;
  const cap=(n,title)=>`<h3 class="print-section-title"><span>${n}.</span> ${title}</h3>`;
  function patientBand(){
   const name=groups.identity.find(r=>/성명|피보험자|이름/.test(r.label));
   const date=groups.identity.find(r=>r!==name);
   const headers=['환자등록번호',name?.label||'환자 성명',date?.label||'진료기간','병실','환자구분','비고'];
   let body='<tr>'+cells(context('patient-no','환자등록번호','P-'+token))+cells(name)+cells(date)+blank()+cells(context('patient-kind','환자구분','외래'))+blank()+'</tr>';
   return table('print-patient-band',[18,17,24,10,17,14],body,'<tr>'+headers.map(x=>'<th scope="col">'+escape(x)+'</th>').join('')+'</tr>');
  }
  const H={escape,field,context,groups,patientBand,peer:options.peer};
  function remainingTable(){
   const rest=rows.filter(r=>!used.has(r.id));
   if(!rest.length)return '';
   return table('print-supplement',[25,75],rest.map(r=>`<tr><th scope="row">${escape(r.label)}</th>${cells(r)}</tr>`).join(''));
  }
  function renderClaim(){
   const name=original(/피보험자|성명|이름/),claimType=original(/청구구분/),visit=original(/^(진료일|조제일)$/),provider=original(/의료기관|약국명/),visitKind=original(/진료구분|조제구분/),claimDate=original(/청구일|작성일/),total=original(/청구금액|총액/);
   const visitLabel=doc.pharmacy?'조제일':'진료일',providerLabel=doc.pharmacy?'약국명':'의료기관';
   const visitKindLabel=doc.pharmacy?'조제 구분':'진료 구분';
   const narrative=doc.pharmacy?'처방 조제 관련 서류를 첨부하여 보험금을 청구합니다.':'통원 진료 관련 서류를 첨부하여 보험금을 청구합니다.';
   const targetType=claimType?cells(claimType,2):cells(context('claim-kind','청구 구분','통원'),2);
   const person=table('claim-person-table',[14,20,15,19,14,18],
    `<tr><th scope="row">피보험자</th>${cells(name)}<th scope="row">생년월일</th>${cells(context('birth','생년월일','••••.••.••'))}<th scope="row">성별</th>${blank()}</tr>`+
    `<tr><th scope="row">청구인 관계</th>${cells(context('relation','청구인 관계','본인'))}<th scope="row">연락처</th>${cells(context('telephone','연락처','010-****-****'),3)}</tr>`+
    `<tr><th scope="row">주소</th>${blank(5)}</tr>`+
    `<tr><th scope="row">안내 방법</th><td colspan="5" class="print-choices">□ 문자　 □ 전화　 □ 전자우편　 □ 우편</td></tr>`);
   const incident=table('claim-incident-table',[14,20,15,19,14,18],
    `<tr><th scope="row">청구 구분</th>${targetType}<th scope="row">${visitKindLabel}</th>${cells(visitKind,2)}</tr>`+
    `<tr><th scope="row">${visitLabel}</th>${cells(visit,2)}<th scope="row">${providerLabel}</th>${cells(provider,2)}</tr>`+
    `<tr class="narrative-row"><th scope="row">청구 내용</th><td colspan="5" class="narrative-entry">${narrative}</td></tr>`+
    `<tr><th scope="row">청구 금액</th>${cells(total,2)}<th scope="row">첨부 서류</th><td colspan="2" class="print-choices">□ 영수증　 □ 확인서</td></tr>`);
   const payment=table('claim-payment-table',[14,20,15,19,14,18],
    `<tr><th scope="row">수령인</th>${cells(context('payee','수령인','피보험자와 동일'),2)}<th scope="row">관계</th>${cells(context('payee-relation','수령인과 관계','본인'),2)}</tr>`+
    `<tr><th scope="row">은행</th>${blank()}<th scope="row">계좌번호</th>${blank(3)}</tr>`);
   const confirm=table('claim-sign-table',[14,20,15,19,14,18],
    `<tr><th scope="row">청구일</th>${cells(claimDate,2)}<th scope="row">청구인</th><td colspan="2" class="signature-blank">________________ (서명)</td></tr>`);
   return `<div class="claim-identity">${cap(1,'인적 사항 및 연락처')}${person}</div><div class="claim-incident">${cap(2,doc.pharmacy?'처방 조제 및 청구 내용':'사고·진료 및 청구 내용')}${incident}</div><div class="claim-payment">${cap(3,'보험금 수령 계좌')}${payment}</div><div class="claim-confirmation">${cap(4,'확인 및 서명')}<p class="claim-confirm-text">기재한 내용과 첨부 서류를 확인하였습니다. 수령 계좌는 청구인과의 관계를 확인한 후 기재하며, 서명이 필요한 칸은 작성자가 직접 확인합니다.</p>${confirm}</div>`;
  }
  function renderConfirmation(){
   const provider=original(/의료기관/),visitKind=original(/진료구분/),department=original(/확인부서/),issued=original(/발행일|발급일/),count=original(/방문횟수/);
   const basic=patientBand();
   const detail=table('certificate-table',[19,31,19,31],
    `<tr><th scope="row">주소</th>${blank(3)}</tr>`+
    `<tr><th scope="row">진료 구분</th>${cells(visitKind)}<th scope="row">진료 부서</th>${cells(department)}</tr>`+
    `<tr><th scope="row">의료기관</th>${cells(provider)}<th scope="row">방문 횟수</th>${cells(count)}</tr>`+
    `<tr><th scope="row">확인 내용</th><td colspan="3" class="certificate-description">위 환자는 본 기관을 방문하여 진료를 받은 사실이 있습니다.</td></tr>`+
    `<tr><th scope="row">진단명</th>${blank(3)}</tr>`+
    `<tr><th scope="row">용도</th>${cells(context('purpose','용도','보험회사 제출용'),3)}</tr>`+
    `<tr><th scope="row">비고</th>${blank(3)}</tr>`);
   const issue=table('certificate-issue',[24,31,20,25],`<tr><th scope="row">발급일</th>${cells(issued)}<th scope="row">발급 담당</th><td class="signature-blank">________ (인)</td></tr>`);
   return `<div class="certificate-identity">${basic}</div><div class="certificate-record">${detail}</div><div class="certificate-declaration"><p>위와 같이 진료 사실을 확인합니다.</p>${issue}<div class="institution-signature"><span>${escape(doc.issuer)}</span><i class="print-seal" aria-hidden="true">발급<br>확인</i></div></div>`;
  }
  function renderRecord(){
   const basic=patientBand();
   const events=groups.body.filter(r=>r.code||/검사|촬영|치료/.test(r.label)&&!/(기록|부서)/.test(r.label));
   const mainRows=events.map((row,i)=>{
    const metadata=[row.quantity,row.unit].filter(Boolean).join(' · ');
    return `<tr><td>${String(i+1).padStart(2,'0')}</td><td>${escape(row.code||'—')}</td><td class="record-item-name">${escape(row.label)}${metadata?`<small>${escape(metadata)}</small>`:''}</td>${cells(row)}${cells(context('record-status-'+i,'확인 상태','등록'))}</tr>`;
   });
   while(mainRows.length<5)mainRows.push('<tr class="empty-log-row"><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>');
   const eventsTable=table('clinical-events',[7,15,35,28,15],mainRows.join(''),'<tr><th>순번</th><th>관리코드</th><th>시행 항목 및 시각</th><th>횟수·기록</th><th>확인</th></tr>');
   const other=rows.filter(r=>!used.has(r.id));
   const facts=table('record-facts',[25,75],other.map(r=>`<tr><th scope="row">${escape(r.label)}</th>${cells(r)}</tr>`).join(''));
   return `${basic}<h3 class="print-section-title">시행 및 처치 기록</h3>${eventsTable}${facts}<div class="record-verification"><span>작성 부서 확인</span><span>담당자 __________________ (서명 또는 인)</span></div>`;
  }
  function renderHistory(){
   const basic=patientBand(),body=groups.body;
   const facts=table('history-registration',[22,78],body.map(r=>`<tr><th scope="row">${escape(r.label)}</th>${cells(r)}</tr>`).join(''));
   const attachments=table('history-file-list',[8,42,24,26],
    `<tr><td>1</td>${cells(context('file-name','서류 종류',doc.pharmacy?'약제비 계산서·영수증':'진료비 계산서·영수증'))}${cells(context('file-format','파일 구분','전자문서'))}${cells(context('file-check','서류 등록','등록됨'))}</tr>`+
    '<tr class="empty-log-row"><td>2</td><td></td><td></td><td></td></tr>',
    '<tr><th>순번</th><th>등록 서류</th><th>구분</th><th>상태</th></tr>');
   const summary=table('history-total',[35,65],groups.summary.map(r=>`<tr><th scope="row">${escape(r.label)}</th>${cells(r)}</tr>`).join(''));
   return `${basic}<h3 class="print-section-title">접수 기본사항</h3>${facts}<h3 class="print-section-title">등록 서류 목록</h3>${attachments}${summary}<div class="archive-signature">접수내역 조회 확인　 담당자 __________________ (인)</div>`;
  }
  let content;
  const formPhotos=kind==='claim'||kind==='detail'?formPhotoRenderer():null;
  if(formPhotos?.supports(doc)){
   content=formPhotos.render(doc,H);
   const missing=rows.filter(row=>!used.has(row.id));
   if(missing.length)throw new Error('Unrendered form photo fields: '+missing.map(row=>row.id).join(', '));
   const source=sourceFor(doc);
   return `<article class="${mode==='operator'?'mini-document':'paper'} document-v4 doc-${kind} photo-document photo-document-form photo-document-${kind}" data-kind="${kind}" data-form-type="${kind}" data-source="${escape(source.label)}" aria-label="${escape(side+' '+String(doc.title||''))}">${content}</article>`;
  }
  const photos=kind==='receipt'?photoRenderer():null;
  if(photos?.supports(doc)){
   content=photos.receipt(doc,H);
   const missing=rows.filter(row=>!used.has(row.id));
   if(missing.length)throw new Error('Unrendered photo receipt fields: '+missing.map(row=>row.id).join(', '));
   const source=sourceFor(doc),profile=photos.profileFor(doc);
   return `<article class="${mode==='operator'?'mini-document':'paper'} document-v4 doc-receipt photo-document photo-document-${profile.type}" data-kind="receipt" data-receipt-type="${profile.type}" data-source="${escape(source.label)}" aria-label="${escape(side+' '+String(doc.title||''))}">${content}</article>`;
  }
  if(kind==='receipt'||kind==='detail'){
   const hospital=typeof module==='object'&&module.exports?require('./hospital-forms.js'):root.AIMS_HOSPITAL_FORMS;
   if(!hospital)throw new Error('Load hospital-forms.js before documents.js');
   content=hospital[kind](doc,H);
  }else if(kind==='claim')content=renderClaim();
  else if(kind==='confirmation')content=renderConfirmation();
  else if(kind==='record')content=renderRecord();
  else content=renderHistory();
  content+=remainingTable();
  const cleanFooter=String(doc.footer||'').replace(/(?:\s*·\s*)?체험용 가상 문서(?:\s*·\s*실제 진료·청구에 사용할 수 없습니다\.)?/g,'').trim();
  const signature=String(doc.signature||'').replace(/\s*\(직인 생략\)\s*$/,'');
  const subtitle=String(doc.subtitle||'').replace(/\s*\/\s*대조용 서류$/,'');
  const source=sourceFor(kind);
  const title=kind==='history'&&doc.pharmacy&&!String(doc.title||'').includes('약제비')?'약제비 청구 접수 내역':doc.title;
  const head=`<header class="print-heading"><div class="print-meta"><span>${escape(kind==='claim'?doc.issuer:'문서번호 '+String(doc.serial||''))}</span><span>${escape(doc.copyLabel==='체험용'?'제출용':doc.copyLabel||'보관용')}</span></div><h2>${escape(title)}</h2><div class="print-subline"><span>${escape(subtitle)}</span><span>${escape(kind==='claim'?'문서번호 '+String(doc.serial||''):doc.section||'')}</span></div></header>`;
  const foot=`<footer class="print-footer"><div class="print-footer-note"><span>${escape(cleanFooter)}</span><span>${escape(signature)}</span></div><div class="print-page-line"><small class="form-fiction">전시용 가상 서식 · 실제 증빙으로 사용할 수 없습니다.</small><span>1 / 1</span></div></footer>`;
  // A printed report is measured as one sheet. Tables never borrow the full
  // viewport height independently from their following rows or footer.
  const sheetLabel={confirmation:'확인서',record:'시행기록',history:'접수내역서',receipt:'영수증',claim:'청구서',detail:'세부내역서'}[kind];
  const fitted=`<div class="receipt-photo-viewport printed-document-viewport" data-photo-width="800" data-photo-height="1000" data-photo-label="${sheetLabel}" role="group" aria-label="${escape(doc.title||sheetLabel)}" tabindex="0"><div class="receipt-photo-canvas" data-photo-width="800" data-photo-height="1000"><div class="printed-sheet" data-print-sheet>${head}<div class="print-content">${content}</div>${foot}</div></div></div>`;
  return `<article class="${mode==='operator'?'mini-document':'paper'} document-v4 doc-${kind} printed-document" data-kind="${kind}"${source?` data-source="${escape(source.label)}"`:''} aria-label="${escape(side+' '+String(doc.title||''))}">${fitted}</article>`;
 }
 const mountPhotos=container=>photoRenderer()?.mount(container);
 return Object.freeze({render,escape,sourceFor,mountPhotos});
});
