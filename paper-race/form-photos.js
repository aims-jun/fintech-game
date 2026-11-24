/* Source-based claim and itemized-expense photographs with live fictional fields. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AIMS_FORM_PHOTOS = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const PROFILES = Object.freeze({
    claim: Object.freeze({type:'claim', width:1055, height:1491, asset:'assets/claim-form-photo.png', label:'청구서'}),
    detail: Object.freeze({type:'detail', width:1536, height:1024, asset:'assets/detail-form-photo.png', label:'세부내역서'})
  });
  const rowsOf = doc => Array.isArray(doc?.rows) ? doc.rows : [];
  const supports = doc => !!PROFILES[doc?.kind];
  const profileFor = doc => PROFILES[doc?.kind] || null;
  function category(value) {
    if (/영상\s*사본|제증명|증명|사본료/.test(value)) return '제증명수수료';
    if (/치료\s*재료|재료대|재료/.test(value)) return '치료재료대';
    if (/물리|재활/.test(value)) return '재활 및 물리치료료';
    if (/영상|촬영|판독|X선/.test(value)) return '영상진단료';
    if (/치료|처치|드레싱/.test(value)) return '처치 및 수술료';
    if (/진찰/.test(value)) return '진찰료';
    if (/검사|검체/.test(value)) return '검사료';
    return '기타';
  }
  function render(doc, H) {
    const profile = profileFor(doc);
    if (!profile) throw new Error('Unsupported photographed form');
    const rows = rowsOf(doc), used = new Set(), parts = [];
    const token = String(doc.serial || '000001').replace(/[^a-zA-Z0-9]/g, '').slice(-7).padStart(7, '0');
    const pick = expression => rows.find(row => !used.has(row.id) && expression.test(String(row.label).replace(/\s/g, '')));
    const role = (suffix, expression) => rows.find(row => !used.has(row.id) && String(row.id).endsWith('-' + suffix)) || (expression && pick(expression));
    function boxStyle(box) {
      const [x,y,width,height] = box;
      return `left:${x/profile.width*100}%;top:${y/profile.height*100}%;width:${width/profile.width*100}%;height:${height/profile.height*100}%;`;
    }
    function dataAttributes(data) {
      return Object.entries(data).map(([key,value]) => ` data-${key}="${H.escape(value)}"`).join('');
    }
    function field(slot, row, box, options = {}) {
      if (!row) return;
      if (used.has(row.id)) throw new Error('Repeated form photo field: ' + row.id);
      used.add(row.id);
      const [x,y,width,height] = box;
      const alignment = options.align === 'right' ? ' photo-money' : options.align === 'left' ? ' photo-text' : '';
      const attrs = dataAttributes({'photo-slot':slot, x,y,width,height, ...(options.data || {})});
      parts.push(`<div class="photo-field${alignment}"${attrs} style="${boxStyle(box)}--photo-value:${options.size || 28}px"><div class="photo-cell">${H.field(row)}</div></div>`);
    }
    function context(slot, label, value, box, options) {
      field(slot, H.context(slot, label, value), box, options);
    }
    function label(text, box, options = {}) {
      const attrs = dataAttributes(options.data || {});
      parts.push(`<span class="photo-printed-label form-photo-label${options.cover ? ' form-label-replacement' : ''}${options.left ? ' form-label-left' : ''}${options.wrap ? ' form-label-wrap' : ''}"${attrs} style="${boxStyle(box)}--photo-label-size:${options.size || 24}px">${H.escape(text)}</span>`);
    }
    if (profile.type === 'claim') {
      const legacy = !rows.some(row => row.zone);
      const section = name => ({'form-section':name});
      const left = name => ({align:'left', size:31, data:section(name)});
      field('insured-name', role(legacy?'person':'insured-name',/^(피보험자|환자성명|성명|이름)$/), [217,224,296,39], left('identity'));
      context('birth','생년월일','••••.••.••',[693,224,300,39],left('identity'));
      context('telephone','연락처','010-****-****',[217,279,296,39],left('identity'));
      context('relation','청구인 관계','본인',[693,279,300,39],left('identity'));
      context('address','주소','가상시 가람로 26',[217,333,776,39],left('identity'));
      context('contact-method','안내 방법','문자메시지',[217,388,776,39],left('identity'));
      field('claim-type',legacy?pick(/^청구구분$/):role('claim-type',/^청구구분$/),[225,524,767,37],left('incident'));
      field('visit-kind',role(legacy?'type':'visit-kind',/^진료구분$|^조제구분$/),[225,577,767,37],left('incident'));
      field('visit-date',role(legacy?'date':'visit-date',/^진료일$|^조제일$/),[225,630,767,37],left('incident'));
      field('provider',role(legacy?'hospital':'provider',/의료기관|약국명/),[225,682,767,37],left('incident'));
      label(doc.pharmacy ? '처방 조제 관련 서류를 첨부하여 보험금을 청구합니다.' : '통원 진료 관련 서류를 첨부하여 보험금을 청구합니다.',[227,741,759,90],{left:true,size:25,data:section('incident')});
      const filingType = role('filing-type',/^청구유형$/);
      if (filingType) {
        label('청구 유형',[62,854,143,39],{size:26,cover:true});
        field('filing-type',filingType,[225,858,767,37],left('incident'));
      } else field('total',role('total',/청구금액|총액/),[225,858,767,37],left('incident'));
      label(doc.pharmacy ? '약제비 계산서·영수증' : '진료비 영수증 · 진료확인서',[227,911,759,37],{left:true,size:25,data:section('incident')});
      context('payee','수령인','피보험자와 동일',[224,1055,291,38],{align:'left',size:28,data:section('payment')});
      context('payee-relation','수령인과 관계','본인',[691,1055,301,38],left('payment'));
      field('claim-date',role(legacy?'issued':'claim-date',/^청구일$|^작성일$/),[204,1308,224,42],{align:'left',size:29,data:section('confirmation')});
      const claimant = role(legacy?'name':'claimant',/^청구인$/);
      if (claimant) field('claimant',claimant,[583,1308,316,42],left('confirmation'));
      else context('signature-check','청구인 확인','본인 확인',[583,1308,316,42],left('confirmation'));
      if (doc.serial) label('접수번호 ' + doc.serial,[58,144,603,21],{left:true,size:18});
      if (doc.pharmacy) {
        label('2. 처방 조제 및 청구 내용',[51,465,750,39],{left:true,size:29,cover:true});
        label('조제 구분',[62,576,143,39],{size:26,cover:true});
        label('조제일',[62,629,143,39],{size:26,cover:true});
        label('약국명',[62,681,143,39],{size:26,cover:true});
      }
    } else {
      // Native column boundaries of the photographed 12-column ledger.
      const columns = [47,169,270,377,641,742,810,884,987,1120,1251,1383,1489];
      const cell = (column,line,inset=6) => [columns[column-1]+inset,351+(line-1)*43,columns[column]-columns[column-1]-inset*2,34];
      const name = role('patient',/^환자성명$|^피보험자$/), date = role('visit-date',/^진료일$|^진료기간$/);
      context('patient-no','환자등록번호','P-'+token,[58,174,220,37],{size:27,data:{'form-section':'identity'}});
      if (name) field('patient',name,[302,174,216,37],{size:29,data:{'form-section':'identity'}});
      if (date) field('visit-date',date,[541,174,215,37],{size:27,data:{'form-section':'identity'}});
      context('patient-kind','환자구분','외래',[1016,174,222,37],{size:29,data:{'form-section':'identity'}});
      const count = role('service-count',/^청구횟수$/), unit = role('unit-price',/해당항목단가/), lineAmount = role('line-amount',/해당항목금액/);
      const total = role('total',/진료비합계|환자부담총액/), issued = role('issued-date',/^발행일$|^발급일$/);
      const quantity = !!(count && unit && lineAmount);
      const originalRows = rows.filter(row => !used.has(row.id) && row !== total && row !== issued && row !== unit && row !== count);
      const services = quantity ? [lineAmount].concat(originalRows.filter(row => row !== lineAmount && row !== unit)) : originalRows;
      if (services.length > 6) throw new Error('The photographed detail form has six service rows');
      const totalCase = rows.some(row => /^total-(?:laboratory|imaging|treatment)-/.test(String(row.id)));
      services.forEach((row,index) => {
        const number = index + 1, primary = quantity && index === 0;
        const description = primary ? count.label : row.label;
        const code = (primary ? count.code : row.code) || '—';
        const nonbenefit = row.costBasis === 'nonbenefit' || (primary && doc.quantityBasis === 'nonbenefit') || (totalCase && index >= 2);
        const amountColumn = nonbenefit ? 12 : 9;
        const rowData = {line:number, category:category(description)};
        label(category(description),cell(1,number),{size:16,wrap:true,data:{...rowData,column:1}});
        label('〃',cell(2,number),{size:24,data:{...rowData,column:2}});
        label(code,cell(3,number),{size:23,data:{...rowData,column:3}});
        label(description,cell(4,number),{left:true,size:24,data:{...rowData,column:4}});
        if (primary) {
          field('unit-price',unit,cell(5,number),{align:'right',size:23,data:{...rowData,column:5}});
          field('service-count',count,cell(6,number),{size:25,data:{...rowData,column:6}});
        } else label(row.quantity || '1회',cell(6,number),{size:24,data:{...rowData,column:6}});
        label('1',cell(7,number),{size:24,data:{...rowData,column:7}});
        field(primary ? 'line-amount' : 'service-'+number,row,cell(amountColumn,number),{align:'right',size:25,data:{...rowData,column:amountColumn,'cost-column':nonbenefit?'nonbenefit':'patient'}});
      });
      // A cost-share subtotal belongs to its cost-share column, never to the
      // gross charge column (which also includes the public insurer's share).
      const totalColumn = doc.amountBasis === 'nonbenefit' ? 12 : doc.amountBasis === 'benefitPatient' ? 9 : 8;
      const totalBox = [columns[totalColumn-1]+7,697,columns[totalColumn]-columns[totalColumn-1]-14,29];
      field('total',total,totalBox,{align:'right',size:22,data:{'form-section':'summary',column:totalColumn}});
      if (issued) field('issued-date',issued,[54,807,213,27],{size:24,data:{'form-section':'issuance'}});
      else {
        const issuedText = String(doc.footer || '').match(/발행일\s*([\d.]+)/)?.[1];
        if (issuedText) context('issued-date','발급일',issuedText,[54,807,213,27],{size:24,data:{'form-section':'issuance'}});
      }
      if (doc.issuer) context('provider','요양기관 명칭',doc.issuer,[285,807,645,27],{size:25,data:{'form-section':'issuance'}});
    }
    const missing = rows.filter(row => !used.has(row.id));
    if (missing.length) throw new Error('Unmapped form photo fields: '+missing.map(row=>row.id).join(', '));
    return `<div class="receipt-photo-viewport receipt-photo-${profile.type}" data-photo-width="${profile.width}" data-photo-height="${profile.height}" data-photo-label="${profile.label}" role="group" aria-label="${H.escape(doc.title || profile.label)}" tabindex="0"><div class="receipt-photo-canvas" data-photo-width="${profile.width}" data-photo-height="${profile.height}"><img class="receipt-photo-image" src="${profile.asset}" width="${profile.width}" height="${profile.height}" alt="" draggable="false"><div class="receipt-photo-overlay">${parts.join('')}<span class="form-fiction form-photo-fiction">전시용 가상 서식 · 실제 증빙으로 사용할 수 없습니다.</span></div></div></div>`;
  }
  return Object.freeze({supports,profileFor,render});
});
