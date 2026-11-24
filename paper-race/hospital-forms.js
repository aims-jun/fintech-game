/* Printed hospital tables. Fictional values; no answer knowledge or game state. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AIMS_HOSPITAL_FORMS = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function money(value) {
    return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원';
  }
  function amount(row) {
    const value = String(row && row.value || '');
    return /^[\d,]+\s*원$/.test(value) ? Number(value.replace(/[^\d]/g, '')) : null;
  }
  function hash(value) {
    let result = 2166136261;
    for (const character of String(value)) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
    return result >>> 0;
  }
  function helpers(doc, H) {
    const rows = Array.isArray(doc.rows) ? doc.rows : [];
    const used = new Set((H.groups.identity || []).map(row => row.id));
    function field(row) {
      if (!row || used.has(row.id)) return '';
      used.add(row.id);
      return H.field(row);
    }
    function context(role, label, value) { return H.field(H.context(role, label, value)); }
    function find(suffix, label) {
      return rows.find(row => String(row.id).endsWith('-' + suffix)) || rows.find(row => label.test(String(row.label)));
    }
    function remaining() { return rows.filter(row => !used.has(row.id)); }
    function additional(className) {
      const pending = remaining();
      if (!pending.length) return '';
      return `<table class="print-table ${className}"><colgroup><col style="width:30%"><col style="width:70%"></colgroup><tbody>${pending.map(row => `<tr><th scope="row">${H.escape(row.label)}</th><td>${field(row)}</td></tr>`).join('')}</tbody></table>`;
    }
    return {rows, used, field, context, find, remaining, additional};
  }

  // Distribute fictional balances, not medical reimbursement percentages.
  // No charge cell repeats an original document amount merely as decoration.
  function allocate(total, positions, forbidden, salt, count) {
    const values = Array(count).fill(0);
    const weights = positions.map((_position, index) => 16 + ((salt >>> (index * 4)) % 15));
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    let remainder = total;
    positions.forEach((position, index) => {
      const value = index === positions.length - 1 ? remainder : Math.floor(total * weights[index] / weightTotal / 100) * 100;
      values[position] = value;
      remainder -= value;
    });
    for (let attempt = 0; attempt < positions.length; attempt++) {
      const conflict = positions.find(position => values[position] > 0 && forbidden.has(values[position]));
      if (conflict == null) break;
      let resolved = false;
      for (const donor of positions.filter(position => position !== conflict)) {
        for (let transfer = 100; transfer < values[donor]; transfer += 100) {
          if (forbidden.has(values[conflict] + transfer) || forbidden.has(values[donor] - transfer)) continue;
          values[conflict] += transfer;
          values[donor] -= transfer;
          resolved = true;
          break;
        }
        if (resolved) break;
      }
      if (!resolved) {
        // The synthetic total itself is excluded from forbidden values by the
        // caller. Keep it in a supported category if a split cannot be formed.
        positions.forEach(position => { values[position] = 0; });
        values[positions[0]] = total;
        break;
      }
    }
    return values;
  }

  function receiptCategory(label) {
    const text = String(label);
    // Specific item names precede broad words such as 영상 and 치료.
    if (/영상\s*사본|제증명|증명|사본료/.test(text)) return 8;
    if (/치료\s*재료|재료대|재료/.test(text)) return 6;
    if (/물리|재활/.test(text)) return 7;
    if (/진찰/.test(text)) return 0;
    if (/투약|조제|약품/.test(text)) return 1;
    if (/주사/.test(text)) return 2;
    if (/촬영|X선|영상|판독|CT|MRI|초음파/.test(text)) return 5;
    if (/검사|검체/.test(text)) return 4;
    if (/처치|수술|치료/.test(text)) return 3;
    return 9;
  }

  function receipt(doc, H) {
    const R = helpers(doc, H);
    const benefit = R.find('benefit', /^급여\s*본인부담/);
    const nonbenefit = R.find('nonbenefit', /^비급여$/);
    const totalRow = R.find('total', /총\s*수납금액|환자부담\s*총액/);
    const total = amount(totalRow) ?? ((amount(benefit) || 0) + (amount(nonbenefit) || 0));
    const seed = hash(doc.serial || R.rows.map(row => row.id).join('|'));
    const peer = H.peer;
    const peerRows = peer && peer.kind === 'detail' && Array.isArray(peer.rows)
      ? peer.rows.filter(row => (!row.zone || row.zone === 'body') && amount(row) > 0 && !/합계|총액|수납|단가|해당 항목 금액/.test(String(row.label)))
      : [];
    const hasDetail = peerRows.length >= 2;
    const peerCovered = peerRows.slice(0, 2).reduce((sum, row) => sum + amount(row), 0);
    const B = amount(benefit) ?? (amount(nonbenefit) != null ? total - amount(nonbenefit) : hasDetail ? peerCovered : Math.max(0, Math.min(total - 1000, 12000 + seed % 7 * 1000)));
    const N = amount(nonbenefit) ?? Math.max(0, total - B);
    const peerOriginals = peer && Array.isArray(peer.rows) ? peer.rows : [];
    const forbidden = new Set(R.rows.concat(peerOriginals).map(amount).filter(value => value != null));
    let P = 17000 + seed % 23 * 1300;
    while (forbidden.has(P)) P += 700;
    const categories = ['진찰료', '투약 및 조제료', '주사료', '처치 및 수술료', '검사료', '영상진단료', '치료재료대', '재활 및 물리치료료', '제증명수수료', '기타'];
    const patient = Array(categories.length).fill(0);
    const uncovered = Array(categories.length).fill(0);
    if (hasDetail) {
      peerRows.forEach((row, index) => { (index < 2 ? patient : uncovered)[receiptCategory(row.label)] += amount(row); });
      // Preserve the existing case's deliberate receipt/detail discrepancy in
      // an actual billed category, instead of inventing another treatment.
      patient[receiptCategory(peerRows[0].label)] += B - peerCovered;
      const noncoveredTarget = peerRows[2] || peerRows[peerRows.length - 1];
      uncovered[receiptCategory(noncoveredTarget.label)] += N - uncovered.reduce((sum, value) => sum + value, 0);
    } else {
      // The supplied source has no service breakdown. An aggregate is honest;
      // fabricated drug, treatment, or imaging charges would create new clues.
      patient[9] = B;
      uncovered[9] = N;
    }
    const coveredCategories = patient.map((value, index) => value > 0 ? index : -1).filter(index => index >= 0);
    const insurer = allocate(P, coveredCategories.length ? coveredCategories : [9], forbidden, seed ^ 0x47a2b, categories.length);
    const cell = (role, label, value) => value ? R.context(role, label, money(value)) : '<span class="print-empty">—</span>';
    const costs = `<table class="print-table receipt-costs" aria-label="항목별 진료비 계산 내역">
      <colgroup><col style="width:32%"><col style="width:17%"><col style="width:17%"><col style="width:17%"><col style="width:17%"></colgroup>
      <thead><tr><th rowspan="3" scope="col">항목</th><th colspan="3" scope="colgroup">급여</th><th rowspan="3" scope="col">비급여</th></tr>
      <tr><th colspan="2" scope="colgroup">일부 본인부담</th><th rowspan="2" scope="col">전액<br>본인부담</th></tr>
      <tr><th scope="col">본인부담금</th><th scope="col">공단부담금</th></tr></thead>
      <tbody>${categories.map((label, index) => `<tr data-category="${H.escape(label)}"><th scope="row">${H.escape(label)}</th><td data-cost-column="patient">${cell('cost-patient-' + index, label + ' 본인부담금', patient[index])}</td><td data-cost-column="insurer">${cell('cost-insurer-' + index, label + ' 공단부담금', insurer[index])}</td><td><span class="print-empty">—</span></td><td data-cost-column="nonbenefit">${cell('cost-nonbenefit-' + index, label + ' 비급여', uncovered[index])}</td></tr>`).join('')}</tbody>
      <tfoot><tr><th scope="row">합계</th><td>${benefit ? R.field(benefit) : R.context('cost-patient-total', '급여 본인부담 합계', money(B))}</td><td>${R.context('cost-insurer-total', '공단부담 합계', money(P))}</td><td>${R.context('cost-fullpatient-total', '전액 본인부담 합계', '0원')}</td><td>${nonbenefit ? R.field(nonbenefit) : R.context('cost-nonbenefit-total', '비급여 합계', money(N))}</td></tr></tfoot>
    </table>`;
    const prior = R.find('prior', /이미\s*납부한\s*금액/);
    const method = R.find('method', /납부\s*방법|결제\s*수단/);
    const settlement = `<table class="print-table receipt-settlement" aria-label="금액 산정 및 수납 내역">
      <colgroup><col style="width:48%"><col style="width:52%"></colgroup>
      <thead><tr><th colspan="2">금액 산정 및 수납</th></tr></thead><tbody>
      <tr><th scope="row">진료비 총액</th><td>${R.context('settlement-gross', '진료비 총액', money(total + P))}</td></tr>
      <tr><th scope="row">공단부담액</th><td>${R.context('settlement-insurer', '공단부담액', money(P))}</td></tr>
      <tr><th scope="row">이미 납부한 금액</th><td>${prior ? R.field(prior) : R.context('settlement-prior', '이미 납부한 금액', '0원')}</td></tr>
      <tr><th scope="row">결제수단</th><td>${method ? R.field(method) : R.context('settlement-method', '결제수단', '신용카드')}</td></tr>
      <tr class="receipt-paid"><th scope="row">총 수납금액</th><td>${totalRow ? R.field(totalRow) : R.context('settlement-paid', '총 수납금액', money(total))}</td></tr>
      <tr><th scope="row">미납 금액</th><td>${R.context('settlement-unpaid', '미납 금액', '0원')}</td></tr>
      <tr class="receipt-payment-note"><td colspan="2">수납 구분　외래<br>상기 금액을 영수합니다.</td></tr>
      </tbody></table>`;
    const issuance = ['receipt-id', 'provider', 'issued-date'].map((role, index) => R.find(role, [/영수증\s*번호/, /의료기관/, /발행일/][index])).filter(row => row && !R.used.has(row.id));
    const issuanceHTML = issuance.length ? `<table class="print-table receipt-issuance"><colgroup><col style="width:18%"><col style="width:32%"><col style="width:18%"><col style="width:32%"></colgroup><tbody>${issuance.reduce((groups, row, index) => { if (index % 2 === 0) groups.push([]); groups[groups.length - 1].push(row); return groups; }, []).map(pair => `<tr>${pair.map(row => `<th scope="row">${H.escape(row.label)}</th><td>${R.field(row)}</td>`).join('')}${pair.length === 1 ? '<th scope="row">발급 구분</th><td>외래 진료</td>' : ''}</tr>`).join('')}</tbody></table>` : '';
    return `${H.patientBand()}<div class="print-unit-line"><span>진료비 계산 내역</span><span>단위: 원</span></div><div class="receipt-layout">${costs}${settlement}</div>${issuanceHTML}${R.additional('receipt-additional')}<div class="print-guidance"><b>항목 안내</b><p>${hasDetail ? '급여와 비급여를 구분하여 기재하였으며, 수납 내역은 우측 금액란에서 확인합니다.' : '세부 항목 분류 미기재. 항목별 내역은 별도 세부산정내역서에서 확인합니다.'}</p></div>`;
  }

  function detail(doc, H) {
    const R = helpers(doc, H);
    const countRow = R.find('service-count', /^청구\s*횟수$/);
    const unitRow = R.find('unit-price', /해당\s*항목\s*단가/);
    const lineRow = R.find('line-amount', /해당\s*항목\s*금액/);
    const otherRow = R.find('other-amount', /그\s*밖의\s*진료비/);
    const totalRow = R.find('total', /진료비\s*합계/);
    const quantityCase = countRow && unitRow && lineRow;
    const bodyRows = (H.groups.body || []).filter(row => !R.used.has(row.id) && row !== totalRow);
    const isTotalCase = R.rows.some(row => /^total-(?:laboratory|imaging|treatment)-/.test(String(row.id)));
    const empty = '<span class="print-empty">—</span>';
    function textCell(value, className) { return `<td${className ? ` class="${className}"` : ''}>${value == null || value === '' ? empty : H.escape(value)}</td>`; }
    function line(row, index, settings) {
      settings = settings || {};
      const patientColumn = settings.nonbenefit ? 12 : 9;
      const description = settings.description || row.label;
      const category = /촬영|영상|판독|X선/.test(description) ? '영상진단료' : /치료|처치/.test(description) ? '처치료' : /진찰/.test(description) ? '진찰료' : /검사|검체/.test(description) ? '검사료' : '기타';
      const cells = [textCell(category, 'detail-category'), textCell('〃', 'detail-date'), textCell(settings.code || row.code || '—', 'detail-code'), textCell(description, 'detail-description')];
      cells.push(`<td>${settings.unit ? R.field(settings.unit) : empty}</td>`);
      cells.push(`<td>${settings.count ? R.field(settings.count) : H.escape(row.quantity || '1회')}</td>`);
      cells.push(textCell('1', 'detail-days'));
      cells.push(`<td>${empty}</td>`);
      for (let column = 9; column <= 12; column++) cells.push(`<td${column === patientColumn ? ' class="detail-patient-amount"' : ''}>${column === patientColumn ? R.field(row) : empty}</td>`);
      return `<tr class="detail-service-line" data-line="${index + 1}">${cells.join('')}</tr>`;
    }
    const lines = [];
    if (quantityCase) {
      lines.push(line(lineRow, 0, {description:countRow.label, code:countRow.code, unit:unitRow, count:countRow}));
      if (otherRow) lines.push(line(otherRow, 1));
    } else {
      bodyRows.filter(row => amount(row) != null).forEach((row, index) => lines.push(line(row, index, {nonbenefit:isTotalCase && index >= 2})));
    }
    // Keep the blank ruled portion of a printed ledger instead of stretching a few values.
    const blankCount = Math.max(2, 6 - lines.length);
    for (let i = 0; i < blankCount; i++) lines.push(`<tr class="detail-blank" aria-hidden="true">${Array.from({length:12}, () => '<td>&nbsp;</td>').join('')}</tr>`);
    const ledger = `<table class="print-table medical-detail" aria-label="진료비 세부산정내역">
      <colgroup><col style="width:8%"><col style="width:5%"><col style="width:6%"><col style="width:18%"><col style="width:10%"><col style="width:6%"><col style="width:4%"><col style="width:6%"><col style="width:12%"><col style="width:8%"><col style="width:7%"><col style="width:10%"></colgroup>
      <thead><tr><th rowspan="3" scope="col">항목</th><th rowspan="3" scope="col">일자</th><th rowspan="3" scope="col">코드</th><th rowspan="3" scope="col">명칭</th><th rowspan="3" scope="col">금액<small>환자부담 단가</small></th><th rowspan="3" scope="col">횟수</th><th rowspan="3" scope="col">일수</th><th rowspan="3" scope="col">총액</th><th colspan="3" scope="colgroup">급여</th><th rowspan="3" scope="col">비급여</th></tr>
      <tr><th colspan="2" scope="colgroup">일부본인부담</th><th rowspan="2" scope="col">전액<br>본인부담</th></tr>
      <tr><th scope="col">본인부담금</th><th scope="col">공단부담금</th></tr></thead>
      <tbody>${lines.join('')}</tbody>
      ${totalRow ? `<tfoot><tr><th colspan="8" scope="row">진료비 합계 <small>(환자 부담금)</small></th><td colspan="4">${R.field(totalRow)}</td></tr></tfoot>` : ''}
    </table>`;
    return `${H.patientBand()}<div class="print-unit-line"><span>항목별 산정 내역</span><span>단위: 원 / 회 / 일</span></div>${ledger}${R.additional('detail-additional')}<div class="print-guidance"><b>일반사항 안내</b><p>이 내역은 환자가 부담하는 금액을 기준으로 구성한 전시용 자료입니다. 빈 금액란은 체험에 사용하지 않는 항목입니다.</p></div>`;
  }

  return Object.freeze({receipt, detail});
});
