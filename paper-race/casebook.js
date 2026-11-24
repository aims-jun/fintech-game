/* Fictional exhibition documents. Historical books stay frozen; book3 compares like-for-like records. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  root.AIMS_CASEBOOK = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const DAY = 86400000;
  const GROUPS = ['easy', 'compare', 'review'];
  const PROFILES = [
    { name: '홍길동', alternate: '김철수', hospital: '가람빛의원' },
    { name: '김철수', alternate: '홍길동', hospital: '새봄나무의원' },
    { name: '홍길동', alternate: '김철수', hospital: '가람빛의원' },
    { name: '김철수', alternate: '홍길동', hospital: '새봄나무의원' }
  ];

  // Catalog entries differ in visit context and document content, not just names.
  const SCENARIOS = [
    { id: 'date-outpatient', type: 'date', group: 'easy', title: '외래 진료 날짜가 같을까?',
      visitKind: '외래 진료', claimType: '질병 · 통원', department: '가정의학과', dateOffset: 1 },
    { id: 'date-examination', type: 'date', group: 'easy', title: '검사받은 날을 확인해요.',
      visitKind: '검사 방문', claimType: '질병 · 검사', department: '검사실', dateOffset: -1 },
    { id: 'date-treatment', type: 'date', group: 'easy', title: '치료 방문일을 비교해요.',
      visitKind: '통원 치료', claimType: '상해 · 통원', department: '재활치료실', dateOffset: 2 },
    { id: 'name-outpatient', type: 'name', group: 'easy', title: '같은 분의 진료 서류일까?',
      visitKind: '외래 진료', claimType: '질병 · 통원', department: '가정의학과', confirmation: '통원 확인서' },
    { id: 'name-examination', type: 'name', group: 'easy', title: '검사 확인서의 이름은?',
      visitKind: '검사 방문', claimType: '질병 · 검사', department: '검사실', confirmation: '검사 방문 확인서' },
    { id: 'name-treatment', type: 'name', group: 'easy', title: '치료 확인서와 이름을 맞춰요.',
      visitKind: '통원 치료', claimType: '상해 · 통원', department: '재활치료실', confirmation: '치료 방문 확인서' },
    { id: 'total-laboratory', type: 'total', group: 'compare', title: '검사비 합계, 맞을까?',
      visitKind: '외래 검사', department: '검사실', items: [
        ['F101', '재진 진찰료', 12000], ['F211', '혈액검사', 15000],
        ['F212', '소변검사', 8000], ['F219', '검체 처리료', 3000]
      ] },
    { id: 'total-imaging', type: 'total', group: 'compare', title: '영상검사 수납금을 맞춰요.',
      visitKind: '영상검사', department: '영상검사실', items: [
        ['F102', '초진 진찰료', 17000], ['F301', 'X선 촬영', 23000],
        ['F309', '영상 판독료', 9000], ['F310', '영상 사본료', 4000]
      ] },
    { id: 'total-treatment', type: 'total', group: 'compare', title: '치료비 총액을 비교해요.',
      visitKind: '통원 치료', department: '재활치료실', items: [
        ['F101', '재진 진찰료', 12000], ['F401', '물리치료', 11000],
        ['F409', '치료 재료대', 6000], ['F410', '처치료', 8000]
      ] },
    { id: 'quantity-laboratory', type: 'quantity', group: 'compare', title: '검사 횟수가 서로 다르네?',
      visitKind: '외래 검사', department: '검사실', service: '혈액검사', code: 'F211', unitPrice: 12000, recordTitle: '검사 시행 확인서' },
    { id: 'quantity-imaging', type: 'quantity', group: 'compare', title: '촬영 횟수를 확인해요.',
      visitKind: '영상검사', department: '영상검사실', service: 'X선 촬영', code: 'F301', unitPrice: 22000, recordTitle: '촬영 시행 확인서' },
    { id: 'quantity-treatment', type: 'quantity', group: 'compare', title: '치료 횟수와 청구 횟수는?',
      visitKind: '통원 치료', department: '재활치료실', service: '물리치료', code: 'F401', unitPrice: 10000, recordTitle: '치료 시행 확인서' },
    { id: 'duplicate-laboratory', type: 'duplicate', group: 'review', title: '검사 항목이 두 줄?',
      visitKind: '외래 검사', department: '검사실', service: '혈액검사', code: 'F211', unitPrice: 11000,
      other: ['F212', '소변검사', 6000], recordTitle: '진료·검사 시행 기록' },
    { id: 'duplicate-imaging', type: 'duplicate', group: 'review', title: '같은 촬영이 반복됐을까?',
      visitKind: '영상검사', department: '영상검사실', service: 'X선 촬영', code: 'F301', unitPrice: 24000,
      other: ['F309', '영상 판독', 7000], recordTitle: '진료·촬영 시행 기록' },
    { id: 'duplicate-treatment', type: 'duplicate', group: 'review', title: '같은 시각의 치료 두 줄.',
      visitKind: '통원 치료', department: '재활치료실', service: '물리치료', code: 'F401', unitPrice: 10000,
      other: ['F410', '처치', 5000], recordTitle: '진료·치료 시행 기록' },
    { id: 'receipt-repeat-reissue', type: 'receipt-repeat', group: 'review', title: '재발급 영수증을 다시 접수?',
      visitKind: '외래 진료', department: '가정의학과', copyLabel: '재발급본', channel: '온라인 접수', status: '서류 접수 완료', reissued: true },
    { id: 'receipt-repeat-online', type: 'receipt-repeat', group: 'review', title: '온라인 접수 기록에도 있네?',
      visitKind: '검사 방문', department: '검사실', copyLabel: '제출용 사본', channel: '온라인 접수', status: '서류 확인 중' },
    { id: 'receipt-repeat-paper', type: 'receipt-repeat', group: 'review', title: '방문 접수 기록과 비교해요.',
      visitKind: '통원 치료', department: '재활치료실', copyLabel: '환자 보관용', channel: '방문 접수', status: '검토 대기' }
  ];

  // Keep the original array and its selection order frozen for stored book1 games.
  const PHARMACY_SCENARIOS = [
    { id: 'pharmacy-name', type: 'name', group: 'easy', title: '약제비 영수증의 이름은?',
      visitKind: '처방 조제', claimType: '질병 · 처방조제', department: '조제실', pharmacy: true },
    { id: 'pharmacy-total', type: 'total', group: 'compare', title: '약값 청구 금액을 맞춰요.',
      visitKind: '처방 조제', claimType: '질병 · 처방조제', department: '조제실', pharmacy: true },
    { id: 'pharmacy-receipt-repeat', type: 'receipt-repeat', group: 'review', title: '이 약제비 영수증, 처음 접수일까?',
      visitKind: '처방 조제', department: '조제실', copyLabel: '재발급본', channel: '온라인 접수',
      status: '서류 접수 완료', reissued: true, pharmacy: true }
  ];
  // Approved exhibition lineup: three easy + three compare + three review
  // families, with 21 individual visit scenarios. Historical books remain intact.
  const NEW_REVIEW_SCENARIOS = [
    { id:'provider-outpatient', type:'provider', group:'review', title:'병원 이름 비교', visitKind:'외래 진료', claimType:'질병 · 통원', department:'가정의학과' },
    { id:'provider-imaging', type:'provider', group:'review', title:'검사받은 병원 확인', visitKind:'영상검사', claimType:'질병 · 검사', department:'영상검사실' },
    { id:'provider-treatment', type:'provider', group:'review', title:'치료받은 병원 확인', visitKind:'통원 치료', claimType:'상해 · 통원', department:'재활치료실' },
    { id:'input-date', type:'input-date', group:'review', title:'접수 진료일 대조', visitKind:'외래 진료', department:'가정의학과' },
    { id:'input-name', type:'input-name', group:'review', title:'접수 환자명 대조', visitKind:'검사 방문', department:'검사실' },
    { id:'input-total', type:'input-total', group:'review', title:'접수 수납금액 대조', visitKind:'통원 치료', department:'재활치료실' }
  ];
  const CURRENT_SCENARIOS = SCENARIOS.filter(value => value.group !== 'review').concat(NEW_REVIEW_SCENARIOS);
  const NEW_PHARMACY_SCENARIOS = PHARMACY_SCENARIOS.filter(value => value.id !== 'pharmacy-receipt-repeat').concat([
    { id:'pharmacy-date', type:'pharmacy-date', group:'review', title:'약국 조제일 비교', visitKind:'처방 조제', department:'조제실', pharmacy:true }
  ]);
  const NEW_ALL_SCENARIOS = CURRENT_SCENARIOS.concat(NEW_PHARMACY_SCENARIOS);
  const ALL_SCENARIOS = SCENARIOS.concat(PHARMACY_SCENARIOS);
  const catalog = Object.freeze(ALL_SCENARIOS.map(scenario => Object.freeze({
    id: scenario.id, type: scenario.type, group: scenario.group, title: scenario.title
  })));

  const LABELS = { date: '날짜', name: '이름', total: '금액', quantity: '횟수', duplicate: '항목 중복', 'receipt-repeat': '재접수' };
  const PROMPTS = {
    date: ['서로 맞지 않는 진료일 두 곳을 눌러주세요.', '청구서와 영수증에 적힌 진료일을 비교해보세요.'],
    name: ['서로 맞지 않는 이름 두 곳을 눌러주세요.', '청구서의 피보험자와 확인서의 환자 성명을 비교해보세요.'],
    total: ['서로 맞지 않는 총액 두 곳을 눌러주세요.', '세부내역의 진료비 합계와 영수증의 총 수납금액을 비교해보세요.'],
    quantity: ['횟수가 서로 맞지 않는 두 값을 눌러주세요.', '같은 항목과 시각의 청구 횟수와 시행 횟수를 비교해보세요.'],
    duplicate: ['왼쪽 서류에서 반복된 항목 두 줄을 눌러주세요.', '세부내역에서 항목·시각·금액이 모두 같은 두 줄을 찾아보세요.'],
    'receipt-repeat': ['같은 영수증인지 확인할 두 번호를 눌러주세요.', '이번 영수증과 기존 접수 내역의 영수증 번호를 비교해보세요.']
  };

  function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i++) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    value ^= value >>> 16;
    value = Math.imul(value, 0x85ebca6b);
    value ^= value >>> 13;
    value = Math.imul(value, 0xc2b2ae35);
    return (value ^ (value >>> 16)) >>> 0;
  }

  function seeded(seed) {
    let state = hash(seed);
    return function () {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function integer(random, start, end) { return start + Math.floor(random() * (end - start + 1)); }
  function choose(random, values) { return values[integer(random, 0, values.length - 1)]; }
  function money(value) { return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원'; }
  function date(at) {
    const value = new Date(at);
    return value.getUTCFullYear() + '.' + String(value.getUTCMonth() + 1).padStart(2, '0') + '.' + String(value.getUTCDate()).padStart(2, '0');
  }
  function time(minutes) { return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0'); }
  function shuffled(random, values) {
    const output = values.slice();
    for (let i = output.length - 1; i > 0; i--) {
      const j = integer(random, 0, i);
      const saved = output[i]; output[i] = output[j]; output[j] = saved;
    }
    return output;
  }

  function context(scenario, seed) {
    const random = seeded(seed + '|' + scenario.id);
    const profile = choose(random, PROFILES);
    const visitAt = Date.UTC(2026, 0, 5) + integer(random, 0, 300) * DAY;
    const token = hash(seed + '|' + scenario.id + '|document').toString(36).toUpperCase().padStart(7, '0');
    const total = integer(random, 30, 96) * 1000;
    return {
      random, profile, scenario, visitAt, visit: date(visitAt), issued: date(visitAt + 5 * DAY), claimDate: date(visitAt + 6 * DAY),
      total, benefit: integer(random, 10, 22) * 1000,
      id: scenario.id + '-' + token.toLowerCase(), token,
      visitContext: '진료 건 참조 V-' + token,
      startMinute: integer(random, 9, 13) * 60 + integer(random, 0, 2) * 10
    };
  }

  function row(ctx, kind, role, label, value, zone, extra) {
    return Object.assign({ id: ctx.id + '-' + kind + '-' + role, label, value, zone }, extra || {});
  }
  function identity(ctx, kind, second) {
    return [
      row(ctx, kind, 'patient', '환자 성명', ctx.profile.name, 'identity'),
      second || row(ctx, kind, 'visit-date', '진료일', ctx.visit, 'identity')
    ];
  }
  function document(ctx, kind, title, section, rows, extra) {
    const issuer = kind === 'claim' || kind === 'history' ? 'AIMS 체험보험' : ctx.profile.hospital;
    return Object.assign({
      kind, issuer, title, subtitle: ctx.scenario.visitKind + ' / 대조용 서류',
      serial: 'DOC-' + kind.toUpperCase().slice(0, 3) + '-' + ctx.token,
      section, rows, footer: '체험용 가상 문서 · 실제 진료·청구에 사용할 수 없습니다.',
      signature: kind === 'claim' ? '청구인 확인 __________________ (서명)' : issuer + ' (직인 생략)',
      copyLabel: '체험용', visitContext: ctx.visitContext
    }, extra || {});
  }
  function claim(ctx, insuredName, visitDate, total) {
    const kind = 'claim';
    return document(ctx, kind, '보험금 청구서', '진료 및 청구 사항', [
      row(ctx, kind, 'insured-name', '피보험자', insuredName, 'identity'),
      row(ctx, kind, 'claim-type', '청구 구분', ctx.scenario.claimType, 'identity'),
      row(ctx, kind, 'visit-date', '진료일', visitDate, 'body'),
      row(ctx, kind, 'provider', '의료기관', ctx.profile.hospital, 'body'),
      row(ctx, kind, 'visit-kind', '진료 구분', ctx.scenario.visitKind, 'body'),
      row(ctx, kind, 'claim-date', '청구일', ctx.claimDate, 'body'),
      row(ctx, kind, 'total', '청구 금액', money(total), 'summary')
    ], { subtitle: '질병·상해 / 통원 의료비', footer: '위 내용과 같이 보험금을 청구합니다. · 체험용 가상 문서', copyLabel: '접수용' });
  }
  function receipt(ctx, total, benefit, options) {
    options = options || {};
    const kind = 'receipt';
    const body = options.receiptId
      ? [row(ctx, kind, 'receipt-id', '영수증 번호', options.receiptId, 'body'),
        row(ctx, kind, 'benefit', '급여 본인부담', money(benefit), 'body'),
        row(ctx, kind, 'nonbenefit', '비급여', money(total - benefit), 'body'),
        row(ctx, kind, 'issued-date', '발행일', options.issued || ctx.issued, 'body')]
      : [row(ctx, kind, 'benefit', '급여 본인부담', money(benefit), 'body'),
        row(ctx, kind, 'nonbenefit', '비급여', money(total - benefit), 'body'),
        row(ctx, kind, 'provider', '의료기관', ctx.profile.hospital, 'body'),
        row(ctx, kind, 'issued-date', '발행일', ctx.issued, 'body')];
    return document(ctx, kind, '진료비 계산서·영수증', '진료 및 수납 내역', identity(ctx, kind).concat(body, [
      row(ctx, kind, 'total', '총 수납금액', money(total), 'summary')
    ]), {
      subtitle: ctx.scenario.visitKind + ' / 환자 부담금 기준', copyLabel: options.copyLabel || '환자 보관용',
      footer: '상기 금액을 정히 영수합니다. · 체험용 가상 문서'
    });
  }
  function detail(ctx, body, total, extra) {
    return document(ctx, 'detail', '진료비 세부산정내역', '환자 부담금 산정 내역', identity(ctx, 'detail').concat(body, [
      row(ctx, 'detail', 'total', '진료비 합계', money(total), 'summary')
    ]), Object.assign({
      tableHeading: ['진료 항목', '환자 부담금'], copyLabel: '세부내역',
      footer: '발행일 ' + ctx.issued + ' · 항목별 환자 부담금 기준 · 체험용 가상 문서'
    }, extra || {}));
  }
  function monetaryRow(ctx, index, item, price, at) {
    return row(ctx, 'detail', 'line-' + (index + 1), item[1] + (at ? ' · ' + at : ''), money(price), 'body', {
      code: item[0], quantity: '1회', unit: money(price)
    });
  }
  function evidenceId(doc, roleName) { return doc.rows.find(value => value.id.endsWith('-' + roleName)).id; }

  function makeDate(ctx) {
    const changedDate = date(ctx.visitAt + ctx.scenario.dateOffset * DAY);
    const docs = [claim(ctx, ctx.profile.name, changedDate, ctx.total), receipt(ctx, ctx.total, ctx.benefit)];
    return {
      docs, needs: [evidenceId(docs[0], 'visit-date'), evidenceId(docs[1], 'visit-date')],
      reveal: changedDate + ' ≠ ' + ctx.visit,
      explanation: '같은 진료 건의 진료일이 서로 달라요. 원본 진료 기록을 보고 어느 날짜가 맞는지 확인해야 해요.'
    };
  }
  function makeName(ctx) {
    const kind = 'confirmation';
    const confirmation = document(ctx, kind, ctx.scenario.confirmation, '방문 사실 확인', identity(ctx, kind).concat([
      row(ctx, kind, 'provider', '의료기관', ctx.profile.hospital, 'body'),
      row(ctx, kind, 'visit-kind', '진료 구분', ctx.scenario.visitKind, 'body'),
      row(ctx, kind, 'department', '확인 부서', ctx.scenario.department, 'body'),
      row(ctx, kind, 'issued-date', '발행일', ctx.issued, 'body'),
      row(ctx, kind, 'visit-count', '방문 횟수', '1회', 'summary')
    ]), { copyLabel: '확인용', footer: '위 방문 사실을 확인합니다. · 체험용 가상 문서' });
    const docs = [claim(ctx, ctx.profile.alternate, ctx.visit, ctx.total), confirmation];
    return {
      docs, needs: [evidenceId(docs[0], 'insured-name'), evidenceId(confirmation, 'patient')],
      reveal: ctx.profile.alternate + ' ≠ ' + ctx.profile.name,
      explanation: '청구서의 피보험자와 확인서의 환자 이름이 달라요. 같은 분의 서류인지 확인해야 해요.'
    };
  }
  function makeTotal(ctx) {
    const prices = ctx.scenario.items.map(item => item[2] + integer(ctx.random, 0, 8) * 500);
    const sum = prices.reduce((total, price) => total + price, 0);
    const total = sum + choose(ctx.random, [5000, 7000, 10000, 12000]);
    const detailDoc = detail(ctx, ctx.scenario.items.map((item, index) => monetaryRow(ctx, index, item, prices[index])), sum);
    const receiptDoc = receipt(ctx, total, prices[0] + prices[1]);
    return {
      docs: [detailDoc, receiptDoc], needs: [evidenceId(detailDoc, 'total'), evidenceId(receiptDoc, 'total')],
      reveal: money(sum) + ' ≠ ' + money(total),
      explanation: '세부내역의 항목 합계와 영수증 수납금액이 달라요. 같은 진료 건의 금액인지 확인해야 해요.'
    };
  }
  function makeQuantity(ctx) {
    const item = ctx.scenario.service + ' · ' + time(ctx.startMinute + 20);
    const unitPrice = ctx.scenario.unitPrice + integer(ctx.random, 0, 8) * 500;
    const otherAmount = integer(ctx.random, 14, 25) * 1000;
    const detailDoc = detail(ctx, [
      row(ctx, 'detail', 'service-count', item, '2회', 'body', { code: ctx.scenario.code }),
      row(ctx, 'detail', 'unit-price', '해당 항목 단가', money(unitPrice), 'body'),
      row(ctx, 'detail', 'line-amount', '해당 항목 금액', money(unitPrice * 2), 'body'),
      row(ctx, 'detail', 'other-amount', '그 밖의 진료비', money(otherAmount), 'body')
    ], unitPrice * 2 + otherAmount, { section: '항목별 청구 횟수', tableHeading: ['청구 항목', '횟수·금액'] });
    const kind = 'record';
    const recordDoc = document(ctx, kind, ctx.scenario.recordTitle, '시행 내역 확인', identity(ctx, kind).concat([
      row(ctx, kind, 'service-count', item, '1회', 'body', { code: ctx.scenario.code }),
      row(ctx, kind, 'record-kind', '기록 구분', '당일 시행 기록', 'body'),
      row(ctx, kind, 'additional', '추가 시행 기록', '없음', 'body'),
      row(ctx, kind, 'department', '확인 부서', ctx.scenario.department, 'body'),
      row(ctx, kind, 'issued-date', '발행일', ctx.issued, 'summary')
    ]), { tableHeading: ['시행 항목', '확인 횟수'], copyLabel: '대조용', footer: '등록된 시행 기록을 바탕으로 작성했습니다. · 체험용 가상 문서' });
    return {
      docs: [detailDoc, recordDoc], needs: [evidenceId(detailDoc, 'service-count'), evidenceId(recordDoc, 'service-count')],
      reveal: '청구 2회 ≠ 시행 1회',
      explanation: '같은 항목의 시행 기록과 청구 횟수가 달라요. 추가 시행이나 횟수 기재 오류가 있는지 확인해야 해요.'
    };
  }
  function makeDuplicate(ctx) {
    const fee = { item: ['F101', '재진 진찰료'], price: 16000 + integer(ctx.random, 0, 5) * 500, at: time(ctx.startMinute) };
    const service = { item: [ctx.scenario.code, ctx.scenario.service], price: ctx.scenario.unitPrice + integer(ctx.random, 0, 4) * 500, at: time(ctx.startMinute + 20) };
    const other = { item: ctx.scenario.other, price: ctx.scenario.other[2] + integer(ctx.random, 0, 4) * 500, at: time(ctx.startMinute + 40) };
    const entries = shuffled(ctx.random, [fee, service, other, service]);
    const body = entries.map((entry, index) => monetaryRow(ctx, index, entry.item, entry.price, entry.at));
    // Keep amounts in the selectable value only, uniformly across all four lines.
    body.forEach(value => { delete value.unit; });
    const detailDoc = detail(ctx, body, entries.reduce((sum, entry) => sum + entry.price, 0), { section: '진료 항목 및 시행 시각', tableHeading: ['진료 항목·시각', '환자 부담금'] });
    const kind = 'record';
    const recordRows = [fee, service, other].map((entry, index) =>
      row(ctx, kind, 'service-' + (index + 1), entry.item[1], entry.at + ' · 1회', 'body', { code: entry.item[0] })
    );
    recordRows.push(row(ctx, kind, 'additional', '추가 시행 기록', '없음', 'body'));
    recordRows.push(row(ctx, kind, 'confirmed-count', '확인 항목 수', '3건', 'summary'));
    const recordDoc = document(ctx, kind, ctx.scenario.recordTitle, '등록된 시행 내역', identity(ctx, kind).concat(recordRows), {
      tableHeading: ['시행 항목', '시각·횟수'], copyLabel: '대조용',
      footer: '발행일 ' + ctx.issued + ' · 등록된 시행 기록입니다. · 체험용 가상 문서'
    });
    return {
      docs: [detailDoc, recordDoc], needs: body.filter((_row, index) => entries[index] === service).map(value => value.id),
      reveal: ctx.scenario.service + ' · ' + service.at + ' → 두 줄 기록',
      explanation: '같은 항목과 시각이 세부내역에 두 줄로 적혀 있고, 시행 기록은 한 번이에요. 반복 시행이나 중복 기재인지 추가 확인이 필요해요.'
    };
  }
  function makeReceiptRepeat(ctx) {
    const receiptId = 'RCT-2026-' + hash(ctx.id + '|receipt').toString(36).toUpperCase().padStart(7, '0');
    const issued = date(ctx.visitAt + (ctx.scenario.reissued ? 5 : 1) * DAY);
    const receiptDoc = receipt(ctx, ctx.total, ctx.benefit, { receiptId, issued, copyLabel: ctx.scenario.copyLabel });
    const kind = 'history';
    const historyDoc = document(ctx, kind, '보험금 청구 접수 내역', '기존 접수 건 조회', identity(ctx, kind,
      row(ctx, kind, 'received-date', '기존 접수일', date(ctx.visitAt + 3 * DAY), 'identity')
    ).concat([
      row(ctx, kind, 'receipt-id', '영수증 번호', receiptId, 'body'),
      row(ctx, kind, 'provider', '의료기관', ctx.profile.hospital, 'body'),
      row(ctx, kind, 'received-status', '접수 상태', ctx.scenario.status, 'body'),
      row(ctx, kind, 'claim-date', '기존 청구일', date(ctx.visitAt + 2 * DAY), 'body'),
      row(ctx, kind, 'total', '접수된 영수 금액', money(ctx.total), 'summary')
    ]), {
      subtitle: ctx.scenario.channel + ' / 기존 제출 서류 조회', copyLabel: '접수 이력',
      footer: '기존 서류 접수 기록을 조회한 내역입니다. · 체험용 가상 문서', signature: '접수 담당 확인 (인)'
    });
    return {
      docs: [receiptDoc, historyDoc], needs: [evidenceId(receiptDoc, 'receipt-id'), evidenceId(historyDoc, 'receipt-id')],
      reveal: receiptId + ' → 기존 접수 내역에도 있음',
      explanation: '같은 영수증 번호가 기존 접수 내역에도 있어요. 이미 접수된 영수증인지 확인해야 해요.'
    };
  }

  function pharmacyContext(ctx) {
    const benefit = integer(ctx.random, 4, 14) * 1000;
    // Keep a positive fictional noncovered component so the target total is
    // not duplicated by the covered subtotal in the same receipt.
    const nonbenefit = integer(ctx.random, 1, 6) * 500;
    return Object.assign({}, ctx, {
      profile: Object.assign({}, ctx.profile, { hospital: ctx.profile.hospital.replace(/의원$/, '약국') }),
      total: benefit + nonbenefit, benefit,
      visitContext: '조제 건 참조 P-' + ctx.token
    });
  }

  function pharmacyDocument(doc) {
    doc.pharmacy = true;
    for (const value of doc.rows) {
      if (value.id.endsWith('-visit-date')) value.label = '조제일';
      if (value.id.endsWith('-provider')) value.label = '약국명';
    }
    if (doc.kind === 'receipt') {
      doc.receiptType = 'pharmacy';
      doc.title = '약제비 계산서·영수증';
      doc.subtitle = '처방 조제 / 환자 부담금 기준';
      doc.section = '조제 및 수납 내역';
    } else if (doc.kind === 'claim') {
      doc.subtitle = '질병·상해 / 처방 조제비';
      doc.section = '처방 조제 및 청구 사항';
    } else if (doc.kind === 'history') {
      doc.title = '약제비 청구 접수 내역';
    }
    return doc;
  }

  function makePharmacyName(source) {
    const ctx = pharmacyContext(source);
    const docs = [pharmacyDocument(claim(ctx, ctx.profile.alternate, ctx.visit, ctx.total)),
      pharmacyDocument(receipt(ctx, ctx.total, ctx.benefit))];
    return {
      docs, needs: [evidenceId(docs[0], 'insured-name'), evidenceId(docs[1], 'patient')],
      instruction: '서로 맞지 않는 이름 두 곳을 눌러주세요.',
      hint: '청구서의 피보험자와 약제비 영수증의 환자 성명을 비교해보세요.',
      reveal: ctx.profile.alternate + ' ≠ ' + ctx.profile.name,
      explanation: '청구서의 피보험자와 약제비 영수증의 환자 이름이 달라요. 같은 분의 조제 서류인지 확인해야 해요.'
    };
  }

  function makePharmacyTotal(source) {
    const ctx = pharmacyContext(source);
    const claimed = ctx.total + choose(ctx.random, [1000, 2000, 3000]);
    const docs = [pharmacyDocument(claim(ctx, ctx.profile.name, ctx.visit, claimed)),
      pharmacyDocument(receipt(ctx, ctx.total, ctx.benefit))];
    return {
      docs, needs: [evidenceId(docs[0], 'total'), evidenceId(docs[1], 'total')],
      instruction: '약제비 청구 금액과 납부 금액을 비교해보세요.',
      hint: '청구서의 청구 금액과 약제비 영수증의 총 수납금액을 확인해보세요.',
      reveal: money(claimed) + ' ≠ ' + money(ctx.total),
      explanation: '청구서에 적힌 약제비와 실제 납부한 금액이 달라요. 같은 조제 건의 환자 부담금으로 청구했는지 확인해야 해요.'
    };
  }

  function makePharmacyRepeat(source) {
    const ctx = pharmacyContext(source);
    const result = makeReceiptRepeat(ctx);
    result.docs.forEach(pharmacyDocument);
    return Object.assign(result, {
      instruction: '같은 영수증인지 확인할 두 번호를 눌러주세요.',
      hint: '이번 약제비 영수증과 기존 접수 내역의 영수증 번호를 비교해보세요.',
      explanation: '같은 약제비 영수증 번호가 기존 접수 내역에도 있어요. 이미 접수된 서류인지 확인해야 해요.'
    });
  }

  const BUILDERS = { date: makeDate, name: makeName, total: makeTotal, quantity: makeQuantity, duplicate: makeDuplicate, 'receipt-repeat': makeReceiptRepeat };
  const PHARMACY_BUILDERS = { name: makePharmacyName, total: makePharmacyTotal, 'receipt-repeat': makePharmacyRepeat };
  function generate(scenario, seed) {
    const ctx = context(scenario, seed);
    return Object.assign({
      id: ctx.id, templateId: scenario.id, type: scenario.type, group: scenario.group,
      label: LABELS[scenario.type], title: scenario.title,
      instruction: PROMPTS[scenario.type][0], hint: PROMPTS[scenario.type][1]
    }, (scenario.pharmacy ? PHARMACY_BUILDERS : BUILDERS)[scenario.type](ctx));
  }

  // New matches use explicit document meanings. Do not change the historical
  // builders above: an existing race must keep its selected evidence and score.
  const CURRENT_TITLES = {
    'total-laboratory': '두 서류의 비급여 합계가 같을까?',
    'total-imaging': '영상검사 비급여 합계를 맞춰요.',
    'total-treatment': '치료비의 비급여 합계를 비교해요.',
    'quantity-laboratory': '검사 횟수가 기록과 같을까?',
    'quantity-imaging': '촬영 횟수를 기록과 맞춰요.',
    'quantity-treatment': '치료 횟수가 기록과 같을까?',
    'pharmacy-total': '영수증 금액이 제대로 입력됐을까?'
  };
  const currentCatalog = Object.freeze(catalog.map(entry => Object.freeze(Object.assign({}, entry, {
    title: ({date:'진료일 비교',name:'환자 이름 비교',total:'비급여 합계 비교',quantity:'검사·치료 횟수 비교',duplicate:'동일 항목 두 줄 찾기','receipt-repeat':'영수증 접수 이력 확인'})[entry.type] || entry.title
  }))));
  const latestCatalog = Object.freeze(NEW_ALL_SCENARIOS.map(value => Object.freeze({
    id:value.id, type:value.type, group:value.group, title:value.title
  })));
  const byRole = (doc, role) => doc.rows.find(value => value.id.endsWith('-' + role));
  const numericAmount = value => Number(String(value).replace(/[^\d]/g, ''));

  function generateCurrent(scenario, seed) {
    const result = generate(scenario, seed);
    result.bookVersion = 3;
    result.title = CURRENT_TITLES[scenario.id] || result.title;

    if (scenario.id === 'pharmacy-total') {
      const oldClaim = result.docs[0], receiptDoc = result.docs[1];
      const token = String(receiptDoc.serial).replace(/[^a-zA-Z0-9]/g, '').slice(-7).padStart(7, '0');
      const receiptId = 'RC-' + token;
      const provider = byRole(receiptDoc, 'provider');
      // The record refers to this exact receipt, not an insurance payout.
      provider.id = provider.id.replace(/-provider$/, '-receipt-id');
      provider.label = '영수증 번호';
      provider.value = receiptId;
      const inputRow = (role, label, value, zone) => ({id: result.id + '-history-' + role, label, value, zone});
      const inputDoc = Object.assign({}, oldClaim, {
        kind: 'history', title: '약제비 서류 입력 내역', section: '영수증 입력값 대조',
        subtitle: '제출 영수증 / 접수 시 입력한 내용', serial: oldClaim.serial.replace('DOC-CLA-', 'DOC-HIS-'),
        copyLabel: '입력 내역', visitContext: receiptDoc.visitContext,
        footer: '제출된 영수증의 입력 기록입니다. · 체험용 가상 문서', signature: '접수 담당 확인 (인)',
        rows: [
          inputRow('patient', '환자 성명', byRole(receiptDoc, 'patient').value, 'identity'),
          inputRow('visit-date', '조제일', byRole(receiptDoc, 'visit-date').value, 'identity'),
          inputRow('receipt-id', '영수증 번호', receiptId, 'body'),
          inputRow('provider', '약국명', receiptDoc.issuer, 'body'),
          inputRow('received-status', '입력 상태', '원본 대조 전', 'body'),
          inputRow('received-date', '입력일', byRole(oldClaim, 'claim-date').value, 'body'),
          inputRow('total', '영수증 수납금액', byRole(oldClaim, 'total').value, 'summary')
        ]
      });
      result.docs = [inputDoc, receiptDoc];
      result.needs = [byRole(inputDoc, 'total').id, byRole(receiptDoc, 'total').id];
      result.instruction = '영수증 수납금액과 접수할 때 입력한 금액을 눌러주세요.';
      result.hint = '같은 영수증 번호의 총 수납금액과 입력 내역의 영수증 수납금액을 비교해보세요.';
      result.explanation = '같은 약국·환자·조제일·영수증 번호인데 수납금액이 다르게 입력됐어요. 원본을 확인해 입력값을 수정해야 해요.';
    } else if (scenario.type === 'total') {
      const [detailDoc, receiptDoc] = result.docs;
      const services = detailDoc.rows.filter(value => value.zone === 'body');
      // Give this visit a second genuine cost category (copies of results),
      // so its noncovered subtotal is not just one repeated category amount.
      if (scenario.id === 'total-laboratory') services[3].label = '검사 결과 사본료';
      const nonbenefit = services.slice(2).reduce((sum, value) => sum + numericAmount(value.value), 0);
      const totalRow = byRole(detailDoc, 'total'), receiptAmount = byRole(receiptDoc, 'nonbenefit');
      totalRow.label = '비급여 합계';
      totalRow.value = money(nonbenefit);
      detailDoc.amountBasis = 'nonbenefit';
      detailDoc.section = '비급여 금액 대조';
      services.forEach((value, index) => {
        value.costBasis = index < 2 ? 'benefitPatient' : 'nonbenefit';
        // These are cost-share values, not the unit charges of covered care.
        delete value.unit;
      });
      receiptAmount.label = '비급여 합계';
      result.needs = [totalRow.id, receiptAmount.id];
      result.instruction = '두 서류에서 서로 다른 비급여 합계를 눌러주세요.';
      result.hint = '같은 진료 건의 세부내역서와 영수증에서 비급여 열의 합계를 찾아보세요.';
      result.reveal = '비급여 합계 ' + totalRow.value + ' ≠ ' + receiptAmount.value;
      result.explanation = '같은 환자·병원·진료일의 최종 내역인데 비급여 합계가 달라요. 정산 내역과 원본을 확인해야 해요.';
    } else if (scenario.type === 'quantity') {
      const [detailDoc, recordDoc] = result.docs;
      const count = byRole(detailDoc, 'service-count'), recordCount = byRole(recordDoc, 'service-count');
      count.label = '비급여 ' + count.label;
      recordCount.label = count.label;
      const unit = byRole(detailDoc, 'unit-price'), line = byRole(detailDoc, 'line-amount');
      unit.label = '비급여 항목 단가';
      line.label = '비급여 항목 금액';
      line.costBasis = 'nonbenefit';
      byRole(detailDoc, 'other-amount').costBasis = 'benefitPatient';
      byRole(detailDoc, 'total').label = '비급여 합계';
      byRole(detailDoc, 'total').value = line.value;
      detailDoc.amountBasis = 'nonbenefit';
      detailDoc.quantityBasis = 'nonbenefit';
      detailDoc.section = '비급여 항목의 산정 횟수';
      result.instruction = '같은 항목의 산정 횟수와 시행 횟수를 눌러주세요.';
      result.hint = '같은 날짜·코드·시각의 항목이에요. 세부내역서의 횟수와 시행 기록을 비교해보세요.';
      result.reveal = '세부내역 2회 ≠ 시행 기록 1회';
      result.explanation = '같은 날 같은 항목의 시행 기록은 1회인데 세부내역에는 2회로 적혀 있어요. 추가 시행 기록이나 기재 오류를 확인해야 해요.';
    } else if (scenario.type === 'duplicate') {
      const detailDoc = result.docs[0];
      detailDoc.amountBasis = 'benefitPatient';
      detailDoc.rows.filter(value => value.zone === 'body').forEach(value => { value.costBasis = 'benefitPatient'; });
      byRole(detailDoc, 'total').label = '급여 본인부담 합계';
      result.instruction = '왼쪽에서 같은 항목·시각의 두 금액을 눌러주세요.';
      result.hint = '항목 코드와 시각이 같은 두 줄을 찾아요. 오른쪽 시행 기록은 한 번이에요.';
    } else if (scenario.type === 'receipt-repeat') {
      const [receiptDoc, historyDoc] = result.docs;
      const visit = byRole(receiptDoc, 'visit-date');
      const received = byRole(historyDoc, 'received-date');
      const receivedValue = received.value;
      received.id = received.id.replace(/-received-date$/, '-visit-date');
      received.label = visit.label;
      received.value = visit.value;
      const oldClaimDate = byRole(historyDoc, 'claim-date');
      oldClaimDate.id = oldClaimDate.id.replace(/-claim-date$/, '-received-date');
      oldClaimDate.label = '기존 접수일';
      oldClaimDate.value = receivedValue;
      result.hint = '환자·발급 기관·진료 또는 조제일이 같은 건이에요. 두 서류의 영수증 번호를 비교해보세요.';
      result.explanation = '같은 기관·환자·진료 건의 영수증이 접수 이력에 있어요. 재발급이나 보완 제출인지 확인할 건이에요.';
    }

    // Exhibition instructions: tell visitors exactly which fields to compare,
    // without identifying the answer value or making correct rows look different.
    const shortPrompts = {
      date: {
        title: '진료일이 서로 달라요!',
        instruction: '양쪽 서류의 「진료일」을 하나씩 눌러 비교하세요.',
        hint: '청구서의 진료일과 병원 서류의 진료일을 찾아보세요.'
      },
      name: {
        title: '환자 이름이 다르네요!',
        instruction: '「피보험자」와 「환자 성명」을 하나씩 눌러 비교하세요.',
        hint: '청구서의 피보험자와 병원·약국 서류의 환자 성명을 보세요.'
      },
      total: {
        title: '비급여 금액이 서로 달라요!',
        instruction: '「비급여 합계」가 적힌 두 칸을 눌러 비교하세요.',
        hint: '세부내역서와 영수증에서 각각 비급여 합계를 찾아보세요.'
      },
      quantity: {
        title: '검사·치료 횟수가 다르네요!',
        instruction: '같은 항목의 「산정 횟수」와 「시행 횟수」를 하나씩 눌러보세요.',
        hint: '같은 날짜와 항목의 횟수를 두 서류에서 비교하세요.'
      },
      duplicate: {
        title: '같은 진료 항목이 두 번 적혔어요!',
        instruction: '왼쪽 세부내역서에서 이름과 시각이 같은 두 줄을 눌러보세요.',
        hint: '오른쪽 기록을 참고하고, 왼쪽에서 같은 항목·시각 두 줄을 찾으세요.'
      },
      'receipt-repeat': {
        title: '이미 제출한 영수증일까요?',
        instruction: '이번 영수증과 기존 접수 내역의 「영수증 번호」를 각각 눌러보세요.',
        hint: '서류가 이미 접수되었는지 번호 두 개가 같은지 비교하세요.'
      }
    };
    const prompt = shortPrompts[scenario.type];
    Object.assign(result, prompt);
    if (scenario.id === 'pharmacy-total') {
      result.title = '약국 영수증 금액을 확인해요!';
      result.instruction = '「입력한 수납금액」과 「영수증 총 수납금액」을 각각 눌러보세요.';
      result.hint = '접수 입력 내역과 같은 번호의 약국 영수증을 비교하세요.';
    }
    if (scenario.type === 'quantity') {
      const count = byRole(result.docs[0], 'service-count');
      const recordCount = byRole(result.docs[1], 'service-count');
      count.label = '산정 횟수 · ' + scenario.service;
      recordCount.label = '시행 횟수 · ' + scenario.service;
    }
    if (scenario.type === 'duplicate') {
      result.explanation = '왼쪽 세부내역서에 같은 항목과 시각이 두 번 기재되어 있어요. 실제로 두 번 시행한 건지는 오른쪽 기록과 대조해 확인해야 해요.';
    }
    if (scenario.type === 'receipt-repeat') {
      result.explanation = '이번 영수증 번호가 기존 접수 내역에도 있어요. 잘못된 청구로 단정하지 않고 재발급·보완 제출 여부를 확인해야 해요.';
    }

    for (const doc of result.docs) {
      doc.semanticVersion = 3;
      if (doc.kind !== 'claim') continue;
      const oldTotal = byRole(doc, 'total');
      // Claim forms identify the event and insured person; they do not supply
      // a made-up amount that would be treated as equal to medical costs.
      oldTotal.id = oldTotal.id.replace(/-total$/, '-filing-type');
      oldTotal.label = '청구 유형';
      oldTotal.value = '최초 청구';
    }
    return result;
  }

  // New book4 games only: compare equivalent values, never imply that an
  // insurance payout must equal the hospital's total charge.
  function generateLatest(scenario, seed) {
    if (['date','name','total','quantity'].includes(scenario.type) || scenario.id === 'pharmacy-name' || scenario.id === 'pharmacy-total') {
      const result = generateCurrent(scenario, seed);
      result.bookVersion = 4;
      if (scenario.id === 'pharmacy-name') {
        result.title = '환자 이름이 달라요!';
        result.instruction = '청구서의 「피보험자」와 약국 영수증의 「환자 성명」을 선택하세요.';
      } else if (scenario.id === 'pharmacy-total') {
        result.title = '입력한 약값과 영수증 금액이 달라요!';
        result.instruction = '접수 입력내역의 「영수증 수납금액」과 약국 영수증의 「총 수납금액」을 선택하세요.';
      } else if (scenario.type === 'date') {
        result.title = '진료일이 서로 달라요!';
        result.instruction = '두 서류의 「진료일」을 각각 선택하세요.';
      } else if (scenario.type === 'name') {
        result.title = '환자 이름이 달라요!';
        result.instruction = '「피보험자」와 「환자 성명」을 각각 선택하세요.';
      } else if (scenario.type === 'total') {
        result.title = '비급여 합계가 달라요!';
        result.instruction = '세부내역서와 영수증의 「비급여 합계」를 각각 선택하세요.';
      } else if (scenario.type === 'quantity') {
        result.title = '검사·치료 횟수가 달라요!';
        result.instruction = '「산정 횟수」와 「시행 횟수」를 각각 선택하세요.';
      }
      return result;
    }
    const ctx = context(scenario, seed);
    let docs, needs, reveal, explanation, instruction, hint, title;
    if (scenario.type === 'provider') {
      const wrongProvider = ctx.profile.hospital === '가람빛의원' ? '새봄나무의원' : '가람빛의원';
      const claimDoc = claim(ctx, ctx.profile.name, ctx.visit, ctx.total);
      const receiptDoc = receipt(ctx, ctx.total, ctx.benefit);
      byRole(claimDoc, 'provider').value = wrongProvider;
      docs = [claimDoc, receiptDoc];
      needs = [byRole(claimDoc, 'provider').id, byRole(receiptDoc, 'provider').id];
      reveal = wrongProvider + ' ≠ ' + ctx.profile.hospital;
      title = '병원 이름이 서로 달라요!';
      instruction = '청구서와 영수증의 「의료기관」을 각각 선택하세요.';
      hint = '두 서류에서 병원 이름이 적힌 칸을 찾아보세요.';
      explanation = '같은 진료 건으로 제출된 두 서류에 병원명이 다르게 적혀 있어요. 원본을 확인해야 해요.';
    } else if (scenario.type.startsWith('input-')) {
      const receiptDoc = receipt(ctx, ctx.total, ctx.benefit);
      const receiptNumber = 'RCT-' + ctx.token;
      receiptDoc.rows.splice(2, 0, row(ctx, 'receipt', 'receipt-id', '영수증 번호', receiptNumber, 'body'));
      const kind = 'history';
      const diffAmount = ctx.total + choose(ctx.random, [2000, 4000, 6000]);
      const wrongDate = date(ctx.visitAt + DAY);
      const inputDoc = document(ctx, kind, '접수 입력 정보', '영수증 정보 입력값 확인', [
        row(ctx,kind,'patient','환자 성명',scenario.type === 'input-name' ? ctx.profile.alternate : ctx.profile.name,'identity'),
        row(ctx,kind,'visit-date','진료일',scenario.type === 'input-date' ? wrongDate : ctx.visit,'identity'),
        row(ctx,kind,'receipt-id','영수증 번호',receiptNumber,'body'),
        row(ctx,kind,'provider','의료기관',ctx.profile.hospital,'body'),
        row(ctx,kind,'input-status','처리 상태','원본 확인 전','body'),
        row(ctx,kind,'total','영수증 수납금액',money(scenario.type === 'input-total' ? diffAmount : ctx.total),'summary')
      ], {subtitle:'내부 입력자료 / 영수증 원본 대조', copyLabel:'접수 입력 정보',footer:'전시용 가상 접수 입력 화면',signature:'입력 담당 확인'});
      docs = [receiptDoc, inputDoc];
      if (scenario.type === 'input-date') {
        needs = [byRole(receiptDoc,'visit-date').id,byRole(inputDoc,'visit-date').id];
        title='입력한 진료일이 달라요!';
        instruction='영수증과 접수 입력 정보의 「진료일」을 각각 선택하세요.';
        hint='두 서류에서 진료받은 날짜를 비교하세요.';
        reveal=ctx.visit+' ≠ '+wrongDate;
        explanation='영수증의 진료일과 접수할 때 입력한 날짜가 달라요. 입력 정보를 확인해야 해요.';
      } else if (scenario.type === 'input-name') {
        needs=[byRole(receiptDoc,'patient').id,byRole(inputDoc,'patient').id];
        title='입력한 환자 이름이 달라요!';
        instruction='영수증과 접수 입력 정보의 「환자 성명」을 각각 선택하세요.';
        hint='두 자료의 환자 성명 칸을 비교하세요.';
        reveal=ctx.profile.name+' ≠ '+ctx.profile.alternate;
        explanation='영수증의 환자 이름이 접수 입력 정보에 다르게 적혀 있어요. 잘못 입력된 항목을 확인해야 해요.';
      } else {
        needs=[byRole(receiptDoc,'total').id,byRole(inputDoc,'total').id];
        title='입력한 수납금액이 달라요!';
        instruction='영수증의 「총 수납금액」과 접수 입력 정보의 「영수증 수납금액」을 선택하세요.';
        hint='실제로 낸 금액을 접수 입력값과 비교하세요.';
        reveal=money(ctx.total)+' ≠ '+money(diffAmount);
        explanation='영수증의 수납금액과 접수 입력값이 달라요. 영수증 원본을 확인해야 해요.';
      }
    } else if (scenario.type === 'pharmacy-date') {
      const pharm = pharmacyContext(ctx);
      const receiptDoc = pharmacyDocument(receipt(pharm,pharm.total,pharm.benefit));
      const wrongDate = date(pharm.visitAt + DAY);
      const kind='record';
      const recordDoc=document(pharm,kind,'약국 조제 기록','조제일 확인',[
        row(pharm,kind,'patient','환자 성명',pharm.profile.name,'identity'),
        row(pharm,kind,'visit-date','조제일',wrongDate,'identity'),
        row(pharm,kind,'provider','약국명',pharm.profile.hospital,'body'),
        row(pharm,kind,'visit-kind','조제 구분','처방 조제','body'),
        row(pharm,kind,'issued-date','기록 발행일',pharm.issued,'body')
      ],{subtitle:'동일 조제 건의 날짜 대조 / 가상 조제 기록',copyLabel:'조제 기록'});
      docs=[receiptDoc,recordDoc];
      needs=[byRole(receiptDoc,'visit-date').id,byRole(recordDoc,'visit-date').id];
      title='약을 조제한 날짜가 달라요!';
      instruction='약국 영수증과 조제 기록의 「조제일」을 각각 선택하세요.';
      hint='두 서류에서 조제한 날짜를 찾으세요.';
      reveal=pharm.visit+' ≠ '+wrongDate;
      explanation='같은 조제 건의 날짜가 영수증과 조제 기록에서 달라요. 원본을 확인해야 해요.';
    } else {
      throw new Error('Unsupported current case type: '+scenario.type);
    }
    return { id:ctx.id, templateId:scenario.id, bookVersion:4, type:scenario.type,
      group:scenario.group,label:scenario.type,title, instruction,hint, docs,needs,reveal,explanation };
  }

  function legacyCases() {
    if (Array.isArray(root.AIMS_CASES)) return root.AIMS_CASES;
    if (typeof module === 'object' && module.exports && typeof require === 'function') return require('./cases.js');
    throw new Error('Load cases.js before restoring a legacy session.');
  }
  function forSession(session) {
    const key = typeof session === 'string' && session ? session : 'book3-demo';
    if (!key.startsWith('book1-') && !key.startsWith('book2-') && !key.startsWith('book3-') && !key.startsWith('book4-')) return legacyCases();
    if (key.startsWith('book4-')) {
      const random = seeded(key + '|selection');
      const pharmacyGroup = choose(random, GROUPS);
      return GROUPS.map(group => {
        const source = group === pharmacyGroup ? NEW_PHARMACY_SCENARIOS.filter(value => value.group === group)
          : CURRENT_SCENARIOS.filter(value => value.group === group);
        return generateLatest(choose(random, source), key + '|' + group);
      });
    }
    const random = seeded(key + '|selection');
    if (key.startsWith('book1-')) {
      return GROUPS.map(group => generate(choose(random, SCENARIOS.filter(scenario => scenario.group === group)), key + '|' + group));
    }
    if (key === 'book2-demo') {
      return ['date-outpatient', 'pharmacy-total', 'receipt-repeat-reissue'].map((id, index) =>
        generate(ALL_SCENARIOS.find(scenario => scenario.id === id), key + '|' + GROUPS[index]));
    }
    if (key === 'book3-demo') {
      return ['date-outpatient', 'total-laboratory', 'pharmacy-receipt-repeat'].map((id, index) =>
        generateCurrent(ALL_SCENARIOS.find(scenario => scenario.id === id), key + '|' + GROUPS[index]));
    }
    const build = key.startsWith('book3-') ? generateCurrent : generate;
    const pharmacyGroup = choose(random, GROUPS);
    const hospitalGroup = choose(random, GROUPS.filter(group => group !== pharmacyGroup));
    return GROUPS.map(group => {
      const candidates = group === pharmacyGroup ? PHARMACY_SCENARIOS.filter(scenario => scenario.group === group)
        : SCENARIOS.filter(scenario => scenario.group === group &&
          (group !== hospitalGroup || ['date', 'total', 'receipt-repeat'].includes(scenario.type)));
      return build(choose(random, candidates), key + '|' + group);
    });
  }

  // A preview never starts a game or changes the session; unknown IDs return null.
  function preview(templateId, seed) {
    const scenario = ALL_SCENARIOS.find(value => value.id === templateId);
    return scenario ? generate(scenario, seed == null ? 'operator-preview' : String(seed)) : null;
  }
  function previewCurrent(templateId, seed) {
    const scenario = ALL_SCENARIOS.find(value => value.id === templateId);
    return scenario ? generateCurrent(scenario, seed == null ? 'operator-preview' : String(seed)) : null;
  }
  function previewLatest(templateId, seed) {
    const scenario = NEW_ALL_SCENARIOS.find(value => value.id === templateId);
    return scenario ? generateLatest(scenario, seed == null ? 'operator-preview' : String(seed)) : null;
  }

  let sessionSequence = 0;
  function createSessionId() {
    try {
      if (root.crypto && typeof root.crypto.randomUUID === 'function') return 'book4-' + root.crypto.randomUUID();
    } catch (_error) { /* Restricted or older browsers can use the local fallback. */ }
    sessionSequence += 1;
    return 'book4-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) + '-' + sessionSequence.toString(36);
  }

  return Object.freeze({ version: 4, catalog, currentCatalog:latestCatalog, forSession, preview, previewCurrent:previewLatest, createSessionId });
});
