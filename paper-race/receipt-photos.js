/* Photo-backed Korean receipts. All amounts and people are fictional. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AIMS_RECEIPT_PHOTOS = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const PROFILES = Object.freeze({
    hospital: Object.freeze({ type: 'hospital', width: 1254, height: 1254, asset: 'assets/receipt-hospital-photo.png' }),
    pharmacy: Object.freeze({ type: 'pharmacy', width: 1086, height: 1448, asset: 'assets/receipt-pharmacy-photo.png' })
  });
  const CATEGORIES = Object.freeze(['진찰료', '투약 및 조제료', '주사료', '처치 및 수술료', '검사료', '영상진단료', '치료재료대', '재활 및 물리치료료', '제증명수수료', '기타']);
  const CATEGORY_Y = Object.freeze([361, 451, 513, 604, 635, 665, 726, 755, 959, 989]);
  const ROLE_LABELS = {
    patient: /환자\s*성명|수진자명/, 'visit-date': /진료일|진료기간|조제일/,
    benefit: /^급여\s*본인부담/, nonbenefit: /^비급여$/, total: /총\s*수납금액|환자부담\s*총액/,
    'receipt-id': /영수증\s*번호/, provider: /의료기관|약국명/, 'issued-date': /발행일|발급일/
  };

  function money(value) { return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원'; }
  function amount(row) {
    const value = String(row && row.value || '');
    return /^[\d,]+\s*원$/.test(value) ? Number(value.replace(/[^\d]/g, '')) : null;
  }
  function hash(value) {
    let result = 2166136261;
    for (const character of String(value)) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
    return result >>> 0;
  }
  function rowsOf(doc) { return Array.isArray(doc && doc.rows) ? doc.rows : []; }
  function find(doc, role) {
    const rows = rowsOf(doc);
    return rows.find(row => String(row.id).endsWith('-' + role)) || rows.find(row => ROLE_LABELS[role].test(String(row.label)));
  }
  function profileFor(doc) {
    return PROFILES[doc && (doc.pharmacy || doc.receiptType === 'pharmacy') ? 'pharmacy' : 'hospital'];
  }
  function supports(doc) {
    if (!doc || doc.kind !== 'receipt' || rowsOf(doc).length < 7) return false;
    const identified = new Set(Object.keys(ROLE_LABELS).map(role => find(doc, role)).filter(Boolean));
    return ['patient', 'visit-date', 'benefit', 'nonbenefit', 'total', 'issued-date'].every(role => find(doc, role)) &&
      rowsOf(doc).every(row => identified.has(row));
  }

  // These balances are fictional. They do not imply a reimbursement percentage.
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
        positions.forEach(position => { values[position] = 0; });
        values[positions[0]] = total;
        break;
      }
    }
    return values;
  }
  function receiptCategory(label) {
    const text = String(label);
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

  // Keep the same charge projection as the former printed hospital receipt:
  // the first two detail rows are covered; later rows are noncovered. Only the
  // existing discrepancy changes an actual noncovered service category.
  function projectHospital(doc, peer) {
    const rows = rowsOf(doc);
    const benefit = find(doc, 'benefit'), nonbenefit = find(doc, 'nonbenefit'), totalRow = find(doc, 'total');
    const total = amount(totalRow) ?? ((amount(benefit) || 0) + (amount(nonbenefit) || 0));
    const seed = hash(doc.serial || rows.map(row => row.id).join('|'));
    const peerRows = peer && peer.kind === 'detail' ? rowsOf(peer).filter(row =>
      (!row.zone || row.zone === 'body') && amount(row) > 0 && !/합계|총액|수납|단가|해당 항목 금액/.test(String(row.label))) : [];
    const hasDetail = peerRows.length >= 2;
    const peerCovered = peerRows.slice(0, 2).reduce((sum, row) => sum + amount(row), 0);
    const B = amount(benefit) ?? (amount(nonbenefit) != null ? total - amount(nonbenefit) : hasDetail ? peerCovered : Math.max(0, Math.min(total - 1000, 12000 + seed % 7 * 1000)));
    const N = amount(nonbenefit) ?? Math.max(0, total - B);
    const forbidden = new Set(rows.concat(rowsOf(peer)).map(amount).filter(value => value != null));
    let P = 17000 + seed % 23 * 1300;
    while (forbidden.has(P) || forbidden.has(total + P)) P += 700;
    const patient = Array(CATEGORIES.length).fill(0), uncovered = Array(CATEGORIES.length).fill(0);
    if (hasDetail) {
      peerRows.forEach((row, index) => { (index < 2 ? patient : uncovered)[receiptCategory(row.label)] += amount(row); });
      patient[receiptCategory(peerRows[0].label)] += B - peerCovered;
      const target = peerRows[2] || peerRows[peerRows.length - 1];
      uncovered[receiptCategory(target.label)] += N - uncovered.reduce((sum, value) => sum + value, 0);
    } else {
      patient[9] = B;
      uncovered[9] = N;
    }
    const covered = patient.map((value, index) => value > 0 ? index : -1).filter(index => index >= 0);
    const insurer = allocate(P, covered.length ? covered : [9], forbidden, seed ^ 0x47a2b, CATEGORIES.length);
    return { categories: CATEGORIES.slice(), patient, insurer, nonbenefit: uncovered,
      benefitTotal: B, nonbenefitTotal: N, insurerTotal: P, total, gross: total + P, hasDetail };
  }

  function receipt(doc, H) {
    if (!supports(doc)) throw new Error('Photo receipt requires the modern receipt field schema.');
    const profile = profileFor(doc), used = new Set(), parts = [];
    const token = String(doc.serial || '000001').replace(/[^a-zA-Z0-9]/g, '').slice(-7).padStart(7, '0');
    const projection = projectHospital(doc, H.peer);
    const context = (role, label, value) => H.context(role, label, value);
    function field(slot, row, box, options = {}) {
      if (!row) return;
      if (used.has(row.id)) throw new Error('Repeated photo field: ' + row.id);
      used.add(row.id);
      const [x, y, width, height] = box;
      const attributes = Object.entries(options.data || {}).map(([key, value]) => ` data-${key}="${H.escape(value)}"`).join('');
      const alignment = options.align === 'right' ? ' photo-money' : options.align === 'left' ? ' photo-text' : '';
      parts.push(`<div class="photo-field${alignment}" data-photo-slot="${H.escape(slot)}" data-x="${x}" data-y="${y}" data-width="${width}" data-height="${height}" style="left:${x / profile.width * 100}%;top:${y / profile.height * 100}%;width:${width / profile.width * 100}%;height:${height / profile.height * 100}%;--photo-value:${options.size || (profile.type === 'pharmacy' ? 34 : 26)}px"${attributes}><div class="photo-cell">${H.field(row)}</div></div>`);
    }
    function note(slot, text, box, className = 'photo-caption') {
      const [x, y, width, height] = box;
      parts.push(`<div class="photo-note" data-photo-note="${H.escape(slot)}" style="left:${x / profile.width * 100}%;top:${y / profile.height * 100}%;width:${width / profile.width * 100}%;height:${height / profile.height * 100}%"><div class="${className}">${H.escape(text)}</div></div>`);
    }
    function label(text, x, y, size = 21) {
      parts.push(`<span class="photo-printed-label" style="left:${x / profile.width * 100}%;top:${(y - size) / profile.height * 100}%;--photo-label-size:${size}px">${H.escape(text)}</span>`);
    }
    const patient = find(doc, 'patient'), date = find(doc, 'visit-date'), benefit = find(doc, 'benefit');
    const nonbenefit = find(doc, 'nonbenefit'), total = find(doc, 'total'), issued = find(doc, 'issued-date');
    const number = find(doc, 'receipt-id') || context('receipt-number', '영수증 번호', 'RC-' + token);
    const provider = find(doc, 'provider') || context('provider', profile.type === 'pharmacy' ? '약국명' : '의료기관', doc.issuer || '가람빛의원');

    if (profile.type === 'pharmacy') {
      field('receipt-number', number, [353, 135, 385, 59], {size: 31});
      field('days', context('days', '투약일수', '3일'), [937, 135, 103, 59], {size: 31});
      field('patient', patient, [353, 199, 688, 60]);
      field('visit-date', date, [353, 264, 688, 59]);
      field('gross', context('settlement-gross', '약제비 총액', money(projection.gross)), [421, 328, 620, 59], {align: 'right'});
      field('benefit', benefit, [421, 392, 620, 57], {align: 'right'});
      field('insurer', context('cost-insurer-total', '보험자부담금', money(projection.insurerTotal)), [421, 453, 620, 57], {align: 'right'});
      field('nonbenefit', nonbenefit, [421, 515, 620, 57], {align: 'right'});
      // The three payment-method cells intentionally remain unprovided: filling
      // one with the total would create a second selectable answer value.
      field('paid-total', total, [617, 762, 424, 57], {align: 'right'});
      field('registration', context('registration', '사업자등록번호', '000-00-00000'), [357, 942, 684, 61], {size: 31});
      field('address', context('address', '사업장 소재지', '가상시 가람로 26, 1층'), [357, 1009, 684, 91], {size: 31});
      field('provider', provider, [357, 1107, 684, 60]);
      field('pharmacist', context('pharmacist', '약사 성명', '이해준'), [357, 1174, 684, 57]);
      field('issued-date', issued, [357, 1238, 684, 56]);
      note('acknowledgement', '상기 금액을 영수합니다.', [64, 1311, 961, 34]);
      note('fiction', '전시용 가상 서식 · 실제 증빙으로 사용할 수 없습니다.', [64, 1363, 961, 31], 'form-fiction photo-fiction');
    } else {
      field('chart-number', context('patient-no', '차트번호', 'P-' + token), [20, 181, 259, 27], {size: 24});
      field('patient', patient, [284, 181, 294, 27]);
      field('visit-date', date, [584, 181, 318, 27]);
      field('department', context('department', '진료과목', '일반진료'), [20, 242, 259, 26], {size: 24});
      field('insurance', context('insurance', '보험구분', '건강보험'), [751, 242, 151, 26], {size: 23});
      field('receipt-number', number, [908, 242, 325, 26], {size: 23});
      label('단위: 원', 1137, 132, 19);

      const columns = { patient: [284, 99], insurer: [389, 94], nonbenefit: [685, 114] };
      const originals = { patient: benefit, nonbenefit };
      // If the only category is its whole subtotal, use the original field
      // there and leave the redundant subtotal cell empty. This keeps every
      // original value live exactly once, with no fabricated service split.
      const originalCategory = {};
      for (const column of ['patient', 'nonbenefit']) {
        const nonzero = projection[column].map((value, index) => value > 0 ? index : -1).filter(index => index >= 0);
        // Current amount questions ask for a subtotal. Keep that live field in
        // the printed sum row even if only one category happens to have it.
        if (!(doc.semanticVersion >= 3 && column === 'nonbenefit') && nonzero.length === 1 && projection[column][nonzero[0]] === amount(originals[column])) originalCategory[column] = nonzero[0];
      }
      projection.categories.forEach((category, index) => {
        for (const column of ['patient', 'insurer', 'nonbenefit']) {
          const value = projection[column][index];
          if (!value) continue;
          const row = originalCategory[column] === index ? originals[column] : context('cost-' + column + '-' + index,
            category + ' ' + ({ patient: '본인부담금', insurer: '공단부담금', nonbenefit: '비급여' })[column], money(value));
          field('cost-' + column + '-' + index, row, [columns[column][0], CATEGORY_Y[index], columns[column][1], 27],
            {size: 24, align: 'right', data: {category, 'cost-column': column}});
        }
      });
      if (!used.has(benefit.id)) field('benefit-total', benefit, [284, 1106, 102, 27], {size: 24, align: 'right'});
      field('insurer-total', context('cost-insurer-total', '공단부담 합계', money(projection.insurerTotal)), [392, 1106, 93, 27], {size: 24, align: 'right'});
      if (!used.has(nonbenefit.id)) field('nonbenefit-total', nonbenefit, [685, 1106, 114, 27], {size: 24, align: 'right'});
      field('gross', context('settlement-gross', '진료비 총액', money(projection.gross)), [1045, 302, 188, 55], {align: 'right'});
      field('prior', context('settlement-prior', '이미 납부한 금액', '0원'), [1045, 423, 188, 57], {align: 'right'});
      field('paid-total', total, [1045, 637, 188, 26], {align: 'right'});

      note('acknowledgement', '상기 금액을 정히 영수합니다.', [826, 803, 387, 28]);
      field('provider', provider, [826, 839, 387, 43], {size: 28});
      label('발 행 일', 829, 919);
      field('issued-date', issued, [940, 891, 273, 36], {size: 25});
      label('사업자번호', 829, 964);
      field('registration', context('registration', '사업자등록번호', '000-00-00000'), [971, 936, 242, 36], {size: 24});
      field('address', context('address', '소재지', '가상시 가람로 26'), [826, 991, 387, 40], {size: 24});
      field('copy-label', context('copy-label', '발급 구분', doc.copyLabel === '체험용' ? '환자 보관용' : doc.copyLabel || '환자 보관용'), [826, 1046, 245, 37], {size: 24});
      parts.push(`<span class="photo-stamp" aria-hidden="true" style="left:${1115 / profile.width * 100}%;top:${1041 / profile.height * 100}%;width:${77 / profile.width * 100}%;height:${48 / profile.height * 100}%">체험<br>확인</span>`);
      note('unprovided', '공란은 이 체험에서 제공하지 않은 항목입니다.', [823, 1094, 385, 32], 'photo-caption photo-small-caption');
      note('fiction', '전시용 가상 서식 · 실제 증빙으로 사용할 수 없습니다.', [30, 1208, 1194, 24], 'form-fiction photo-fiction');
    }
    const missing = rowsOf(doc).filter(row => !used.has(row.id));
    if (missing.length) throw new Error('Unmapped photo receipt field: ' + missing.map(row => row.id).join(', '));
    return `<div class="receipt-photo-viewport receipt-photo-${profile.type}" data-photo-width="${profile.width}" data-photo-height="${profile.height}" role="group" aria-label="${H.escape(doc.title || (profile.type === 'pharmacy' ? '약제비 계산서·영수증' : '진료비 계산서·영수증'))}" tabindex="0"><div class="receipt-photo-canvas" data-photo-width="${profile.width}" data-photo-height="${profile.height}"><img class="receipt-photo-image" src="${profile.asset}" width="${profile.width}" height="${profile.height}" alt="" draggable="false"><div class="receipt-photo-overlay">${parts.join('')}</div></div></div>`;
  }

  // One fitted HTML rectangle owns both the image and every evidence control.
  // No SVG/HTML compositing or object-fit letterboxing is involved.
  function fitGeometry(profile, width, height, zoom = 1, pan = {}) {
    if (![width, height, profile?.width, profile?.height].every(value => Number.isFinite(value) && value > 0)) return null;
    zoom = Number.isFinite(zoom) ? Math.max(1, Math.min(3, zoom)) : 1;
    const scale = Math.min(width / profile.width, height / profile.height) * zoom;
    const fittedWidth = profile.width * scale, fittedHeight = profile.height * scale;
    const maxPanX = Math.max(0, (fittedWidth - width) / 2), maxPanY = Math.max(0, (fittedHeight - height) / 2);
    const panX = Math.max(-maxPanX, Math.min(maxPanX, Number.isFinite(pan.x) ? pan.x : 0));
    const panY = Math.max(-maxPanY, Math.min(maxPanY, Number.isFinite(pan.y) ? pan.y : 0));
    return {width:fittedWidth, height:fittedHeight, left:(width - fittedWidth) / 2 + panX,
      top:(height - fittedHeight) / 2 + panY, scale, zoom, panX, panY, maxPanX, maxPanY};
  }

  const frames = new Set(), states = new WeakMap(), sheetFrames = new WeakMap(), fontDocuments = new WeakSet();
  let observer = null, fallbackBound = false;
  function measureSheet(state) {
    if (!state.sheet) return;
    // Native offset/scroll metrics ignore CSS transforms and include content
    // below the last table. A two-pixel guard covers fractional edge rounding.
    const width = Math.max(state.sheet.offsetWidth, state.sheet.scrollWidth);
    const height = Math.max(state.sheet.offsetHeight, state.sheet.scrollHeight);
    if (width > 0 && height > 0) state.profile = {width:width + 2,height:height + 2};
  }
  function watchFonts(doc) {
    if (!doc?.fonts || fontDocuments.has(doc)) return;
    fontDocuments.add(doc);
    const refit = () => { for (const frame of frames) if (frame.isConnected && frame.ownerDocument === doc) updateFrame(frame); };
    doc.fonts.ready?.then(refit).catch(() => {});
    doc.fonts.addEventListener?.('loadingdone', refit);
  }
  function updateFrame(frame, dimensions) {
    const state = states.get(frame);
    if (!state) return;
    measureSheet(state);
    const width = dimensions?.width ?? frame.clientWidth, height = dimensions?.height ?? frame.clientHeight;
    const geometry = fitGeometry(state.profile, width, height, state.zoom, state.pan);
    if (!geometry) return;
    const changed = !state.geometry || ['width', 'height', 'left', 'top', 'scale'].some(key => state.geometry[key] !== geometry[key]);
    state.pan = {x:geometry.panX, y:geometry.panY};
    state.geometry = geometry;
    for (const key of ['width', 'height', 'left', 'top']) state.canvas.style[key] = geometry[key] + 'px';
    state.canvas.style.setProperty('--photo-scale', String(geometry.scale));
    frame.classList.add('is-fitted');
    frame.classList.toggle('is-zoomed', state.zoom > 1);
    if (state.button) state.button.textContent = state.zoom > 1 ? '전체 보기' : '확대';
    if (state.button) state.button.setAttribute('aria-pressed', String(state.zoom > 1));
    if (state.button) state.button.setAttribute('aria-label', (frame.dataset.photoLabel || '영수증') + (state.zoom > 1 ? ' 전체 보기' : ' 확대'));
    const LayoutEvent = frame.ownerDocument?.defaultView?.CustomEvent;
    if (changed && typeof LayoutEvent === 'function') frame.dispatchEvent(new LayoutEvent('receiptphotolayout', {bubbles:true}));
  }
  function mount(container) {
    if (!container?.querySelectorAll) return;
    for (const frame of frames) if (!frame.isConnected) {
      observer?.unobserve(frame);
      const sheet = states.get(frame)?.sheet;
      if (sheet) { observer?.unobserve(sheet); sheetFrames.delete(sheet); }
      frames.delete(frame);
    }
    if (!observer && typeof root.ResizeObserver === 'function') observer = new root.ResizeObserver(entries => {
      for (const entry of entries) {
        if (states.has(entry.target)) updateFrame(entry.target, entry.contentRect);
        else {
          const frame = sheetFrames.get(entry.target);
          if (frame) updateFrame(frame);
        }
      }
    });
    if (!observer && !fallbackBound && typeof root.addEventListener === 'function') {
      root.addEventListener('resize', () => { for (const frame of frames) updateFrame(frame); });
      fallbackBound = true;
    }
    const found = container.matches?.('.receipt-photo-viewport') ? [container] : container.querySelectorAll('.receipt-photo-viewport');
    for (const frame of found) {
      if (!states.has(frame)) {
        const state = {profile:{width:Number(frame.dataset.photoWidth),height:Number(frame.dataset.photoHeight)},
          canvas:frame.querySelector('.receipt-photo-canvas'), sheet:frame.querySelector('[data-print-sheet]'), button:frame.querySelector('[data-photo-zoom]'), zoom:1, pan:{x:0,y:0}, drag:null};
        states.set(frame, state); frames.add(frame); observer?.observe(frame);
        if (state.sheet) { sheetFrames.set(state.sheet, frame); observer?.observe(state.sheet); }
        watchFonts(frame.ownerDocument);
        state.button?.addEventListener('click', event => {
          event.stopPropagation();
          state.zoom = state.zoom > 1 ? 1 : 2.5;
          state.pan = {x:0,y:0};
          if (state.zoom > 1) {
            measureSheet(state);
            const geometry = fitGeometry(state.profile, frame.clientWidth, frame.clientHeight, state.zoom);
            if (geometry) state.pan.y = geometry.maxPanY;
          }
          updateFrame(frame);
        });
        frame.addEventListener('pointerdown', event => {
          if (state.zoom === 1 || event.button !== 0 || event.target.closest?.('button')) return;
          state.drag = {id:event.pointerId,x:event.clientX,y:event.clientY};
          frame.setPointerCapture?.(event.pointerId); frame.classList.add('is-dragging'); event.preventDefault();
        });
        frame.addEventListener('pointermove', event => {
          if (!state.drag || state.drag.id !== event.pointerId) return;
          state.pan.x += event.clientX - state.drag.x; state.pan.y += event.clientY - state.drag.y;
          state.drag.x = event.clientX; state.drag.y = event.clientY; updateFrame(frame);
        });
        const stop = () => { state.drag = null; frame.classList.remove('is-dragging'); };
        frame.addEventListener('pointerup', stop); frame.addEventListener('pointercancel', stop);
        frame.addEventListener('wheel', event => {
          if (state.zoom === 1) return;
          event.preventDefault();
          const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? frame.clientHeight : 1;
          state.pan.x -= event.deltaX * unit; state.pan.y -= event.deltaY * unit; updateFrame(frame);
        }, {passive:false});
        frame.addEventListener('keydown', event => {
          if (state.zoom === 1) return;
          const move = {ArrowLeft:[55,0],ArrowRight:[-55,0],ArrowUp:[0,55],ArrowDown:[0,-55]}[event.key];
          if (move) { event.preventDefault(); state.pan.x += move[0]; state.pan.y += move[1]; updateFrame(frame); }
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); state.zoom = 1; state.pan = {x:0,y:0}; updateFrame(frame); }
        });
      }
      updateFrame(frame);
    }
  }
  return Object.freeze({ supports, receipt, profileFor, projectHospital, fitGeometry, mount });
});
