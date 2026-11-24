# AIMS 핀테크 체험 게임

LG 스탠바이미 2 Max에서 한 참가자가 한 게임을 선택해 진행하는 터치용 행사 키오스크입니다. 스탠바이미 브라우저에서 [게임 선택 화면](https://fintech-game.vercel.app)을 열어 게임을 고를 수 있습니다.

## 행사 운영

- **PAPER RACE** · 연습 화면에서 날짜 두 곳을 눌러본 뒤 본 경기를 시작합니다. AI의 제한 시간 안에 세 문제의 정답 쌍을 모두 찾으면 성공합니다. 기본 난이도는 45초입니다. **항목 크게 보기**에서 항목명과 값을 큰 버튼으로 선택할 수 있습니다. 서류의 **확대**를 누르면 손가락으로 서류를 이동할 수 있고, **전체 보기**로 원래 배율에 돌아갑니다.
- **ONE SHOT SCAN** · 처음 보이는 영수증을 누르면 시작합니다. 각 단계에서 움직이는 영수증을 직접 누르는 순간 촬영됩니다. 위치, 각도, 크기 순으로 각 단계에서 한 번 촬영합니다. 각 단계의 제한 시간은 7.5초이며, 세 번 모두 통과하면 성공합니다. 한 단계라도 실패하거나 시간이 끝나면 게임이 종료됩니다.
- **참가자 교대** · 결과 화면의 **다음 참가자**를 누르면 게임 선택으로 돌아갑니다. 직원이 중간에 차례를 종료하려면 화면 왼쪽 위 **뒤로가기(←) → 차례 종료**를 누릅니다. 플레이 중 키오스크 페이지를 새로고침하면 다음 참가자 확인 화면이 표시됩니다.
- 참여 단위는 현장에서 교대하는 한 차례입니다. 이름이나 전화번호를 수집하지 않으므로 동일인의 재방문 여부는 현장에서 관리합니다. 게임 기록은 해당 기기와 사이트 주소의 브라우저 저장소에 보관됩니다.

## 수정과 검증

Node.js 22 이상에서 저장소 루트의 명령을 사용합니다.

```sh
npm ci
npm run dev
```

로컬 주소는 http://127.0.0.1:8769 입니다. 터치 테스트는 배포용 정적 파일을 빌드한 뒤 독립된 브라우저로 실행합니다.

```sh
npx playwright install chromium
npm test
npm run build
```

배포판에도 같은 검사를 실행할 수 있습니다. KIOSK_TEST_URL에 검사할 배포 주소를 설정한 뒤 npm test를 실행하세요. 테스트용 브라우저는 각 참가 기록을 독립된 저장소에 보관합니다.

| 위치 | 내용 |
| --- | --- |
| index.html, touch-center.css, touch-center.js | 터치 메뉴, 게임 열기, 직원 종료 확인, 참가자 교대 |
| assets/ | AIMS 로고와 세 화면의 공통 글자·버튼 크기(kiosk.css) |
| paper-race/ | 서류 비교 화면과 게임 엔진. cases.js와 casebook.js에 문제 데이터 보관 |
| paper-race/assets/ | 원본 서류 사진. 약국 영수증은 두 게임이 공유 |
| one-shot/ | 화면(index.html, game.css), 터치 및 게임 진행(app.js), 판정(engine.js), 화면 맞춤(layout.js), 기록(storage.js) |
| tests/ | 두 게임의 승패, 연속 터치, 교대, 화면 크기별 브라우저 테스트 |
| scripts/build.mjs, vercel.json | 공개할 정적 파일을 dist/에 모으는 빌드와 Vercel 설정 |

ZIP 원본은 첫 커밋 `d54749f`에서 확인할 수 있습니다. 원본의 center.js와 center.css는 이전 운영자 화면용 파일입니다. 현재 메뉴는 touch-center.js와 touch-center.css를 사용합니다.

## GitHub와 Vercel

[aims-jun/fintech-game](https://github.com/aims-jun/fintech-game)의 main 브랜치가 [Vercel 프로젝트](https://vercel.com/juns-projects-c52d4ab2/fintech-game)에 연결되어 있습니다. 기능 브랜치에서 수정하고 테스트한 뒤 main에 병합하면 Vercel이 저장소 루트에서 빌드하고 [운영 사이트](https://fintech-game.vercel.app)를 갱신합니다.

빌드 명령과 출력 디렉터리는 vercel.json에서 관리합니다. 배포 상태와 커밋은 Vercel 프로젝트의 Deployments에서 확인할 수 있습니다. 이전 버전으로 복구하려면 해당 변경을 Git에서 되돌린 뒤 main에 반영하세요.
