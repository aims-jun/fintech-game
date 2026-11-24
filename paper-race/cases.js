/* Fictional exhibition fixtures. All values are equally interactive. */
(function (root) {
  'use strict';
  const row = (id, label, value) => ({id,label,value});
  root.AIMS_CASES = [
    {
      id: 'date', label: '날짜', title: '같은 진료, 다른 날짜.',
      instruction: '서로 맞지 않는 두 값을 찾아 눌러주세요.',
      hint: '청구서와 영수증에 적힌 진료일을 비교해보세요.',
      needs: ['d-claim-date','d-receipt-date'],
      reveal: '11월 18일 ≠ 11월 19일',
      explanation: '같은 진료 건인데 날짜가 달라요. 어느 쪽이 맞는지 확인해야 해요.',
      docs: [
        {kind:'claim', issuer:'AIMS 체험보험', title:'보험금 청구서', subtitle:'질병 · 상해 / 통원 의료비', serial:'CLM 2026-0182',section:'청구 사항',
          rows:[row('d-claim-name','청구인','홍길동'),row('d-claim-person','피보험자','홍길동'),row('d-claim-date','진료일','2026.11.18'),row('d-claim-type','진료 구분','외래'),row('d-claim-hospital','의료기관','가온의원'),row('d-claim-issued','청구일','2026.11.20')],
          footer:'위 내용과 같이 보험금을 청구합니다.',signature:'청구인  김 다 온  (서명)'},
        {kind:'receipt',issuer:'가온의원',title:'진료비 계산서·영수증',subtitle:'외래 진료 / 환자 보관용',serial:'RCT 2026-0182',section:'진료 및 수납 내역',
          rows:[row('d-receipt-name','환자 성명','홍길동'),row('d-receipt-date','진료일','2026.11.19'),row('d-receipt-base','급여 본인부담','15,000원'),row('d-receipt-extra','비급여','25,000원'),row('d-receipt-total','총 수납금액','40,000원'),row('d-receipt-issued','발행일','2026.11.20')],
          footer:'상기 금액을 정히 영수합니다.',signature:'가 온 의 원  (인)'}
      ]
    },
    {
      id:'total',label:'금액',title:'내가 낸 돈, 맞을까?',
      instruction:'두 서류의 총액을 비교하고, 두 값을 눌러주세요.',
      hint:'세부내역의 진료비 합계와 영수증의 총 수납금액을 비교해보세요.',
      needs:['m-detail-total','m-receipt-total'],reveal:'40,000원 ≠ 58,000원',
      explanation:'같은 진료 건의 합계와 수납금액이 달라요. 차이가 생긴 이유를 확인해야 해요.',
      docs:[
        {kind:'detail',issuer:'가온의원',title:'진료비 세부산정내역',subtitle:'홍길동 / 2026.11.19 / 외래',serial:'DET 2026-0183',section:'환자 부담금 내역',
          rows:[row('m-detail-fee','초진 진찰료','15,000원'),row('m-detail-lab','혈액검사','12,500원'),row('m-detail-other','소변검사','12,500원'),row('m-detail-discount','감면 금액','0원'),row('m-detail-total','진료비 합계','40,000원'),row('m-detail-date','발행일','2026.11.20')],
          footer:'각 항목은 환자 부담금 기준입니다.',signature:'가 온 의 원  (인)'},
        {kind:'receipt',issuer:'가온의원',title:'진료비 계산서·영수증',subtitle:'외래 진료 / 환자 보관용',serial:'RCT 2026-0183',section:'진료 및 수납 내역',
          rows:[row('m-receipt-name','환자 성명','홍길동'),row('m-receipt-date','진료일','2026.11.19'),row('m-receipt-total','총 수납금액','58,000원'),row('m-receipt-prior','이미 납부한 금액','0원'),row('m-receipt-method','납부 방법','신용카드'),row('m-receipt-issued','발행일','2026.11.20')],
          footer:'상기 금액을 정히 영수합니다.',signature:'가 온 의 원  (인)'}
      ]
    },
    {
      id:'duplicate',label:'중복',title:'한 번 받은 검사가 두 번?',
      instruction:'왼쪽 서류에서 중복된 검사 두 줄을 눌러주세요.',
      hint:'같은 시각에 받은 혈액검사가 두 줄로 적혀 있어요.',
      needs:['r-detail-first','r-detail-second'],reveal:'혈액검사 · 10:30 → 두 번 기록',
      explanation:'시행 기록은 한 번, 청구 내역은 두 줄이에요. 반복 검사였는지 추가 확인이 필요해요.',
      docs:[
        {kind:'detail',issuer:'가온의원',title:'진료비 세부산정내역',subtitle:'홍길동 / 2026.11.19 / 외래',serial:'DET 2026-0184',section:'진료 항목 · 시행 시각',
          rows:[row('r-detail-fee','초진 진찰료 · 10:10','15,000원'),row('r-detail-first','혈액검사 · 10:30','12,500원'),row('r-detail-urine','소변검사 · 10:40','8,000원'),row('r-detail-second','혈액검사 · 10:30','12,500원'),row('r-detail-total','진료비 합계','48,000원'),row('r-detail-date','발행일','2026.11.20')],
          footer:'각 항목은 환자 부담금 기준입니다.',signature:'가 온 의 원  (인)'},
        {kind:'record',issuer:'가온의원',title:'검사 시행 기록',subtitle:'외래 검사실 / 진료 내역 대조용',serial:'LAB 2026-0184',section:'검사 확인 사항',
          rows:[row('r-record-name','환자 성명','홍길동'),row('r-record-date','진료일','2026.11.19'),row('r-record-blood','혈액검사','10:30 · 1회'),row('r-record-urine','소변검사','10:40 · 1회'),row('r-record-repeat','추가 시행 기록','없음'),row('r-record-issued','발행일','2026.11.20')],
          footer:'검사실에 등록된 시행 기록입니다.',signature:'검 사 실  (인)'}
      ]
    }
  ];
  if(typeof module!=='undefined')module.exports=root.AIMS_CASES;
})(typeof window!=='undefined'?window:globalThis);
