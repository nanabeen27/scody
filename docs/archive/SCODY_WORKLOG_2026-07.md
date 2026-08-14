# Scody 작업 로그 — 2026-07

마스터 플랜에서 걷어 낸 진행 기록을 여기에 남긴다. 정책과 현재 상태는 `docs/SCODY_MASTER_PLAN.md`에 있다.

## M0~M7 (프로토타입 완성)

| 마일스톤 | 결과 |
|---|---|
| M0 프로젝트 기반 | Expo·TypeScript·Expo Router 골격, 역할별 라우트, 디자인 토큰, `RoleShell`, 결정적 fixture, typecheck·lint·jest·playwright 실행 경로 |
| M1 로그인·가입·역할 분기 | 카카오 우선 로그인 UI, 스코디 아이디/비밀번호, 역할 선택, 초대 링크 인식, 다역할 계정의 공간 선택 |
| M2 학생 핵심 흐름 | 홈 3초 위계, 학습 상세, 문제 풀이(지문형·문법형, 몰입 모드, 풀이 시간, iPad 2단·펜 필기), 자동 저장, 제출·결과, 기록 |
| M3 학부모 핵심 흐름 | 자녀 연결·전환, 학습 현황, 리포트, 미완료·반복 오답, 구독 상태, 다시 풀게 하기 |
| M4 학원 핵심 흐름 | 원장·선생 권한 분기, 초대, 반·학생, 학습 배정, 제출 현황, 성과 분석, 학원 관리, 문제 등록 |
| M5 이용권·소속 경계 | 개인·학원 이용권 병존, 학원 연결/종료, 중복 계정 차단, 개인 학습 열람 제한 |
| M6 품질 정리 | 3뷰포트 반응형, 접근성 셀렉터, 빈·오류·로딩 상태, AI 디자인 제거, 문구 정리 |
| M7 범위 밖 확장 | `/admin` 운영 대시보드, Scody AI(OpenRouter), 오답노트, 리포트 확장, iPad 최적화, 학원 가입·문제 등록 |

## 품질 개선 캠페인 (사이클 18개)

점수: 미평가 → 83.2 → 88.6 → 96.2. 채점 근거와 완료 조건 대조는 `docs/PRODUCT_QUALITY_SCORE.md`.

### 배치 1 (사이클 1~8)

| 문제 | 등급 | 조치 |
|---|---|---|
| 로그아웃 후 다른 계정에서 이전 학생 기록·오답노트가 보임 | P0 | 기록을 계정별로 분리, 열람 권한을 provider에서 검사(본인·연결된 자녀만) |
| 학생이 학원 과제를 제출해도 학원·학부모 화면에 반영 안 됨 | P1 | 제출 시 본인 제출 행 갱신 |
| 성과 분석이 "개인 학습 상세 비공개"라 쓰고 개인 학습 오답을 표시 | P1 | 해당 섹션을 미제출 학생 확인으로 교체 |
| 재제출이 기존 기록을 조용히 덮어씀 | P1 | 재제출 전 확인 단계 |
| 제출 후 상세에서 결과로 돌아갈 수 없음 | P1 | 상세에 결과 다시 보기 |
| 몰입 모드 이탈이 항상 홈으로, 아이콘 방향 반대 | P2 | 들어온 화면 복귀 + `chevron-left` |
| 오답 삭제 무확인, 기록 빈 상태 막다름 | P2 | 삭제 확인, 빈 상태 행동 |
| 상세·결과에 이탈 경로 없음 | P2 | `Screen backFallback`(직접 진입 시 역할 상위 경로) |

### 배치 2 (사이클 9~12)

- 학원이 등록한 문제가 전체 학생 개인 학습에 공개됨(P1) → 학원 콘텐츠는 배정 전용, 운영자 콘텐츠만 공개
- 학부모의 "다시 풀게 하기"가 자녀 기록을 삭제(P1) → 요청만 기록, 기존 기록 유지 + 피드백
- "오늘 진행률"이 전체 진행률 → 라벨 정정
- 반 상세 학생 행 무동작 → 학생별 제출 요약
- 문제 등록 폼에 취소 경로 없음 → 뒤로 제공
- 관리자 대시보드가 fixture 집계를 실제 지표처럼 표시 → 테스트 데이터·추정값 표기

### 배치 3 (사이클 13~18)

- 학원이 다른 학원 콘텐츠까지 배정 가능(P1) → `ContentSet.ownerAcademyName` 기준 필터
- `/select-space` 직접 진입 시 흰 화면 → 로그인 리다이렉트
- 다역할 계정이 로그아웃 없이 공간 전환 불가 → 설정에 "공간 바꾸기"
- 배정 마감일 입력 없음 → 입력·형식 검증·학생 화면 전달
- 등록 문제에 해설 입력 없음 → 문항별 해설 → 결과 화면 노출
- 학부모 홈의 정보 없는 안내 블록 축소, `ask.tsx` 주석을 실제 구현과 일치
- 키보드만으로 로그인(Enter) 회귀 테스트 확보

## 개발 데이터 규모 확대

- `src/data/roster.ts`: 반 120개 · 선생 60명 · 학생 3,000명을 결정적 생성. 로스터 계정은 비밀번호가 없어 로그인 불가
- 원장의 선생 추가·제외(`src/features/academy.tsx`), 제외 시 담당 반은 미배정 표시
- 반·선생 목록에 검색과 더보기(12개 단위), 총 반·학생 수 요약
- 콘텐츠: 모든 세트를 10문항 이상으로. 문법 은행 4세트는 20~25문항(`src/data/grammarBank.ts`). 학생 공개 11세트·144문항
- 학년(`grade`)·세부 유형(`topic`) 분류 도입(`src/data/taxonomy.ts`) → 학습 탭을 학년 → 영역 → 유형 뎁스로 재구성
- 학원 결제 학생에게 미결제처럼 읽히던 개인 학습 안내 문구 교정
- 학부모 리포트를 종합 리포트 + 학습별 상세 리포트로 재기획(취약 영역, 영역별 정답률, 문항별 정오, 재풀이 요청)

## Scody AI · 오답노트 학습 체계

- 선프롬프트를 Toss 말투로 재작성(`src/features/prompts.ts`)
- 답변 스트리밍(`askScodyAIStream`, SSE) + 스트림 미지원 환경 폴백
- 마크다운 렌더러 `src/components/RichText.tsx` — `**`, `*`, 백틱, 제목, 목록을 서식으로 반영(기호 노출 제거)
- 질문 입력창을 `AskField`로 통합: 입력 시에만 강조색 원형 위쪽 화살표 버튼이 입력창 안 오른쪽에 나타남. 오답노트에서는 문제 카드와 한 몸(hairline 구분)
- 오답노트: 지문 함께 표시, 카테고리 칩 필터, 별표, 요약 버튼 상태 전환(`노트에 정리해 두기` → `노트에 추가됐어요`), 삭제 확인, 맨 아래 마무리 안내
- 기록 탭에 "오답노트로 공부하기" 섹션(카테고리별 진입, 별표 집중 복습)
- 카드 복습 화면 `app/student/review.tsx`: 카드별 다시 풀기 → 정답·처음 답·내 메모 → 추가 질문(스트리밍) → 메모 재정리, 이해 완료 표시, 진행률·결과 요약
- 오답노트 열람: 학부모는 메모·별표까지, 학원은 배정 학습 오답만(`academyNotesOf`)

## 검증 이력

- `npm run typecheck` 통과, `npm run lint` 오류 0(생성 파일 `.expo/types/router.d.ts` 경고 1건은 기존)
- `npm test`: 30 → 38건 통과(로스터 규모, 콘텐츠 문항 하한, 마크다운 파서 테스트 추가)
- `npx playwright test`: 87 → 156건 전체 통과 이력. 규모·뎁스 개편 이후로는 desktop 56/56 통과를 확인했고, tablet·mobile은 로컬 머신 커밋 한도 고갈(`0xC0000142` 워커 크래시)로 미완
- 화면 확인: 모바일 390 / 태블릿 820 / 데스크톱 1280·1440

## 폐기한 문서

- `docs/LOOP.md`, `docs/LOOP_STATE.md` — 반복 개선 캠페인 종료로 삭제. 절차와 상태는 이 로그로 대체

## 웹 홈(랜딩) 리디자인 — 쏠북·뱅크샐러드 참고 (2026-07-26)

대상은 `src/features/landing/WebLanding.tsx` 하나(웹 `/login`에서 보이는 소개형 홈). 앱 화면·토큰·메인 컬러는 건드리지 않았다.

참고 자료는 firecrawl로 수집: `solvook.com`(+ `/categories?id=10`), `banksalad.com`(+ `/cards`)의 마크다운·branding·스크린샷.

가져온 규칙

- 두 사이트 모두 본문 Pretendard, 강조색은 1개, 그라데이션·발광 없음. 값(가격·혜택 금액·정답률)만 굵게·강조색, 라벨은 회색 — 미리보기 줄(`PreviewLine`)과 취약 영역 목록에 반영
- 섹션 머리가 '작은 회색 한 문장 → 큰 제목' 순서(뱅샐: "내게 맞는 금융상품, 비교하기 힘드시죠?" → "쉽고 정확하게 비교합니다"). 한글에 대문자 eyebrow를 쓰지 않도록 전부 교체
- 목록은 카드 테두리 대신 hairline 구분선(쏠북 자료 목록, 뱅샐 카드 목록). 역할 3분할을 테두리 카드 → 세로 hairline으로 변경
- 라벨 좌 · 항목 인라인 필터 줄(뱅샐 카드 필터) → 실제 제공 학년·영역을 밝히는 얇은 띠 `ScopeStrip` 신설
- 뱅샐 홈은 소개 블록이 2개뿐이고 전체 길이가 짧다(1280폭 2,805px). 같은 모양 반복을 줄이는 근거로 사용

변경

- 섹션 여백을 균일 56 → 단계형(`band.xs 36 / sm 24 / md 72 / lg 88`). 히어로 아래만 크게 쉬고, 학습 범위 띠는 짧게 지나가게
- 소개 블록 4개(01~04, 각 380~450px) → 3개. 세 번째는 가운데 머리 + 미리보기 2단으로 배치를 달리해 반복감 제거
- 근거 없는 지표 밴드(`StatBand`: "하루 권장 학습 15분", "복습 목표 100%", "4영역") 삭제. 대신 사실인 학년·영역만 표기
- 한글 타이포 교정: 히어로 46/62(모바일 34/46), 섹션 제목 32/44, 자간 -0.6 → -0.2. 기존 46/52·32/38은 한글에서 줄이 붙어 보였다
- 히어로 CTA 높이 40 → 52, 라운드 `lg`. 전체폭 버튼 3개 → 카카오·다른 방법 2개 + "스코디가 처음이라면 시작하기" 텍스트 링크(`login-signup` testID 유지)
- 본문 문장 길이 축소(끝줄에 "요."만 남던 고아줄 제거), 미리보기에 `예시 화면` 표기, 테스트 계정 펼침에 "개발용 계정이에요" 문구 추가
- 태블릿(820) 회귀 수정: 목업 440px 고정폭이 2단 배치에서 본문을 침범해 글자가 겹쳤다. 2단은 데스크톱(≥1024)에서만, 목업은 `width:100% / maxWidth:440`

결과

- 데스크톱 1280 전체 높이 4,126 → 3,755px. 블록 높이 595·414·445·381·448·395·522·400·239·220 → 550·146·474·479·411·632·502·292·204
- 유지: 메인 컬러(청록), 모든 testID(`login-kakao` `login-other` `login-id` `login-pw` `login-submit` `login-signup` `login-signup-academy`), `카카오로 계속하기` 문구, 미리보기 목업 5종

검증

- `npm run typecheck` 통과, `npx eslint src/features/landing/WebLanding.tsx` 오류 0
- `npm test` 38건 통과
- `npx playwright test e2e/auth-flow.spec.ts e2e/a11y.spec.ts`: desktop 15/15, tablet 15/15, mobile 15/15 통과
- 화면 확인: 모바일 390 / 태블릿 820 / 데스크톱 1280 (라이트·다크)

남은 판단

- 두 참고 사이트의 한글 인상은 Pretendard에서 온다. 스코디는 Inter + 시스템 폴백(윈도우는 맑은 고딕)이라 본문 질감이 다르다. 폰트 교체는 전 화면·번들에 영향이 있어 이번 범위에서 하지 않았다 → 결정 대기 M9-03

## 본문 폰트 Pretendard 전환 (2026-07-27)

랜딩 리디자인에서 남긴 결정 대기 M9-03을 사용자가 "전체 폰트 다 Pretendard로"로 확정 → D-016.

무엇을 했나

- `assets/fonts/`에 Pretendard TTF 4무게 번들(Regular·Medium·SemiBold·Bold, 약 10.8MB) + `Pretendard-LICENSE.txt`(SIL OFL 1.1). npm `pretendard@1.3.9`의 `dist/public/static/alternative`에서 가져왔고, 런타임 의존성으로 추가하지는 않았다(정적 자산만 복사). CDN·네트워크 의존 없음
- `app/_layout.tsx`의 `useFonts`가 로컬 TTF를 로드. `SpaceGrotesk_700Bold`만 남기고 `SpaceGrotesk_600SemiBold`·Inter 4종 제거
- `src/theme/tokens.ts`: `typeface.regular/medium/semibold/bold` → Pretendard. `display`·`displaySemi` 제거하고 `wordmark`(Space Grotesk) 신설. `FONT_KEYS`도 실제 로드 키와 일치시킴
- `src/components/Brand.tsx` → `typeface.wordmark`. `src/components/AppText.tsx`의 `display` variant → `typeface.bold`(큰 제목도 본문과 같은 골격)
- `@expo-google-fonts/inter` 의존성 제거(사용처 없음)
- `DESIGN.md` 4절 Typography를 새 기준으로 교체: 폰트 정의·번들 위치·라이선스, 워드마크 전용 규칙, 라틴 전용 폰트 금지 이유, 한글 자간 상한(-0.2), 한글 줄간격(큰 제목 1.3~1.35 이상)

검증

- `npm run typecheck` 통과, `npm run lint` 오류 0(경고 2건은 기존: 생성 파일 eslint-disable, `app/student/ask.tsx` 미사용 `radius`)
- `npm test` 38/38
- `npx playwright test` 3뷰포트 전체 통과: desktop 61/61 · mobile 61/61 · tablet 61/61 (총 183건). 마스터 플랜의 "tablet·mobile 전체 E2E 미완" P2 항목 해소
- 브라우저에서 `document.fonts` 확인: `Pretendard_400Regular/500Medium/600SemiBold/700Bold`, `SpaceGrotesk_700Bold` 모두 `loaded`, Inter 없음. 히어로 제목 computed `font-family: Pretendard_700Bold, ...`
- 화면 확인: 랜딩·학생 홈 1280 라이트(워드마크만 Space Grotesk 유지 확인)

남은 것

- 웹 번들에 TTF 4종이 그대로 들어간다(약 10.8MB). 운영 웹 배포 전 woff2 동적 서브셋 또는 글리프 서브셋으로 교체 필요 → 남은 작업 P3

## 관리자 페이지 개편 (2026-07-27)

메뉴 2개(콘텐츠·문제 등록) → 6개. 요금 설정·페이지네이션·카테고리 드릴다운·감사 로그를 새로 넣었다.

### 조사한 것

firecrawl로 백오피스 설계 관례를 모았다(SaaS 대시보드 IA, 슈퍼관리자 패널, 멀티테넌트 관리 기능 목록). 반복적으로 나온 요소:

- 1단(핵심 지표·경고·주요 행동) → 2단(필터·상세 표)로 위계를 나눈다
- 드릴다운: 목록에서 눌러 상세로, 상세에서 원인 문항까지
- 테넌트·계정·요금제/구독·카탈로그·감사 로그가 기본 메뉴
- 지표 정의를 화면에 적어 숫자를 믿게 만든다(context/definitions)
- 실시간에 집착하지 않고 데이터 출처와 갱신 방식을 밝힌다

스코디에 맞게 뺀 것: SSO/SCIM, 계정 가로채기(impersonation), 기능 플래그. 프로토타입 단계에 보안 위험만 크고 검증할 흐름이 없다.

### 새 화면

| 경로 | 내용 |
|---|---|
| `/admin` | 지표 6종(학원·학생 계정·MRR·ARPU·콘텐츠·누적 풀이) → 배정 제출률 → 확인이 필요해요 → 최근 등록 콘텐츠 → 자세히 보기 → 지표 정의 |
| `/admin/academies` | 학원 목록. 검색 + 페이지네이션. 좌석·청구액·제출률 |
| `/admin/academy/[id]` | 학원 상세. 좌석·청구액·반/선생님 수·평균 정답률, 제출률, 반 목록(제출률 낮은 순 + 페이지네이션) |
| `/admin/users` | 계정 3,069건. 역할·이용권 칩 필터 + 이름·아이디 검색 + 페이지네이션(20) |
| `/admin/billing` | 월정액 단가 3종 + 비율 4종을 증감으로 설정. MRR·ARR·개인/학원 매출 구성비 즉시 반영. 학원별 청구액. 계산식 설명 |
| `/admin/content` | 영역 칩(개수 표시) + 정렬 3종 + 검색 + 페이지네이션(10). 세트/누적 풀이/학원 배정 풀이/개인 학습 풀이 집계. 콘텐츠 없는 세부 유형 |
| `/admin/content/[id]` | 학원 배정 풀이 vs 개인 학습 풀이(구성비), 평균 정답률, 문항별 오답률 막대, 어려운 문항 5개, 배정 학원·공개 여부·소유 |
| `/admin/ops` | 기본값과 다른 요금 항목, 변경 기록(감사 로그 + 분류 필터), 숫자의 출처, 아직 없는 것 |

### 새 모듈

- `src/data/usage.ts` — 콘텐츠·문항 id를 FNV-1a로 해시해 만드는 **결정적 테스트 집계**(배정 풀이·개인 풀이·평균 정답률·문항별 오답률). 세션 실측(배정 제출)을 더해서 보여 준다. 같은 id면 값이 흔들리지 않는다
- `src/features/pricing.tsx` — 요금 정책 provider. 항목별 허용 범위·step을 `PRICING_LIMITS`에 두고 화면과 검증이 같은 값을 쓴다. `academyMonthly`(규모 할인), `personalMonthly`(연 결제 비율 반영)
- `src/features/audit.tsx` — 운영자 행동 기록. `atISO`는 `YYYY-MM-DDTHH:mm:ss`
- `src/components/Pager.tsx` — "13개 중 1–10" + 이전/다음. 끝 페이지에서 버튼이 비활성
- `src/components/StatTiles.tsx` — 라벨 → 값 → 뜻 3단 타일. `maxWidth`가 있어 마지막 줄에 하나만 남아도 전폭으로 늘어나지 않는다
- `src/components/Chips.tsx` — 개수 붙는 단일 선택 필터 칩

### 고친 버그

- `src/components/Row.tsx`: `onPress`가 없으면 `testID`가 사라졌다(`if (!onPress) return body`). 누를 수 없는 행도 testID를 갖게 했다 — 계정 목록 E2E가 이 때문에 실패했다
- 매출·풀이 구성비가 `Math.round`로 0%가 되어 "없는 것"처럼 읽혔다 → 0으로 반올림되면 `1% 미만`으로 표기
- 운영 기록에서 비율 항목이 단위 없이 `현재 20`으로 나왔다 → 항목별 단위(원/%/명) 적용

### 정직성 경계

- 풀이 횟수·오답률은 테스트 집계임을 6개 화면 전부에 표기. 출처는 `/admin/ops`의 "이 숫자는 어디서 왔나요"에 모아 뒀다
- 요금은 추정값이고 실제 결제·정산이 아니라고 밝힌다. 기존 E2E가 검사하는 문구(`프로토타입 테스트 데이터 기준`, `실제 결제·정산 기록이 아닙니다`)는 그대로 유지
- 계정 목록에 비밀번호를 넣지 않았다. 로스터 계정은 로그인할 수 없다고 화면에 적었다
- 학원 상세에서 학생 개인 학습 상세로 가는 경로를 만들지 않았다(확정 정책)

### 검증

- `npm run typecheck` 통과, `npm run lint` 오류 0(경고 2건은 기존)
- `npm test` 38/38
- `npx playwright test` 3뷰포트 전체 통과: desktop 68/68 · mobile 68/68 · tablet 68/68 (204건). 관리자 E2E는 7건 추가(메뉴 이동, 영역 필터 + 페이지 이동, 콘텐츠 상세 지표·문항 오답률, 요금 변경 → 운영 기록 반영, 학원 상세, 계정 검색·필터, 비운영자 접근 차단)
- 기존 관리자 E2E 5건은 문구·testID를 바꾸지 않고 통과. `admin-new` 버튼과 최근 등록 콘텐츠 목록을 개요에 남겨 두었다
- 화면 확인: 개요·학원·계정·요금제·콘텐츠·콘텐츠 상세·운영 기록 데스크톱 1280 라이트, 관리자 탭바 모바일 390(6개 라벨 한 줄에 들어감)

### 남은 것

- 반 상세에서 학생별 결과로 가는 경로 없음(기존 Q-031) — 관리자 학원 상세도 같은 한계
- 콘텐츠 정렬·검색이 클라이언트 필터. 실제 수천 건이면 서버 페이지네이션·인덱스 필요
- 감사 로그는 메모리. 운영에서는 서버 append-only여야 한다

---

## 소개 페이지 신설(`/introduce`)과 로그인·가입 방법 교체 — 2026-07-27

### 요청

1. 좌측 상단 `Scody` 워드마크를 누르면 홈으로 갈 것
2. 메인 페이지의 `카카오로 계속하기`·`다른 방법으로 로그인`·`스코디가 처음이라면 시작하기`를 없애고, 우측 상단에 `로그인`·`회원가입`을 둘 것
3. 로그인 화면은 `카카오로 로그인`·`휴대폰 번호로 로그인`, 그 아래 `스코디에 처음 오셨나요?` + `회원가입`
4. 회원가입 화면은 `카카오로 가입하기`·`휴대폰 번호로 가입하기` 두 개
5. 메인 페이지 주소를 `/login` → `/introduce`로, 방문자 토글(학생·학부모·선생님)로 내용 전환, 소개 문장 고정, 개인 문제 제공을 드러낼 것

### 확정 정책 변경

- 기존 2절 정책은 `카카오로 계속하기` + `다른 방법으로 로그인`(아이디·비밀번호) 두 가지였다. 사용자 지시로 카카오 + 휴대폰 번호로 교체하고 D-020으로 기록했다.
- 소개 문장 고정은 D-021로 기록했다.

### 한 일

- `src/components/RoleShell.tsx`: 워드마크를 `Pressable`로 감싸 역할 홈(`nav[0].href`)으로 이동. 데스크톱 사이드바·모바일 상단 바 공통(`testID="brand-home"`)
- `src/data/types.ts`·`fixtures.ts`: `Account.phone` 추가, 로그인 가능한 9계정에 합성 번호(`010-1000-0001` 형태) 부여, `DEMO_PHONE_CODE = '000000'` 추가. 로스터 계정은 번호가 없어 여전히 로그인 불가
- `src/data/index.ts`: `normalizePhone`·`authenticateByPhone`·`isPhoneTaken` 추가, `makeAccount`에 `phone`·`kakaoLinked` 입력 추가. 기존 `authenticate`(아이디·비밀번호)는 남겨 뒀다
- `app/login.tsx`: 카카오 / 휴대폰(번호 → 인증번호 2단계) + `스코디에 처음 오셨나요?` + 회원가입. 없는 번호는 인증번호 단계로 넘기지 않는다. 테스트 계정 목록 유지
- `app/signup.tsx`: 방법 선택 → (휴대폰이면 번호 확인) → 이름·아이디·비밀번호·역할. 카카오는 번호 단계를 건너뛴다
- `src/features/landing/WebLanding.tsx`: props 없는 컴포넌트로 재작성. 상단 로그인·회원가입(로그인 상태면 `내 공간으로 가기`), 첫 문장 고정 소개문, `어떤 분이세요?` 토글, 유형별 본문 3섹션, 제공 범위 띠에 유형 행 추가, 새 목업 5종(`PickMock`·`ChildSummaryMock`·`AssignMock`·`SubmitMock`·`SourceSplitMock`)
- `app/introduce.tsx` 신설, `app/index.tsx`는 로그아웃 상태에서 웹 `/introduce` · 앱 `/login`으로 분기
- 큰 제목에 `wordBreak: keep-all`(웹 전용) 적용. RNW 기본값이 `break-word`라 `만드/는 학습`처럼 한글 단어 중간이 끊겼다

### 정직성 경계

- 휴대폰 인증은 목업이다. 인증번호 입력란 힌트에 프로토타입 값(`000000`)임을 밝힌다
- 소개 페이지 목업 전부에 `예시 화면` 표기. 자녀 요약은 fixture 이름 대신 `자녀`로 뒀다
- 테스트 계정 목록은 `개발용 계정이에요. 실제 사용자 데이터가 아니에요.`를 유지

### 검증

- `npm run typecheck` 통과, `npx eslint app src e2e` 오류 0(경고 1건은 기존 `app/student/ask.tsx`의 미사용 `radius`)
- `npm test` 38/38
- `npx playwright test` 3뷰포트 전체: 워드마크 홈 이동 추가 후 141건 통과 → 로그인 방법 교체 후 228건 중 6건 실패(`boundary-flow`가 `/signup` 진입 직후 상세 필드를 기대) → 방법 선택 단계 추가 후 재실행 84/84 통과
- E2E 갱신: 공용 헬퍼 `e2e/_auth.ts`(번호 매핑 + `loginHere`/`login`) 신설, 7개 스펙의 로컬 로그인 헬퍼를 휴대폰 인증으로 교체, `auth-flow.spec.ts`는 소개 라우트·토글·휴대폰 오류 경로·2단계 가입까지 재작성
- 화면 확인: `/introduce` 데스크톱 1280(학생·선생님 토글) · 모바일 390, `/login`·`/signup` 방법 선택 화면

### 남은 것

- A-020: 인증번호 발송·재발송·만료·시도 제한 없음(목업)
- A-021: 아이디 찾기·비밀번호 재설정 진입점이 사라졌다. 복구 흐름을 휴대폰 기준으로 다시 설계해야 한다
- 소개 페이지 방문자 선택이 URL에 남지 않는다(새로고침하면 학생으로 돌아온다)

---

## 문항 추천, 워드마크 이탈 경로, 푸터 문서 — 2026-07-27 (이어서)

### 요청

1. 틀린 문제가 있으면 비슷한 유형의 문제를 추천하는 시스템을 기획·설계해 넣을 것
2. 로그인 화면에서 `Scody`를 눌러 뒤로 나갈 수 있게 할 것
3. 문제 추천으로 약점을 고친다는 점을 메인 페이지에서 강조할 것
4. 방문자 토글을 상단 `Scody` 우측으로 옮기고 `어떤 분이세요?` 문구는 삭제
5. 푸터에 서비스 소개·이용약관·개인정보처리방침·사업자정보를 넣고 클릭하면 내용이 보이게 할 것

### 문항 추천 설계

- 추천 단위는 **학습 세트**. 문항은 세트 안에 유형별로 묶여 있고 풀이 화면·라우팅도 세트 기준이라 그대로 재사용된다.
- 후보는 **아직 안 푼 개인 학습**만. 학원 학습은 배정으로만 전달하는 정책이라 추천에 넣지 않았다.
- 점수: 같은 세부 유형(topic) 오답 +3, 영역만 일치 +1, 학년 일치 +1(한 번), 별표 오답은 가중치 2배.
- 동점이면 오답 수 → 제목 순으로 정렬해 순서를 고정했다(같은 상태에서 순서가 흔들리지 않게).
- 근거를 문장으로 함께 낸다: `문법 · 음운의 변동에서 2문항 틀렸어요`. 추측 확률·점수는 화면에 쓰지 않는다.
- 구현: `src/features/recommend.ts`의 순수 함수 `rankRecommendations` + 훅 `useRecommendations`. 노출 위치는 결과 화면(2개)과 오답노트 화면(3개).
- 신호는 **오답노트에 담은 문항**에서 나온다. 담기 전에는 추천이 없다(학생이 담는 행동을 근거로 삼는다).

### 한 일

- `src/features/recommend.ts` 신설, `__tests__/recommend.test.ts` 7건으로 점수 규칙 고정
- `app/student/result/[id].tsx`: `비슷한 유형으로 이어서 풀어요` 섹션(추천 2개, 이유 문장 포함)
- `app/student/notebook.tsx`: 하단 `이 유형 더 풀어볼까요?` 섹션(추천 3개)
- `src/components/Brand.tsx`: 옵셔널 `onPress` 추가. 로그인 화면은 소개 페이지로, 가입 화면은 앞 단계로 나간다
- `src/features/landing/WebLanding.tsx`: 방문자 토글을 상단 바 워드마크 옆으로(모바일은 아래 줄), `어떤 분이세요?` 삭제, 학생 약점 섹션을 `약점은 비슷한 문제로 고쳐요`로 바꾸고 `RecommendMock` 추가, 히어로 불릿에 추천 항목 추가
- `src/features/legal/documents.ts` + `LegalDocView.tsx`, 라우트 `app/legal/{about,terms,privacy,business}.tsx`, 랜딩 푸터에 문서 링크 4개

### 문서 작성 근거

- 개인정보처리방침 항목 순서는 개인정보 보호법 제30조 제1항(처리 목적 → 보유 기간 → 제3자 제공 → 위탁 → 파기 → 권리 행사 → 보호책임자 → 자동수집장치)을 따랐다
- 사업자정보는 전자상거래법상 표시 항목(상호·대표자·사업자등록번호·통신판매업 신고번호·주소·전화·전자우편·호스팅 제공자)의 틀만 두었다
- 약관에는 이 서비스에 실제로 있는 것만 적었다: 역할별 권한 경계(제9조), AI 답변의 한계와 외부 전송(제12조), 학원 연결 종료 후 기록 유지(제7조)
- 개인정보처리방침에 Scody AI 호출로 질문·문항 텍스트가 국외 사업자에게 전송될 수 있다는 사실을 적었다(현재 OpenRouter 경유 구조)

### 정직성 경계

- 약관·개인정보처리방침 첫 줄에 `검토 전 초안이에요`를 두고, 랜딩 푸터에도 같은 사실을 적었다
- 사업자등록번호·주소·대표자명을 지어 넣지 않았다. 전부 `준비 중`이고 그 이유를 화면에 적었다
- 권익침해 구제 연락처(1833-6972 / 118 / 1301 / 182)는 실제 공공기관 번호다
- 랜딩 `RecommendMock`은 제품과 같은 문장 형태를 쓰되 `예시 화면`으로 표시했다

### 검증

- `npm run typecheck` 통과, `npx eslint app src` 오류 0(경고 1건은 기존 `app/student/ask.tsx`)
- `npx jest __tests__/recommend.test.ts` 7/7
- `npx playwright test e2e/recommend-flow.spec.ts --project=desktop` 4/4 (담기 전 추천 없음 → 담은 뒤 추천·이유 표시 → 추천 클릭 시 학습 상세 → 오답노트 추천 → 오답 없으면 추천 없음)
- `auth-flow` 신규 3건(푸터 문서 4개 순회, 로그인 워드마크 이탈, 가입 워드마크 단계 뒤로) desktop 통과
- 화면 확인: `/introduce` 데스크톱 1280·태블릿 820·모바일 390(토글 상단 배치), `/legal/terms`·`/legal/about` 문서 화면

### 진행 중 알게 된 것

- `expo export -p web`은 라우트별 HTML을 만들지 않는다(단일 `index.html` + SPA fallback). 그래서 `serve -s`가 필요하고, 직접 URL 진입은 클라이언트 라우터가 처리한다
- 푸터 문서를 한 동적 라우트(`legal/[doc].tsx`)로 두면 문서끼리 이동할 때 이전 문서 화면이 DOM에 남는다. 라우트를 문서별로 나누고 문서 간 이동은 `replace`로 했다
- 큰 제목의 한글 줄바꿈은 웹에서 `wordBreak: keep-all`이 필요하다(RNW 기본값 `break-word`)

### 남은 것

- A-022: 약관·방침 법률 검토와 시행일 확정, 사업자 등록 정보 표시
- A-023: 추천이 오답 유형만 본다. 학년·난이도·최근 정답률 미반영
- A-024: 추천 후보가 없을 때 안내 문구 없음

---

## 라이트 테마 기본화, 설계 근거 섹션 — 2026-07-27 (이어서)

### 요청

1. 테마 기본을 라이트로. 라이트에서 경계선이 잘 안 보이고 배경이 너무 하얗다(아주 조금 베이지로)
2. 소개 페이지의 학년·영역·유형 띠 삭제
3. 해설이 자세하다는 점을 메인에서 강조
4. 자세한 해설과 오답노트가 성적 향상 요인이라는 근거 위에 스코디가 만들어졌음을 알릴 것. 교육학에서 쓰는 통계적 근거를 찾아 반영

### 한 일

- `src/theme/ThemeProvider.tsx`: 기본 모드 `system` → `light`. 토글 순서는 라이트 → 다크 → 시스템
- `src/theme/palette.ts` 라이트 값 조정: `bg #fbfaf4 → #f7f4ea`, `surface #ffffff → #fffdf7`, `offset → #eeeade`, `hover → #e5dfd0`, `border #e5e1d5 → #d9d2be`, `borderStrong #d3cdbd → #bdb49b`
- `WebLanding`: `ScopeStrip`(학년·영역·유형 띠) 삭제, 자리에 설계 근거 섹션 `EvidenceBand` 배치
- 학생 섹션에 해설 전용 블록 추가(02 `해설은 근거 문장까지`) + `ExplainMock`(정답 근거 / 고른 오답 이유). 히어로 첫 불릿을 `문항마다 정답 근거와 오답 이유까지 해설`로 교체
- 기존 02(오답노트)는 03으로, 번호 재정렬

### 근거 조사와 인용

검색으로 확인한 것만 적었다. 수치는 출처와 함께 화면에 노출한다.

- 설명형 해설 d=0.49 > 정답만 알려주기 d=0.32 > 정오만 알려주기 d=0.05 — Van der Kleij, Feskens & Eggen (2015), Review of Educational Research
- 다시 꺼내 풀기(retrieval practice) g=0.50 — Rowland (2014); Roediger & Karpicke (2006)
- 형성평가 효과 크기 0.4~0.7(Black & Wiliam 1998)이나 이후 메타분석은 더 작게 봄(Kingston & Nash 2011) — 범위와 논쟁을 함께 적었다
- 피드백 개입 평균 d≈0.41, 연구별 변동 큼 — Kluger & DeNisi (1996). Hattie 판단 기준점 d=0.40

### 표현 조정(사용자 요청과 다르게 쓴 부분)

- 요청 문구는 "성적 향상의 가장 큰 원인", "성적 향상에 최적화된 시스템"이었다. 두 표현은 측정·검증할 수 없어 화면에는 "교육학에서 성취도에 영향이 크다고 통계적으로 확인된 요인" / "그 두 가지에 집중해 화면 흐름을 만들었다"로 적었다
- 섹션 끝에 `효과 크기는 연구 설계에 따라 달라지고, 스코디를 쓴 학생의 성적 변화는 아직 측정하지 않았어요`를 남겼다

### 검증

- `npm run typecheck` 통과, `npx eslint app src e2e` 오류 0(경고 1건은 기존)
- E2E 갱신: `theme.spec.ts`는 기본 라이트에서 시작하도록, `auth-flow`의 제공 범위 테스트는 설계 근거 노출 테스트로 교체(인용 수치·출처·한계 문장 확인)
- 화면 확인: `/introduce` 데스크톱 1280 라이트 기본 — 배경 베이지, 카드·경계선 구분 확인. 근거 섹션과 해설 목업 렌더 확인, 제공 범위 띠 사라짐 확인

---

## 로그인·가입 화면 리디자인, 파비콘·문서 제목 — 2026-07-27 (이어서)

### 요청

1. 오늘의집(`ohou.se`) 로그인·회원가입 화면을 firecrawl로 참고해 스코디 로그인·가입 화면에 반영. 현재 너무 밋밋하다
2. Scody 파비콘 디자인·적용 — 16x16에서 식별 가능, 단색 위주, 메인 컬러, 플랫, Vercel·Notion·Linear처럼 심플, SVG(필요하면 favicon.ico도)
3. 문서 제목은 `Scody - 가장 효율적인 학습 플랫폼`

### 참고한 것과 가져온 원칙

`firecrawl scrape`로 `ohou.se/users/sign_in`, `ohou.se/normal_users/new`를 마크다운 + 스크린샷으로 받아 봤다.
자산·문구·레이아웃을 복제하지 않고 구성 원칙만 가져왔다.

| 오늘의집에서 본 것 | 스코디에 적용한 방식 |
|---|---|
| 좁은 한 컬럼을 화면 가운데 두고 그 안에서만 묻는다 | `AuthShell`: 폭 420 컬럼 + 넓은 화면에서 위아래 가운데 정렬 |
| 입력·주요 행동을 하나의 면에 모은다(이메일+비밀번호가 한 상자) | 태블릿·데스크톱에서 패널(surface + hairline + `radius.card`), 모바일은 테두리 없음 |
| 로고를 컬럼 맨 위에 둔다 | 마크 + 워드마크 조합(`Brand withMark`)을 컬럼 위에 |
| SNS 로그인 묶음을 라벨 붙은 구분선으로 가른다 | `LabeledDivider`(`또는`)로 카카오와 휴대폰을 가름 |
| 보조 행동(비밀번호 재설정·회원가입)은 글자 링크 | `TextLink` — 같은 무게의 전폭 버튼 4개가 쌓이던 것을 링크로 내림 |
| 가입 화면은 굵은 항목 제목 + 회색 한 줄 설명 + 입력 | `AuthSection`(제목 + 힌트) 두 묶음: `역할`, `계정 정보` |
| 약관 동의를 가입 버튼 옆에 명시 | 버튼 아래 `시작하면 … 동의하게 돼요` + 약관·처리방침 링크(초안 표기 유지) |

스코디 규칙은 유지했다: 본문 좌측 정렬, 그림자 없음, 강조색은 청록 단색, 카드는 주인공 표면에만.
로그인 방법은 D-020대로 카카오·휴대폰 두 가지만 두고 오늘의집처럼 SNS를 늘리지 않았다.

### 한 일

- 새 파일 `src/features/auth/AuthShell.tsx`: `AuthShell`·`AuthHeading`·`AuthSteps`·`AuthSection`·`LabeledDivider`·`TextLink`·`AuthError` + 문서 링크·테마 푸터
- `app/login.tsx`, `app/signup.tsx`를 위 구성으로 다시 씀. 로직·문구·testID는 그대로 두고 배치만 바꿈
  - 단계형 흐름에 진행 표시 추가(로그인 2단계 / 가입은 카카오 2단계·휴대폰 3단계 — 방법을 고르기 전에는 표시하지 않는다)
  - 가입 마지막 단계는 역할을 먼저 묻고 계정 정보를 뒤에 묻는다(학원을 고르면 학원 이름이 이어서 나온다)
  - 역할 선택 행은 선택 시 `accentSoft` 배경 + 체크 아이콘
- `src/components/Button.tsx`: `size` 추가(`md` 40 기본 / `lg` 52 — 인증 화면 전용), `accessibilityLabel` 추가(앞에 아이콘을 두면 읽히는 이름이 흐려진다)
- `src/components/Icon.tsx`: `smartphone`, `message-circle` 추가(방법 버튼 앞 아이콘)
- `src/components/Mark.tsx`: 스코디 마크(청록 라운드 타일 + 'S'). `src/components/Brand.tsx`에 `withMark`·`center` 옵션
- 파비콘: `public/favicon.svg`(32 viewBox, `prefers-color-scheme: dark`에서 밝은 청록 + 어두운 글자), `public/favicon.ico`(16·32·48 PNG 3종)
  - 'S' 윤곽선은 워드마크와 같은 Space Grotesk Bold 글리프에서 추출했다(`Mark.tsx`와 같은 path)
  - 후보를 16px로 직접 굽어 비교했다: `ㅅ`·`Λ`는 캐럿, `ㅅ+ㅡ`(스)는 eject 기호, 각진 S는 숫자 5로 읽혀 모두 버렸다
- 문서 제목: `app.json`의 `expo.web.name`. `web.output: "single"`이면 Expo가 자기 HTML 템플릿을 쓰고 `app/+html.tsx`를 읽지 않아 제목·아이콘을 그 파일로 넣을 수 없다
- 파비콘 링크는 런타임에 붙인다: `src/theme/webHead.ts`의 `applyWebIcons()`를 `app/_layout.tsx`에서 호출(테마 CSS 변수를 넣는 방식과 같다)

### 되돌린 것

- `AppText`의 `title`·`display` 줄간격을 1.15 → 1.3으로 올렸다가 되돌렸다. 제목 아래 밑줄처럼 보이던 선은 글리프가 잘린 게 아니라
  `로그인`의 세 글자가 모두 아래쪽 가로획으로 끝나서 이어져 보이는 것이었다(4배 확대로 확인). 실제 결함이 아니라 요청 범위 밖 변경이라 원복했다

### 검증

- `npm run typecheck` 통과, `npm run lint` 오류 0(경고 2건은 기존: `app/student/ask.tsx`, `.expo/types`)
- `npm test` 45개 통과, `npx playwright test` 249개 통과(desktop·tablet·mobile 3뷰포트)
- 화면 확인: 로그인·가입 각 단계를 1280 / 820 / 390에서 확인. 다크 테마 확인(마크 타일이 다크 강조색으로 바뀜)
- 높이 520 뷰포트에서 테스트 계정을 펼쳐도 컬럼 위쪽이 잘리지 않는지 확인 — 가운데 정렬은 `justifyContent`가 아니라 자동 여백으로 했다
- 파비콘: `/favicon.svg`·`/favicon.ico` 응답 200, 문서에 `link[rel=icon]` 두 개 삽입 확인, 라이트·다크에서 16px·64px 렌더 확인
- 문서 제목: 개발 서버와 `npm run web:export` 산출물(`dist/index.html`) 모두 `Scody - 가장 효율적인 학습 플랫폼`
- 증거: `docs/evidence/login-desktop.png`, `login-mobile.png`, `login-dark.png`, `signup-desktop.png`, `favicon-64.png`

### 남은 것

- `app.json`의 `expo.name`(`스코디`)은 네이티브 앱 이름이라 그대로 뒀다. 웹 문서 제목만 `web.name`으로 분리했다
- 가입 화면의 약관 동의는 문장과 링크만 두었다. 필수 동의 체크박스는 법률 검토(A-022) 뒤에 결정한다

---

## 학생 탭 개선(홈·풀이·결과·오답노트) — 2026-07-27 (이어서)

### 요청과 해석

사용자가 학생 탭에서 걸리는 점 12가지를 한 번에 지적했다. 요청별로 무엇을 고쳤는지 남긴다.

| 요청 | 해석 | 한 일 |
|---|---|---|
| 학원 과제가 있으면 `학원에서 내준 과제가 있어요` | 학원 연계 학생이 지금 상태를 문장으로 알아야 한다 | 섹션 제목을 그 문장으로. `academy.length > 0`일 때만 |
| 다 끝났으면 `…모두 마쳤어요. 개인 학습을 해볼까요?` | 끝났다는 사실 + 다음 행동 | `academy-cleared` 블록 + `개인 학습 고르기` 버튼. 학원 학습이 없는 학생에게는 둘 다 안 띄운다 |
| Scody AI를 버튼이 아니라 대화창으로 | 버튼 → 화면 이동 단계를 없애기 | 홈에 `AskField`를 직접 두고, 보내면 `/student/ask?q=`로 이어짐. ask 화면은 1문 1답 → 여러 턴 대화로 바꿈(앞 대화를 함께 보냄) |
| `틀린 문제 모아보기` → `오답노트 하러 가기`, 버튼처럼 | ghost는 버튼으로 보이지 않는다 | 홈·결과 두 곳 문구 교체 + `secondary`(테두리 있는 버튼) |
| 학습 진행률 UI가 별로다 | 라벨 + 비율보다 문장과 숫자 | `학습 N개 중 M개 마쳤어요` + 오른쪽 큰 숫자 `M / N` + 얇은 막대. `학습 진행률` 라벨 삭제 |
| 지문을 더 명확하게 | 읽는 곳과 푸는 곳이 갈려야 한다 | `Passage`를 하나의 면(surface + hairline + card radius)으로. 단락(`\n`)마다 끊고, 데스크톱 2단에서는 sticky로 붙여 둠 |
| 선지가 두 줄이면 어떻게 되는지 | 실제 국어 선지는 길다 | 선지 행 정렬 `flex-start`, 동그라미는 첫 줄 고정, 줄간격 1.55. 두 줄 상태를 화면으로 확인(`docs/evidence/solve-long-choice-mobile.png`) |
| 문제번호와 발문이 미스매치 | 발문이 길면 번호 아래로 흐른다 | 번호(26px 원형)와 발문을 두 컬럼으로 분리 |
| 한 번에 5문항 + 한 문항씩 토글 | 10문항을 한 번에 쏟지 않기 | 5문항 페이지 + `5문항씩`·`한 문항씩` 칩 토글 + `이전`·`다음`. 모드를 바꿔도 보던 문항이 남는다 |
| 결과는 기본이 틀린 문항, 토글로 전체 | 볼 것부터 보여주기 | `틀린 문항 N`·`전체 N` 칩. 다 맞았으면 전체를 보여주고 안내 한 줄 |
| `오답노트` → `오답노트할 문제 담기`, `틀린 문제예요` 삭제, 담기를 아이콘 토글로(깜빡임 없이) | 상태는 아이콘으로, 되돌릴 수 있어야 한다 | 섹션명 교체, 부제 삭제, `bookmark → check` 토글(`accentSoft`). 행 누름을 없애 번쩍임 제거. 다시 누르면 노트에서 빠진다 |
| 입력창 위 이중 테두리 / 포커스 모서리 | 선이 두 겹, 사각형 포커스 링 | `AskField`의 `flat`에서 위쪽 선 제거(구분선은 `Group`이 그린다). 브라우저 기본 링을 끄고 `ink` 테두리(카드 안이면 `offset` 배경)로 대체 |
| `오답노트에서 빼기` / `메모까지 지울게요` / `그대로 둘게요` | 버튼처럼 보이지 않고 표현이 이상하다 | 새 `IconButton`(휴지통)을 오른쪽 끝에. 확인은 `취소` + 빨간 휴지통. 안내는 문구(`메모까지 지워요`)로 분리 |
| `뺏어요` 오타 | — | `오답노트에서 뺐어요.` |

### 새 파일·컴포넌트

- `src/components/IconButton.tsx`: 아이콘만 있는 버튼(40×40, `Button`과 높이 동일, `label`은 접근성 이름)
- `e2e/_solve.ts`: `answerAll`(페이지를 넘기며 모든 문항의 첫 보기 선택), `keepWrongNotes`(오답 담기)
- `Icon`에 `bookmark`·`trash-2` 추가

### 손대지 않은 것

- 오답노트에서 같은 학습의 오답이 두 개면 지문이 두 번 나온다(기존 동작). 요청 범위 밖이라 그대로 뒀다.
- 실제 수능 길이의 긴 선지 fixture는 추가하지 않았다. 지금 데이터의 가장 긴 선지(34자)로 두 줄 상태를 확인했다. 60자 이상 선지가 필요하면 콘텐츠 작업으로 따로 다룬다.

### 검증

- `npm run typecheck` 통과, `npx eslint app src e2e` 오류 0
- `npm test` 45개 통과, `npx playwright test` **255개 통과**(desktop·tablet·mobile). 문구·흐름이 바뀐 테스트는 지우지 않고 새 기준으로 고쳤다
  - 새 테스트 2개: `문항을 5개씩 보거나 한 문항씩 보면서 풀 수 있다`, `학원 과제가 남았으면 알려주고, 다 끝내면 개인 학습을 권한다`
  - 기존 테스트의 라디오 루프(문항 전체가 한 화면에 있다고 가정)를 `answerAll` 헬퍼로 바꿨다
- 화면 확인: 홈·풀이(5문항/한 문항)·결과(틀린 문항/전체)·오답노트를 1280·820·390에서 확인. 다크 테마 확인. 데스크톱에서 900px 스크롤 후에도 지문이 남아 있는지 확인
- 증거: `docs/evidence/student-home-*.png`, `solve-desktop.png`, `solve-one-desktop.png`, `solve-long-choice-mobile.png`, `result-wrong-only.png`, `result-keep-notes.png`, `notebook-delete.png`, `notebook-input-focus.png`, `scody-ai.png`

---

## 학생 탭 2차 수정 + 담아 둔 학습 — 2026-07-28

1차 수정 뒤 사용자가 직접 써 보고 지적한 12건. 계획서는 `~/.claude/plans/virtual-yawning-noodle.md`.

### 사실관계를 바로잡은 지적

> "학원에서 내준 과제가 16개인데 3개만 뜨네"

학원 과제 목록에는 개수 제한이 없었다. 실제 데이터는 학원 과제 **4개**(`src/data/fixtures.ts:194` `ASSIGNMENTS_SEED`: `c_kor1` 1개 + `c_kor2` 3개)뿐이고, **16은 1차 수정에서 내가 만든 진행률 문구가 개인 학습 12개 + 학원 4개를 합쳐 센 값**이었다. 히어로가 목록의 첫 항목을 가져가 하나를 풀면 3개로 보인 것도 겹쳤다.

→ 고친 것: 진행률을 출처별로 따로 세고(`남은 학습 N개` + `학원 과제 3개 · 개인 학습 12개`), 히어로에 올린 항목을 목록에서 빼고, 요청대로 5개 + 더 보기를 넣었다. fixture를 늘려 16개를 만들지는 않았다.

### 참고한 챗 UI (firecrawl)

`chatgpt.com`·`perplexity.ai`를 스크랩·스크린샷으로 확인했다. 가져온 것: **텍스트 영역과 전송 버튼을 위아래 두 층으로 분리**, 입력이 늘면 박스가 자람, Enter 전송 / Shift+Enter 줄바꿈, 라운드 큰 단일 표면.
확인한 사실: react-native-web의 `TextInput`은 `multiline` + `blurOnSubmit` + `onSubmitEditing`이면 Enter 전송·Shift+Enter 줄바꿈을 이미 구현하고 있고 **한글 조합 중에는 전송하지 않는다**(`node_modules/react-native-web/dist/exports/TextInput/index.js:270-293`). 키 핸들러를 새로 만들지 않았다.

### 지적별 조치

| 지적 | 조치 |
|---|---|
| 입력창 왼쪽 위 선이 끊김 | 원인은 `Group`의 `<Divider inset={16} />`. `dividerInset` prop 추가(기본 16), 오답노트 카드만 `0` |
| Shift+Enter·줄바꿈 안 되고 오른쪽으로만 늘어남 | `AskField`를 2층 컴포저로 재작성. `multiline` 기본 + `onContentSizeChange`로 26→200px 자동 확장, 전송 버튼을 글 아래 오른쪽으로, 전송 후 포커스 복귀 |
| 쓰레기통을 별표 옆으로, `메모까지 지워요/취소` 삭제 | 휴지통을 문항 카드 헤더(별표 옆)로. 확인 단계 제거 → 즉시 삭제 + 화면 위 `오답노트에서 뺐어요. · 되돌리기`. 되돌리기는 `restoreWrongNote(note, index)`로 원래 자리에 메모·별표까지 복원 |
| 학원 과제 문구가 반영됐는지 모르겠다 | 반영되어 있었다(섹션 제목). 눈에 띄게 5개 + `과제 N개 더 보기`로 정리하고 히어로 중복을 제거 |
| Scody AI를 ChatGPT/Perplexity처럼 | 위 컴포저 + 홈에서 바로 입력 → `/student/ask?q=`로 대화 이어짐 |
| 목록이 5개 + 더 보기여야 한다 | 홈 학원 과제·담은 학습, 학습 탭 학원 학습 모두 5개 + 더 보기(기존 `showAll` 패턴 재사용) |
| 오답노트 버튼이 크고 색이 없다 | 전체폭 제거. 오답 복습 섹션 제목 옆 작은 버튼(테두리 + 청록 아이콘·글자, `Button tone="accent"`, `Section action`) |
| 홈에 개인 학습이 없다 | 홈에 `담아 둔 학습` 섹션 신설(5개 + 전체 보기), 비면 안내 + `학습 고르러 가기` |
| 담아서 나중에 풀게 해달라 | 아래 '담아 둔 학습' 참고 |
| 토글이 뭔지 모르냐 | 랜딩 방문자 토글과 같은 세그먼트를 `src/components/Toggle.tsx`로 뽑고 풀이(5문항씩/한 문항씩)·결과(틀린 문항/전체)에 적용. 랜딩도 이 컴포넌트를 쓰게 바꿈 |
| `아직 3문항 남았어요` 삭제 | 제출 버튼은 늘 `제출할게요`. 못 누르는 상태는 밝기만 낮추고, 눌렀을 때 이유를 캡션으로 |

### 담아 둔 학습(큐) — 새 기능

- 상태: `progress.tsx`의 `queueByUser`(계정별). `QueueEntry {itemId, contentId}`, **배열 순서 = 풀 순서**. 액션 `addToQueue`·`removeFromQueue`·`removeManyFromQueue`·`moveInQueue`·`isQueued`. 순서 규칙은 순수 함수 `moveQueueEntry`로 빼서 단위 테스트(`__tests__/queue.test.ts`, 7건)
- **개인 학습만** 담는다(`addToQueue`가 `source !== 'personal'`이면 무시). 학원 과제를 담을 수 있으면 자기 배정이 된다(D-012)
- 리졸버 `useQueuedItems()`(`learning.ts`)는 `personal` 안에서만 찾는다 — 잘못된 값이 들어와도 학원 과제가 나올 수 없다. 콘텐츠가 사라진 항목은 빼고 개수를 알린다
- 풀면 큐에서 빠진다(`recordAttempt`). 홈의 개수가 늘 '할 일'을 뜻한다
- 진입점 4곳: 학습 탭 세부 유형 목록 · 학습 상세(`detail-queue`) · 결과 추천 · 오답노트 추천. 토글은 `QueueToggle`(`plus → check`, 이름 `담아 두기`/`담아 둔 학습에서 빼기`) — 오답노트 담기(`bookmark → check`, `오답노트에 담기`)와 아이콘·이름을 모두 다르게 했다
- `LearningRow`·`Row`에 `trailing` 추가. **행 Pressable의 형제로 둔다** — 중첩하면 클릭은 막히지만 pointerdown이 버블링돼 행 배경이 번쩍인다(D-030이 고친 결함)
- 새 화면 `/student/queue`: 순서 바꾸기(위로·아래로 버튼 — 드래그 라이브러리 없이 웹·터치·키보드 모두 동작), 빼기, 여러 개 빼기, 빈 상태. 탭에는 넣지 않았다(학생 탭 4개는 확정 정책)
- 홈 히어로는 담아 둔 학습을 먼저 쓴다(`queued.items[0] ?? todo[0]`). 큐가 비면 기존과 완전히 같아 기존 E2E가 그대로 통과한다

### 함께 고친 것

- 학습 탭의 학원 학습 섹션이 학년을 고르면 사라졌다 → 단계와 무관하게 늘 위에 유지

### 검증

- `npm run typecheck` 통과, `npx eslint app src e2e` 오류 0
- `npm test` 52건 통과(큐 순서 7건 추가), `npx playwright test` **288건 통과**(desktop·tablet·mobile)
  - 새 스펙 `e2e/queue-flow.spec.ts` 9건: 담기 → 홈 → 전체 목록 / 풀면 빠짐 / 상세에서 담고 빼기 / **추천 행 토글이 행 이동을 삼키지 않음** / 순서 바꾸기·여러 개 빼기 / 빈 상태·뒤로 / 세션 없이 진입 / **학원 과제는 담을 수 없음** / 학원 이용권만 있는 학생에게는 섹션 감춤
  - `session-boundary`에 `담아 둔 학습도 계정을 넘어가지 않는다` 추가, `a11y`에 두 담기 토글의 이름이 겹치지 않는지 추가
  - 문구·흐름이 바뀐 기존 테스트는 지우지 않고 새 기준으로 고쳤다(홈 ask 좌표 → 글 아래 오른쪽, 오답노트 삭제 → 되돌리기, 진행률 문구)
- 컴포저 직접 확인: Shift+Enter로 3줄 입력 시 높이 26 → 70px, Enter로 전송되며 줄바꿈이 그대로 전달됨(`?q=...%0A...`)
- 화면 확인: 홈·학습·학습 목록·큐·풀이·결과·오답노트를 1280·820·390에서, 홈과 풀이는 다크에서도
- 증거: `docs/evidence/student-home-desktop.png`, `student-queue-desktop.png`, `student-queue-mobile.png`, `learn-leaf-queue.png`, `notebook-desktop.png`, `home-composer.png`, `solve-nudge-dark.png`

## 학생 홈 Critical·High 7건 수정

product-manager·ux-auditor 두 검토를 합친 확정 목록. 범위는 `app/student/index.tsx` + `src/features/learning.ts`의 `merge` + `DESIGN.md` §14.

| ID | 문제 | 조치 |
|---|---|---|
| F1 | 오답 복습 목록이 손으로 만든 `Pressable`이라 `SourceTag`가 없다. 학원 과제 오답과 개인 학습 오답이 라벨 없이 섞인다(4절·`DESIGN.md` §18 위반) | `LearningRow`로 교체. 목적지는 `/student/result/{id}` 유지. 이미 푼 학습이라 마감은 넘기지 않는다(`dueDate: undefined`) — 남은 일처럼 읽힌다. 사라진 `틀린 문제 다시 보기` 안내는 행이 아니라 섹션에 한 줄(`줄을 누르면 틀린 문제를 다시 볼 수 있어요.`) |
| F2 | `next ? … : …` 단일 분기라 가입 직후 계정의 첫 화면이 `오늘 할 일을 다 끝냈어요`였고, `all.length > 0` 조건 때문에 진행 상황·학원 섹션·담아 둔 학습이 모두 사라져 primary가 하나도 없었다 | 히어로를 세 갈래로. 완료로 할 일이 없을 때만 기존 문구, 학습 자체가 없으면 `아직 시작한 학습이 없어요` + 죽어 있던 문구 `새 학습을 골라볼까요?` + primary `학습 고르러 가기`(`home-empty-start` → `/student/learn`) |
| F3 | `due()`가 오늘과 비교하지 않아 지난 마감(7/20~7/25, 오늘 7/28)이 여유 있게 읽혔고, 학원 과제 순서가 `ASSIGNMENTS_SEED` 정의 순서라 가장 급한 7/20이 세 번째 줄이었다 | `dueLabel()`로 교체: 지남 `마감이 지났어요` · 오늘 `오늘까지` · 내일 `내일까지` · 그 밖 `N월 N일까지`. 오늘은 `new Date()`로 얻고 날짜만 비교(로컬 자정). 지난 마감은 메타에 이어 붙이지 않고 한 줄로 분리 + `colors.danger`(텍스트가 먼저 바뀐다). 정렬은 `byDue`로 홈에서만 — `learning.ts`의 `academy` 생성부는 건드리지 않아 학습 탭 순서는 그대로 |
| F4 | 학원 과제 섹션에 바로 할 행동이 없어(회색 chevron뿐) 개인 학습을 하나만 담아도 유일한 primary가 개인 학습을 가리키고 마감 지난 과제 4개가 평범한 목록으로 밀렸다 | 섹션 `action`에 `과제 먼저 하기`(`home-academy-first`) — 오답 복습의 `Button variant="secondary" tone="accent"` + `noteBtn` 높이 그대로. 마감이 가장 이른 과제로 보낸다. 히어로가 이미 학원 과제면 두지 않는다. **히어로 우선순위는 바꾸지 않았다**(D-032 → 결정 대기 M9-03) |
| F5 | 과제를 다 마치면 캡션에 `학원 과제 0개`가 남아 같은 사실을 세 번, 그중 하나는 어색한 형태로 말했다 | 개수 0인 항목은 내역에서 빼고, 둘 다 비면 내역 줄 자체를 두지 않는다. 완료 사실은 아래 `academy-cleared` 블록이 말한다 |
| F6 | 진행 분모가 공개 카탈로그 전부(12세트)라 정예린 홈이 `남은 학습 16개 / 0 / 16 완료`였다. 콘텐츠가 늘면(S-011) 완료율이 계속 내려간다 | **사용자 승인 설계 변경(D-034)**: 분모를 학원 과제 + 담아 둔 학습으로. 학원 과제는 배정 수가 목표라 완료 후에도 분모에 남고, 담아 둔 학습은 풀면 큐에서 빠지므로 남은 개수로만 센다(분자는 학원 과제에서만 늘어 `goalDone + goalTodo === goalTotal`). 내역은 `학원 과제 N개 · 담아 둔 학습 N개`. 셀 것이 없으면 진행 상황·진행바를 감춘다. 공개 개수는 학습 탭이 말한다(`app/student/learn.tsx`는 고치지 않았다) |
| F7 | `merge`가 `attempts`만 봐서 `in_progress`를 세팅하는 코드가 없었고, `LearningRow`의 `이어서 하기`와 학습 상세의 `이어서 풀기`가 한 번도 렌더되지 않았다. 부분 답안은 `saveAnswer`로 실제로 남는다 | **사용자 승인 범위 확장(D-035)**: `merge`가 `useSession()`의 `answers`를 함께 본다. `attempts`가 없고 저장된 답안이 있으면 `status: 'in_progress'`. 빈 답안·제출한 학습은 진행 중으로 보지 않는다. 홈 화면 코드는 추가로 고치지 않았다. 학습 탭·담아 둔 학습에서도 함께 살아난다 |

### 고치지 않은 것

- **A-026**(제출된 학원 과제가 학생 화면에서 미제출로 보임) — `merge`를 만졌지만 `assignment.submissions`는 반영하지 않았다. 6절에 등록된 별도 작업이다
- **히어로 우선순위**(`queued.items[0] ?? todo[0]`) — D-032·`DESIGN.md` §14.5 충돌 → 결정 대기 M9-03
- **개인 이용권 없는 학생의 `개인 학습 고르기` dead-end** — D-031이 문구를 고정하고 E2E가 검증한다 → 결정 대기 M9-04
- `LearningRow`의 마감 표시는 여전히 `N월 N일 마감`이다(다른 화면에 영향) → 6절 A-027

### 검증

- `npm run typecheck` 통과 · `npm run lint` 오류 0(경고 1건은 기존 생성 파일 `.expo/types/router.d.ts`)
- `npm test` 52건 통과(기준선 유지)
- `npx playwright test` **303건 통과**(desktop 1280 · tablet 820 · mobile 390). 기준선 288건 + 새 5건 × 3뷰포트
  - 추가한 E2E(`e2e/student-flow.spec.ts`): 마감이 이른 과제부터 오고 지난 마감을 알림 / 담아 둔 학습이 히어로면 `과제 먼저 하기`로 과제에 감 / 진행 상황이 학원 과제·담아 둔 학습만 셈 / 학습 없는 계정에 `다 끝냈어요`라고 하지 않음 / 풀다 나온 학습이 `이어서 하기`로 보임
  - 고친 기존 테스트 1건: `e2e/auth-flow.spec.ts:120`의 `개인 학습 \d+개` → `학원 과제 \d+개` + `개인 학습 \d+개`가 없음을 확인. F6로 홈 내역의 개인 쪽 항목이 `담아 둔 학습 N개`가 되었고 정예린은 담은 것이 0이라 그 항목이 빠진다. 출처를 따로 센다는 원래 의도는 그대로 검증한다
- 화면 확인: `/student`를 1280·820·390 + 다크에서. 정예린(마감 지난 과제 4개) · 정예린+담은 학습 1개 · 가입 직후 계정 · 김서준(오답 복습) · 박도윤(과제 완료 후 캡션)
- 증거: `docs/evidence/home-overdue-academy-{desktop,tablet,mobile,dark}.png`, `home-academy-first-{desktop,mobile}.png`, `home-empty-{desktop,mobile,dark}.png`, `home-review-source-{desktop,mobile,dark}.png`, `home-academy-cleared-caption.png`

## 학생 화면 조작감 정리 — 입력창·버튼·토스트·풀이 조작부

사용자가 앱을 직접 써 보며 낸 요청. 조사로 네 가지 근본 원인이 특정됐고 셋은 한 곳만 고치면 여러 화면이 함께 나았다.

| 항목 | 문제와 원인 | 조치 |
|---|---|---|
| A1 | 줄바꿈으로 늘어난 입력창이 백스페이스로 지워도 안 줄어들었다. `<textarea>`에 명시적 `height`가 걸려 `scrollHeight`가 그 아래로 못 내려가고, react-native-web이 같은 값을 `dimensions.current` 캐시로 걸러 `onContentSizeChange`를 **아예 부르지 않았다**(`TextInput/index.js:195`). `onContentSizeChange`만으로는 원리적으로 고칠 수 없다 | 웹은 값이 바뀔 때 host node의 `style.height`를 `0px`로 풀어 `scrollHeight`를 직접 재고 되돌린다. 네이티브는 `contentSize`가 실제로 줄어들어 기존 경로 유지. `maxHeight` prop 추가(기본 200), `overflowY: auto` 명시. **구조는 그대로** — `e2e/student-flow.spec.ts`가 전송 버튼 위치를 `boundingBox`로 단정한다. 입력창 4곳(홈·대화·오답노트·카드 복습)이 함께 나았다 |
| A2·A3 | 대화는 아래로 쌓이는데 입력창이 위에 있었다. 전환이 어색한 원인은 애니메이션이 아니라 `send()`가 **답이 끝난 뒤에야** 턴을 추가해 홈에서 넘어오면 내 질문이 안 보였던 것 | **D-037**: `ask.tsx`만 `Screen`을 버리고 자체 3단 flex(고정 헤더 / `ScrollView` / 하단 바). `position:fixed` 불필요 — `expo-reset`의 높이 체인이 이어져 flex로 성립한다. 자동 스크롤은 `atBottom`(하단 64px)을 추적해 위로 읽는 중이면 방해하지 않고, 내가 보낸 말은 예외로 항상 따라간다. `pending` 상태로 질문을 즉시 표시. `RoleShell`에 `chatting` 조건을 두어 **모바일 하단 탭만** 숨기고 데스크톱 사이드바는 유지. `BackLink` 추출(`screen-back` testID 보존) |
| B | 버튼 다섯 개가 좌우로 늘어나 버튼처럼 안 보였다. `Button.styles.base`에 폭 제약이 없어 `Screen` 컬럼의 `alignItems: stretch`를 받아 최대 680px까지 늘어난다 | `Button`에 `size="sm"`(높이 32)·`trailing`·`hug` 추가해 매 화면 `style` override하던 것을 prop으로 올렸다. `Icon`에 `arrow-right`·`refresh-cw`·`eye` 추가. `result-notebook`은 342px 전폭 → 160px·오른쪽 정렬(**`DESIGN.md:167` "전체폭 버튼을 쓰지 않는다" 위반을 고친 것**), `결과 다시 보기` 141px, `다시 풀기`·`담아 두기` 113px. `담아 두기` 라벨과 `accessibilityLabel`은 E2E 10곳이 검증하므로 그대로 뒀다 |
| C | 오답노트 담기 피드백이 아이콘 모양 변화뿐이라 담겼는지 확신이 안 섰다. 레포에 토스트가 0건 | **D-038**: `src/components/Toast.tsx` 신규. 하단에서 페이드+살짝 올라와 약 2.4초 뒤 사라진다. `pointerEvents="none"`이라 떠 있는 동안 화면을 계속 쓸 수 있다. 애니메이션은 `Reveal.tsx`와 같은 `Animated` + `useNativeDriver: false` — 새 의존성 없음. `Screen` 밖에 두어 스크롤과 함께 흐르지 않는다. **D-033 되돌리기 배너는 건드리지 않았다**(사라지면 되돌릴 기회도 사라진다) |
| D | `이전`이 `다음`보다 훨씬 컸다. `navSide: { flex: 1 }`에 교차축 정렬이 없어 기본값 `stretch`가 걸렸고 오른쪽만 `alignItems: 'flex-end'`로 덮여 있었다 | `navLeft: { alignItems: 'flex-start' }` 추가로 대칭. 두 버튼에 chevron. **D-036**: `제출할게요`를 `allAnswered`일 때만 렌더하고 `trailing` 화살표를 붙였다. 도달 불가가 된 `submitOff`·`nudge`·미응답 캡션을 지웠다. `Pager`로 교체하지 않았다 — `e2e/_solve.ts`의 `answerAll`이 `solve-next`가 DOM에서 사라지는 것을 종료 신호로 쓴다 |

### 고치지 않은 것

- **`<Slot />` → `<Stack>` 전환** — 학생 화면 전체·전 E2E 영향. `Q-010`에 전환 애니메이션이 같은 뿌리라는 점을 덧붙였다
- **모바일 웹 iOS Safari 키보드** — 하단 입력창이 가려질 수 있다. 코드로 완결할 수 없는 지점이라 6절 `A-028`로 등록
- **네이티브 `KeyboardAvoidingView` 파라미터** — 레포 최초 사용이라 실기기 미검증. 6절 `A-029`
- 남은 Medium: `inkTertiary` 대비 3.2:1, `SourceTag`의 `eyebrow` 사용, 터치 타깃 44px, 히어로 줄간격 1.20(§4 기준 1.3 미달)

### 검증

- `npm run typecheck` 통과 · `npm run lint` 오류 0(경고 1건은 기존 생성 파일 `.expo/types/router.d.ts`)
- `npm test` 52건 통과(기준선 유지)
- `npx playwright test` **318건 통과**(desktop 1280 · tablet 820 · mobile 390). 기준선 303건 + 새 5건 × 3뷰포트, 실패 0
  - 추가한 E2E(`e2e/student-flow.spec.ts`): 제출 버튼이 다 푼 뒤에 나타남 / `이전`·`다음` 크기가 같음 / 담기·빼기 토스트가 뜨고 스스로 사라짐 / 대화 화면이 입력창을 아래에 붙이고 하단 탭을 숨김 / 보낸 질문이 답을 기다리는 동안에도 남음
  - `RoleShell`의 탭 래퍼에 `testID="tab-bar"` 추가 — 탭 숨김을 단정하려면 필요했다(`getByRole('link', {name:'홈'})`은 부분 문자열이라 `스코디 홈으로`에도 걸리고, 데스크톱 사이드바는 의도적으로 남긴다)
  - 기존 테스트를 삭제·skip·완화한 것은 없다
- 실제 화면 확인(`npm run web`, 390 · 1280, 라이트·다크)
  - **입력창 축소**: 4줄 93px → 2줄 47px → 전부 지움 26px. 수정 전에는 93px에 머물렀다
  - **제출 버튼 게이팅**: 안 풀었을 때 없음 → 5/10에서도 없음 → 10문항 다 풀면 나타남
  - **대화 화면**: 입력창이 스크롤 영역 아래, 전송 버튼이 뷰포트 하단 21px, body는 스크롤 안 함. 보낸 뒤 맨 아래까지 따라감(잔여 0px), 위로 올린 위치는 1.5초 뒤에도 유지. 데스크톱은 사이드바 유지 + 탭 없음
  - **토스트**: 담기 `문항을 오답노트에 담았어요` / 빼기 `오답노트에서 뺐어요`, 불투명도 1, 가로 중앙, 탭 바 위, 약 2.6초 뒤 사라짐
  - 증거: `docs/evidence/ask-bottom-composer-{mobile,desktop,dark}.png`, `result-toast-dark.png`
- **미검증**: 한글 IME **조합 중** Enter(예: `구분해`까지 입력한 상태)는 Playwright로 실제 조합 이벤트를 재현할 수 없어 확인하지 못했다. 실제 키보드로 확인이 필요하다

## 학습 탭 개인 학습 재설계 + 토스트·오답노트 정리

사용자가 앱을 직접 쓰며 낸 요청. 조사 결과가 설계를 바꾼 지점이 여러 곳이었다.

| 항목 | 문제와 원인 | 조치 |
|---|---|---|
| 학습 탭 순서 | `담아 둔 학습 보기`가 화면 맨 위(`learn.tsx:76`)로 학원 과제(`:88`)보다 앞섰다. 전폭 `secondary`라 배경이 `surface`인 `Group`과 면 구분이 약해 버튼으로도 안 보였다 | **D-039**: 순서를 학원 학습 → 담아 둔 학습 → 개인 학습으로. 진입은 `Section`의 `action` 슬롯에 `size="sm"` + `tone="accent"` + 화살표(`learn-queue-all` testID 유지). 담아 둔 학습 5줄 미리보기도 함께 보여 준다 |
| 고르기 분리 | 탭을 열자마자 고1·고2·고3이 펼쳐져 이 화면이 무엇을 위한 곳인지 읽히지 않았다. `← 유형 다시 고르기`는 ghost 전폭이라 버튼으로 안 보이고 위치도 떠 있었다 | **D-039**: `app/student/pick.tsx` 신설(`backFallback="/student/learn"`). 드릴다운 3단 + 학습 목록을 옮기고 URL 쿼리 방식 유지. **`learn-back-*` 3버튼을 없앴다** — 단계마다 히스토리가 쌓이므로 표준 뒤로가기가 정확히 한 단계씩 물러난다(어떤 E2E도 이 버튼을 참조하지 않았다). 단계는 `eyebrow`(지나온 길) + `title`(할 일)로 알린다 |
| `>`가 `+` 왼쪽 | 사용자 요청대로 playwright로 직접 측정: `>`는 행 오른쪽에서 **79px**, `+`는 **16px** 안쪽. 원인은 chevron이 누름 영역 기준 `absolute right:16`인데 `trailing`은 그 영역 밖 flex 형제라(`DESIGN.md:105`가 요구하는 배치), 붙는 순간 누름 영역 경계가 64px 밀려 chevron이 끌려 들어온 것 | **D-040**: `LearningRow`에서 `trailing`이 있으면 chevron을 렌더하지 않는다. 한 줄 조건으로 고르기 화면과 담아 둔 학습이 함께 나았다. 확인: chevron 0개, `+`가 오른쪽 16px, 행은 여전히 누를 수 있다. `Row.tsx`는 같은 조합을 쓰는 호출부가 없어 주석만 남겼다 |
| 토스트 허전함·색 | 문구만 있어 허전했고 배경이 검은색이었다 | **D-040**: `check-circle`·`minus-circle`을 `Icon`에 추가하고 토스트에 `flexDirection: row` + 청록 아이콘. **배경은 `ink`로 유지** — `accent` 배경으로 바꾸면 다크에서 `accentText`가 거의 검정(`#04211f`)이라 인상이 반대가 되고 대비가 16.6:1 → 4.6:1로 떨어진다(사용자와 확인 후 결정). 아이콘은 문구의 **형제**로 두고 `testID`는 `AppText`에 남겼다 — Feather는 웹에서 폰트 글리프 텍스트 노드를 만들어 `testID` 요소 안에 넣으면 문구 검증이 깨진다 |
| 토스트를 여러 화면에서 | 붙일 곳이 3곳 이상이고 `notebook.tsx`·`learn.tsx`는 `Screen`을 바로 반환해 각자 fragment 래핑이 필요했다 | `src/features/toast.tsx`에 `ToastProvider` + `useToast()` 신설, `app/_layout.tsx`의 라우터를 감싸는 가장 안쪽에 연결. 결과 화면의 로컬 state를 provider 호출로 교체하고 결과 화면의 fragment를 되돌렸다. testID를 `result-toast` → `toast`로 바꾸고 E2E 1줄 갱신 |
| 추천 `+` 토스트 | 아이콘 모양만 바뀌어 담겼는지 확신이 안 섰다 | `result/[id].tsx`(비슷한 유형)·`notebook.tsx`(이 유형 더 풀어볼까요?)·`pick.tsx` 목록에 연결. 문구는 `학습을 담아 뒀어요` / `담기를 취소했어요` — 오답노트 문항 담기(`문항을 오답노트에 담았어요`)와 구분한다(`DESIGN.md` §17). `담기를 취소했어요`로 정한 이유는 `queue.tsx:78`의 `담아 둔 학습에서 뺐어요. 기록은 그대로예요.`와 부분 일치해 테스트가 흔들릴 수 있었기 때문이다 |
| 오답노트 정리 | `노트에 정리해 두기`가 답변 `Group`(`:269`)의 **형제**라 카드 밖에 떠 있었고, 한 번 정리하면 되돌릴 수 없었다 | **D-041**: 버튼을 답변 카드 안으로(Group이 자식 사이 구분선을 그어 준다). `다시 정리하기`(덮어쓰기, `resum-`)·`이어서 더 정리해보기`(누적, `addsum-`) 추가. `summarize(n, mode)`로 한 함수에서 처리하고 누적은 호출부에서 `기존 dig + 새 요약`을 합쳐 `setDig`에 넣는다(`progress.tsx` 무수정). **새 testID를 `summ-`로 시작하지 않게 했다** — `e2e/parent-flow.spec.ts:143`이 `[data-testid^="summ-ct_"]`.first()로 잡는다. 대화가 없으면 두 버튼을 숨긴다 |
| `질문하고 메모하기` | 오답노트가 아니라 **기록 화면**(`records.tsx:133`)에 있었다. `variant="ghost"` + 기본 톤 + 전폭이라 배경·테두리·색 어느 것도 눌리는 것임을 알리지 않았고, 위의 전폭 버튼 2개 밑에서 캡션처럼 읽혔다 | `secondary` + `tone="accent"` + `hug` + 화살표 |

### 의도적으로 바꾼 테스트

- `e2e/student-flow.spec.ts` 이용권 없는 학생(박도윤) 단정: `학년 → 영역 → 유형 순으로 골라요`가 **보인다** → **보이지 않는다** + `learn-pick`도 없다. 옛 코드는 이 캡션을 `hasPersonal`과 무관하게 띄웠는데 고를 것이 없는 학생에게 "골라요"라고 말하는 것이 맞지 않아 조건을 안으로 옮겼다. 이용권 상태 문구 검증은 그대로 유지
- `e2e/student-flow.spec.ts` `좌측 상단 Scody…`의 URL 단정: `/student/learn` → `/student/pick`(고르기 분리에 따른 사실 반영)
- `e2e/queue-flow.spec.ts` `담은 순서를 바꾸고…`: 고르기 페이지에서 `learn-queue-all`을 누를 수 없으므로 학습 탭으로 돌아온 뒤 누르게 한 줄 추가
- 드릴다운 헬퍼 7곳에 `learn-pick` 클릭 한 줄 추가(`queue-flow` 2 · `student-flow` 3 · `a11y` · `session-boundary` · `admin-flow` · `boundary-flow`)
- `learnUrl` → `pickUrl` 변수명 정정. 삭제·skip·완화한 테스트는 없다

### 추가한 E2E 5건

학습 탭이 학원 학습을 먼저 보여주고 고르기를 별도 화면으로 넘김 / 담으면 학원 학습 아래로 들어감 / 담기 버튼이 있는 줄에 이동 화살표가 없음 / 추천 학습 담기·취소 토스트 / 이어서 정리하면 메모가 늘고 다시 정리하면 새로 씀. 메모 본문에 `dig-{qId}` testID를 추가해 길이 비교가 가능하게 했다.

### 검증

- `npm run typecheck` 통과 · `npm run lint` 오류 0(경고 1건은 기존 생성 파일 `.expo/types/router.d.ts`)
- `npm test` 52건 통과(기준선 유지)
- `npx playwright test` **333건 통과**(desktop 1280 · tablet 820 · mobile 390). 기준선 318 + 새 5건 × 3뷰포트, 실패 0
- 실제 화면 확인(390, 라이트·다크)
  - **chevron**: 수정 후 chevron 0개, `+`가 행 오른쪽 16px, 행은 계속 누를 수 있음
  - **학습 탭 순서**: 학원 학습 4개 → `담아 둔 학습 1개 / 보러 가기` → `개인 학습 / 학습할 문제 담으러 가기`
  - **고르기 페이지**: `학년을 골라요` → `고1 / 영역을 골라요` → `고1 · 문법 / 유형을 골라요` → `고1 · 문법 · 어문 규정 - 맞춤법 / 담을 학습을 골라요`. 뒤로가기 4회에 학습 탭 복귀
  - **토스트**: 라이트에서 배경 `rgb(9,23,23)` + 아이콘 `rgb(32,128,141)`, 다크에서 배경 `rgb(243,241,232)` + 글자 반전 + 아이콘 `rgb(58,167,177)`. 문구에 글리프가 섞이지 않음
  - **오답노트 정리**: 정리 전 버튼 1개 → 정리 후 3개. 이어서 정리 88자 → 183자, 다시 정리 89자로 되돌아감
  - 증거: `docs/evidence/pick-toast-dark.png`

## 학습 탭 → 고르기 → 담기 흐름 High 8건

`product-manager`·`ux-auditor` 두 검토를 합친 목록. 8건 모두 코드에서 재현을 확인한 뒤 고쳤다.

| ID | 문제와 원인 | 조치 |
|---|---|---|
| F1 | `learn.tsx:35`의 `<Section title="학원 학습">`이 조건 없이 렌더돼, 학원 소속이 없는 학생(김서준)의 학습 탭 맨 위 가장 큰 제목이 `학원 학습` + `아직 학원에서 받은 학습이 없어요`였다. 이 학생의 유일한 primary(`learn-pick`)는 세 번째 섹션 맨 아래로 밀렸다 | **D-042**: `academy.length > 0 \|\| inAcademy`일 때만 섹션을 렌더한다. 기준을 `academyPaid`(소속 + 연결)가 아니라 **소속(`account.academyName`)** 으로 둔 이유는 `e2e/boundary-flow.spec.ts:83`이 학원 연결을 끊은 정예린에게 그 빈 안내가 **남는다**고 검증하기 때문이다 — `academyPaid`를 쓰면 연결을 끊는 순간 섹션이 사라져 그 테스트가 깨진다. 소속은 있고 배정만 없는 학생에게는 빈 안내가 사실이라 그대로 뒀다 |
| F2 | `queue.tsx:105`가 `picked.length === 0`일 때 라벨을 지시문(`뺄 학습을 골라주세요`)으로 바꾸고 `onPress={undefined}`를 줬다. `Button`에는 disabled 표현이 없어(`src/components/Button.tsx`) 눌러도 아무 일이 없는 버튼이 됐다 | **D-036과 같은 규칙**: `selecting && picked.length > 0`일 때만 `N개 빼기` primary를 렌더한다. 안내는 상단 캡션을 빼기 모드에서 `뺄 학습을 골라요.`로 바꿔 전달한다 |
| F3 | `removed`가 `true`로만 바뀌고 되돌아가는 코드가 없어 `담아 둔 학습에서 뺐어요. 기록은 그대로예요.`가 화면을 떠날 때까지 남았다. 되돌릴 방법이 없어 잘못 누르면 고르기 4단계를 다시 파고들어야 하고 맞춰 둔 순서까지 잃었다(`addToQueue`는 맨 뒤에 붙는다) | **D-033의 형태**: `progress.tsx`에 순수 함수 `restoreQueueEntries` + 액션 `restoreToQueue`를 추가하고(오답노트 `restoreWrongNote`와 짝) 화면은 뺀 칸과 자리를 `undo` 상태로 들고 있다가 복원한다. 자리는 화면 목록이 아니라 `queue`에서 센다 — 공개가 끝나 빠진 칸이 있으면 두 배열 위치가 어긋난다. 여러 개도 함께 되돌린다(자리 오름차순 삽입). 문구는 `담아 둔 학습에서 뺐어요` + `되돌리기` 한 벌로 줄였다. **`기록은 그대로예요`는 삭제** — 아직 풀지 않은 학습에는 없는 기록을 안심시키는 말이다. 안내를 빈 상태 분기보다 위에 두어 마지막 하나를 빼도 되돌릴 수 있다 |
| F4 | `pick.tsx`의 2단계 영역 행이 count와 무관하게 `showChevron` + `onPress`를 받았다. 3단계는 이미 `n > 0`으로 막고 있어 한 화면에 규칙이 두 개였다. `화법과 작문`은 공개 세트가 전 학년 0개라(측정: 고1·고2·고3 모두 0) 들어가면 누를 수 없는 다섯 줄만 있는 막힌 화면이었다 | 2단계를 3단계와 같은 규칙으로 맞추고 subtitle을 `아직 준비 중이에요`로 뒀다(색·기호가 아니라 문장으로 이유를 남긴다). **1단계 학년도 같은 규칙을 적용했다** — 공개 세트가 고1 5 · 고2 4 · 고3 3으로 0인 학년이 없어 이용권 있는 계정에서는 동작이 바뀌지 않고, 이용권이 없어 전부 0이 되는 경우는 F6이 화면째로 대체하므로 겹치지 않는다. 콘텐츠 공백 자체는 6절 S-011 |
| F5 | `담은 순서대로 풀어요.`라고 말하는 화면의 primary·전폭 버튼이 `queue-remove-selected` 하나뿐이었다. 풀려면 줄을 눌러 상세로 가야 했다 | 목록 **위**에 `첫 번째 학습부터 시작하기` primary 하나(`queue-start`, 목적지 `items[0]` — 홈 히어로와 같은 대상이라 새 상태가 없다). 빼기 모드·빈 상태에서는 두지 않는다. D-032·`DESIGN.md` §14.5의 히어로 규칙은 건드리지 않았다 |
| F6 | `pick.tsx`가 `useStudentItems().personal`만 써서, `hasPersonal`이 false면 `personal = []`(`learning.ts:72`)이 되고 모든 칸이 0개 → 유형이 전부 `아직 준비 중이에요`가 됐다. 이용권 문제를 콘텐츠 문제로 잘못 말한다 | `hasPersonal`을 함께 받아 false면 단계 UI 대신 이용권 상태를 밝힌 한 화면으로 대체한다. **문구는 학습 탭의 두 갈래를 그대로 재사용**했다(M9-04로 결정 대기 중이라 새로 만들지 않았다). 화면 모양은 `app/student/[id].tsx`의 못 찾은 학습 분기를 따랐다(간단한 `Screen` + 안내 + 돌아가는 행동 `pick-go-learn`) |
| F7 | `trail`을 `Screen`의 `eyebrow`로 넘겼다. `eyebrow`는 `textTransform: uppercase` + 넓은 자간이 붙는 라틴 전용 변형이라 `DESIGN.md` §4가 "한글에는 쓰지 않는다"로 못박았고 `inkTertiary` 대비도 낮다. 4단계에서는 유형 이름이 `eyebrow`와 `Section title={topic}` 두 곳에 나왔다 | 경로를 본문 첫 줄 `AppText variant="caption" tone="secondary"`로 내렸다(`Screen`은 고치지 않았다 — 다른 화면이 함께 바뀐다). 4단계의 `Section`을 없애 유형 이름 중복을 지웠다. `SourceTag`의 `eyebrow`는 이번 범위가 아니라 손대지 않았다 |
| F8 | `BackLink`가 `paddingVertical: spacing.xs`(4) + 캡션 한 줄(약 20)이라 누름 영역이 약 28px로 §10의 44px에 미달했다. D-039로 `← 다시 고르기` 3버튼을 없앤 뒤 고르기의 유일한 단계 이동 장치다 | `paddingVertical: spacing.md`로 44px을 만들고, 늘어난 만큼 `marginTop: -spacing.sm` · `marginBottom: -spacing.lg`로 되돌려 이 컴포넌트를 쓰는 화면(`Screen` 전부 + 대화 화면)의 여백을 그대로 뒀다. 계산: `Screen` 컬럼 gap 24 · 대화 화면 head 패딩 12 + gap 8 기준 양쪽 모두 이전과 같은 위치가 된다. `testID="screen-back"`·`accessibilityLabel="뒤로"`·아이콘·`canGoBack` 분기는 문자 단위로 유지 |

### 고치지 않은 것

- **학원 배정 콘텐츠가 개인 고르기에도 나오는 문제** → 결정 대기 `M9-05`
- **담기·빼기 문구 통일** → 결정 대기 `M9-06`
- **뒤로가기 라벨을 목적지로 바꾸기** → 결정 대기 `M9-07`(D-039의 부분 복원이 된다)
- **학습 탭 학원 목록 마감순 정렬** — D-034가 "정렬은 홈 화면에서만"으로 정해 문서 충돌
- `LearningRow`의 `leading` 추가, `SourceTag`의 `eyebrow`, `inkTertiary` 대비 전반, `QueueToggle` 등 나머지 44px 미달 — 범위 밖
- 담아 둔 학습 맨 아래 `학습 고르러 가기`가 전폭이라 primary보다 넓게 보인다 → 6절 `A-033`

### 의도적으로 바꾼 문구

- `뺄 학습을 골라주세요`(버튼 라벨) → `뺄 학습을 골라요.`(상단 캡션). 버튼 라벨은 늘 '무엇을 하는지'만 말한다(`DESIGN.md` §8)
- `담아 둔 학습에서 뺐어요. 기록은 그대로예요.` → `담아 둔 학습에서 뺐어요` + `되돌리기`. `e2e/queue-flow.spec.ts:130`은 부분 일치 정규식이라 그대로 통과한다
- 영역·학년 행의 `0개 학습` → `아직 준비 중이에요`(3단계와 같은 문구)
- 고친 테스트는 없다. 삭제·skip·완화한 테스트도 없다

### 추가한 E2E 6건 (× 3뷰포트 = 18)

`e2e/queue-flow.spec.ts`: 담아 둔 학습을 첫 번째부터 시작(시작 버튼이 목록 위 · 빼기 모드에서 없음 · 고른 것이 없으면 빼기 버튼도 없음) / 뺀 것을 되돌리기(한 개 → 원래 자리, 여러 개 → 빈 상태에서도 되돌리기).
`e2e/student-flow.spec.ts`: 학원 소속이 없는 학생에게 학원 섹션 없음 / 공개 학습이 없는 영역은 눌리지 않고 이유를 말함 / 경로를 본문 첫 줄에 두고 유형 이름을 두 번 쓰지 않음 / 세션 없이 고르기 단계 URL 직접 진입은 로그인으로.

`개인 학습`(exact) 위치 비교는 `student-learn` 안으로 범위를 좁혔다 — 데스크톱 사이드바 계정 메타(`accountMeta`)가 같은 글자라 `.first()`가 사이드바를 집는다.

### 검증

- `npm run typecheck` 통과 · `npm run lint` 오류 0(경고 1건은 기존 생성 파일 `.expo/types/router.d.ts`)
- `npm test` **60건 통과**(기준선 52 + `restoreQueueEntries` 8건). `__tests__/queue.test.ts`에 가운데·맨 앞 복원, 여러 개 동시 복원, 전부 복원, 중복 방지, 자리가 넘칠 때 맨 뒤, 빈 입력, 원본 불변을 넣었다
- `npx playwright test` **351건 통과**(desktop 1280 · tablet 820 · mobile 390). 기준선 333 + 새 6건 × 3뷰포트, 실패 0
- 실제 화면 확인(1280 · 390, 라이트·다크)
  - 학습 탭(김서준): `학습` → `개인 학습` → `학습할 문제 담으러 가기`. 학원 섹션 없음 — `docs/evidence/learn-no-academy-desktop.png` · `learn-no-academy-mobile.png`
  - 학습 탭(박도윤): 학원 섹션 유지 + 이용권 문구 — `docs/evidence/learn-academy-empty.png`
  - 고르기: 학년/영역/목록 3단계 — `docs/evidence/pick-grade.png` · `pick-area-blocked.png`(화법과 작문에 chevron 없음 + `아직 준비 중이에요`) · `pick-list-trail.png`(경로 한 줄, 유형 제목 중복 없음) · `pick-area-blocked-dark.png`
  - 담아 둔 학습: `docs/evidence/queue-start.png`(시작 버튼이 목록 위) · `queue-select-empty.png`(고른 것 없음 → 빼기 버튼 없음) · `queue-select-one.png`(`1개 빼기`) · `queue-undo.png`(안내 + 되돌리기) · `queue-undo-empty-dark.png`(빈 상태에서도 되돌리기)
- **도달 불가 분기**: F6 화면은 프로토타입에서 실행 중 도달할 수 없다(그 계정에 `learn-pick`이 없고, 직접 URL 진입은 메모리 세션 때문에 로그인으로 가드되며, 이용권은 바뀌지 않는다). 조건을 임시로 `true`로 두고 두 갈래를 캡처한 뒤 되돌렸다 — `docs/evidence/pick-no-entitlement.png` · `pick-academy-paid.png`. E2E로 고정하지 못한 사실은 6절 `A-032`에 남겼다. E2E는 대신 직접 URL 진입이 로그인으로 가드되는 것을 고정한다

## /product-review 학습 탭 → 고르기 → 담기 흐름

`product-manager`·`ux-auditor` 병렬 검토 → 합쳐 High 8건 수정 → 검증.

### 수정한 것

| # | 문제와 원인 | 조치 |
|---|---|---|
| F1 | 학원 소속이 없는 학생(김서준)의 학습 탭 **맨 위**가 자기와 무관한 빈 `학원 학습` 상자였다. 홈은 이미 `hasAcademy`로 가르는데(`index.tsx:69`) 학습 탭은 조건 없이 렌더했다 | 소속(`account.academyName`)이 있거나 배정이 있을 때만 섹션을 렌더. **기준을 `academyPaid`가 아니라 소속으로 둔 것이 핵심** — `academyPaid`(연결 상태 포함)를 쓰면 연결을 끊은 학생에게 섹션이 사라져 `e2e/boundary-flow.spec.ts:96`(끊은 뒤에도 그 문구가 **남는다**고 검증)이 깨진다. 내 최초 지시가 틀렸고 수정자가 바로잡았다 |
| F2 | `뺄 학습을 골라주세요`가 전폭 버튼인데 `onPress={undefined}`라 눌러도 무반응이었다(`queue.tsx:102-118`). `Button`에 disabled 표현이 없다 | D-036과 같은 규칙 — `picked.length > 0`일 때만 `N개 빼기` primary를 렌더. 안내는 상단 캡션 `뺄 학습을 골라요.`로 |
| F3 | 큐에서 뺀 것을 되돌릴 수 없고, `removed`가 `true`로만 바뀌어 안내가 화면을 떠날 때까지 남았다 | `progress.tsx`에 순수 함수 `restoreQueueEntries` + `restoreToQueue`. 뺀 칸과 **raw `queue` 기준 자리**를 기억해 복원(보이는 목록은 `dropped` 때문에 위치가 어긋난다). 여러 개 동시 복원 지원. `기록은 그대로예요` 삭제. 빈 상태에서도 되돌릴 수 있게 안내를 위에 뒀다 |
| F4 | 고르기 2단계는 `0개 학습`이어도 눌렸다. 3단계는 이미 `n > 0`으로 막아 **같은 화면에서 규칙이 달랐다**. `화법과 작문`(전 학년 0개)에 들어가면 누를 수 없는 5줄만 있고 안내도 없었다 | 2단계·1단계를 3단계와 같은 규칙으로. subtitle도 `아직 준비 중이에요`로 이유를 말한다. 콘텐츠 공백 자체는 S-011 |
| F5 | 화면이 `담은 순서대로 풀어요`라면서 시작 행동이 없고 유일한 primary가 `빼기`였다 | 목록 **위**에 `queue-start` = `첫 번째 학습부터 시작하기`(→ `items[0]`, 홈 히어로와 같은 대상). 빼기 모드·빈 상태 제외 |
| F6 | 개인 이용권 없는 계정이 고르기에 오면 전부 `0개 학습`·`아직 준비 중이에요`로 **콘텐츠 탓**을 했다. 실제 원인은 이용권이다 | `hasPersonal`이 false면 단계 UI 대신 이용권 안내 화면. **문구는 `learn.tsx`의 두 갈래를 그대로 재사용**(M9-04 결정 대기라 새 문구를 만들지 않았다) |
| F7 | 경로를 `Screen`의 `eyebrow`로 넘겼는데 `DESIGN.md` §4가 **한글에 쓰지 말라고 못박은 변형**이다(uppercase·자간이 한글에 뜻이 없다). 대비도 낮았고 4단계에서 유형 이름이 두 번 나왔다 | 경로를 본문 첫 줄 `caption`/`secondary`로. `Section title={topic}` 중복 제거. `Screen`·`SourceTag`는 건드리지 않았다 |
| F8 | `BackLink` 누름 영역이 28px로 §10의 44px 미달. D-039로 `다시 고르기` 3버튼을 없앤 뒤 고르기의 **유일한 단계 이동 장치**다 | 세로 패딩을 올려 44px. 음수 마진으로 상쇄해 `Screen` 전체와 대화 화면 레이아웃은 이전과 같다. testID·라벨·아이콘·`canGoBack` 유지 |

### 검증 (직접 재실행)

- typecheck 통과 · lint **오류 0**(경고 1건은 기존 생성 파일)
- `npm test` **60건**(기준선 52 + `restoreQueueEntries` 8건)
- `npx playwright test` **351건 통과**(기준선 333 + 새 6건 × 3뷰포트), 실패 0. **고친 기존 테스트 없음**
- 실제 화면 확인(390, 라이트·다크) — 두 검토가 남긴 `실제 화면 확인이 필요한 것` 목록 포함
  - F3 되돌리기: 빼면 `되돌리기` 등장 → 누르면 복원 → 안내 사라짐. **마지막 하나까지 빼 빈 상태가 돼도 되돌릴 수 있다**
  - F4: `화법과 작문`이 `role` 없이 눌리지 않고 이유를 문장으로 말한다
  - F7: 경로가 13px `caption` `rgb(76,87,88)`(≈7.3:1), `textTransform: none`. 유형 이름 **1회**
  - F5: `첫 번째 학습부터 시작하기`가 목록 위
  - **다크 담김 상태**: 배경 `rgb(16,48,47)` + 테두리·아이콘 `rgb(58,167,177)` — 세 신호로 구분된다. UX가 우려한 "아이콘만 유일한 신호"는 아니다
  - **담아 둔 학습 조작 3버튼이 한 줄에 들어간다**(실측). 코드 주석의 "한 줄에 셋이 안 들어간다"는 전제가 틀렸다
  - 증거: `docs/evidence/pick-saved-state-dark.png` + 수정자가 남긴 12장
- 문서 숫자 정정: 5절의 `학생 공개 11세트` → **12세트**(`publishToStudents: true` 실측 12: `content.ts` 3 + `contentExtra.ts` 5 + `grammarBank.ts` 4). 고르기의 `N개 학습`이 이 값을 그대로 보여준다

### 고치지 않은 것

- **학원 배정 콘텐츠가 개인 고르기에도 표시 없이 나온다** → 결정 대기 `M9-05`. `ct_gram_bank_spelling`·`ct_gram_1`이 배정 대상이면서 `publishToStudents: true`다(`fixtures.ts:220,256`). 개인 쪽을 풀면 기록은 `li_ct_...`에 남아 학원 배정은 미제출로 남는다 — 학생은 했다고 보고 학원은 안 했다고 본다
- 담기·빼기 문구 통일(4가지 이름) → `M9-06` / 뒤로가기 목적지 라벨 → `M9-07`(D-039를 부분 복원하는 셈)
- **모바일에서 primary가 화면 밖**: 정예린(학원 4 + 큐 2)에서 `learn-pick`이 y=920, 뷰포트 844px 밖이다(실측). UX는 큐 5개일 때를 예상했으나 **2개만으로도** 벗어난다. 고치는 방법이 여러 가지(`Screen lead` 추가 / 학원 미리보기 축소 / 진입점을 상단으로)라 사용자 판단이 필요하다
- `LearningRow`에 `leading` 추가(담아 둔 학습 순번을 왼쪽으로 옮겨 chevron 복원) — Medium, 공유 컴포넌트
- 학습 탭 학원 목록 마감순 정렬 — D-034의 "정렬은 홈에서만" 문장과 충돌
- 기존 항목: A-025 · A-026 · A-027 · A-032 · A-033 · S-011 · M9-04 · Q-010

## 개선 후보 5건 반영 (담기 흐름 후속)

`/product-review` 뒤 남긴 다음 개선 후보를 사용자 결정과 함께 처리했다.

| # | 조치 | 근거 |
|---|---|---|
| 1 | **학습 탭 미리보기 3줄 + 담아 둔 학습은 개수·진입만** | 모바일 390에서 주요 행동(`학습할 문제 담으러 가기`)이 화면 밖(y=920)이었다. 3줄로 줄여 869까지 왔지만 뷰포트 844를 여전히 넘었다(학원 행 하나 −95px, `더 보기` 버튼 +44px로 순이득 51px뿐). 담아 둔 학습의 **행 목록**이 남은 덩어리라 개수와 `보러 가기`만 남기고 목록은 전용 화면에 맡겼다 — D-039가 정한 이 탭의 목적("무엇을 할 수 있는지만 보여 주고 넘긴다")과 맞다. 결과 **y=698~738로 첫 화면 안에 완전히 들어온다**(실측) |
| 2 | **학원 배정 콘텐츠에 한 줄 표시**(D-044) | `학원 과제로도 받은 학습이에요. 과제는 학원 학습에서 풀어야 제출돼요.` 감추지 않는 이유는 개인 이용권으로 쓸 수 있는 콘텐츠가 남의 배정 때문에 줄고, 연결이 끝나면 목록이 갑자기 늘기 때문이다. `LearningRow`에 `note` 슬롯을 더했다 |
| 3 | **큐 순번을 왼쪽(`leading`)으로 옮겨 이동 화살표 복원** | D-040이 "`trailing`이 있으면 chevron을 뺀다"인데 큐는 순번(정보)을 `trailing`에 넣어 규칙이 잘못 발동했다. 순번은 원래 목록 왼쪽에서 읽는 정보다. 실측: 순번 43px < 제목 73px, 화살표 2개 복원, 고르기 모드에서는 0개(규칙 유지) |
| 4 | **담기·빼기 동사를 `빼기`로 통일**(D-043) | 토글 이름이 `담아 둔 학습에서 빼기`인데 토스트가 `담기를 취소했어요`라 스크린리더 사용자가 "빼기"를 누르고 "취소"를 들었다. 토스트를 `담아 둔 학습에서 뺐어요`로 |
| 5 | **학습 탭 학원 목록을 홈과 같은 순서로**(D-043) | 남은 것 먼저, 그 안에서 마감 이른 것부터(`byTodoThenDue`). 정렬 함수를 `src/features/learning.ts`로 올려 홈·학습 탭이 같은 것을 쓴다. D-034의 "정렬은 홈에서만" 문장을 D-043으로 대체했다 |

### 의도적으로 바꾼 테스트

- `e2e/academy-flow.spec.ts` `배정할 때 정한 마감일이…`: 새 배정(2026-08-11)이 **가장 늦은 마감**이라 마감순 정렬에서 마지막으로 가고 3줄 미리보기에 잘린다. `학원 학습 N개 더 보기`를 눌러 확인하도록 한 줄 추가했다. 급한 것이 위로 오는 것이 의도한 동작이라 정렬을 되돌리지 않았다
- 내가 새로 쓴 `학원 과제로도 받은 학습은…` 테스트가 strict mode로 실패했다 — **기능이 아니라 테스트가 틀렸다.** 정예린은 이 유형의 **두 세트 모두** 학원 배정이라 표시가 2개 잡힌다. `.first()` + `toHaveCount(2)`로 고쳤다
- 삭제·skip·완화한 테스트는 없다

### 추가한 E2E 3건

학원 목록이 마감 이른 것부터 세 줄까지 / 학원 과제로도 받은 학습에 표시가 붙고 배정 없는 학생에게는 안 붙음 / 담아 둔 학습이 순번을 왼쪽에 두고 화살표를 남기며 고르기 모드에서는 뺌.

### 검증

- typecheck 통과 · lint 오류 0 · `npm test` **60건** · `npx playwright test` **360건 통과**(3뷰포트), 실패 0
- 실측: `learn-pick` y 920 → 869 → **698**(뷰포트 844 안) / 큐 화살표 2개 복원, 고르기 모드 0개 / 순번 왼쪽 정렬

### 검증 중 알게 된 것

`playwright.config.ts`의 `reuseExistingServer: !CI` 때문에, 개발 서버(`expo start --web`)가 8081에 떠 있으면 Playwright가 `web:preview` 대신 그것을 재사용한다. 실행 중 개발 서버가 죽으면 **351건이 전부 1.1초 만에 실패**한다(코드 회귀처럼 보인다). 포트를 비우고 다시 돌려 구분했다.

## 오답노트 화면 재설계 (대화 순서·정리 아이콘·지문 접기)

사용자가 화면을 직접 쓰며 낸 세 가지 요청. 조사로 원인을 특정한 뒤 고쳤다.

| 항목 | 문제와 원인 | 조치 |
|---|---|---|
| 정리 버튼이 왼쪽 끝에 처박힘 | **버튼 위치는 이미 대화 카드 안이었다**(D-041 반영 완료). 진짜 원인은 `styles.actions`에 패딩이 전혀 없어 `Group`의 0px 경계에 붙은 것 | 첫 정리를 헤더의 노트 아이콘 하나로 옮기고(`file-plus` → `check-square`, 16px, `inkTertiary` → `accent`), `다시/이어서`는 메모 블록 아래로. ghost 버튼의 좌우 패딩을 음수 마진으로 상쇄해 메모 글자와 줄을 맞췄다 |
| AI 답변 위에 입력창이 남아 있음 | `AskField`가 문항 정보 `Group`의 두 번째 자식이고 대화 `Group`이 그 **아래**였다 — 순서가 `문항 → 입력 → 대화` | **D-045**: `문항 카드[헤더+답+메모+다시/이어서]` → `대화 카드[로그 + AskField]`로 뒤집었다. 대화가 없어도 대화 카드를 띄워 입력창을 늘 열어 둔다. placeholder는 대화가 있으면 `이어서 물어보세요`로 바뀐다 |
| 문항마다 지문이 다 펼쳐짐 | `{content?.passage ? <Passage/> : null}`이 조건 없이 항상 펼쳤고 `Passage`에 접기가 없었다 | `Passage`에 `collapsible`·`defaultOpen` 추가. **목록 첫 문항만 펼친다**(`n.id === wrongNotes[0]?.id`) — 칩을 바꾸거나 문항을 지우면 새 첫 문항이 자동으로 펼쳐진다 |

### 설계 판단

- **"ChatGPT처럼"을 대화 화면과 다르게 풀었다.** `/student/ask`는 대화가 하나뿐이라 입력창을 화면 하단에 고정했지만(레포에서 유일하게 `Screen`을 쓰지 않는 이유), 오답노트는 문항마다 카드와 대화가 따로라 하단에 하나를 고정하면 **어느 문항에 쓰는 건지 정의되지 않는다.** 그래서 카드 단위로 순서만 뒤집었다 — `review.tsx`의 `더 파고들기`가 이미 그 배치다
- **정리 아이콘의 노출 조건 `msgs.length > 0`을 반드시 유지했다.** 모든 카드 헤더에 항상 띄우면 `e2e/parent-flow.spec.ts:143`의 `[data-testid^="summ-ct_"]`.first()가 질문 안 한 카드를 잡아 `summarize`의 가드에 막혀 죽은 버튼을 누르게 된다. `A-031`(재진입 시 대화 소실)도 같은 상황이다
- **별표를 `Icon name="star"`로 통일했다.** 텍스트 글리프 `★`만 남기면 아이콘 셋의 스트로크가 어긋난다. 테스트는 `accessibilityLabel`(`별표 달기`)만 보므로 안전했다
- **지문을 접을 때 언마운트한다.** `height: 0`으로 감추면 지문 텍스트가 DOM에 남아 `getByText`가 여러 개를 잡고 strict mode 위반이 난다. `Passage` 자체는 마운트를 유지해 필기(`strokes`)를 보존한다

### 의도적으로 바꾼 테스트 (3곳)

- `e2e/student-flow.spec.ts:586` `summ.getByText('노트에 정리해 두기')` → 아이콘이라 텍스트가 없다. `getByRole('button', { name: ... })`로. **질문 전에는 아이콘이 없다는 단정도 함께 추가**했다
- `e2e/student-flow.spec.ts:588` · `e2e/parent-flow.spec.ts:144` `getByText('노트에 추가됐어요')` → 확인 신호를 토스트로 옮겨 `getByTestId('toast')`가 `노트에 정리했어요`인지 본다
- `e2e/student-flow.spec.ts:409-410`의 지문 본문 단정은 **고치지 않았다** — 첫 카드가 펼쳐져 있어 그대로 통과했다(실제로 돌려 확인)
- 삭제·skip·완화한 테스트는 없다

### 추가한 E2E 1건

`오답노트는 대화가 입력창 위에 오고, 지문은 첫 문항만 펼쳐진다` — 첫 문항 `지문 접기`/둘째 `지문 펼치기` 공존, 펼치면 둘 다 접기가 됨, 답변이 입력창보다 위(`boundingBox` 비교).

### 검증

- typecheck 통과 · lint 오류 0 · `npm test` 60건 · `npx playwright test` **363건 통과**(3뷰포트), 실패 0
- 실제 화면(390): 첫 문항만 펼침(접기 1 / 펼치기 1) · 질문 전 노트 아이콘 0개 → 질문 후 생김 · 헤더 순서 노트 245 → 별표 281 → 휴지통 317 · 답변이 입력창 위 · 정리 후 아이콘이 `노트에 정리됐어요`로, `다시/이어서`가 메모(422) 아래(559)
- 증거: `docs/evidence/notebook-card-redesign.png`

### 남긴 것

- **`A-034`(신규)**: `busy`가 전역 단일 값이라 한 문항이 작업 중이면 다른 문항의 질문·정리도 막힌다. 이번 재설계와 무관한 기존 동작이라 등록만 했다
- `A-031` 대화 비영속 · `A-030` 학부모 화면 긴 메모 접기(여기서 만든 `Passage` 접기와는 성격이 다르다)

## 오답 담기 목록의 정답 선지 + 정리 버튼 두 개 구분

| 항목 | 문제와 원인 | 조치 |
|---|---|---|
| 담기 목록이 발문만 보여 모든 줄이 똑같음 | `app/student/result/[id].tsx`의 `Row`에 `subtitle`이 없어 `${i+1}. ${q.prompt}`만 나온다. 문법 은행 세트는 `build()`로 만들어 25문항이 전부 `맞춤법이 바른 것은?` 하나다 | `subtitle={`정답 · ${q.choices[q.answerIndex]}`}` 추가. 실측으로 `정답 · 웬일이니` / `며칠` / `어이없다`로 구분된다 |
| `다시 정리하기`와 `이어서 더 정리해보기`가 구분 안 됨 | **둘 다 대화 전체를 요약**했다. 하나는 덮어쓰고 하나는 그 결과를 뒤에 붙이니, 이어서 정리하면 같은 내용이 두 번 쌓였다 | 요약은 늘 전체를 다시 쓰게 하고(`append` 모드 삭제) 두 행동의 역할을 갈랐다 |

### 두 버튼의 새 역할

- **`추가로 대화한 내용까지 더해서 정리하기`**(`addsum-{qId}`) — 더 물어본 뒤 누르면 그 내용까지 담긴 한 편으로 **새로 쓴다.** 뒤에 붙이지 않으므로 중복이 없다. 실측: 79자 → 114자로 바뀌되 앞 메모로 시작하지 않는다(`startsWith === false`)
- **`정리와 대화 지우기`**(`resum-{qId}`) — 메모·대화·입력을 모두 지워 처음 상태로 되돌린다. 실측: 토스트 `정리와 대화를 지웠어요`, 메모·대화·헤더 노트 아이콘이 모두 사라진다
- testID는 둘 다 유지했다(E2E가 참조). `resum-`이 이제 '지우기'라 이름과 뜻이 어긋나지만, 바꾸면 테스트 계약이 흔들려 그대로 뒀다

### 되돌릴 수 없는 삭제 (정직하게 남김)

`정리와 대화 지우기`는 되돌릴 수 없다. D-033이 이 화면의 **문항 지우기**에는 `되돌리기`를 두라고 정했지만 이쪽에는 없다. 이번에는 **라벨로 무엇이 지워지는지 밝히는 것**(`정리와 대화 지우기`)으로만 처리하고, 되돌리기는 6절 **A-035**로 등록했다 — `note-undo` 배너와 자리가 겹쳐 표시 방법을 함께 정해야 한다.

### 의도적으로 고친 테스트 1건

`이어서 더 정리하면 메모가 늘고, 다시 정리하면 새로 쓴다` → `추가 대화까지 다시 정리하고, 지우면 처음 상태로 돌아간다`. 옛 테스트는 append 동작(`appended.startsWith(first)`, 길이 증가)을 단정했는데 그 동작 자체를 없앴다. 새 테스트는 재요약이 앞 메모로 시작하지 **않음**과, 지우면 메모·정리 아이콘이 사라짐을 본다. 삭제·skip한 것은 없다.

### 검증

- typecheck 통과 · lint 오류 0 · `npm test` 60건 · `npx playwright test` **363건 통과**(3뷰포트), 실패 0
- 실제 화면(390): 문법 세트 담기 목록의 정답 선지 구분 / 두 버튼의 이름·동작 분리 / 지우기 후 처음 상태 복귀

## 새 과제 알림과 재배정 (D-046)

### 문제

학생 홈은 학원 과제를 `학원에서 내준 과제가 있어요` 한 문장으로만 알렸다. 새로 배정된 것과 지난주에 놓친 것이 같은 목록에 섞여, 무엇이 새로 온 소식인지 구분되지 않았다. 정예린으로 들어가면 마감이 다 지난 과제(7/20~7/25, 오늘 7/28)만 보였다.

### 고친 것

| | 동작 | 근거 |
|---|---|---|
| `home-academy-new` | `status === 'todo'`이고 마감이 안 지난 학원 과제가 있으면 `새 과제가 배정되었어요`(2개 이상이면 개수). 한 문항이라도 고르면 사라진다 | `merge`가 저장된 답이 있으면 `in_progress`로 올린다(D-035). 답은 보기를 누르는 즉시 저장되므로 "한 문제라도 풀면"과 뜻이 같다 |
| 마감 지난 미제출 | 알리지 않는다 | 이미 늦은 일을 새 소식으로 띄우면 재촉이 된다. 학생이 지울 수도 없다 |
| `reassign(assignmentId, dueDate)` | 마감일만 바꾼다. 제출 기록은 그대로 | 새 `Assignment`를 추가하면 이미 낸 학생에게 같은 과제가 또 가고 제출 현황이 두 줄로 갈라진다(D-013 기록 보존) |
| 성과 분석 `마감이 지난 미제출 과제` | 마감이 지났고 안 낸 학생이 남은 배정만. 줄을 누르면 `새 마감일` 입력이 열린다. 다시 정하면 목록에서 빠지고 토스트로 알린다 | 배정 화면과 같은 형식 검증(`2026-08-11`)에 "오늘보다 뒤" 검사를 더했다 — 지난 날짜로 다시 정하면 아무 일도 일어나지 않는다 |

미제출 학생을 이름으로 늘어놓았다가 아래 `확인이 필요한 학생` 섹션과 텍스트가 겹쳐 기존 E2E가 strict mode 위반으로 깨졌다. `N명 미제출` 개수로 바꿔 중복을 없앴다. 날짜 입력은 전폭이면 900px가 되어 `maxWidth: 280`으로 묶었다.

### 검증

- typecheck 통과 · lint 오류 0 · `npm test` 60건 · `npx playwright test` **369건 통과**(363 + 새 테스트 2건 × 3뷰포트), 실패 0
- 새 E2E 2건: 배정 → 정예린 홈에 알림 → 한 문항만 고르고 나오면 사라짐 / 박도윤은 마감 지난 미제출이라 알림 없음 → 원장이 재배정(지난 날짜는 거부) → 박도윤 홈에 다시 알림
- 실제 화면 1280·390: `docs/evidence/academy-reassign.png`(입력 열림) · `docs/evidence/home-new-assignment.png`(`새 과제가 2개 배정되었어요`)

## 학습 탭 계층과 버튼 인지 (D-047)

### 문제

1. 학습 탭에서 `담아 둔 학습`이 **학원 학습과 같은 층위의 섹션**이었다. 내가 담은 것도 개인 학습인데 밖으로 나와 있어 계층이 어긋나 보였다.
2. `학습 고르러 가기`는 이름과 실제 행동이 달랐다 — 고르는 것이 목적이 아니라 **담는 것**이 목적이다.
3. `학습 고르러 가기`·`빼기`·`여러 개 빼기`가 버튼으로 읽히지 않았다. 앞의 것은 전폭이라 배너 같았고, 뒤의 둘은 배경도 테두리도 없는 글자뿐이었다.

### 고친 것

| | 전 | 후 |
|---|---|---|
| 학습 탭 구조 | 학원 학습 / 담아 둔 학습 N개 / 개인 학습 (3섹션) | 학원 학습 / 개인 학습 (2섹션). 담아 둔 학습은 개인 학습 **안**의 한 줄 + `풀러 가기` |
| 담아 둔 것이 있을 때 primary | `학습할 문제 담으러 가기` | `풀러 가기` (담는 일은 이미 끝났다) |
| 담으러 가는 버튼 이름 | `학습 고르러 가기` · `학습 탭에서 문제 고르기` · `보러 가기` | 전부 `문제 담으러 가기`(학습 탭 안에서만 `학습할 문제 담으러 가기`) |
| 폭 | `queue-empty-start`·`queue-go-learn`·`records-empty-start` 전폭 | 전부 `hug` + `arrow-right` |
| `빼기`·`여러 개 빼기`·`위로`·`아래로` | 글자만 있는 `ghost` | `size="sm"` + `leading` 아이콘(`minus-circle`·`arrow-up`·`arrow-down`) |
| `N개 빼기` | `fullWidth` | `hug` + `minus-circle` |

`arrow-down`을 `IconName`에 추가했다. `home-empty-start`·`home-queue-empty-start`는 이미 내용폭 컨테이너 안이라 이름과 화살표만 맞췄다.

### DESIGN.md에 규칙으로 남긴 것 (사용자 요청)

반복해서 어긴 규칙이라 §8에 판단 기준을 문장으로 적고 §12 Don't에도 올렸다.

- **전폭을 쓸 수 있는 것은 그 화면의 primary 하나뿐이다.** 판단이 애매하면 "이 버튼을 눌러야 화면의 목적이 끝나는가?"를 묻는다 — 아니면 `hug`. 다른 화면으로 보내기만 하는 버튼은 절대 전폭이 아니다.
- **글자만 있는 `ghost`에는 `leading` 아이콘을 둔다.** 아이콘이 "여기는 누르는 곳"이라는 유일한 신호다. 취소·닫기처럼 뜻이 굳은 라벨에는 두지 않는다.

이로써 6절 **A-033**을 닫았다.

### 의도적으로 고친 테스트 1건

`담아 두면 학습 탭에 학원 학습 아래로 들어간다` → `담아 두면 학습 탭의 개인 학습 안으로 들어간다`. 옛 테스트는 `담아 둔 학습 < 개인 학습` 순서를 단정했는데 그 구조 자체를 바꿨다. 새 테스트는 `학원 학습 < 개인 학습 < 담아 둔 학습 줄`과, 두 버튼이 나란히 놓이고 폭이 각각 240·280px 미만임을 함께 본다. 삭제·skip한 것은 없다.

### 검증

- typecheck 통과 · lint 오류 0 · `npm test` 60건 · `npx playwright test` **369건 통과**(3뷰포트), 실패 0
- 실제 화면: 390·1280 라이트 + 1280 다크. `docs/evidence/learn-personal-mobile.png` · `learn-personal-desktop.png` · `queue-icon-buttons.png` · `queue-remove-selected.png`

## 학부모 영역 업그레이드 — 대시보드와 리포트 (D-048)

`product-manager`·`ux-auditor` 검토를 받고 **모든 지적을 코드로 대조**한 뒤 구현했다. 배치보다 데이터 정합성이 더 심각했다.

### 데이터가 사실과 달랐던 것

| 문제 | 원인 | 조치 |
|---|---|---|
| 학부모 홈이 자녀의 실제 상태를 한 글자도 반영하지 않았다 | 홈은 `getChildSummary`(정적 fixture), 리포트는 자기 계산을 썼다. `LEARNING_BY_USER`에 `status:'done'`이 하나도 없어 **`평균 정답률`은 구조적으로 항상 `—`** | 계산을 `src/features/report.ts` 한곳으로 모으고(`buildChildReport`) 두 화면이 함께 읽는다. `getChildSummary` 삭제 |
| `확인할 오답`이 항상 0 | 학부모 **본인**의 `wrongNotes`를 셌다(`progress.tsx:183`) | 지표를 없애고 자녀 오답노트 수는 리포트에서 `wrongNotesOf`로 센다 |
| 마감일을 제출일·학습일로 썼다. 정렬·추이·상세의 `제출한 날`이 전부 이 값이었다 | `Submission`에 제출 시각이 없어 `dateISO`에 `dueDate`를 넣었다 | `Submission.submittedAt` 신설. 없으면 `제출일 기록 없음`, 마감은 별도 행. 날짜 없는 기록 수를 화면에 밝힌다 |
| 개인 학습 기록이 학부모 화면에 0건이라 "학원 과제 vs 개인 학습 구분"을 보여 줄 데이터가 없었다 | `ATTEMPTS_SEED`가 없었다 | `src/data/attempts.ts` 신설(정예린 개인 2 · 이하은 개인 3, 여러 날짜) |
| 재풀이 요청이 자녀에게 **한 번도 도달하지 않았다** | 학생 안내 조건이 `attempt && retry.includes(...)`인데 학원 제출 과제에는 `attempt`가 없다(A-026) | `attempt &&`를 뗐다(한 줄) |
| 학부모에게는 `기록은 그대로 남아요`, 학생에게는 `새로 풀면 바뀌어요`라고 반대로 말했다 | `recordAttempt`가 `itemId`로 덮어쓴다 | 문구를 사실에 맞췄다. 회차 보존은 **A-036**으로 등록 |
| 홈이 약속한 `해설`이 도착 화면에 없었다 | `attempt.tsx`가 `QuestionReview`를 쓰지 않았다 | `Toggle` + `QuestionReview`로 교체 — 해설이 붙고 D-030 규칙과 하나가 됐다 |

### 리포트 재설계 (7섹션 → 5섹션)

순서를 학부모의 판단 순서로 바꿨다: **아직 안 낸 학원 과제 → 종합 → 영역별 정답률 → 학습 기록 → 자녀의 오답노트.** 예전에는 가장 급한 미제출이 네 번째, 유일한 행동이 맨 아래 일곱 번째였고 **같은 학습 목록이 세 번**(그중 둘은 정렬이 반대로) 나왔다. 목록을 하나로 합치고 재풀이는 그 행의 행동으로 옮겼다.

- **표본 하한**: 문항 20개(`WEAK_MIN_QUESTIONS`) 미만이면 `문항이 적어 아직 판단하기 일러요`. 근거 없는 안심 문구(`고르게 하고 있어요`)는 삭제.
- `StatTiles`·`SourceTag`·`Chips`·`RichText`로 통일. 손으로 그린 metric 세 벌이 사라졌다.
- 메모는 `RichText` + 접기 → 6절 **A-030** 닫음.
- IA: `/parent/child/[id]`는 `/parent/report?child=…`로 리다이렉트. `자녀` 탭은 소속·이용권 확인으로 성격 변경(이용권 병존을 감추던 배타 삼항 수정).

### 화면에서 잡아 고친 것 두 가지

1. **모바일 390에서 행이 무너졌다.** `leading`(출처) + `meta`(정답률) + 라벨 있는 버튼이 본문을 **한 글자 폭**까지 밀어냈다(실측 캡처로 확인). 행의 행동을 아이콘 하나로 좁혔다(결과 화면 담기 토글과 같은 형태, 이름은 `accessibilityLabel`).
2. **`독서이 20문항에서…`** — 영역 이름이 데이터에서 와서 조사가 틀렸다. 받침으로 이/가를 고르는 `subjectParticle`을 뒀다.

### 검토에서 채택하지 않은 것

**세부 유형(topic)별 정답률.** 공개 콘텐츠에서 세트가 2개 이상인 유형은 `현대소설`·`어문 규정 - 맞춤법` 둘뿐이라(실측) 유형별 집계가 사실상 학습 목록을 다시 쓴 것이 된다. `Question`에 `topic`이 없어 세트 단위가 한계다. 영역 + 문항 수 표기가 정직한 선이다.

`product-manager`에게 WebSearch 도구가 없어 리서치 절을 검증하지 못했다. 설계 근거는 외부 사례가 아니라 이 레포의 코드에만 두었다.

### 의도적으로 고친 테스트

- `__tests__/data.test.ts` `자녀 요약` — **깨진 동작을 고정하고 있었다**(`expect(s.recentAccuracy).toBeNull()`). 함수를 지우고 `__tests__/report.test.ts` 8건으로 대체했다(출처 분리·제출일·빈 상태·표본 하한·권한).
- `e2e/parent-flow.spec.ts:97` — `담긴 오답이 아직 없어요.`가 **코드에 없는 문구**라 항상 통과하던 단언. 실제 빈 상태 문구로 교체.
- 취약 문구 정규식, `학습별 상세 리포트` → `학습 기록`, `문항별 전체 내역` → `문항별로 확인해요`, `자녀 답:` → `자녀가 고른 답`, `/parent/child/` URL → `/parent/report`, 자녀 전환 `tab` → `button`(`Chips`).
- 삭제·skip·완화한 것은 없다.

### 검증

- typecheck 통과 · lint 오류 0 · `npm test` **67건**(60 → 깨진 1건 삭제 + 8건 추가) · `npx playwright test` **390건 통과**(369 + 새 7건 × 3뷰포트), 실패 0
- 전체 E2E를 돌렸다 — `todayISO()` UTC 수정이 학생 홈·학원 성과 분석의 마감 판정에도 닿는다
- 실제 화면 390 · 1280 + 다크: `docs/evidence/parent-home.png` · `parent-report-mobile.png` · `parent-report-rows.png` · `parent-report-desktop.png` · `parent-report-dark.png` · `parent-attempt.png` · `parent-attempt-review.png`

## 학부모 리포트를 월간으로 (D-049)

### 지적받은 것

`총 학습 시간 38분 38초`가 **누적 총합**이었다. 5년 쓰면 5년치가 합쳐진다. 장기 사용자를 전혀 고려하지 않은 기획이었고, 자녀 탭은 리포트 복사본이라 리포트 탭과 완전히 같은 화면이었다. 모바일 여백과 내비도 지적받았다.

### 조사 (WebSearch)

- 학습 리포트는 **일·주·월로 끊는다.** IXL은 `Usage`(시간·문항)와 `Progress`를 명시적으로 분리한 탭으로 두고, 국내 학습지 앱(풀다 등)도 일별·주별·월별 학습 시간과 푼 문항 수를 앞세운다.
- **지표는 3~5개로 좁힌다.** 학습 결과와 직결된 것만 두고 학부모를 데이터로 덮지 않는다.
- **꾸준함(학습한 날 수)이 총합보다 신뢰를 얻는다.** 학부모가 검증할 수 있는 사실이기 때문이다. 연속 학습 추적을 쓴 서비스는 2개월차 이탈이 22% 줄었다.
- **복습 활동이 리포트 항목이다.** 오답 노트를 작성하고 복습하는 것이 학습 리포트 구성 요소로 언급된다.
- 학부모가 진행 상황을 볼 수 있으면 구독 유지 확률이 2~3배 — 리포트가 이 제품의 유지 축이다.

출처: [SplashLearn 학부모 리포트](https://support.splashlearn.com/hc/en-us/articles/12275144246546-How-can-parents-track-the-child-s-progress-or-view-the-report) · [Wizidoo 학부모 대시보드](https://www.wizidoo.com/en/blog/parent-dashboard-track-progress) · [thisisglance 학습 추적](https://thisisglance.com/learning-centre/how-do-i-track-student-progress-effectively-in-my-educational-app) · [Nxtwave 연속 학습 사례](https://medium.com/@rsoni9099/increasing-user-retention-with-nxtwaves-streak-ui-ux-case-study-37e469c7c080) · [Plotline 스트릭 설계](https://www.plotline.so/blog/streaks-for-gamification-in-mobile-apps) · [풀다 학부모](https://apps.apple.com/il/app/%ED%92%80%EB%8B%A4-%ED%95%99%EB%B6%80%EB%AA%A8-%EC%9E%90%EB%85%80%EC%99%80-%ED%95%99%EB%B6%80%EB%AA%A8%EC%9D%98-%EA%B5%90%EC%9C%A1-%EC%97%B0%EA%B2%B0%EA%B3%A0%EB%A6%AC/id6471932083?l=he) · [체리팟 학부모](https://play.google.com/store/apps/details?id=net.cherrypot.parent&hl=ko)

### 다시 기획한 것

**한 달이 리포트 하나다.** `buildChildReport(childId, deps, month)`로 모든 지표를 달로 끊고 지난달과 나란히 둔다.

| 블록 | 답하는 질문 |
|---|---|
| 아직 안 낸 학원 과제 | 지금 문제가 있나 (달과 무관한 **지금** 상태) |
| 달 선택 칩 | 어느 달을 볼까 |
| `N월 학습` | 공부한 날 **2일**(지난달보다 1일 많아요) · 푼 문항 34문항 · 정답률 79%(지난달 60%) · 학습 시간 |
| `N월 오답노트` | **틀린 걸 다시 봤나** — 담은 오답 2개(전체 3개) · AI와 정리 1개 · 이해 완료 0개(별표 1개) + 자녀 메모 |
| 영역별 정답률 | 어디가 약한가 (그 달 기준) |
| `N월 학습 기록` | 근거 |
| 달마다 어떻게 변했나 | 최근 6개월 공부한 날 수. 누르면 그 달 리포트로 |

- **머무는 지표를 `공부한 날 수`로 바꿨다.** 총합은 어디에도 두지 않는다.
- **날짜가 없는 기록은 어느 달에도 세지 않고** 그 수를 밝힌다. 임의의 달로 밀어 넣지 않는다.
- 데이터 변경 하나: **`WrongNote.createdAt`** — 없으면 복습 활동을 달로 셀 수 없다.
- 시드를 6월·7월 두 달로 갈랐다. 지난달 비교와 `달마다 어떻게 변했나`를 화면에서 확인해야 하기 때문이다.

**자녀 탭은 이용권·결제 화면이 됐다.** 학원 이용권과 개인 월정액을 함께 보여 주고(이용권 병존), 자녀 본인이 내는 개인 월정액을 `내가 대신 낼게요`로 표시할 수 있다(`parentPays`). **실제 청구는 없다는 사실을 화면에서 밝힌다** — 표시만 남는다.

### 모바일

- `Screen`의 좌우 여백·섹션 간격을 모바일에서만 `spacing.lg`로 줄였다(342px에 24는 본문을 누른다). 태블릿·데스크톱은 그대로.
- 하단 내비를 **화면에 붙이고 위 모서리만 둥글게**, 아이콘 19·세로 패딩 `xs`로 줄였다. 태블릿은 떠 있는 알약 유지(요청대로).
- 화면에서 잡은 문구 버그: `7월 2일 공부했어요`가 날짜로 읽혀 `7월에 2일 공부했어요`로 고쳤다.

### 의도적으로 고친 테스트

`종합 리포트`→`N월 학습`, `학습 기록`→`N월 학습 기록`, `총 학습 시간`→`공부한 날`. 자녀 탭이 결제 화면이 되어 그 탭을 거쳐 리포트로 가던 두 테스트는 홈 경유로 바꿨다. 박도윤(기록 0)은 `report-stats`가 아예 없는 것이 옳은 동작이라 `toHaveCount(0)` + `푼 학습이 없어요`로 바꿨다. 삭제·skip은 없다.

### 검증

- typecheck 통과 · lint 오류 0 · `npm test` **74건**(월 단위 동작 7건 추가) · `npx playwright test` **396건 통과**(3뷰포트)
- 실제 화면 390: `docs/evidence/parent-home-monthly.png` · `parent-report-month.png` · `parent-report-notes.png` · `parent-report-history.png` · `parent-children-billing.png`

## 학부모 리포트 대폭 재설계 — 모바일·출처 분리·반 비교 (D-050)

### 지적받은 여섯 가지

`이해 완료`가 뭔지 모르겠다 / 개인·학원을 따로 구분해라 / 등수 같은 것이라도 나올 줄 알았는데 뭐가 없다 / 오답노트가 1개만 보인다, 3개면 넘겨 볼 수 있어야 한다 / 지표 **카드 박스가 너무 크다**, 리포트처럼 간결하게 / **학부모는 휴대폰으로 본다**.

`product-manager`·`ux-auditor` 두 에이전트를 붙이고 지적을 코드로 대조했다. 두 보고가 실제로 구현을 고쳤다.

### 등수 — 지어내지 않고 계산했다

`Submission.accuracy`에 반 학생 전원의 정답률이 있어 **반 평균과 순위는 실제 데이터에서 나온다.** 학원 화면이 이미 같은 값을 본다.

문제는 시드였다: `c_kor1`은 제출자 1명, **`c_kor2`는 반 학생 자체가 정예린 한 명**이었다(에이전트가 잡아냈다). 그대로 붙이면 `반 평균 80% · 자녀 80%` — 자기 점수를 반 평균으로 오해시키는 **잘못된 정보**가 된다.

- 로스터 학생(이미 `ACCOUNTS`에 있고 로그인 불가)을 `c_kor1`에 7명, `c_kor2`에 5명 넣었다. 새 계정을 만들지 않았다.
- `classStat`은 **제출자 5명 미만이면 `null`** — 2명이면 평균과 내 점수로 남의 점수가 역산되고, 1명이면 자기 점수가 반 평균이 된다.
- 동점은 공동 등수(`accuracy > mine` 수 + 1).
- **월 단위 집계 순위는 만들지 않았다.** 과제별 순위를 평균 내면 학생마다 과제 집합이 달라 근거가 없다 → `반 평균보다 높았던 과제 2/4`로 센다.
- 개인 학습에는 또래가 없어 순위를 만들지 않고 `비교할 또래가 없어 지난달과만 견줘요`라고 밝힌다.
- 에이전트가 경고한 `src/data/usage.ts`의 `contentUsage`는 **문항 id를 FNV 해시로 돌려 만든 가짜 집계**다. 학부모 화면에 절대 쓰지 않는다.

### 화면 (실측)

| | 전 | 후 |
|---|---|---|
| 리포트 세로 길이(390) | **3,773px** | **2,457px (−35%)** |
| 지표 표현 | `StatTiles` 큰 상자 7개(734px ≈ 한 화면 전체) | `Group`+`Row` 목록 한 줄 |
| 오답노트 지표 | 상자 3개(313px) | 한 줄 문장(20px) |
| 학습 기록 행 본문 폭 | 109px(제목 2줄로 접힘) | 185px(정답률을 `meta`→subtitle 앞으로) |

- **개인/학원을 섹션으로 갈랐다**: `7월 학습`(공부한 날·학습 시간) → `7월 학원 과제`(낸 과제·정답률·반 평균 대비) → `7월 개인 학습`(푼 학습·정답률). 합쳐도 사실인 것만 위에 두고 정답률은 각 블록에만 뒀다.
- **오답노트를 `Pager`(`pageSize=1`)로 다 넘겨 본다** — `3개 중 1–1` + 이전/다음. `Pager`의 버튼이 28px로 §10(44px)을 어기고 있어 `minHeight: 44`를 넣었다(운영자 표에도 같이 이득).
- **`이해 완료` 삭제.** 카드 복습에서 학생이 스스로 누른 자기 신고이고 재풀이 결과는 저장되지 않아(A-036) 실제로 맞혔는지와 무관하다. 필드는 학생 화면이 쓰므로 남겼다.
- 학원 소속이 없는 자녀(이하은)에게는 **학원 블록을 그리지 않는다** — 예전에는 `학원 과제 0`이라고 썼다.
- 메모 접기 기준을 모바일에서 70자로(390에서 120자는 6줄). 맨 아래에서 달을 바꾸면 위쪽이 바뀐 것이 안 보여 토스트로 알린다.
- 과제 상세에도 `반에서 · 제출한 8명 기준 · 반 평균 76% · 4번째`.

### 의도적으로 고친 테스트

반이 9명이 되어 `__tests__/data.test.ts`의 반 인원(2명)·`submissionStat`(1/2/80) 단정을 9명·8/9/76으로 고쳤고, 반 친구가 로그인 불가임을 함께 단정하도록 늘렸다. `e2e/academy-flow.spec.ts:31` `제출 2/2` → `제출 9/9`. `모두 제출했어요.`는 반 친구를 전원 제출로 둬서 그대로 통과한다(예고대로). `parent-flow`는 `report-stats` 단일 testID가 사라져 `metric-*`로 갈랐다. 삭제·skip은 없다.

### 검증

- typecheck 통과 · lint 오류 0 · `npm test` **74건** · `npx playwright test` **405건 통과**(3뷰포트, 새 E2E 3건 × 3)
- 실제 화면 390 실측: `docs/evidence/parent-report-lines.png`(목록형 지표·출처 분리) · `parent-report-notes-pager.png`(한 줄 지표 + 넘기기) · `parent-report-rank.png`(반 8명 중 4번째)

### 달 선택을 스테퍼로 (D-050 보강)

칩으로 두었더니 **`7월` 오른쪽에 `6월`이 와서 시간 흐름과 반대**였다. 리포트는 달마다 하나씩 쌓여 5년이면 칩이 60개가 된다.

조사 결과 **모바일에서 드롭다운은 피해야 한다** — 사용자가 60% 느려지고 오류가 늘어난다. 항목이 적을 때는 스테퍼가 더 빠르고 직관적이며(성공률 비교), "월은 이전/다음 버튼"이 권장 패턴이다.

출처: [NN/g 날짜 입력 가이드라인](https://www.nngroup.com/articles/date-input/) · [Quant-UX 모바일 드롭다운](https://www.quant-ux.com/blog/mobile_drop_downs_revisited/) · [Smashing Magazine 날짜·시간 피커](https://www.smashingmagazine.com/2017/07/designing-perfect-date-time-picker/) · [Mobbin 날짜 피커 패턴](https://mobbin.com/glossary/date-picker)

`‹ 7월 ›`로 바꿨다. **왼쪽이 과거, 오른쪽이 미래**라 방향이 곧 시간이고 순서를 외울 것이 없다 — 지적받은 문제가 구조적으로 사라진다. 갈 곳이 없으면 그 화살표가 막히고(44px), 기록이 있는 달만 오간다. 특정 달로 바로 가는 길은 `달마다 어떻게 변했나`가 맡는다(그쪽도 오래된 달이 위).

실측: 7월에서 오른쪽 막힘 → 왼쪽 누르면 6월(학원 과제가 없어 학원 블록 자체가 안 그려짐) → 6월에서 왼쪽 막힘. `docs/evidence/parent-month-nav.png` · `parent-month-nav-prev.png`

## 학부모 리포트 — AI 주간 요약 · 칭찬 스티커 · 자세히 보기 (D-051)

사용자가 아이디어 45개를 줬다. **절반이 지금 데이터로 계산되지 않았고**, 그것을 넣지 않는 것이 이 작업의 절반이었다.

### 넣은 것

| | 계산 근거 |
|---|---|
| **AI 이번 주 요약** (맨 위, 그 주 내내 유지) | `askScodyAI` + `SCODY_PARENT_WEEK_SYSTEM`. 재료는 `weekFacts`가 만든 **이미 계산된 숫자만** |
| **칭찬 스티커** | `praiseByChild` → 학생 홈 맨 위 한 줄, 자녀가 확인해 닫는다 |
| **기한 내 제출률** | `submittedAt` vs `dueDate`. 둘 다 있는 과제만 분모에 넣는다 |
| 과제 완료율 · 미제출 목록 · **마감 요일 부담** | `submissions` + `dueDate`의 요일 |
| 반 등수 + **상위/중위/하위 구간** | `classStat`. 구간은 등수보다 압박이 적어 함께 둔다 |
| **제재·갈래별 성취도** | `ContentSet.topic`. 문항 수를 반드시 함께 낸다 |
| 날짜별 학습 · 문항당 평균 시간 | `dateISO` · `timeSec / questions` |
| 오답 **정리율** · 스스로 한 공부 비중 | `dig` 비율 · `bySource` |

### 넣지 않은 것과 이유 (6절 A-039~A-042로 등록)

- **또래·전국·같은 학년 평균, 비슷한 출발점 사례** — 실제 사용자 집계가 없다. `usage.ts`는 문항 id를 FNV 해시로 돌린 테스트 값이다(D-018).
- **역량 12종**(추론·핵심 요약·정보 구조·어휘 문맥·보기 적용·개념어·인물 관계·정서 태도 등) — `Question`에 능력 태그가 없다. 12세트 전 문항 재태깅이 먼저다.
- **읽기 속도·초반 과속·긴 지문 회피·고난도 집착** — 문항별 시각이 없다.
- **답 변경 패턴** — `saveAnswer`가 덮어써 이력이 없다.
- **순공부 시간** — `timeSec`이 벽시계 시간이다. 오히려 `순공부 시간은 아니에요`를 화면에 적었다.
- **오답 재발률**(재풀이 미저장) · **루틴 안정성**(시각 없음) · **중도 이탈**(미기록) · **EBS 연계**(데이터 없음).
- **현재 학습 상태 4단 등급** — AI 요약이 문장으로 같은 일을 하고, 4단 등급은 근거를 밝히기 어렵다.

**대신 없는 이유를 화면에 밝히는 것을 기능으로 삼았다** — 상세 맨 아래 `이 리포트가 말하지 않는 것`.

### 프롬프트만으로는 출력을 통제할 수 없었다

실측으로 두 번 실패했다. 1차: `안녕하세요, 스코디 선생님이에요.` 인사말이 붙었고 문장마다 줄이 바뀌어 5단락이 됐다. `[금지] 서론`을 프롬프트에 두었는데도 그랬다.

그래서 **`tidySummary`로 결정적으로 다듬는다** — 인사·자기소개 문장 제거, 줄바꿈을 한 덩어리로, 마크다운 제거, 4문장 제한. 내용은 손대지 않는다. 단위 테스트 5건으로 고정했다.

재료 라벨도 고쳤다(`공부한 날: 1일` → `공부한 날 수: 1일`). 모델이 `1일 동안 9분 동안`처럼 이어 붙이던 것이 `1일 동안 9분을 공부했고`로 나아졌다.

실제 출력(실측): `예린이는 이번 주에 1일 동안 9분을 공부했고 10문항을 풀었어요. 문학 영역 정답률은 80퍼센트를 기록했어요. 다음 주에는 학부모님이 예린이의 학습 화면을 함께 넘겨봐 주세요. 오늘은 예린이가 문제를 풀 때 쓴 공책을 조용히 펼쳐봐 주세요.`

### 의도적으로 고친 테스트

새 E2E 4건을 넣다가 **제 가정이 틀린 것을 두 번 잡았다**: 이하은의 기록(7/26·7/24)은 월요일 시작 기준으로 지난주라 이번 주가 비어 있다. 동작이 맞으므로 테스트를 사실에 맞게 고쳤다. `weekFacts` 라벨 변경에 따라 단위 테스트 1건도 함께 고쳤다.

### 검증

- typecheck 통과 · lint 오류 0 · `npm test` **88건**(74 → 주 단위·반 비교·요약 다듬기 14건 추가) · `npx playwright test` **420건 통과**(3뷰포트)
- 학생 홈 구획이 하나 늘어 학생 E2E를 함께 돌렸다(히어로 위치를 `boundingBox`로 보는 테스트 포함)
- 리포트 세로 길이 390: 2,457 → **2,877px**(요약·칭찬·자세히 보기 추가분). 상세 화면은 2,367px
- 근거: `docs/evidence/parent-week-summary.png` · `parent-detail-top.png`(기한 내 제출·요일 부담·반 구간) · `parent-detail-limits.png`(말하지 않는 것)

## /product-review — 학부모 리포트 흐름 (D-052)

`product-manager` + `ux-auditor` 병렬 검토. 두 보고가 **같은 Critical 두 건을 각각 독립적으로** 짚었고, 내가 직접 검산한 다섯 건과 합쳐 고쳤다.

### Critical

| 문제 | 근거 | 조치 |
|---|---|---|
| **AI 실패 문장이 요약으로 저장되고 성공 토스트가 떴다** | `askScodyAI`는 실패도 문장으로 반환한다(`openrouter.ts:45,50,52`). 호출부가 검사 없이 저장 → `Scody AI 호출 실패 (HTTP 402). 모델(…)·키·크레딧을 확인해 주세요.`가 **그 주 내내** 리포트 맨 위에 남았다 | `askScodyAIResult`로 성공·실패를 값으로 받는다. 실패 시 저장하지 않고 대체 문장 + `AI 요약을 만들지 못해 숫자로 대신했어요` |
| **직접 푼 학원 과제에 반 비교가 안 붙었다** | 학원 학습의 `LearningItem.id`가 배정 id이고 제출 기록 `itemId`도 같은 값이라(`learning.ts:124`, `solve/[id].tsx:96`) 배정 루프가 `seen`으로 건너뛴다. **지금 등수가 보이는 건 시드 제출 덕분**이고 실제 사용에서는 비어 있었다. 게다가 화면은 `반에서 낸 학생이 적어…`라는 거짓 이유를 댔다 | attempt 행에도 배정을 역참조해 `dueDate`·`cls`를 붙인다. 없는 이유도 실제 원인으로 갈라 쓴다 |

### High·Medium

- **정답 수를 정답률에서 되돌리던 것**을 `Attempt.correct`·`wrongQIds`로 바꿨다. `accuracy`가 이미 반올림값이라 25문항 세트에서 ±1이 `totals`·`bySource`·`byArea`·`byTopic`에 각각 쌓였다.
- **그 달 배정을 마감월로만** 판정한다. 제출월 OR 마감월이면 한 과제가 두 달에 계상되고 `아직 안 낸 학원 과제 1개`와 `모두 냈어요`가 한 화면에 함께 나왔다. 마감일 없는 배정은 개수를 밝힌다.
- **주간 요약에 월 영역 집계를 넘기던 것**을 `weekAreas`(주 단위)로 바꿨다. 모델이 월 성취를 주간 사실로 서술했다.
- **반 평균도 문항 가중**으로 낸다(자녀 정답률과 같은 방식). 부호가 뒤집힐 수 있었다.
- **쓰기 함수에 권한 검사**를 넣었다(`setWeekSummary`·`sendPraise`). `requestRetryFor`는 이미 `canRead`를 탔다.
- **칭찬 id 충돌**: 같은 날 같은 종류를 두 번 보내면 id가 같아 React key가 겹치고 확인 한 번에 둘이 닫혔다 → 같은 날 중복 전송을 막았다.
- **칭찬을 요약 밖으로** 옮겼다. 달과 무관한 행동인데 지난달 리포트에서 사라졌다. 펼침에 `닫기`를 뒀다(유일한 출구가 되돌릴 수 없는 쓰기였다).
- **`자세히 보기`를 첫 화면으로**. y≈2,390 → **y=374**(실측). `7월 학습` 섹션 `action`.
- **달 상태가 왕복에서 살아난다**: `report.tsx`가 `month` 쿼리를 읽고 상세의 `backFallback`이 달을 담는다. `<ChildReport key={child.userId}>`로 자녀 전환 시 로컬 상태(달·펼침·요약 진행)를 버린다.
- 문구: `또래가 없어 지난달과만 견줘요`(화면에 없는 비교를 약속했다) → `또래 비교는 두지 않아요`. 월 문장을 `7월 한 달 동안…`으로 갈라 주간과 틀이 겹치지 않게. 빈 주는 카드가 아니라 캡션 + 기간 표기. `모두 0개예요` 제거. 요약 버튼의 `arrow-right` 제거(이동이 아니다). 스테퍼에도 달 변경 토스트.
- `Chips` 터치 영역 28 → **44px**(§10). 공용이라 3뷰포트 확인했다.
- 상세: 달 무관 미제출 목록 제거, 마감이 몰리지 않은 달에 몰림을 그리지 않음, `말하지 않는 것`을 `Group`+`Row`로, `StyleSheet.create`로 통일.
- 모바일 섹션 간격을 `spakcing.lg`로(§10). 리포트 세로 2,877 → **2,577px**.

### 의도적으로 고친 테스트 — 근본 원인을 밝힘

`추가 대화까지 다시 정리하고…`(`student-flow`)가 **일관되게** 실패했다. 원인은 내 변경이 아니었다: **AI가 두 번 같은 요약을 냈다**(실측 로그로 확인). 키가 없을 때는 데모 응답이 프롬프트를 되돌려 주므로 대화가 바뀌면 글도 항상 달라져 통과했을 뿐이다.

이 테스트가 지켜야 하는 규칙은 D-045의 "**뒤에 붙이지 않는다**"이고, 같은 내용이 다시 나오는 것은 그 규칙과 모순되지 않는다. 그래서 `not.toHaveText(first)`를 `startsWith(first) && length > first.length === false`로 바꿨다 — 우연한 성질(글이 달라짐) 대신 실제 불변식(이어 붙이지 않음)을 단정한다. 그 과정에서 `busy` 가드에 막혀 초기화가 안 되던 것도 잡아 토스트가 사라질 때까지 기다리게 했다. 그 밖의 두 건은 내가 바꾼 문구에 맞춘 것이다.

### 검증

- typecheck 통과 · lint 오류 0 · `npm test` **94건**(88 → 검토 대응 6건 추가) · `npx playwright test` **420건 통과**(3뷰포트)
- 실측: `자세히 보기` y=374(첫 화면 안) · 리포트 2,577px · 6월로 바꿔도 칭찬 유지 + 요약 사라짐 + 토스트
- 근거: `docs/evidence/parent-report-reviewed.png`

### 남긴 것 (6절)

**A-043** `askScodyAI`의 실패 계약을 학생 화면 두 곳도 같은 방식으로 다루기 · **A-044** 섹션 제목 `N월` 접두어 다섯 번 반복(E2E 6곳·4절 표기 동반) · **A-045** 칭찬 전송 되돌리기(A-037과 같은 뿌리)

## 7/31 — 웹 폰트: 첫 진입 폰트 전환 (D-053)

### 신고와 원인

"웹페이지 들어가면 5초간 폰트가 2번 바뀌다가 정착한다. `npm run web`이라 그런가, 배포하면 괜찮은가?"

**`npm run web` 탓이 아니었다.** `npx expo export -p web`으로 프로덕션 번들을 만들어 정적 서버로 띄워 같은 현상을 재현했다.

- 폰트 자산이 프로덕션에도 그대로 들어갔다: Pretendard TTF 4종 10.7MB(gzip 약 4.6MB) + Space Grotesk 5종 430KB + Feather 54KB
- 타임라인(250ms 간격): **7,397ms에 텍스트가 폴백(`Apple SD Gothic Neo`)으로 먼저 그려지고** 7,671ms에 Pretendard가 도착
- expo-font가 넣는 `@font-face`의 `font-display`가 `auto`라 브라우저는 약 3초만 기다린다. 굵기당 2.5MB는 그 시간을 넘긴다
- 같은 URL이 **두 배치**(약 455ms 간격)로 요청됐다 — FontFace API 경로와 `@font-face` CSS 경로. 두 번째는 HTTP 캐시에서 오므로 대역폭이 두 배는 아니지만, 굵기별 적용 시점이 어긋나 본문 → 제목 순으로 **두 번** 바뀌었다
- `app/_layout.tsx`의 `if (!loaded) return null`이 FOUT를 막지 못하는 이유도 여기서 드러났다: 웹 구현은 CSS 규칙을 넣는 시점에 `loaded`를 참으로 만들고 실제 내려받기를 기다리지 않는다(A-046)

재방문은 HTTP 캐시로 전환이 사라진다(캐시 상태 실측: 전송 0). 문제는 **첫 방문**이고 배포로 해결되지 않는다.

### 중간에 되돌린 것

처음 지시를 "서체를 Pretendard 하나로"로 읽어 워드마크까지 바꿨다가, 로고는 원래대로 두라는 정정을 받고 전부 되돌렸다(`_layout.tsx`·`tokens.ts`·`Brand.tsx`·`AppText.tsx`·`DESIGN.md`·`CLAUDE.md`·마스터 플랜, `@expo-google-fonts/space-grotesk` 재설치). 확인해 보니 **Space Grotesk는 이미 워드마크 한 곳에만** 쓰이고 있었다.

### 한 일

- `scripts/build-web-fonts.py` 신설. 한글 완성형 전체(U+AC00-D7A3)와 실제로 쓰는 기호 범위만 남겨 woff2로 만든다. 남길 범위는 `src/`·`app/` 전체를 훑어 비ASCII 기호를 뽑아 정했다(`§±·×÷–—“”…₩→−①-⑨★☆「」ㄱㄴㄷㄹㅈㅎ`). 한자는 코드 어디에도 없어 뺐다
- **한글을 전체로 남긴 이유**: KS X 1001 2,350자로 줄이면 빠진 음절만 폴백으로 떨어져 한 단어 안에서 서체가 갈린다. 학생 이름·지문·AI 답변에 어떤 음절이 올지 모른다
- **이름을 `ScodyKR`로 바꿨다.** Pretendard 라이선스에 Reserved Font Name `Pretendard`가 있고 서브셋은 OFL 4항의 Modified Version이라 원래 이름을 쓸 수 없다. `name` 테이블의 nameID 1·3·4·6·16·21을 고친다. 네이티브는 원본 TTF라 `Pretendard` 유지
- `src/theme/fonts.ts`(네이티브 TTF) / `fonts.web.ts`(웹 woff2) 한 쌍을 두고 `FAMILY`·`SOURCES`를 내보낸다. `tokens.ts`의 `typeface`가 `FAMILY`를 참조하고 `FONT_KEYS`는 `Object.keys(SOURCES)`에서 뽑아 어긋날 수 없게 했다. `_layout.tsx`는 `useFonts({ ...SOURCES, SpaceGrotesk_700Bold })`
- `metro.config.js` 신설 — 기본 `assetExts`에 `woff2`가 없다. 네이티브는 ttf만 쓰므로 네이티브 번들은 늘지 않는다

### 결과 (실측)

| | 전 | 후 |
|---|---|---|
| 웹 폰트 원본 | 10.7MB | 2.5MB |
| 첫 방문 전송량 | 4.57MB | 2.55MB |
| 굵기별 도착 간격 | 두 배치, 약 455ms | 4종이 90ms 안에 함께 |
| 눈에 보이는 전환 | **2회** | **1회** |
| 폴백 노출(4Mbps/70ms) | — | 688ms |

굵기별 서브셋: Regular 624KB · Medium 636KB · SemiBold 643KB · Bold 647KB (각 원본의 약 24%)

### 검증

- typecheck 통과 · lint **오류 0**(경고 6 → 5, `require()` 경고가 `_layout.tsx`에서 `fonts.web.ts`로 옮겨짐) · `npm test` **94건 통과**
- `npx playwright test` **419/420** — `parent-flow.spec.ts:413`(tablet) 1건 실패. **폰트와 무관한 토스트 겹침 플레이크**이고 단독 실행은 통과했다(A-047로 등록)
- 프로덕션 번들 확인: Pretendard TTF가 웹 번들에서 빠지고 `ScodyKR-*.woff2` 4개만 들어간다
- 글리프 누락 실측: `뷁`·`짧`·`힣`·`①②③`·`★☆`·`「」`·`→`·`₩`·`±×÷§` 전부 서브셋에 있다(폴백 폭 비교로 확인)
- 화면 390·820·1280 확인. 웹은 `ScodyKR_*`, **워드마크는 그대로 `SpaceGrotesk_700Bold`**, 가로 스크롤 없음

### 남긴 것 (6절)

**A-046** 폴백 노출 688ms가 남는다 — `document.fonts.ready` 대기(전환 제거, 빈 화면 0.7초 증가) 또는 `unicode-range` 동적 서브셋 중 선택. `<link rel=preload>`는 `web.output: "single"`(D-028) 때문에 불가능 · **A-047** `parent-flow.spec.ts:413` 토스트 플레이크

## 7/31 — 학원 대시보드 재구성 (D-061)

`app/academy/index.tsx` 한 파일만 고쳤다. 집계는 `src/features/academyStats.ts`에서 가져오고 새로 계산하지 않는다.

### 고친 것과 이유

- **`미제출 N명`이 사람 수가 아니었다.** 옛 `reduce`(`index.tsx:19`)가 배정마다 미제출 행을 더하고 라벨만 `명`이었다 — 한 학생이 세 개를 안 내면 `3명`. `pendingStat`으로 바꾸고 **라벨을 단위에 맞췄다**: `안 낸 학생 M명`(사람) / `안 낸 과제 N건`(배정 × 학생).
- **평균 정답률을 학부모 리포트와 다른 방법으로 냈다.** 배정별 평균을 다시 단순 평균해서 25문항 세트와 10문항 세트가 같은 무게였다. `weightedAccuracy`(문항 수 가중, D-052와 같은 방법)로 통일했다. 한빛학원 원장 화면 실측 **73%**.
- **손으로 그린 metric 박스를 `StatTiles`로 바꿨다.** 로컬 `styles.metrics`에 `flexWrap`이 없어 390에서 3칸이 각 111px로 눌렸다. `StatTiles`는 `flexBasis:220`이라 알아서 쌓이고 `hint`로 무엇을 세는지 적을 자리가 있다(DESIGN §19 — 운영자·학원 화면 전용). 미제출은 `alert`(값만 `danger`, 뜻은 라벨이 말한다).
- **`바로가기` 4줄을 없앴다.** 목적지가 `_layout.tsx`의 NAV와 같아 정보량이 0이었다.
- **4절이 요구한 것을 채웠다**: 미제출 학생 · 오늘 마감 · 확인이 필요한 학생 · 반별 수행률. `확인이 필요해요`의 각 행은 갈 곳이 있고(`성과 분석`·`학습 배정`), 없으면 `지금 확인할 일이 없어요` 한 줄이다.
- **원장과 선생님의 섹션 집합을 나눴다.** 원장: 반별 수행률(제출률 낮은 5개) · 학원 전체에서 안 낸 학생 · 마감이 지난 미제출, 반 이름은 `학원 반`. 선생님: 오늘·이번 주 마감 · 담당 반에서 안 낸 학생, `담당 반`. `담당 반 N개`가 원장에게 틀린 말이었다(원장은 학원 전체 반 122개를 본다).
- **테스트 데이터 고지 한 줄**을 맨 위에 뒀다. 로스터가 반 120개·학생 3,000명이라 원장 화면에 `학생 3,002명`이 실제 재원생처럼 보인다(5절). 첫 문장은 `/admin` 개요와 같고, 뒷문장만 이 화면의 위험(로스터)에 맞췄다 — 요금 문구는 이 화면에 해당하지 않는다.
- **지표 정의 블록**을 맨 아래에 뒀다(`안 낸 학생`·`안 낸 과제`·`평균 정답률`·`반 제출률`). 같은 숫자를 두 단위로 세는 화면이라 정의가 없으면 또 헷갈린다.
- 한글을 `eyebrow`에 넣던 것(`eyebrow={account.academyName}`)을 없앴다. `eyebrow`는 12px + 자간 + uppercase라 한글에 쓰지 않는다(DESIGN §4). 학원 이름은 `lead` 문장으로 옮겼다.
- `선생님별 배정 활동`은 만들지 않았다 — `Assignment`에 `assignedBy`가 없어 귀속을 지어내게 된다.

### 화면 실측 (한빛학원)

| | 원장 | 선생님(오선생) |
|---|---|---|
| 반 | 학원 반 122개 · 학생 3,002명 | 담당 반 1개 · 학생 9명 |
| 배정한 학습 | 4개 · 제출 26/27건 | 1개 · 제출 8/9건 |
| 안 낸 학생 | 1명 (안 낸 과제 1건) | 1명 (안 낸 과제 1건) |
| 평균 정답률 | 73% | 76% |
| 반별 수행률 | 고1 국어 89% · 고2 국어 100% | (원장 전용) |
| 마감 | 마감이 지난 미제출 1개 | 오늘 0개 · 이번 주 0개 |

### 검증

- typecheck 통과 · lint **오류 0**(경고 5, 기존 그대로) · `npm test` **100건 통과**
- E2E는 다른 작업과 포트가 겹쳐 돌리지 않았다. 대신 개발 서버를 8090에 따로 띄워 화면을 확인했다(1280·820·390 + 다크, 원장·선생님). 근거: `docs/evidence/academy-dashboard-*.png`
- **깨질 단정 2건**(테스트 파일은 고치지 않았다): `e2e/academy-flow.spec.ts:47`·`e2e/auth-flow.spec.ts:160`의 `제출 현황` — `바로가기` 행에 있던 문구다. 대시보드에는 `배정한 학습 · 제출 26/27건`·`반별 수행률`이 대신 있다

## 7/31 — 학습 배정 단계형 재구성 (D-062)

`app/academy/assign.tsx` 한 파일만 고쳤다(172줄 → 662줄). `src/features/`·`src/components/`는 건드리지 않았고, 검사·날짜·쓰기는 이미 있는 함수를 그대로 썼다.

### 고친 것과 이유

- **반 122개와 콘텐츠 전체를 라디오로 한 화면에 나열했다.** 원장은 학원 전체 반을 보므로(`getClassesForAccount`) 행 44px × 122 ≈ 5,400px였고 검색·필터·페이지가 없었다. `반 → 학습 → 확인` 세 단계로 나누고 단계를 URL 쿼리(`?class=&grade=&area=&topic=&content=&due=`)에 남겼다 — `app/student/pick.tsx`와 같은 구조라 표준 뒤로가기가 한 단계씩 물러난다(D-039). 첫 단계는 탭의 시작점이라 뒤로가기를 두지 않는다(실측: `screen-back` 0개).
- **기본값이 미리 골라져 있었다**(`useState(classes[0]?.id)`·`useState(sets[0]?.id)`). 화면을 구경하다 `배정하기`를 누르면 반 전원 홈에 과제가 즉시 떴고 되돌릴 수 없었다(D-046). 이제 두 단계를 지나야 `배정하기`가 있는 화면에 도달한다(D-036과 같은 판단 — 못 누르는 버튼을 띄워 두지 않는다).
- **무엇을 몇 명에게 언제까지 내는지 말하지 않았다.** 확인 단계에 `학습 제목 → 반(학생 N명) → 마감` 요약 세 줄과 `배정하면 학생 9명의 홈과 학습 탭에 바로 나타나요.` 한 줄을 뒀다. 완료 화면도 같은 요약을 남긴다.
- **되돌릴 방법이 없었다.** 완료 화면에 `방금 배정한 것 되돌리기`를 **화면에** 뒀다(`removeAssignment`, ghost + `refresh-cw`). 토스트에 두면 사라지는 순간 기회도 사라진다(D-033·D-038). 되돌리면 확인 단계로 돌아가고 정한 마감일이 남아 있어 바로 다시 낼 수 있다.
- **콘텐츠에 학년·세부 유형·출처가 없었다**(`국어 · 영역 · 지문형 · N문항`). `ContentSet`이 이미 가진 `grade`·`topic`으로 `학년 → 영역 → 세부 유형` 드릴다운을 만들고(분류는 `src/data/taxonomy.ts`), 0개인 칸은 D-042 규칙으로 막았다. 출처는 행마다 `우리 학원`/`스코디 제공`(`meta`)으로 말하고, 출처 필터는 **우리 학원 콘텐츠가 있을 때만** 둔다(지금 시드는 전부 운영자 콘텐츠라 필터가 없다 — 문제 등록으로 하나 만들면 나타난다). 배정 가능 범위는 그대로다(`!s.ownerAcademyName || s.ownerAcademyName === account.academyName`, D-012).
- **콘텐츠가 수천 개가 되어도 찾을 수 있게** 제목 검색을 뒀다. 검색은 분류를 무시하고 전체에서 찾고 그 사실을 한 줄로 밝힌다(`제목으로 찾으면 학년·영역과 상관없이 모두 보여줘요.`). 결과 10개마다 `Pager`. 학년·세부 유형이 비어 드릴다운에 나타날 자리가 없는 콘텐츠는 감추지 않고 개수를 알린다(지금 0개).
- **마감일이 문자열 타이핑뿐이었다.** 빠른 선택 `Chips`(`오늘`·`내일`·`다음 주 금요일(8월 7일)`·`마감 없음`)를 위에 두고 직접 입력을 아래 뒀다. 날짜 계산은 `dayAfter`, 검사는 `parseDueDate`(형식·없는 날짜·과거 날짜), 표시는 `dueLabel`·`formatDate`다 — 화면에 정규식도 ISO 날짜도 없다. 옛 코드는 형식만 보고 어제 날짜를 통과시켰다.
- **전폭 버튼 정리**(D-047): 완료 화면 세 버튼은 전부 `hug`(`제출 현황 보기` primary · `계속 배정하기` secondary · `되돌리기` ghost + 아이콘). 전폭은 확인 단계의 `배정하기` 하나뿐이다.
- `eyebrow="완료"`를 없앴다 — 한글 `eyebrow` 금지(DESIGN §4)이고 제목 문장이 이미 완료를 말한다.
- `계속 배정하기`가 선택을 비운다(쿼리를 지우고 검색어·페이지·마감일까지 초기화). 예전에는 같은 배정을 한 번 더 만들 수 있었다.
- 라디오 묶음의 `radiogroup`·그룹 이름 문제는 라디오 자체를 없애 사라졌다. 지금은 `Row`(role=button, 이름=행 제목) + `Chips`(role=button, `selected` 상태)뿐이고 둘 다 누름 영역 44px 이상이다.
- 확인·완료 요약에서 **학습 제목은 `trailing`이 아니라 행 제목**이다. `trailing`에 넣어 보니 390에서 옆 설명이 200px로 눌려 `10문항`이 `10문`/`항`으로 끊겼다(`docs/evidence/assign-due-error-mobile.png`의 첫 캡처에서 확인). 짧은 값(`반`·`마감`)만 `trailing`의 `label`로 뒀다 — DESIGN §19의 같은 실측 근거다.

### 화면 실측 (한빛학원 원장)

| 단계 | 화면 |
|---|---|
| 1 반 | `어느 반에 낼까요?` · 칩 `전체 122 / 고1 41 / 고2 41 / 고3 40` · 이름 검색 · 10개 + `Pager` |
| 2 학습 | `어떤 학습을 낼까요?` · 경로 `반 고1 국어 · 고1 · 문법 · 어문 규정 - 맞춤법` · 제목 검색 · 결과 2개(`스코디 제공`) |
| 3 확인 | `이렇게 배정할까요?` · `헷갈리는 맞춤법·어법 / 고1 · 문법 · 어문 규정 - 맞춤법 · 10문항 · 스코디 제공` · `반 고1 국어(학생 9명)` · `마감 8월 7일까지` |
| 완료 | `학습을 배정했어요` + 같은 요약 + 되돌리기 |

- 브라우저 뒤로가기: `확인 → 학습 목록 → 유형 → 영역 → 학년 → 반` 한 단계씩 물러난다(실측)
- 마감일 오류: `2026-13-45` → `없는 날짜예요. 달과 일을 다시 확인해 주세요.`(배정되지 않음)
- 중복 배정: 같은 반·같은 학습을 다시 내면 `이 반에 같은 학습이 이미 배정돼 있어요. 마감일만 바꿔 주세요.`(`addAssignment`의 검사 그대로)
- 되돌리기: 토스트 `배정을 되돌렸어요` + 확인 단계 복귀, 마감 `8월 7일까지` 유지

### 검증

- typecheck 통과 · lint **오류 0**(경고 5, 기존 그대로) · `npm test` **100건 통과**(6스위트)
- E2E는 다른 작업과 포트가 겹쳐 돌리지 않았다. 개발 서버를 8099에 따로 띄워 1280·820·390 + 다크에서 확인했다. 근거: `docs/evidence/assign-*.png` 19장
- **깨질 단정 6건**(테스트 파일은 고치지 않았다)
  - `e2e/academy-flow.spec.ts:62`·`:88`·`:112` `assign-content-ct_gram_1`: 반을 고른 직후에는 학년 목록이라 이 행이 없다. 새 흐름은 `assign-grade-1` → `assign-area-문법` → `assign-topic-어문 규정 - 맞춤법` → `assign-content-ct_gram_1`(또는 `assign-content-search`에 `맞춤법`을 넣고 바로 선택)
  - `e2e/academy-flow.spec.ts:174` `assign-due`: 마감일 입력이 확인 단계로 옮겨졌다. 반·학습을 먼저 골라야 나타난다(오류 문구 `마감일은 2026-08-11 형식으로 적어 주세요.`는 `parseDueDate` 그대로라 같다)
  - `e2e/boundary-flow.spec.ts:70` `정보의 홍수와 비판적 읽기`: 배정 화면 첫 단계는 반 목록이라 콘텐츠 제목이 없다. `assign-class-c_kor1` → `assign-content-search`에 `정보의 홍수` 또는 `assign-grade-1` → `assign-area-독서` → `assign-topic-인문(일반)`. **`:72`의 다른 학원 콘텐츠 0건은 여전히 통과하지만 이유가 약해진다**(첫 화면에 콘텐츠가 아예 없어서 통과) — 검색으로 확인하도록 옮기는 것이 정확하다. 배정 가능 범위 코드는 그대로다(D-012)
  - `e2e/parent-flow.spec.ts:223` `assign-content-ct_lit_1`: 새 흐름은 `assign-grade-1` → `assign-area-문학` → `assign-topic-현대소설` → `assign-content-ct_lit_1`
  - 그대로 쓸 수 있는 것: `assign-class-c_kor1`(시드 반이 목록 첫 페이지에 있다) · `assign-submit` · `학습을 배정했어요` · `assign-goto-analytics`
- **찾은 것(범위 밖)**: 브라우저 앞으로가기가 단계형 화면을 복원하지 못하고 `/login`으로 떨어진다 — `/student/pick`에서도 같게 재현된다(6절 Q-032). 단계를 옮기면 화면 상태가 다시 만들어진다(6절 Q-033)

## 7/31 — 반·학생 관리 신설 (D-063, S-005·Q-031 닫음)

`src/features/academy.tsx`(90줄 → 380줄) · `src/features/progress.tsx`(`addAssignment` 입력 1개) · `app/academy/classes.tsx` · `app/academy/class/[id].tsx` · 새 파일 `app/academy/students.tsx`. `src/components/`·`src/data/`·`e2e/`·`__tests__/`는 건드리지 않았다(새 컴포넌트 0개).

### 왜 만들었나

**반을 만들거나 학생을 반에 넣는 경로가 코드에 아예 없었다.** `ACADEMY_CLASSES`는 `readonly` 정적 배열이고 전 레포에서 `studentIds`를 바꾸는 곳이 0곳이었다. 그래서 새로 가입한 학원(`e2e/boundary-flow.spec.ts`의 새길학원 같은 계정)은 반이 0개 → 배정할 반이 없음 → 제품을 한 번도 쓸 수 없었다. `AcademyClass.teacherId`를 정하는 화면도 없어서 원장이 선생님을 한 번 제외하면 그 반은 **영구 미배정**이었다.

### 오버레이 구조와 권한 검사 지점

- `src/data`의 순수 함수(`getClassesForAccount`·`getClass`·`getStudentsInClass`)는 **그대로 뒀다** — 학생(`useStudentItems`)·학부모(`report.ts`)·운영자 5개 화면이 함께 쓴다. 대신 `AcademyStaffProvider`가 fixture를 기준선으로 두고 오버레이를 얹는다: `created`(만든 반) · `archivedIds`(폐강) · `patches`(이름·담당·학생 추가/제외). 선생님 추가·제외가 이미 쓰던 `added`/`removedIds`와 같은 방식이다.
- 읽기: `classesFor(account)`(원장 학원 전체 · 선생님 `teacherId` 일치 · **다른 학원 계정은 빈 목록**) · `classById`(세션 계정이 볼 수 있는 반만, 권한 밖은 `undefined`) · `studentsIn`.
- 쓰기 6개는 전부 `{ok, error}`이고 첫 줄에서 `denyManage()`를 탄다 — `academy` 역할 + `academyRole === 'director'` + 그 반이 우리 학원 목록에 있는지. **화면이 버튼을 감추는 것에 의존하지 않는다**(CLAUDE.md). `setClassTeacher`는 우리 학원 선생님만(제외된 선생님은 `teachers`에 없어 자동으로 걸린다), `addStudentsToClass`는 `student` 역할 + 같은 학원 + 이미 없는 학생만 통과시킨다.
- **폐강은 삭제가 아니다**(D-013). `archivedIds`에 들어가 목록·상세에서만 내려가고 `assignments`는 손대지 않는다.
- `addAssignment`에 `studentIds?`를 더했다(선택적 필드라 기존 호출부는 그대로 컴파일된다). 없으면 예전처럼 `getClass`로 보완한다 — 지금은 `assign.tsx`가 넘기지 않으므로 실제 효과는 그 화면이 연결될 때 난다(6절 S-013).

### 화면

- **`classes.tsx`**: 원장에게 `반 만들기`(이름 + 담당 선생님 고르기, 미배정 허용 · 선생님 60명이라 검색 + 6명씩) → 만들면 토스트 + 그 반 상세로. `학생 찾기` 링크(ghost + `users`)는 선생님도 쓴다. 빈 상태 문구를 `반 만들기는 아직 준비 중이에요` → `반을 만들고 학생을 넣으면 학습을 배정할 수 있어요`로 바꿨다(이제 준비 중이 아니다). 기존 `Pager`·검색·고지 구조는 그대로 뒀다.
- **`class/[id].tsx`**: `담당 선생님` 행을 눌러 배정(`미배정으로 두기` 포함) · **`배정 학습` 섹션 신설**(마감 임박순 · 5개씩 `Pager` · 행마다 `제출 N/M · 평균 X%` · `이 반에 배정하기`) · 학생 목록을 **안 낸 과제 많은 순**으로 정렬(12명 초과면 이름 검색 + `Pager`), 부제를 `st.academyName`(25줄 전부 같은 글자였다) → 제출 요약으로 바꾸고 값은 `trailing`의 `안 낸 과제 N건` · **학생 행을 펼치면 우리 반 배정별 결과 + 배정 학습 오답노트 수**(Q-031, `academyNotesOf`만 쓴다) + `개인 학습 기록은 학원에 공개되지 않아요.` · `학생 추가`(검색 먼저, 우리 학원 학생 중 이 반에 없는 사람, 여러 명) · 맨 아래 `반 이름 바꾸기`와 `폐강하기`(확인 단계 + `tone="danger"` + `minus-circle`).
- **`students.tsx`**(신규, S-005): 원장은 우리 학원 학생 3,002명(반이 없는 학생도 — 반에 넣는 것이 원장의 일이다), 선생님은 담당 반 학생만. 이름·아이디 검색 + 반 필터(반 6개 이하면 `Chips`, 많으면 이름 검색 — `analytics.tsx`와 같은 규칙) + 20명씩 `Pager`. 행에 소속 반과 안 낸 과제 수, 누르면 그 반 상세로. 내비에는 넣지 않았다.
- 한글 `eyebrow`(`eyebrow={cls.academyName}`)를 없앴다 — DESIGN §4. 학원 이름은 좌측 계정 영역이 이미 말한다.

### 실측으로 바꾼 것

- **`빼기`를 학생 행 `trailing`에 두지 못했다.** `안 낸 과제 없음`(약 95px) + 버튼(약 76px)이 `maxWidth:170`을 넘겨 1280에서도 값과 버튼이 두 줄로 갈리고 행 높이가 학생마다 달라졌으며, 390에서는 이름 칸이 100px로 눌렸다(`docs/evidence/academy-class-mobile-dark.png`의 첫 캡처에서 확인). 값만 `trailing`에 두고 `이 반에서 빼기`는 펼친 자리로 옮겼다 — 되돌리기·정책 문구와 같은 덩어리에 있어 무엇을 하는 자리인지도 분명해졌다.
- **새로 만든 반에는 `이 반에 배정하기`를 두지 않는다.** 배정 화면이 아직 fixture 목록에서 반을 고르므로 버튼이 첫 단계로 떨어지는 죽은 버튼이 된다. 대신 `여기서 만든 반은 아직 배정 화면에서 고를 수 없어요.` 한 줄로 밝혔다(6절 S-013).

### 화면 실측

| 계정 | 화면 |
|---|---|
| 한빛 원장 | 반 122개 · 학생 3,002명 · `반 만들기`/`학생 찾기` · 고1 국어 상세(담당 오선생 · 배정 1개 `제출 8/9 · 평균 76%` · 학생 9명, 박도윤 `제출 0/1` `안 낸 과제 1건`이 맨 위) |
| 정예린 행 펼침 | `현대소설 점검 · 7월 23일 제출 — 냈어요 · 정답률 80%` · `배정 학습 오답노트 5개` · 개인 학습 비공개 한 줄 |
| 오선생(선생님) | 담당 반 1개만 · 담당 선생님 행 누름 없음 · 학생 추가·반 관리 섹션 없음 · 학생 찾기 `담당 반 학생 9명` + 반 칩 1개 |
| 새길학원 원장(신규 가입) | `아직 등록된 반이 없어요` + `반 만들기` → `고2 국어 1반` 생성(담당 미배정 · 학생 0명) → 학생 검색 `박` → `찾는 학생이 없어요`(다른 학원 학생이 새지 않는다) |

### 검증

- typecheck 통과 · lint **오류 0**(경고 5, 기존 그대로) · `npm test` **100건 통과**(6스위트)
- E2E는 다른 작업과 포트가 겹쳐 돌리지 않았다. 이미 떠 있는 개발 서버(8081)에 Playwright 스크립트로 붙어 1280·820·390 + 다크에서 확인했다. 근거: `docs/evidence/academy-class*.png`·`academy-students-*.png` 18장
- **기존 E2E 단정을 스크립트로 재확인했다**(테스트 파일은 고치지 않았다). `academy-flow.spec.ts`가 이 세 화면에서 보는 것 전부 그대로다: `고1 국어` exact 1건 · `담당 선생님`/`오선생`/`정예린` 각 1건 · `제출 1/1 · 평균 80%` 1건 · `제출 0/1` 1건 · `screen-back`이 같은 URL로 · `class-pager` `122개 중 1–20` · `class-search` 결과 · 선생님 제외 후 `오선생` 0건/`미배정` 1건 · 선생님 계정 `고2 국어` 0건 · `manage-goto-classes`. **깨지는 단정 0건**
- 새 testID: `class-new-open`·`class-new-name`·`class-new-teacher-search`·`class-new-teacher-none`·`class-new-teacher-{scodyId}`·`class-new-submit`·`class-new-cancel`·`class-goto-students`·`class-teacher`·`class-teacher-search`·`class-teacher-none`·`class-teacher-{scodyId}`·`class-goto-assign`·`class-task-{id}`·`class-task-pager`·`class-student-{userId}`·`class-student-out-{userId}`·`class-student-undo`·`class-student-search`·`class-student-pager`·`class-add-search`·`class-add-{userId}`·`class-add-submit`·`class-rename-open`·`class-rename-input`·`class-rename-submit`·`class-archive-open`·`class-archive-confirm`·`academy-students`·`student-search`·`student-class`·`student-class-search`·`student-row-{userId}`·`student-pager`
- **남은 한계(보고용)**: ① 오버레이라 새 반·반 편성 변경이 학생·학부모·대시보드·성과 분석·**배정** 화면에 아직 없다(6절 S-013) ② 폐강도 학원 세 화면에서만 반영된다(S-014) ③ 새 반의 학생은 `academyNotesOf`의 `getClassesForAccount` 검사에 걸려 오답노트가 0개로 보인다 ④ 학생 뺀 뒤 `되돌리기` 안내는 `학생` 섹션 맨 위에 있어(오답노트·담아 둔 학습과 같은 자리) 25명 목록 아래쪽에서 뺐으면 스크롤 위에 남는다 — 토스트가 함께 알린다 ⑤ 모든 상태는 메모리라 새로고침하면 사라진다(5절)

---

## 학원 `문제 등록` 탭 → `문제` 화면 + 등록 폼 정리 (D-064)

### 왜 바꿨나

- **학원이 등록한 콘텐츠를 다시 볼 화면이 없었다.** 오타·정답 오류를 확인할 수도, 몇 개를 가졌는지도 알 수 없었다. 운영자는 `/admin/content`·`/admin/content/[id]`를 이미 갖는다.
- 내비의 `문제 등록`은 **대상이 아니라 행동**이라 메뉴에 둘 것이 아니다 — 운영자 메뉴가 이미 같은 판단을 했다(D-017). 라벨이 `문제`로 짧아져 390 하단 탭 6칸(칸당 약 62px)도 함께 나아졌다.
- `app/academy/new.tsx`의 `onDone`이 `/academy/assign`으로만 보냈다. 배정이 단계형이 된 뒤(D-062) 첫 화면이 뜨기만 하고 **방금 만든 학습과 이어지지 않았다.**
- 등록 폼은 검사를 첫 실패에서 멈추고 문자열 하나를 **화면 맨 아래** 캡션에 넣었다. 문항 하나가 약 400px이라 25문항 세트(약 10,000px)에서 `3번 문제의 보기를…`을 읽고 수천 픽셀을 거슬러 올라가야 했다.

### 만든 것

- **내비 5→5(라벨 교체)**: `대시보드 · 반·학생 · 학습 배정 · 문제 · 성과 분석 · 학원 관리`. `문제 등록`을 `문제`(`/academy/content`, `file-text`)로 **대체**했다 — 탭 수는 6 그대로이고 `학원 관리`(로그아웃 유일 경로)는 그대로 뒀다. 자리는 `학습 배정` 바로 뒤(만들고 내는 일이 붙어 있게).
- **`app/academy/content/index.tsx`**(신규): 우리 학원이 등록한 콘텐츠만(`ownerAcademyName === account.academyName`). 행은 제목 + `고2 · 문법 · 어문 규정 - 맞춤법 · 문법형 · 1문항` + `trailing`의 `배정 N회`(우리 학원 반 배정만 센다). 최근 등록이 위. 좁히는 도구(영역 `Chips` + 제목 `Field` + `Pager` 10개)는 **한 페이지를 넘을 때만** 둔다(0개 필터는 누를 곳이 아니다 — §18-1과 같은 규칙). 빈 상태는 `Group` 한 줄 + `문제 등록하기`(`hug`, D-047). **운영자 공개 콘텐츠는 넣지 않고** 그 사실을 캡션으로 밝혔다(`학습 배정에서 함께 고를 수 있어요`).
- **`app/academy/content/[id].tsx`**(신규): 지문(`Passage` 재사용) + 문항·보기·정답·해설 + 배정 현황(반 이름 · 마감 · 낸 학생 N/M). `Section`의 `action`에 `이 학습 배정하기` → `/academy/assign?content={id}`. `backFallback="/academy/content"`. **우리 학원 콘텐츠가 아니면 열리지 않는다**(운영자 콘텐츠·다른 학원 콘텐츠 모두 `문제를 찾을 수 없어요`). 첫 줄이 왜 고칠 수 없는지 말한다 — 배정한 적이 있으면 `이미 배정한 학습이라 고칠 수 없어요. 학생이 푼 기록과 어긋나요.`, 없으면 `지금은 등록한 문제를 고치거나 지우는 기능이 없어요.`(6절 Q-034). 문항 표시는 이 화면에만 쓰는 로컬 블록이다 — `QuestionReview`는 풀이 기록(정답/오답)이 있어야 뜻이 서는 컴포넌트라 쓸 수 없었다.
- **등록 → 배정 이어 붙이기**: `ContentComposer`의 `onDone(created: ContentSet)`으로 시그니처를 넓히고(`doneLabel`도 함께 — 목적지는 호출부가 안다) 학원은 `router.replace('/academy/assign?content=' + created.id)`, 운영자(`app/admin/new.tsx`)는 그대로 `/admin`. 실측: `이어서 배정하기` → 반 고르기 → 반을 누르면 확인 단계에 `한빛 맞춤법 점검 · 고2 · 문법 · 어문 규정 - 맞춤법 · 1문항 · 우리 학원`이 그대로 실려 있다.
- **`src/features/content.tsx`**: `addContent`가 `setSets` 콜백 **밖에서** 세트를 만들고 반환한다. 예전에는 콜백 안에서 만들고 "동기적으로 실행된다"는 가정으로 `created!`를 반환했다 — 큐에 다른 갱신이 있으면 그 가정이 깨져 등록 직후 `undefined`가 된다. 지금은 반환값을 실제로 쓰므로(위 이어 붙이기) 가정을 없앴다. id 규칙(`ct_new_{index}`)은 그대로다.

### `ContentComposer` 변경 목록

| 무엇 | 전 | 후 |
|---|---|---|
| 검증 | 첫 실패에서 멈춤 · 화면 맨 아래 캡션 한 줄 | 남은 입력을 **필드 아래 인라인 전부** + 문항 제목 `N번 문제 · 입력이 남았어요` + 화면 위 `아직 입력이 남았어요. 1번 · 3번 문제를 확인해 주세요.` |
| 검증 시점 | 누를 때마다 문자열 하나 | `checked` 뒤에는 채우는 대로 오류가 사라진다(`useMemo` 재계산) |
| 진행 표시 | 없음 | `N문항 · 입력 완료 M`(문법 은행은 20~25문항) |
| 유형·학년·영역·세부 유형 | 로컬 `styles.chip`(약 35.5px · 강조색으로 채움) | 공용 `Chips`(44px · `accentSoft` + `accent` 글자) |
| 정답 고르기 | 24px 라디오, `hitSlop`·패딩 없음 | `Chips`(`보기 1`…`보기 4`) — 실측 59×44px. 고른 보기의 입력 라벨에 `· 정답`이 함께 붙는다 |
| 문항 지우기 | `이 문제 삭제` 전폭 ghost · 되돌릴 수 없음 | `이 문제 지우기` `size="sm"`+`hug`+`trash-2` · 확인 없이 지우고 **지운 자리에** `문제를 지웠어요 · 되돌리기`(원래 순서 복원, D-033) |
| 버튼 폭 | `문제 추가하기`·`이 문제 삭제`가 primary와 같은 폭 | 전폭은 `등록할게요` 하나(D-047). `문제 추가하기`는 `hug`+`plus` |
| 완료 화면 | `eyebrow="완료"`(한글 eyebrow) · 전폭 `확인` | eyebrow 없음 · 만든 세트 요약 한 줄 · `hug` + 호출부가 정한 라벨(`이어서 배정하기`) |
| 임시저장 | 없고 그 사실도 말하지 않음 | 만들지 않고 첫 줄에 밝힌다(`등록하기 전에 이 화면을 벗어나면 쓴 내용은 남지 않아요.`) — 6절 Q-035 |

**정답을 `Chips`로 둔 이유**: 지시받은 "보기 행 전체를 하나의 `Pressable`로"는 두 가지에 걸렸다. ① 입력창을 감싼 `Pressable`은 웹에서 글자를 쓰려고 누른 클릭이 그대로 버블링돼 정답이 바뀐다. ② 라디오+라벨을 입력 위 별도 행으로 올리면 보기마다 약 48px이 늘어 25문항 세트에서 약 +4,800px가 된다. `Chips`는 44px과 `보기 N` 라벨을 이미 지키고 **testID(`new-q0-answer-1`)도 그대로 유지**된다.

### 정책과 어긋나 다르게 한 것

- 문항 지우기의 **되돌리기를 토스트에 넣지 않았다**. 지시는 `Toast`+`되돌리기`였지만 D-038·D-033·DESIGN §8이 "되돌리기가 필요한 삭제는 화면에 남는 안내"라고 정하고 있다. `app/student/queue.tsx`와 같은 모양의 인라인 안내를 **지운 자리에** 뒀다(화면 맨 위에 두면 25문항 폼에서 무엇을 지웠는지와 멀어진다).
- 목록의 `문제 등록하기`는 primary이지만 **전폭이 아니다** — 다른 화면으로 보내기만 하는 버튼이라 D-047에 걸린다.

### 운영자 화면에 준 영향

- `app/admin/new.tsx`는 그대로 컴파일된다(`onDone`이 인자를 안 받아도 되고 `doneLabel`은 기본값 `확인`). 운영자 등록 폼도 같은 개선을 함께 받는다(인라인 오류 · `Chips` · 44px 정답 · 되돌리기 · 버튼 폭 · eyebrow 제거).
- `app/admin/content/*`·`/admin` 대시보드의 `새 문제 등록하기` 경로와 testID(`admin-new`)는 손대지 않았다.

### 깨질 E2E 단정 (테스트 파일은 고치지 않았다 — 6절 T-001)

| 파일:줄 | 기존 | 새 흐름 |
|---|---|---|
| `e2e/boundary-flow.spec.ts:16`·`:58` | `getByRole('link', { name: '문제 등록' }).click()` | 내비 라벨이 `문제`다. `문제` 링크 → `academy-content-new` 두 번 누르기로 바꿔야 한다(부분 문자열도 맞지 않아 실패한다) |
| `e2e/boundary-flow.spec.ts:26-28` | `composer-done` → `assign-class-c_kor1` → `assign-content-search`에 제목 입력 | 완료가 `?content=`를 실어 보내므로 반을 고르면 **확인 단계**로 간다(2단계의 `assign-content-search`가 없다). 확인 단계에는 제목이 이미 있어 `:28`의 단정 자체는 성립한다 — `:27`의 `fill`만 실패한다. 대안: `assign-again`(계속 배정하기)으로 쿼리를 비운 뒤 검색하거나 `/academy/content` 목록에서 확인 |
| `e2e/boundary-flow.spec.ts:64` | `composer-done` 뒤 바로 `학원 관리` 링크 | 목적지가 `/academy/assign?content=`로 바뀌었을 뿐이라 그대로 통과한다(참고) |
| `e2e/admin-flow.spec.ts:12-25` | `new-kind-grammar`·`new-grade-2`·`new-topic-어문 규정 - 맞춤법`·`new-q0-answer-1`·`new-save`·`composer-done` | **전부 유지된다.** `Chips`의 testID 규칙(`${testID}-${value}`)이 기존 이름과 같아 그대로 잡힌다. 실측으로 확인했다 |
| `e2e/academy-flow.spec.ts` | 학원 내비를 이름으로 누르는 곳은 `학습 배정`·`성과 분석`·`학원 관리`·`반·학생`뿐 | 영향 없음 |

새 testID: `academy-content`·`academy-content-new`·`academy-content-area`·`academy-content-search`·`academy-content-pager`·`academy-content-row-{id}`·`academy-content-detail`·`academy-content-assign`·`academy-content-q-{qId}`·`academy-content-assigned-{id}`·`new-progress`·`new-problems`·`new-remove-undo`·`new-q{i}-remove`. 없어진 것: 없음(`new-kind-*`·`new-grade-*`·`new-area-*`·`new-topic-*`·`new-q{i}-answer-{ci}`·`new-title`·`new-save`·`composer-done` 전부 유지).

### 검증

- typecheck 통과 · lint **오류 0**(경고 5, 기존 그대로) · `npm test` **100건 통과**(6스위트)
- E2E는 다른 작업과 포트가 겹쳐 돌리지 않았다. 이미 떠 있는 개발 서버(8081)에 Playwright 스크립트로 붙어 **1280 · 820 · 390 + 다크**에서 한빛 원장으로 흐름 전체(문제 탭 → 등록 → 인라인 오류 → 지우기·되돌리기 → 완료 → 배정 확인 단계 → 목록 → 상세 → 뒤로가기)를 돌렸다. 콘솔·페이지 오류 0.
- **출처 경계 실측**: 새길학원 원장으로 가입해 `새길 전용 자료`를 등록하면 새길 목록에 1건, 한빛 원장으로 갈아타면 **0건**(한빛 목록은 빈 상태 문구). `docs/evidence/academy-content-other-academy.png`·`academy-content-boundary.png`
- **터치 타깃 실측**: 정답 칩 59×44px · `되돌리기` 60×44px(둘 다 §10의 44px 충족)
- **뒤로가기**: 상세 → `screen-back` → `/academy/content`(4뷰포트 모두). 등록 폼의 뒤로가기는 `/academy/content`로 바뀌었다(들어온 곳).
- 근거 이미지: `docs/evidence/academy-content-{empty,list,detail}-{desktop,tablet,mobile,dark}.png` · `academy-new-{top,filled,problem-summary,errors,undo,done,to-assign}-*.png` · `academy-new-assign-confirm.png`
- **직접 URL 진입은 확인할 수 없었다**(A-032·Q-032와 같은 뿌리). 세션이 메모리에만 있어 `page.goto`는 `/login`으로 가드되고, `history.pushState` + `popstate`로도 세션이 유지되지 않는다(유효한 `/academy/analytics`로도 같게 재현). 상세의 남의 콘텐츠 차단은 목록 경계 실측과 같은 술어(`ownerAcademyName === account.academyName`)를 쓴다.

### 남은 한계

① 콘텐츠 수정·삭제 API가 없다(Q-034) ② 등록 폼 임시저장이 없다(Q-035) ③ 배정 1단계가 실려 온 학습을 말하지 않는다(Q-036) ④ `배정 N회`는 배정 건수이고 제출 수가 아니다(제출은 상세의 `낸 학생 N/M`이 말한다) ⑤ 모든 상태는 메모리라 새로고침하면 사라진다(5절).

## 7/31 — 학원 영역 전면 개편: 통합과 검증

네 화면을 각각 고친 기록은 위 절들에 있다. 이 절은 **에이전트 작업을 합친 뒤 메인이 직접 한 일**과 최종 검증만 적는다.

### 검토 방식

`product-manager`와 `ux-auditor`를 병렬로 돌려 **106건**(Critical 15 · High 52 · Medium 32 · Low 7)을 받았고, 영향이 큰 주장은 코드로 직접 확인한 뒤에만 채택했다. 사용자가 10초 훑고 지목한 다섯 가지(대시보드 빈약 · 반·학생 관리 없음 · 배정 한 페이지 · 성과 분석 부실 · 버튼으로 안 보임)는 **전부 사실이었다.**

### 살아 있는 크래시를 찾았다 (D-060)

`src/features/report.ts:138`이 `row.correct ?? correctOf(row)` — **무한 재귀**였다. 지난 작업(D-052)에서 내가 넣었다.

- 도달 경로: `markAssignmentSubmitted`가 `wrongQIds`를 저장하지 않아 앱에서 낸 학원 과제 행의 `correct`가 `undefined`가 된다 → `statOf`·`weekStatOf`·영역별 집계가 `correctOf`를 부른다 → 스택 오버플로.
- **E2E 420건이 전부 통과하는 동안 숨어 있었다** — 시드 제출에는 `wrongQIds`가 있어 그 경로만 돌았고, "학생이 앱에서 학원 과제를 제출한 뒤 학부모가 리포트를 연다"를 잇는 테스트가 없었다.
- 고친 뒤 그 경로를 E2E로 고정했고(`parent-flow.spec.ts`, `pageerror`를 함께 단정), 단위 테스트 3건으로 `correctOf`를 묶었다.
- 브라우저 실측: 정예린으로 학원 과제 제출 → 이민지로 리포트 진입 → `pageerror` 0건, `제출일 기록 없음` 사라짐.

### 메인이 직접 한 일 (0단계 + 통합)

- **`correctOf` 수정** + `__tests__/report.test.ts`에 회귀 3건.
- **`markAssignmentSubmitted(assignmentId, attempt)`** — `Attempt`를 통째로 받아 `submittedAt`·`wrongQIds`까지 저장한다. 호출부는 풀이 제출 한 곳.
- **`originalDueDate` 신설**(D-056) + `reportDueOf()` — 리포트의 달 판정을 원래 마감일로. 재배정이 이미 낸 학생의 확정된 지난달 리포트를 옮기던 문제를 닫았다.
- **권한 경계**: `canWriteClass`를 두고 `addAssignment`·`reassign`·`removeAssignment`가 검사한다. `academyNotesOf`에 **담당 반 검사 + 출처 학원 되짚기**를 더했다(되짚지 못하는 노트는 주지 않는다).
- **쓰기 API를 `{ok, error}`로 통일**(`WriteResult`).
- **`src/features/academyStats.ts` 신설** — 문항 수 가중 정답률과 `pendingStat`(사람 수 `students` / 건수 `count`를 갈라서 준다). 대시보드와 성과 분석이 같은 값을 말한다.
- **`parseDueDate`·`dayAfter`**(`learning.ts`) — 배정과 재배정이 같은 규칙을 쓴다. 실제 달·일까지 검사한다.
- **`Icon`에 `copy`·`link`, `Button`에 `tone="danger"`** 추가.
- **학원 배정 오답노트 시드 5건**(`attempts.ts`) — 문항 번호를 제출 기록의 `wrongQIds`와 일치시켰다. 그 결과 학부모 리포트의 7월 오답이 3 → 8개가 됐다(개인 3 + 학원 5, 의도된 변화).
- **provider 순서 변경**: `AcademyStaffProvider`를 `ProgressProvider` **밖으로**. 배정 권한과 오답 열람이 fixture가 아니라 살아 있는 반 목록을 봐야 한다.
- **새 반까지 이어 붙였다**(6절 S-013 대부분 해소): 학원 다섯 화면이 `classesFor(account)`를 쓰고, `addAssignment`에 `studentIds`를 넘기며, 학생 쪽 배정 판정을 **제출 행 합집합**으로 넓혔다(`learning.ts`) — 새로 만든 반의 학생도 과제를 받는다.
- **대시보드 순서 조정**: 지표 타일 5개를 `확인이 필요해요`·primary **뒤로** 내렸다. 390에서 타일이 첫 화면을 다 먹어 정작 볼 것이 y≈780으로 밀렸다(실측 → `확인이 필요해요` y=209 · CTA y=470). 4절의 "장식보다 다음 행동을 우선한다"에 맞춘 것이다.
- **`배정한 학습이 없는 반 120개` 알림 삭제** — 사실이지만 로스터가 만든 잡음이고 원장이 할 수 있는 일이 아니다. 배정 없는 반은 `반별 수행률`이 이미 말한다.

### 의도적으로 고친 테스트 — 근본 원인을 밝힘

새 흐름에 맞춘 것: 대시보드 `제출 현황` 바로가기 삭제(`academy-flow:47`·`auth-flow:160`) · 배정 3단계(`e2e/_assign.ts` 헬퍼 신설, `academy-flow` 4곳·`parent-flow` 1곳·`boundary-flow` 2곳) · 마감 표기 ISO → `8월 11일까지` · `class-more` → `class-pager` · 천 단위 구분 · `선생님 N명` → `구성원 N명` · 선생님 권한 문구 · `문제 등록` 탭 → `문제`.

**테스트 자체의 결함도 고쳤다(A-047 닫음).** `e2e/_toast.ts`를 만들어 `waitForQuietToast`·`actThenToast`를 공용화했다. 원인은 두 겹이다: ① 토스트는 한 자리에 하나씩이라 앞 토스트가 남으면 다음 단정이 그 문구를 읽는다 ② **오답노트의 `busy`가 전역 단일 값(A-034)**이라 AI 작업 중에 누른 클릭은 가드에 막혀 기다리던 토스트가 **영원히 오지 않는다**. 특히 `노트에 정리했어요`는 앞뒤 문구가 같아 구분할 수 없어 클릭 전에 조용해지기를 기다려야 했다. 단정을 느슨하게 하지 않고 대기만 더했다.

### 검증

- `npm run typecheck` 통과 · `npm run lint` **오류 0**(경고 5 = 기준선) · `npm test` **100건**(94 → 회귀 6건 추가)
- `npx playwright test` **423건 전부 통과**(3뷰포트). 420 → 423은 크래시 회귀 테스트가 3뷰포트에 추가된 것이다. **기준 실패 0건.**
- 브라우저 실측(1280 · 820 · 390 + 다크, 학원 6화면): 가로 스크롤 0 · `pageerror` 0
- **새 흐름 끝까지 확인**: 원장이 `고3 심화 A` 반 생성 → 정예린 추가 → `이 반에 배정하기` → `평상 위의 노인` 8월 14일 마감 배정 성공 → 정예린 학습 탭에 그 과제와 `8월 14일 마감` 표시

## 지표 사전 신설 · 운영 기록 정직화 (D-065)

### ① 운영 기록이 하지 않는 일을 한다고 말했다 (Critical)

`audit.log()` 호출부는 `app/admin/billing.tsx:133`·`:191` **둘뿐이었고 둘 다 `action: '요금 정책'`** — `AuditAction`의 나머지 셋(`콘텐츠`·`계정`·`기타`)은 구조적으로 영구히 0건이었다. 그런데 빈 상태는 `요금제나 콘텐츠를 바꾸면 여기에 남아요`(`ops.tsx:112`)라고 말하고, 0건 분류를 모두 필터 칩으로 두어 누르면 빈 목록이 나왔다.

고친 것

- **`src/features/audit.tsx`**: `AuditAction`에 `'대리 보기'`를 더했다(대리 보기는 이미 `src/session/session.tsx`에 구현돼 있고, 계정 상세가 `'계정'` 분류로 기록할 자리를 남긴다). 분류마다 어느 호출부가 쓰는지 주석으로 못박았다.
- **`app/admin/new.tsx`**: `onDone(created)` 안에서 `log({ actor, action: '콘텐츠', detail })`. detail은 `문제 등록 · {제목} · {학년} {영역} · N문항 · 학생 공개`이고 학년이 비면 지어내지 않고 영역만 적는다. **`ContentComposer`는 고치지 않았다** — 학원 등록(`app/academy/new.tsx`)과 공용이라 폼 안에서 기록하면 학원 조작이 운영자 로그에 섞인다.
- **`app/admin/ops.tsx`**: 필터 칩을 `count > 0`인 분류만 그린다(`전체`는 항상). 빈 상태를 `요금제를 바꾸거나 문제를 등록하면 여기에 남아요`로 고치고, 어느 조작이 남는지 열거하는 대신 `모든 조작이 남는 것은 아니에요. 기록이 생긴 분류만 위에 칩으로 보여 줘요.` 한 줄을 뒀다 — 열거하면 호출부가 늘 때마다 문구가 낡는다.
- **값을 `meta`에서 뺐다**: `현재 ₩12,500`(`:90`)과 `계정 4,186 · 반 148`·`세트 13 · 문항 189`를 `trailing`의 `AppText variant="label"`로 옮겼다. `Row.meta`는 `inkTertiary`(대비 3.23:1, AA 미달)라 화면에서 가장 흐린 글자다. `meta`에는 값이 아닌 분류(`메모리`·`합성`·`고정`·`가정`·`테스트 집계`·`추정`)만 남겼다. **E2E가 단정하는 `현재 ₩12,500` 문구는 그대로 두고 위치만 옮겼다.**
- `이 숫자는 어디서 왔나요`에 **합성 활동 데이터**(`src/data/activity.ts`) · **고정 기준일**(`src/data/calendar.ts`) · **가정한 학사 일정** 세 줄을 더했다. `아직 없는 것`에 `조작 전체를 남기는 감사 로그`·`실제 사용 이벤트` 두 줄을 더했다.
- 한글 `eyebrow="총괄관리자"` 제거(DESIGN.md §4 금지), 상위 탭 화면이라 `backFallback` 제거(CLAUDE.md 내비게이션).

### ② `/admin/metrics` 지표 사전 (신규)

메뉴가 아니다 — 내비는 6개 그대로(D-017)이고 개요의 `admin-goto-metrics` 행에서 들어간다. `backFallback="/admin"`.

**정의를 화면에 다시 쓰지 않는다.** 이름·수식·설명·출처·가짜 상승 경로는 전부 `src/features/adminMetrics.ts`의 `METRICS`(24개)에서 읽는다. `활성의 정의` 표의 `쓰는 지표` 열도 `METRICS[*].label`을 조립해 만들어 이름이 갈리지 않게 했다.

구성

1. **시간 축 고지** — `ANCHOR_LABEL`(`2026-07-28 기준 · 최근 26주`) + 운영자 지표는 고정 기준일, 학생·학부모·학원 화면은 실제 시계라는 사실.
2. **활성의 정의** — `Table` 3행(`활성` / `학습 완료` / `이탈`). 열은 `구분 / 판정 기준 / 쓰는 지표`이고 `쓰는 지표`는 모바일에서 접힌다. **로그인은 활성이 아니라는 사실**과 이유, 이탈 창 `CHURN_WINDOW_DAYS`(28일)를 함께 적었다.
3. **지표 24개** — `Table`(`지표 / 수식 / 출처`). 행을 누르면 `desc`와 `fake`가 펼쳐지고, `fake`가 있는 지표(`wal`·`activation`)는 접힌 상태에서도 `가짜 상승 경로 있음`으로 표시된다. `minWidth`를 주지 않았다 — 코호트·성장 표는 숫자라 가로 스크롤이 통하지만 수식은 읽는 글이라 옆으로 밀면 문장이 끊긴다. 390에서 세 열이 모두 보이고 수식만 줄바꿈한다(실측).
4. **Activation 마일스톤 검증** — `activationPredictiveness()` 실측 **도달군 잔존 79.5% · 미도달군 42.4% · 1.88배**. 2배 미만이라 화면이 `마일스톤을 다시 정해야 해요`라고 말한다(임계값은 `MILESTONE_MIN_RATIO = 2`, 근거는 `METRICS.activation.desc`).
5. **만들지 않은 지표와 이유** — LTV·CAC·Payback(획득 비용이 없고 마진을 발명해야 한다) · NRR(개인 구독에 확장이 없고 학원 좌석 변경 이력도 없다 → GRR만) · Rolling retention(과거 수치가 계속 올라간다) · 외부 벤치마크선(활성 정의가 출처마다 다르다) · 또래·전국 평균(실제 집계가 없다, A-042).
6. **합성 데이터를 어떻게 만드나** — 결정적 생성(FNV-1a, 난수·현재 시각 미사용) · 가입 주 가중 · 이탈과 시험 주 부활 · 계절 가중치. **계절 캘린더는 가정한 학사 일정이고 실제 교육청 일정이 아니라는 사실**을 적고 파일 경로(`src/data/hash.ts`·`activity.ts`·`calendar.ts`)를 함께 밝혔다.
7. **코호트 표를 읽는 법** — Day 0은 가입일 · W0은 강조하지 않음 · 아직 오지 않은 주는 비움 · `COHORT_MIN_SIZE`(20)명 미만은 흐리게 · `COHORT_WEEKS`(9)주까지.

카드를 쓰지 않았다(`StatTiles` 없음). 목록은 `Group`+`Row`, 나란히 비교하는 곳만 `Table`. 새 컴포넌트도 전폭 버튼도 만들지 않았고 한글 `eyebrow`·색 리터럴도 없다.

새 testID: `admin-metrics` · `metrics-active`(+`metrics-active-row-*`) · `metrics-list`(+`metrics-list-row-{지표키}`) · `metrics-predict-reached` · `metrics-predict-missed` · `metrics-predict-ratio`. 기존 `admin-ops`·`ops-filter-*`·`ops-row-*`는 그대로 유지했다.

### 검증

- `npm run typecheck` 통과 · `npm run lint` **오류 0**(경고 10 = 기준선, 전부 기존 파일) · `npm test` **101건 통과**(6 스위트)
- E2E는 이 작업에서 돌리지 않았다(다른 에이전트가 동시 작업 중). `e2e/admin-flow.spec.ts`를 읽고 확인한 것: `:82` 감사 로그 문구와 `:83` `현재 ₩12,500`은 **문구를 그대로 뒀으므로 통과**한다. 다만 `:10`·`:122`의 `admin-new`는 개요가 아니라 `/admin/content`(`app/admin/content/index.tsx:200`)에 있어 이미 깨진다 — 이 작업과 무관한 선행 변경이다.
- 브라우저 실측(`npm run web` 재사용, 1280 · 820 · 390 + 다크): 지표 사전 7섹션 전부 렌더 · 지표 행 펼치기 동작 · 운영 기록 칩이 기록 0건에서 `전체 0` 하나, 요금 변경 + 문제 등록 뒤 `전체 2 · 요금 정책 1 · 콘텐츠 1`
- 라우트 3경로 실측: 비로그인 직접 URL `/admin/metrics` → `/login` · 개요에서 정상 진입 → `/admin/metrics` · `screen-back`과 브라우저 뒤로 모두 `/admin`
- 근거 이미지: `docs/evidence/admin-metrics-desktop.png` · `admin-metrics-tablet.png` · `admin-metrics-mobile.png` · `admin-metrics-dark.png` · `admin-metrics-expand.png` · `admin-ops-desktop.png` · `admin-ops-mobile.png` · `admin-ops-dark.png` · `admin-ops-empty-desktop.png`

## 7/31 — 총괄관리자 학원·요금제·콘텐츠: 카드를 없애고 표로 (D-068)

`app/admin/academies.tsx` · `academy/[id].tsx` · `billing.tsx` · `content/index.tsx` · `content/[id].tsx` 다섯 파일. 오너 지적은 하나였다 — **카드가 비교를 방해한다.**

### 없앤 것

- **`StatTiles` 5곳(타일 20개) 전부 제거.** 여러 대상을 비교하는 자리는 `Table`, 한 대상의 지표는 `Group`+`Row`(값은 `trailing`의 `label`)로 갈랐다. `Row.meta`에 값을 두던 자리도 전부 `trailing`으로 올렸다 — `meta`는 `inkTertiary`(대비 3.23:1)라 판단에 쓰는 값을 둘 자리가 아니다(D-050과 같은 이유).
- 한글 `eyebrow` 4개(`총괄관리자`·`학원`·`국어 · 문학`)와 탭 화면 3곳의 `backFallback`. 상세 두 화면(`academy/[id]`·`content/[id]`)의 뒤로가기는 남겼다.
- 콘텐츠 목록의 정렬 칩 줄(`content-sort`) — 정렬은 표 열 헤더가 맡는다(DESIGN.md 8절).
- 요금제의 손그림 `StepBtn` 14개(32px, `hitSlop` 없음)와 pill 모양 `기본값으로 되돌리기`.
- 콘텐츠 상세의 손그림 오답률 막대(`track`/`fill`) → 공용 `ProgressBar`.

### 화면별

- **학원 목록**: 전체 요약 5행(계약 중 7곳 · 이탈 1곳 · 재원생 3,498명 · 계약 좌석 3,850석 · 월 청구액 합계) + 표 8열. **기본 정렬을 갱신 임박순으로 바꿨다** — 좌석 많은 순이던 예전 정렬에서는 갱신이 지난 해운대국어학원(`지남 15일`)이 6번째였다. 활용률 60% 미만(대치국어학원 58%)은 이름 아래 `활용률 낮음` 글자로 밝힌다. 데이터는 `academyUse()`(좌석·활용률·28일 활성·갱신)와 `scaleStat()`에서 오고 청구액만 `academyMonthly`로 계산한다.
- **학원 상세**: 좌석 활용률을 주 지표로 올렸다(계약 좌석 3,200석 · 재원생 3,002명 · 94% · 28일 활성 2,272명 · 갱신 2026-08-10 D-13 · 청구액 · 반 122개 · 선생님 62명 — `반 · 선생님` 한 타일에 `122 · 62`를 넣었던 것을 두 행으로 갈랐다). **평균 정답률을 `weightedAccuracy`(문항 수 가중)로 교체** — 제출별 단순 평균이라 학부모 리포트와 다른 값을 말하고 있었다(D-052·D-061과 같은 결함). 반 목록은 `classPerformance`가 준 값을 그대로 그린다(화면이 다시 계산하지 않는다). `배정 학습 제출률` 섹션과 `학생 개인 학습 상세는 여기서 보지 않아요` 문구는 유지하고 좌석 아래로 내렸다.
- **요금제**: 증감 컨트롤 7개를 공용 `Stepper`(44px · `atMin`/`atMax`)로 바꿨다. `testID`는 `billing-{key}-value`·`-up`·`-down` 그대로다. 매출 추정은 `estimateRevenue(policy)`와 `share()`에서 오고 화면이 다시 계산하지 않는다(예전에는 개요와 같은 수식을 각자 들고 있었다). 학원별 청구액은 표(좌석·규모 할인·상태·청구액 + 합계 행)이고, **이탈한 학원의 좌석도 아직 합계에 들어간다는 사실을 표 아래 한 줄로 밝혔다**(`revenue.ts`가 반 목록에서 좌석을 세기 때문 — 이 작업 범위 밖).
- **콘텐츠 목록**: 표 7열(제목·학년·영역·세부 유형·문항·누적 풀이·평균 정답률) + 합계 행(문항 189개 · 누적 풀이 3,209회). 지웠던 타일 숫자는 합계 행이 대신 말한다. `새 문제 등록하기`는 960px 전폭에서 섹션 제목 옆 `hug` + `size="sm"`으로 내렸다(D-047).
- **콘텐츠 상세**: 지표 4개를 `Group`+`Row`로(문구 `학원 배정 풀이`·`개인 학습 풀이`는 `Row`의 `title`로 살렸다). 오답률 막대는 `ProgressBar`이고, 70% 이상 문항에는 **`해설을 다시 볼 문항이에요`를 그 행에 붙였다** — `ProgressBar`에 `danger`가 없어 색으로 구분할 수 없고, 색만으로 뜻을 전하지 않는 것이 원래 규칙이다(DESIGN.md 11절).

### 출처 배지

지표 행은 값 옆에 `SourceBadge`를 붙였다(`합성`·`실측`·`추정`). 표는 셀마다 붙이면 잉크가 값을 덮으므로 **표 바로 위에 열 묶음별 범례**를 뒀다(예: `합성 좌석·활용률·활성·갱신` / `추정 월 청구액`). 콘텐츠 상세의 `누적 풀이`·`학원 배정 풀이`는 합성 집계와 세션 실측이 더해진 값이라 **배지를 둘 다** 붙이고 부제에 `이 세션 제출 8건 포함`을 적었다.

### 검증

- `npm run typecheck` 통과 · `npm run lint` **오류 0**(경고 10 = 기준선, 내 파일에는 없음) · `npm test` **101건 통과**(6스위트)
- E2E는 다른 작업과 포트가 겹쳐 돌리지 않았다. 이미 떠 있는 개발 서버(8081)에 Playwright 스크립트로 붙어 **1280 · 820 · 390 + 다크**로 다섯 화면을 확인했다. 콘솔·페이지 오류 0.
  - `billing-academySeat-value` 텍스트 = `₩12,500`(올린 뒤), `content-pager` = `13개 중 1–10 … 1 / 2`, `academy-row-한빛학원` 클릭 → 학원 상세 진입, `content-sort-accuracy`(정답률 낮은 순) → 첫 세트에 `해설을 다시 볼 문항이에요` 4건.
  - 표 접힘 실측: 390에서 학원 표는 우선순위 1 열 4개(학원·활용률·갱신·상태)만 남고 `minWidth`만큼 **표 안에서만** 가로로 스크롤한다. 820에서는 8열이 접히지 않고 들어간다(이름 열 flex 118px).
- 근거 이미지: `docs/evidence/admin-academies-{desktop,tablet,mobile,dark}.png` · `admin-academies-table-{tablet,mobile}.png` · `admin-academy-detail-{desktop,tablet,mobile}.png` · `admin-academy-classes-desktop.png` · `admin-billing-{desktop,tablet,mobile,dark}.png` · `admin-billing-table-desktop.png` · `admin-content-list-{desktop,tablet,mobile}.png` · `admin-content-table-desktop.png` · `admin-content-detail-{desktop,tablet,mobile}.png` · `admin-content-detail-hard.png`

### 남은 한계

① 학원별 청구액 목록에 `Pager`를 두지 않았다 — 8곳이 한 페이지(10개)에 들어와 넘길 수 없는 페이저는 죽은 컨트롤이다(DESIGN.md 18-3의 "좁히는 도구는 목록이 한 화면을 넘을 때만"). 학원이 10곳을 넘으면 그때 둔다. ② `ProgressBar`에 색조가 없어 오답률 70% 이상을 글자로만 구분한다(공용 컴포넌트는 이 작업 범위 밖이었다). ③ 콘텐츠 목록에서 `지문형/문법형`과 `공개/비공개`가 열에서 빠졌다(상세가 둘 다 말한다). ④ `revenue.ts`가 이탈한 학원의 좌석까지 세므로 MRR·청구액 합계가 이탈을 반영하지 않는다.

## 7/31 — 총괄관리자 전면 개편 (D-069~072)

### 검토 방식

웹 리서치(토스 PO세션·콴다 Metrics Store·Reforge·Lenny·Sequoia·Baymard·Tufte·GitLab CVE-2016-4340·Uber God View·카카오 로그인 문서·개인정보 안전성 확보조치 기준) + `product-manager` + `ux-auditor`. 영향이 큰 주장은 코드로 직접 확인한 뒤에만 채택했다.

**검증한 결정적 사실**: `Account`에 가입일이 없고 `Entitlement`에 기간이 없어 **MAU·Activation·Retention·CC를 하나도 계산할 수 없었다.** 학원이 `academyName` 문자열에서 파생돼 **1곳뿐**이고 로스터에 **원장이 0명**이었다. `Row.meta`는 대비 **3.23:1**(AA 미달)인데 admin 8화면의 값이 전부 거기 있었다. `RoleShell.onSignOut`은 **죽은 prop**이라 개요의 `AccountSettings`가 관리자 유일 로그아웃 경로다.

### 데이터를 만들었다 (하드코딩하지 않았다)

- `src/data/hash.ts` — 결정적 생성기(`hash`·`pick`·`frac`·`digits`). `usage.ts`가 이걸 쓰도록 전환.
- `calendar.ts` — `DATA_ANCHOR 2026-07-28`, 26주 창, 계절 가중치, 이벤트 4건. **실제 시계는 건드리지 않았다** — 학생·학부모·학원의 마감 판정은 진짜 오늘이어야 한다.
- `activity.ts` — 학생별 일별 활동. 가입 주 가중·이탈·**시험 주 부활**·계절성. 생성 **84ms**.
- `academies.ts` — 학원 8곳(1곳 이탈), 원장 8·선생 76. 계약 좌석·갱신일이 생겨 활용률 58~94%, 갱신 `지남 15일 ~ D-132`.
- `solo.ts` — 학원 밖 개인 사용자 600명. 무료 사용자가 없으면 `ARPU > ARPPU`가 된다.
- `accountMeta.ts` — 가입일·학년·**고객지원 코드**(3,586개 충돌 0건).
- `adminMetrics.ts` — 지표 사전(이름·수식·정의·**가짜 상승 경로**) + 24개 지표를 한곳에서 계산.
- `revenue.ts` — 개요와 요금제가 각자 하던 MRR 계산을 합치고 **ARPU 분모의 단위 혼합**(건 + 명)을 고쳤다.

### 실측하며 잡은 결함 여섯

| 증상 | 원인 | 조치 |
|---|---|---|
| 고객지원 코드 3,586개 중 **3,386건 충돌** | FNV-1a는 씨앗 끝 글자만 바뀌면 결과가 작은 폭으로만 움직인다 → 6자리가 사실상 한 값 | 해시 하나를 30진수로 펼치는 `digits()` → **충돌 0** |
| `WAL Δ-947`로 꺾임 | 마지막 주가 2일짜리 미완성 | `lastCompleteWeek()`로 완성된 주까지만 |
| Activation 예측력 **1.00배**(무의미) | 초기 행동↔잔존 상관이 없음 | 이탈 시점·완료 확률을 `loyalty`와 연결 → **1.61~1.88배** |
| **개인구독 3명 · `ARPU > ARPPU`** | 로스터 전원이 학원 이용권이라 무료 사용자 0명 | 개인 사용자 600명 → 구독 188·해지 47·GRR 80% |
| **코호트 W0이 98%** | 요일 배치가 비트 필터로 건너뛰기만 해서 활동일이 `count`보다 적거나 **0일**이 됐다(31명이 가입 주 활동 0건, 일부는 전 기간 0건) | 시작 요일 + 7과 서로소인 2씩 돌며 정확히 `count`일 선택 → **W0 전 코호트 100%** |
| **대리 보기를 끝내면 `/login`으로 떨어짐** | 계정만 되돌리고 화면은 학생 라우트에 남아 역할 가드에 걸린다 | 종료 시 `homeHrefFor(operator)`로 이동 |

`ARPU(12,800) > ARPPU(11,009)`는 남겼다 — 버그가 아니라 **계약 좌석이 활성 사용자보다 많다**는 실제 신호이고 지표 정의에 그 해석을 적었다.

### 화면

- **개요**: 카드 전부 제거. 북극성(큰 숫자 + 폭 전체 추이선) → **확인이 필요해요** → primary → 입력 지표 → 규모 → 매출 → 코호트 삼각표 → L7 분포 → 성장 구성 → 적재용량 → 지표 사전 링크. `배정 학습 제출률`·내비 복제 `자세히 보기`·허세 지표 삭제. 지표마다 **수식 한 줄 + 출처 배지**.
- **신규 부품**: `Table`(열 정렬·등폭 숫자·`priority` 접기·표 안 가로 스크롤) · `Sparkline`(`react-native-svg` `Polyline`, 새 의존성 없음) · `Stepper`(44px) · `SourceBadge`.
- **계정**: 붙여넣기 타입 자동 판별 검색 + 8열 표 + `/admin/user/[id]` 상세.
- **대리 보기**: 사유 필수 · 읽기 전용 · 메모 차단 · 세 경로 배너 · 15분 자동 종료 · 감사 로그.
- **지표 사전** `/admin/metrics`(메뉴 아님) — 활성 정의 · 24개 지표 수식 · Activation 검증 · **만들지 않은 지표와 이유** · 합성 데이터 규칙.
- **운영 기록**: `audit`를 문제 등록·대리 보기에 실제로 연결. **0건 필터 칩을 렌더하지 않는다**(전에는 세 분류가 영구히 0건인데 채워지는 것처럼 보였다).
- 학원 목록·상세·요금제·콘텐츠도 표로. 학원 상세의 평균 정답률을 `weightedAccuracy`(문항 가중)로 교체.

### 검증

- typecheck 통과 · lint **오류 0**(경고 5 = 기준선) · `npm test` **112건**(101 → 결정성·불변식 11건 추가) · `npx playwright test` **426건 전부 통과**(3뷰포트)
- 의도적으로 고친 E2E: 문제 등록 진입(개요 → 콘텐츠 화면 행동) · 개요 고지 문구 · `screen-back`이 들어온 화면으로 · 모바일에서 접히는 열을 단정하지 않게. **대리 보기 E2E를 새로 추가**했다(사유 없으면 버튼 없음 → 읽기 전용 → 몰입 모드 배너 → 운영자 복귀 → 감사 기록).
- 화면 확인: 6화면 × 1280·820·390 — **가로 스크롤 0 · `pageerror` 0**. 다크 확인.
- 대리 보기 실측: 검색 → 상세 → 사유 없으면 시작 버튼 0개 → 시작 → `/student` + 배너 → 답 선택이 저장되지 않음(`aria-checked` null, 제출 버튼 미출현) → 몰입 모드에서 배너 유지 → 끝내기 → `/admin` 복귀

### 남긴 것

`revenue.ts`가 이탈 학원 좌석까지 세는 문제(표 아래 한 줄로 밝히는 것까지만 했다) · `ProgressBar`에 위험 색조를 둘지 · `academy/[id]`가 아직 fixture 반 목록을 읽는다(S-013과 같은 뿌리) · 대리 보기의 MFA·사용자 통지·서버 토큰 분리는 인프라가 없어 운영 전 필수로 남긴다 · `RoleShell.onSignOut` 되살리기(잘못 손대면 관리자가 로그아웃할 수 없다)

---

## 7/31 — 대리 보기 경계 결함 11건 (D-073)

총괄관리자 검토에서 나온 대리 보기(D-071) 결함을 확인하고 고쳤다. 전부 재현됐다.

### ① 읽기 전용이 아니었다 (Critical · A-051)

`progress.tsx`에서 `readOnly`를 보던 곳은 `markAssignmentSubmitted`와 배정 3개뿐이었다. 열려 있던 곳:
`recordAttempt` · `requestRetryFor` · `addWrongNote` · `removeWrongNote` · `restoreWrongNote` · `setDig` ·
`toggleStar` · `setMastered` · 큐 5개(`addToQueue`·`removeFromQueue`·`removeManyFromQueue`·`moveInQueue`·`restoreToQueue`) ·
`setWeekSummary` · `sendPraise` · `dismissPraise`. `content.tsx`의 `addContent`와 `academy.tsx`의 `removeTeacher`도 열려 있었다.

가장 나쁜 조합은 메모였다. 대리 중에는 `dig`를 지워 보여 주는데(`wrongNotes`의 `useMemo`) 같은 화면의 `정리하기`가
`setDig`로 **학생이 쓴 실제 메모를 덮어썼다**. D-071이 보호하려던 값이 정확히 그 경로로 사라지는 동안 배너는 `읽기 전용`이라고 말했다.

고친 방식: 값을 돌려주는 함수는 기존 `denyWrite()`, `void` 함수는 `if (readOnly) return;`이고 `useCallback` 의존성에 `readOnly`를 함께 넣었다(경고 5개 기준선 유지).
`addContent`는 반환형을 `ContentSet | null`로 바꿔 거부를 값으로 돌려주고 `ContentComposer`가 `new-refused`로 이유를 말한다 —
완료 화면으로 넘기면 등록된 것처럼 보인다. 이 때문에 `ContentProvider`를 `SessionProvider` **안**으로 옮겼다(`readOnly`를 읽어야 한다).

### ② 배너를 라우터 루트로 올렸다 (C1 · H2 · A-061)

`RoleShell`의 세 반환 경로에 두는 방식이 세 가지를 동시에 만들었다.

- 데스크톱: `deskRoot`가 `flexDirection: 'row'`라 배너가 사이드바 왼쪽의 **세로 띠**(실측 폭 128px, 높이 전체)로 눌렸다. `textBox`가 `flex:1`로 폭 0이 돼 이름·남은 시간이 화면에서 사라졌는데 `toBeVisible` E2E는 통과했다.
- 모바일: 배너가 `SafeAreaView edges={['top']}` **위**라 네이티브 노치 아래로 들어갔다.
- `RoleShell` 밖 화면(`/select-space`·`/login`·`/legal/*`)에는 배너도 `끝내기`도 만료 타이머도 없었다. 다역할 대상(`u_teacher_parent` 한지훈)은 `homeHrefFor`가 `/select-space`를 줘서 **시작 직후 바로 그 화면으로 간다**.

`app/_layout.tsx`에서 `<Stack>` 위에 한 번만 두고 배너가 스스로 `SafeAreaView edges={['top']}`를 쓴다. 세 경로 중복도 사라졌다.
낡은 주석("세 반환 경로 전부에 넣는다")도 새 구조와 이유로 고쳤다.

실측: 1280에서 배너 `boundingBox` = `{x:0, y:0, w:1280, h:83}` (가로 막대) · `/select-space`에서 배너와 `끝내기` 보임.

### ③ 남은 시간이 사유 뒤에서 잘렸다 (H3)

`{reason} · 남은 시간 {mm}:{ss}`가 `numberOfLines={1}`이라 390에서 시간이 먼저 사라졌다 — 15분 자동 종료가 이 배너의 안전장치인데.
남은 시간을 **첫 줄 오른쪽(`끝내기` 왼쪽)의 고정 요소**로 떼고 사유를 둘째 줄에 뒀다. 등폭(`fontVariant: ['tabular-nums']`).
실측 390: `impersonation-who`의 `scrollWidth 196 = clientWidth 196`(잘림 없음), `남은 15:00`이 x=243·폭 62로 화면 안.

### ④ 세션·감사 기록 (A-053 · A-059 · A-060 · A-070 · A-071 · A-073)

- `signIn`이 `setImpersonation(null)`을 한다. 대리 중 뒤로가기로 `/admin`에 가면 역할 가드가 `/login`으로 보내는데, 거기서 다시 로그인하면 **새 계정이 남의 이름으로 읽기 전용**이 됐다(실측 재현). 이제 배너가 `/login`에도 보여 상태가 어긋난 것을 화면에서 알 수 있다.
- `startImpersonation`이 대상의 `admin` 역할을 거부한다. 계정 상세도 그 경우 폼을 그리지 않는다.
- `endImpersonation`이 종료 정보(`ImpersonationEnd`)를 돌려주고 **호출부**가 기록한다. `SessionProvider`가 `AuditProvider`에 의존하면 provider 순서 제약이 늘어난다. 배너와 `내 정보`가 함께 쓰는 `useFinishImpersonation()`이 세션 되돌리기 → 감사 기록 → 운영자 홈 이동을 한다.
- 시작·종료 모두 `action: '대리 보기'`다. 전에는 시작이 `계정`으로 남아 `대리 보기` 분류가 구조적으로 영구히 0건이었다(D-065가 고친 것과 같은 모양). 종료 기록에 `열어 본 화면 N개: 경로 목록`과 종료 사유가 들어간다(안전성 확보조치 기준 제8조의 '수행업무').
- `AuditEntry.subjectId`를 두고 계정 상세의 `이 계정을 누가 열어 봤나`가 그 값으로 좁힌다. `detail.includes(userId)`는 로스터 id가 접두 관계라(`u_as_1_1_1` ⊂ `u_as_1_1_11`) 남의 열람 기록이 섞였다.
- 대리 중 대상의 `내 정보`는 로그아웃 대신 `대리 보기 끝내기`를 두고 `공간 바꾸기`를 감춘다. 그대로 두면 운영자 세션까지 끊기고 종료 기록도 남지 않았다. **대리 중이 아닐 때의 동작은 그대로다**(학생·학원 E2E의 로그아웃 경로가 그대로 통과한다).

### 검증

- typecheck 통과 · lint **오류 0 · 경고 5**(기준선 그대로) · `npm test` **123건 통과**(기준선 112 + 다른 작업이 더한 `table.test.tsx` 11건, 이번 변경으로 깨진 것 없음)
- `npx playwright test` **450건 전부 통과**(3뷰포트). 기준선 426 + 이번에 더한 8건 × 3뷰포트 = 24
- 더한 E2E(`e2e/admin-flow.spec.ts`): 배너 폭·잘림 단정(`boundingBox` + `scrollWidth > clientWidth`) · 오답노트 별표가 안 바뀜 · 담아 두기가 안 됨 · `내 정보`에 로그아웃 없고 대리 종료 있음 · `/select-space`에서 배너 유지 · 시작·종료 2건이 `대리 보기` 칩으로 남고 종료에 경로 수가 있음(+ 계정 상세 2건) · 학원 문제 등록 거부 · 가드된 `/login`에서 다시 로그인하면 대리 상태가 지워지고 쓰기가 살아남
- 고친 기존 테스트: **없다**(기존 단정은 그대로 통과한다)
- 화면 확인(`dist` 빌드 + `serve`): 1280 `docs/evidence/impersonation-banner-desktop.png` · 390 `impersonation-banner-mobile.png` · 820 `/select-space` `impersonation-select-space.png` · 390 다크 `impersonation-settings-dark.png` · 오답노트 읽기 전용 `impersonation-notebook-readonly.png` · 운영 기록 `impersonation-ops-log.png` · 가드된 로그인 화면의 배너 `impersonation-login-banner.png`
- 쓰기 차단 실측: 대리 중 별표를 눌러도 `aria-label`이 그대로 → 끝낸 뒤 그 계정으로 직접 로그인하면 별표(`q3` 유지·`q7` 미설정)와 메모 5건이 **원래대로**

### 남긴 것

- A-074: 대리 중 `학원 연결 끊기`(`setAcademyLinked`)가 눌린다. 세션 값이라 학생 데이터는 안전하지만 화면은 끊긴 것처럼 보인다(`app/student/mypage.tsx`는 이번 범위 밖)
- A-075: 네이티브에서 배너 + `RoleShell`의 상단 인셋이 두 번 들어간다. 웹은 인셋 0이라 재현되지 않는다
- A-048(MFA·대상 통지·서버 토큰 분리·append-only 로그)은 인프라 없이 닫을 수 없어 그대로 둔다

## 7/31 — 공용 표 컴포넌트 결함 8건 (D-074)

`src/components/Table.tsx` · `SourceBadge.tsx` 두 파일만 고쳤다. 이 표를 admin 7화면(개요·계정·학원·학원 상세·요금제·콘텐츠·지표 사전)이 공유하므로 한 곳을 고치면 일곱 곳이 함께 바뀐다. 호출부는 다른 작업이 동시에 만지고 있어 손대지 않았고, 호출부에서만 고칠 수 있는 것은 A-076·A-077로 넘겼다.

### ① 모바일에서 값 열이 화면 밖으로 밀렸다 (H)

`minWidth`가 **전체 열 기준**인데 모바일에서는 `priority 1`만 남는다. 390(컬럼 358)에서 개요 지표 표는 표시 열이 `이름(flex) + 값 110 + 변화 78 + gap 16` = **292px**뿐인데 `minWidth 560`이 강제돼 이름 열이 356px로 부풀고 값·변화가 x 364~560으로 밀렸다 — 첫 화면에 숫자가 하나도 없었다.

`Table`이 폭을 스스로 정한다. 호출부 값과 `neededWidth(shown)`(고정 폭 합 + gap + flex 열마다 `FLEX_MIN 88`) 중 **작은 쪽**을 쓰고, `onLayout`으로 컬럼을 실측해 **정말 넘칠 때만** `ScrollView`로 감싼다(재기 전 한 프레임은 예전 규칙 `isMobile`을 쓴다 — 넘침이 화면에 먼저 나타나지 않게).

실측 390: 값 x 234~288 · 변화 x 296~374(컬럼 16~374), 표 안 가로 스크롤 없음, 문서 `scrollWidth 390 = clientWidth`. 다른 표도 확인 — 학원 4열·콘텐츠 3열·요금제 3열은 스크롤이 사라졌고, 계정(5열 436px)·성장(498)·코호트(660)는 폭이 정말 모자라 표 **안에서만** 스크롤한다.

### ② 정렬 헤더 터치 영역이 20px이었다 (H)

D-068이 "정렬은 열 헤더가 맡는다"로 옮긴 유일한 컨트롤인데 `Pressable`이 감싼 것이 캡션 한 줄(20.15px)뿐이었다. `hitSlop`은 쓸 수 없다 — **react-native-web의 `Pressable`은 `hitSlop`을 구현하지 않는다**(`dist/exports/Pressable`에 없고 레거시 `Touchable`에만 있다). `BackLink`가 쓴 방법(세로 패딩 + 음수 마진)을 썼고, 아래 패딩은 8로 잡아 넘치는 부분이 `headRow`의 `paddingBottom` 안에 들어가게 했다(첫 행의 클릭을 가로채지 않는다).

실측 1280: 활용률 헤더 누름 영역 **44.16px**, 헤더 행 높이 **36 그대로**.

### ③ 스크린리더가 노드 셀을 듣지 못했다 (H)

`labelFor`가 `typeof v === 'string'`만 모아 추이선·출처 배지·색이 들어간 값이 통째로 빠졌다 — D-069의 "모든 숫자에 출처 배지"가 스크린리더에는 전달되지 않았다. 타입을 조여 `rowLabel`을 필수로 만들면 호출부 7곳이 동시에 깨지므로, 조립 라벨이 노드 셀을 `열이름 (값을 읽을 수 없음)`으로 적게 했다(빠진 열이 있다는 것 자체가 정보다). `TableProps.rowLabel` 주석에 "노드를 반환하는 열이 있으면 반드시 준다"를 적었다. 지금 걸리는 표는 개요 `성장 구성` 하나 → **A-077**.

### ④ 펼침 행이 접히고 펼쳐지는 것을 말하지 않았다 (H)

표시도 상태도 들여쓰기도 없어 `/admin/metrics`의 24개 펼침 내용이 새 행처럼 읽혔다. 마지막에 아래·위 chevron을 두고 `aria-expanded`를 주고 펼친 내용을 첫 열 폭만큼(모바일은 `spacing.xl`) 들여썼다.

- chevron은 `chevron-right`를 90° 돌려 쓴다. `Icon`의 `IconName`에 `chevron-down`/`up`이 없는데 그 파일은 앱 전체가 공유해서 이번 범위 밖이다. 글리프 모양은 아래·위 chevron 그대로이고 **이동을 뜻하는 오른쪽 chevron과 방향이 갈린다**(§8).
- 상태는 `accessibilityState`가 아니라 `aria-expanded`·`aria-selected`로 준다. **react-native-web은 `accessibilityState`를 DOM으로 옮기지 않는다** — 실측에서 속성이 아예 붙지 않았고(`aria-expanded: null`), `aria-*`로 바꾸니 `false → true`로 바뀌었다. 네이티브는 `View`가 이 프롭을 `accessibilityState`로 되돌려 준다(단위 테스트가 그 값을 확인한다).

### ⑤ 화살표가 실제 정렬 방향을 말하지 않았다 (M)

비활성 열에도 `arrow-down`을 그려 활성 여부를 **색으로만** 갈랐다(§11 위반). 비활성 열의 화살표를 없애고(정렬 가능함은 헤더가 버튼이라는 것과 이름이 말한다), 활성 헤더를 `typeface.semibold` + `aria-selected` + 방향이 맞는 화살표(`arrow-up`=오름 · `arrow-down`=내림)로 바꿨다. 헤더 이름도 상태를 말한다: `활용률 오름차순 정렬 중, 내림차순으로 바꾸기`.

방향이 어긋나는 진짜 원인은 호출부의 비교 함수가 열마다 `a-b`/`b-a`로 갈리는 것이다. `Column.sort` 주석에 "오름차순으로 정의한다. 내림차순은 표가 뒤집는다"를 명시하고 뒤집힌 8개 열을 **A-076**으로 넘겼다(실측: `계약 좌석` 첫 클릭이 3,200석→62석인데 헤더는 `오름차순 정렬 중`이라고 읽는다. `활용률`은 `a-b`라 58%→94%로 화살표와 맞는다).

### ⑥ 720~761px에서 8열 표가 컬럼을 넘쳤다 (M)

`isMobile`이 아니어서 모든 열을 그렸고 스크롤 컨테이너도 없었다 — 학원 표는 고정 570 + gap 56 + flex 88 = **714px**이 필요한데 컬럼은 672px이었다. `priority 3`을 태블릿에서도 접는다(모바일 1 · 태블릿 1·2 · 데스크톱 전부). 실측 720·820: 학원 표가 7열(`28일 활성` 접힘)이고 문서 `scrollWidth = clientWidth`. 계정·콘텐츠도 820에서 넘치지 않는다.

### ⑦ `SourceBadge`의 11px (M)

크기 스케일 최소는 `xs 12`인데 `fontSize: 11`을 직접 썼다. `font.size.xs`로 올리고 `lineHeight`를 `snug`로 맞췄으며, 늘어난 폭은 `paddingHorizontal`을 `spacing.sm → xs`로 줄여 흡수했다(지표 표 `출처` 열 56px 안에 그대로 들어간다).

### ⑧ 고정 폭 열만 있는 표가 구분선만 뻗었다 (M)

960 컬럼에서 코호트 표(열 합 660)·성장 표(498)가 각각 300px·462px을 비운 채 hairline만 끝까지 지나 빈 셀처럼 보였다. `flex:1` 스페이서는 이 문제를 풀지 못한다 — 구분선은 행 컨테이너에 붙어 있어 폭이 그대로다. **모든 열이 고정 폭일 때 표를 내용 폭에 맞춘다**(`alignSelf: 'flex-start'`). 실측: 구분선 폭이 960 → 성장 **498** · 코호트 **660**. `flex` 열이 하나라도 있는 표(지표·학원·계정)는 960 그대로다.

### 함께 고친 것

헤더 셀의 `align: 'right'`가 `flexDirection: 'row'`인 `headCell`에 `alignItems: 'flex-end'`로 걸려 **가로가 아니라 세로 정렬**을 바꾸고 있었다 — 숫자 열의 헤더가 값과 다른 x좌표에 있었다. 정렬을 셀 래퍼(세로 방향 컨테이너)로 옮겼다. 실측 390: `값` 헤더 오른쪽 끝 288 = 값 셀 오른쪽 끝 288.

### 검증

- typecheck 통과 · lint **오류 0 · 경고 5**(기준선 그대로) · `npm test` **123건 통과**(기준선 112 + 이번에 더한 `__tests__/table.test.tsx` 11건)
- `npx playwright test` **450건 전부 통과**(3뷰포트, 4.5분). 기준선 426 + 같은 날 다른 작업이 더한 24건. 고친 기존 테스트는 **없다** — 태블릿에서 `priority 3`을 접는 변경이 깨는 단정도 없었다(태블릿 단정 중 3순위 열 이름에 기대는 것이 없다)
- 더한 단위 테스트: 뷰포트별 열 접기 3건 · 모바일에서 값 열이 남는지 1건 · 정렬 방향과 이름·`selected` 3건 · 노드 셀 라벨 2건 · 펼침 상태 2건. 뷰포트는 `useWindowDimensions`를 갈아 실제 분기점(720·1024)을 지나게 한다
- 화면 확인(`dist` 빌드 + `serve`): 390 `docs/evidence/admin-metric-table-mobile.png`(값·변화가 가로 스크롤 없이 보인다) · 720 `admin-academies-table-720.png` · 820 `admin-academies-table-820.png`·`admin-content-table-820.png`·`admin-users-table-820.png` · 1280 `admin-metrics-expand-desktop.png`(펼침 chevron·들여쓰기)·`admin-growth-table-desktop.png`(구분선이 내용과 함께 끝난다)·`admin-academies-sort-desktop.png` · 다크 `admin-metric-table-dark.png`·`admin-academies-sort-dark.png` · 390 나머지 표 `admin-academies-table-mobile.png`·`admin-users-table-mobile.png`·`admin-content-table-mobile.png`·`admin-billing-table-mobile.png`·`admin-growth-table-mobile.png`·`admin-cohort-table-mobile.png`

### 남긴 것

- **A-076**(호출부 8개 열의 `sort`가 내림차순) · **A-077**(개요 성장 표에 `rowLabel` 없음) — 둘 다 `app/admin/*`이라 이번 범위 밖
- `open`이 단일 상태라 펼침은 한 번에 하나다. 눌린 행은 제자리에 있고 아래만 밀려 시선 위치를 잃지 않아 그대로 뒀다. 지표 사전에서 두 지표를 나란히 비교하고 싶다는 요구가 생기면 다중 펼침을 다시 본다(호출부 영향 확인 필요)
- 정렬 중이던 열이 화면이 좁아져 접히면 정렬이 조용히 풀린다(`shown.find`). 뷰포트를 바꾸는 사용자가 드물어 이번에는 두었다
- `Icon`의 `IconName`에 `chevron-down`/`chevron-up`이 없다. 회전으로 해결했지만 다른 화면에서도 필요해지면 이름을 늘리는 편이 낫다

## 7/31 — 총괄관리자 학원·요금제·운영기록·콘텐츠·지표사전 결함 13건 (D-075, A-076 닫음)

총괄관리자 검토에서 넘어온 High 4 · Medium 9. 소유 파일은 `app/admin/academies.tsx` · `academy/[id].tsx` · `billing.tsx` · `ops.tsx` · `content/index.tsx` · `content/[id].tsx` · `new.tsx` · `metrics.tsx`. 개요·계정·`src/*`·`e2e/*`는 다른 작업이 동시에 잡고 있어 읽기만 했다.

### ① 정렬 방향이 뒤집힌 열 (A-076, High)

D-074가 "`Column.sort`는 오름차순으로 정의하고 내림차순은 표가 뒤집는다"로 정했는데 호출부가 `b - a`로 남아 첫 클릭이 화살표와 반대 순서를 냈다. 지적받은 **8개 열**(`academies.tsx` 계약 좌석·재원생·28일 활성·월 청구액 / `billing.tsx` 좌석·월 청구액 / `content/index.tsx` 문항·누적 풀이)을 `a - b`로 뒤집었다.

**같은 결함을 2개 더 찾았다**: `app/admin/academy/[id].tsx`의 반별 제출률 표 `학생`(:96)·`배정`(:105). A-076에 없던 열이지만 같은 화면 묶음이고 같은 거짓말을 하고 있어 함께 고쳤다(제출률 열은 이미 `a - b`였다). 실측 정렬 결과(1280):

| 열 | 첫 클릭 | 헤더 이름 | 두 번째 클릭 |
|---|---|---|---|
| 계약 좌석 | 62석 → 64 → 65 | `오름차순 정렬 중` | 3,200석 → 123 → 117 |
| 재원생 | 38명 → 44 → 60 | `오름차순 정렬 중` | 3,002명 → 100 → 90 |
| 28일 활성 | 29명 → 30 → 41 | `오름차순 정렬 중` | 2,279명 → 72 → 68 |
| 월 청구액 | ₩456,000 → ₩528,000 | `오름차순 정렬 중` | ₩30,620,400 → ₩1,020,000 |
| 활용률(원래 맞던 열) | 58% → 71% → 73% | `오름차순 정렬 중` | 94% → 94% → 81% |

기본 정렬(갱신 임박순 + 이탈 후순위, D-068)은 `sort`가 아니라 행 배열 순서라 그대로다 — 실측 첫 행이 `해운대국어학원 지남 15일`, 마지막이 이탈 학원이다.

### ② `오답률 70% 이상 문항` 알림의 목적지가 답을 주지 않았다 (A-055, High)

콘텐츠 목록이 `?wrong=N`을 받는다. 그 기준을 넘는 문항이 있는 세트만 남기고, **점검할 문항이 많은 세트가 위**에 오며, 좁힌 동안만 `점검 문항` 열을 둔다. 문항별 오답률은 상세 화면과 같은 곳(`contentUsage(set).wrongRateByQ`)에서 온다 — 개요가 세는 값과도 같은 소스다.

- 실측: 전체 13세트 → **7세트 · 11문항**. 상단에 `오답률 70% 이상인 문항이 있는 세트만 남겼어요. 7개 세트에 11문항이고, 점검할 문항이 많은 세트가 위에 와요.` + `전체 목록 보기`(누르면 `/admin/content`로 `replace`, 다시 13세트).
- `점검 문항` 열은 `priority: 1`이라 390에서도 접히지 않는다 — 그 기준으로 좁혀서 왔으므로 값이 보이지 않으면 좁힌 뜻이 없다. 대신 `누적 풀이`를 그동안만 `priority: 2`로 내려 390에서 가로 스크롤이 생기지 않게 했다(실측 `scrollWidth 358 = clientWidth 358`, 열은 `제목 · 점검 문항 · 평균 정답률`).
- 범위를 벗어난 쿼리(`?wrong=abc`·`0`·`101`)는 무시하고 전체를 보여 준다. 빈 결과일 때의 문구도 갈라 뒀다.
- **개요는 이 작업 소유가 아니라 손대지 않았다.** `app/admin/index.tsx:138`이 아직 `href: '/admin/content'`이므로 앱에서 이 화면에 닿을 길이 없다 → **A-078**로 남겼다. 검증은 임시 링크(`router.push('/admin/content?wrong=70')`)를 붙인 빌드로 하고 곧바로 되돌렸다(최종 빌드에는 없다).

### ③ 학원 지표가 fixture 반 목록만 읽는 사실을 화면이 말하지 않았다 (A-072, High)

`academyUse`·`revenue.ts`·`app/admin/academy/[id].tsx`가 `ACADEMY_CLASSES`를 읽어서, 원장이 세션에서 반을 만들거나 학생을 옮겨도 운영자의 재원생·좌석 활용률·월 청구액·28일 활성이 움직이지 않는다(D-063 오버레이). 구조는 S-013·S-014와 같은 뿌리이고 `src/features/*`는 이번 소유가 아니라, **학원 상세와 학원 목록 두 곳에 고지 한 줄**을 더했다: `이 세션에서 학원이 바꾼 반·학생은 아직 반영되지 않아요.` 학원 목록에도 넣은 이유는 그 화면의 `전체 요약` 5줄과 표 6열이 전부 같은 출처라서다. S-013의 완료 조건에 "오버레이를 지울 때 두 문장도 함께 지운다"를 적었다.

### ④ 마일스톤 검증 3행에 출처 배지가 없었다 (A-056 부분, High)

`metrics.tsx`의 도달군 잔존·미도달군 잔존·예측력은 모두 합성 활동 기록에서 계산되는데 값만 있었다(D-069는 `/admin`의 모든 숫자에 배지를 요구한다). 이 블록은 표가 아니라 `Group`+`Row`라 열 묶음별 범례를 둘 자리가 없어서, 다른 운영자 화면과 같은 모양의 `Value`(값 + `SourceBadge source="합성"`)를 화면 안에 두었다. 실측: `예측력 / 도달군 ÷ 미도달군… / 1.61배 / 합성`.

지표 목록 표의 `출처` 열은 그대로 뒀다 — `Source`(`실측`)와 `MetricSource`(`실측(세션)`)를 맞추려면 이름을 바꿔 적어야 하고 그게 이 화면이 막으려는 drift다(기존 주석의 판단이 맞다). 나머지 소유 화면을 훑은 결과 표에는 모두 열 묶음별 범례가 이미 있었다.

### ⑤~⑦ 운영 기록 세 가지 (M6 · A-080 · M8)

- **선택지가 하나뿐이면 `Chips`를 렌더하지 않는다.** `audit.tsx`가 `useState([])`이라 **새 세션의 기본 상태가 정확히 `전체 0` 하나**였다 — 이미 선택된 채 놓인 선택 컨트롤이다(D-036·D-042가 막으려던 죽은 버튼). 실측: 기본 상태 칩 **0개**, 요금 정책을 한 번 바꾸면 **2개**(`전체 1`·`요금 정책 1`). 아래 캡션의 "기록이 생긴 분류만 위에 칩으로 보여 줘요" 문장도 칩이 있을 때만 붙인다.
- **빈 상태에서 조작을 열거하지 않는다**(D-065 ④). `요금제를 바꾸거나 문제를 등록하면 여기에 남아요` → `서비스 전체에 영향을 주는 조작을 하면 여기에 남아요`. 앞 문구는 `대리 보기`가 늘면서 이미 낡아 있었다.
- **감사 로그 시각을 `meta`에서 subtitle 맨 앞으로.** `meta`는 `inkTertiary` 3.23:1이고 시각은 판단에 쓰는 값이다(§8이 `meta`에 허용한 것은 분류다). 학부모 리포트가 정답률에 쓴 방법과 같다(§19). 실측 행: `학원 좌석 단가 ₩12,000 → ₩12,500` / `07-31 14:22 · 요금 정책 · 스코디 관리자`. `trailing`은 쓰지 않았다 — 긴 `detail`이 390에서 눌린다.

### ⑧ 콘텐츠 상세가 같은 문항을 두 번 나열했다 (M11)

`문항별 오답률`(전체 막대) 다음에 `어려운 문항 먼저 보기`(상위 5)가 **같은 값·같은 문구**로 왔다. 문법 은행 세트는 20~25문항이라 앞 섹션만 800~1,100px이고 뒤 섹션은 그 부분집합이다. 한 목록으로 합쳤다: 오답률 내림차순 · 상위 **5문항**만 보이고 `15개 더 보기`로 펼친다(`접기`로 되돌아온다). 순서는 `hardestQuestions(set, usage, 전체)`에서 그대로 오고(정렬 규칙을 화면에서 다시 쓰지 않는다) **번호는 세트에서의 원래 순서**를 지켜 운영자가 그 문항을 찾을 수 있다(실측: `7. → 9. → 15. → 20. → 14.`, 72·71·70·66·63%).

`detail-q-{questionId}` testID는 그대로다. 접힌 상태에서도 `ct_acad_1_q1`(오답률 62%, 그 세트에서 2위)이 보여 기존 E2E 단정이 유지된다.

### ⑨ 금액 열이 요금을 올린 뒤의 값을 담지 못할 폭이었다 (M15)

좌석 단가를 상한(`PRICING_LIMITS.academySeat.max` = 200,000)까지 올려 **실제로 확인**했다(376번 클릭). 실측 텍스트 폭: 학원 하나 `₩510,340,000` **104px**, 요금제 합계 `₩597,120,000` **109px**. `academies.tsx`의 열은 104px이라 **여유가 정확히 0**이었고(한 글자만 늘어도 잘린다) `billing.tsx`는 116px이었다. 두 열을 **132px**로 맞췄다. 실측: 상한에서 모든 금액 셀 `scrollWidth === clientWidth`(잘림 없음), 1280 데스크톱 열 합 742 ≤ 컬럼 960, 820 태블릿에서 문서·표 모두 가로 스크롤 없음(`820=820` · `772=772`).

### ⑩ 요금제 합계 행이 절반만 채워져 있었다 (L5)

`footer`에 `seats`가 없어 좌석 합계를 셀 곳이 없었다. `revenue.academySeatCount`를 넣었다(표의 행과 같은 집계에서 온다) — 실측 `합계 · 3,498명 · ₩35,827,200`. 규모 할인·상태는 더할 수 없는 값이라 비워 둔다.

### ⑪ 이탈 학원 고지가 학원 목록에 없었다 (A-067)

`src/features/revenue.ts`를 먼저 읽었다: `seatsByAcademy()`는 여전히 `Academy.status`를 보지 않고 **A-049는 아직 열려 있다.** 그리고 `academies.tsx`의 합계는 `revenue.ts`가 아니라 `academyUse()`에서 오므로 **`revenue.ts`를 고쳐도 그 화면은 바뀌지 않는다.** 그래서 두 화면 모두 고지가 필요하다고 판단했고, 문구를 상수로 박지 않고 **이탈 학원의 곳수와 금액을 계산해서** 말하고 그 값이 0이면 문장을 렌더하지 않게 했다 — 매출에서 이탈을 빼는 날 지울 문구가 남지 않는다. 실측(기본 정책): `이탈한 학원 1곳의 ₩528,000도 아직 이 합계에 들어가요.`(학원 목록) · 상한에서 `₩8,800,000`(요금제).

### ⑫ 운영자 문제 등록이 끝나면 개요로 튀었다 (A-069)

개요에는 `최근 등록 콘텐츠` 섹션이 없다(개편 때 지표가 그 자리를 썼다). `doneLabel="등록한 문제 보기"` + `router.replace('/admin/content/{created.id}')`로 바꾸고 `backFallback`도 `/admin` → `/admin/content`로 맞췄다(등록은 콘텐츠 화면의 행동이다, D-017). 실측: 완료 → `/admin/content/ct_new_13`(제목·분류·문항 수가 보인다) → 상세 뒤로가기 `/admin/content` → 등록을 그만둘 때도 `/admin/content`.

### ⑬ 지표 24개 표의 펼침 (M14 잔여) — 고칠 것이 없었다

`Table`이 chevron·`aria-expanded`·들여쓰기를 갖춘 뒤 1280·390에서 실제로 확인했고 **열 구성을 바꾸지 않았다.**

- 1280: 행 높이 49~55px, 표 폭 960, 가로 스크롤 없음. 390: 행 높이 49~73px(가장 긴 수식 `일 신규 활성 ÷ 일 이탈률 (일 이탈률 = 28일 이탈 ÷ MAU ÷ 28)`이 73px = 3줄), 표 폭 358 = 컬럼 폭, **가로 스크롤 없음**. 세 열(지표 132 · 수식 flex · 출처 64)이 390에서도 다 보인다.
- 캡션(`행을 누르면 무엇을 뜻하는지와 가짜 상승 경로를 볼 수 있어요`)은 **여전히 필요하다** — chevron은 "펼칠 수 있다"만 말하고 무엇이 나오는지는 말하지 않는다. 펼친 뒤 `aria-expanded="true"` 확인.

### 검증

- `npm run typecheck` 통과 · `npm run lint` **오류 0 · 경고 6**(기준선 5 + 다른 작업이 만든 `__tests__/zzprobe.test.ts`의 미사용 disable 1건. 이번 변경이 만든 경고는 0)
- `npm test` **124건 통과**(8스위트). 이번 변경으로 고친 테스트 없음
- `npx playwright test` **444 passed / 6 failed**(450건, 3뷰포트, 5.0분). 실패 6건은 **전부 같은 단정 하나**다 — `e2e/admin-flow.spec.ts:34`의 `await expect(page).toHaveURL(/\/admin$/)`(헬퍼 `createGrammarSet`)이 ⑫로 `/admin/content/ct_new_13`이 된다. `e2e/`는 이 작업의 소유가 아니라 고치지 않고 보고했다(바꿀 값과 함께). 그 밖의 회귀는 없다
- 화면 확인(`expo export` + `serve`, 1280 · 820 · 390 + 다크): `docs/evidence/admin-academies-sort.png` · `admin-academies-max-seat.png` · `admin-academies-tablet.png` · `admin-billing-max-seat.png` · `admin-content-wrong70.png` · `admin-content-wrong70-mobile.png` · `admin-content-detail-merged.png` · `admin-metrics-desktop.png` · `admin-metrics-milestone-source.png` · `admin-metrics-mobile.png` · `admin-metrics-mobile-expanded.png` · `admin-metrics-desktop-expanded.png` · `admin-ops-empty.png` · `admin-ops-logged.png` · `admin-new-done-detail.png` · 다크 390 `admin-academies-dark-mobile.png` · `admin-billing-dark-mobile.png` · `admin-ops-dark-mobile.png`

### 남긴 것

- **A-078**(개요 알림에 `?wrong=70` 붙이기) — 개요는 이번 소유가 아니다. 그 한 줄이 없으면 ②의 화면에 앱에서 닿을 수 없다
- **A-049**는 그대로 열려 있다. 고칠 때 `revenue.ts`의 `seatsByAcademy`와 `academies.tsx`의 `academyUse` 합계를 **함께** 봐야 한다(두 화면이 같은 이름의 합계를 다른 함수에서 얻는다)
- ②의 흐름에는 E2E를 더하지 못했다(`e2e/` 소유 아님 + 개요 링크가 아직 없어 앱 안에서 도달 불가). A-078을 닫을 때 함께 고정한다. 단위 테스트도 두지 않았다 — 임계값 파싱과 필터가 라우트 파일 안에 있고 공용 모듈로 빼는 것은 이번 범위를 넘는다
- `content/index.tsx`의 페이지 상태는 쿼리가 바뀌어도 초기화하지 않는다. 좁히는 방향으로는 항상 새 진입(개요 → 목록)이고 넓히는 방향(`전체 목록 보기`)에서는 페이지가 사라지지 않아 빈 페이지가 생기지 않는다. 목록 안에서 쿼리를 여러 번 갈아 끼우는 경로가 생기면 다시 본다
- `ops.tsx`의 `현재 요금 정책` 행(`현재 ₩12,500`)과 `이 숫자는 어디서 왔나요`의 두 값(`계정 4,186 · 반 148` · `세트 13 · 문항 189`)에는 `SourceBadge`를 붙이지 않았다. 앞은 운영자가 방금 설정한 값이고 뒤는 그 섹션 자체가 출처를 말하는 자리(각 행의 `meta`가 `메모리`·`합성`·`고정`·`가정`·`테스트 집계`)라 배지가 같은 말을 두 번 하게 된다. 시드 콘텐츠를 `합성`이라 부르는 것도 정확하지 않다(사람이 쓴 fixture다) — 배지 어휘를 늘릴지와 함께 볼 문제라 손대지 않았다

## 개요 화면과 지표 계산 — 과거 수치·해지 판정·역할별 학습 기록 (D-076)

총괄관리자 검토에서 나온 개요·지표 결함 19개를 고쳤다. 소유 파일은 `app/admin/index.tsx` · `users.tsx` · `user/[id].tsx` · `src/features/adminMetrics.ts` · `revenue.ts` · `src/data/accountMeta.ts` · `solo.ts` · `__tests__/data.test.ts`.

### ① 규모·매출 표에 과거가 없었다 (A-054, 사용자 요구 6번)

`규모` 8행 · `매출 추정` 5행 · `적재용량` 2행이 전부 `values: []`였다. `추이(12주)` 열 제목을 걸어 놓고 15칸을 통째로 비워 둔 상태였다 — 추이가 없다는 사실보다 나쁘다.

- `adminMetrics.ts`에 **stock 기반**을 더했다: `stockBase()`(모듈 캐시) → `scaleSeries()` · `moneySeries(policy)`. 재료는 이미 있었다 — `Academy.createdAt`·`churnedAt`, `createdAtOf`(=`joinDateOf`), `startedAtOf`, `canceledPersonalAt`.
- **stock과 flow를 다르게 잘랐다.** WAL·WAU는 `lastCompleteWeek()`(24주)까지, 누적 계정 수는 기준일이 속한 주(25주)까지 **as-of**로 그린다. 가입일·계약일이 모두 주 시작(월요일)에 놓여 있어 as-of 절단으로 빠지는 사람이 없고, **마지막 점이 화면의 `값`과 정확히 같다**. 단위 테스트가 규모 10개 값·매출 5개 값을 그 등식으로 고정한다.
- 실측 비용(활동 캐시가 더워진 뒤): `scaleSeries()` **38ms** · `moneySeries()` **15ms**(26주 as-of MAU 포함). 둘 다 100ms 아래이고 모듈 캐시(`stockCache`·`mauAsOfCache`)를 둬 화면을 옮겨도 다시 계산하지 않는다. 처음 호출은 활동 프로파일 4,186개 생성 비용(~700ms, 기존 비용)에 묻힌다.
- `적재용량`은 최근 4주 유입·이탈로 만드는 점 값이라 시계열을 두지 않았고, 대신 **`변화`·`추이` 열을 아예 만들지 않는다**(`rows.some((r) => r.values.length > 1)`으로 열 배열 조립). 섹션 제목이 기간을 못박는다(`적재용량 (최근 4주 유입·이탈 기준)`).
- `입력 지표`의 DAU·고착도는 점 값이라 추이 셀에 **`추이 없음`**을 글자로 적고 `변화`는 `—`, 그 뜻은 표 아래 캡션이 밝힌다.

### ② 매출이 해지한 개인 구독까지 청구했다 (A-052)

`revenue.ts:70-77`이 `a.entitlements`를 그대로 돌며 `isActiveEntitlement`를 부르지 않았다. 그래서 같은 화면이 `개인학습 구독자 N명 / 해지 M명`이라고 말하면서 MRR·ARPPU는 N+M 전원에게 청구했고, GRR 80%를 띄우면서 매출은 해지율 0%로 계산했다. `estimateRevenue`가 `isActiveEntitlement(e)`로 거르게 했다. `RevenueEstimate`의 필드 이름·형태는 그대로다(값만 바뀐다).

### ③ 개인 구독 해지가 두 소스에서 결정됐다 (A-062)

`solo.ts`가 `status: 'canceled'`를 넣고 `accountMeta.canceledPersonalAt`이 `pick('cancel:'+userId)`로 **독립적으로 다시** 10%를 해지로 정했다. 두 집합이 실측으로 거의 겹치지 않아(23 / 24 / 교집합 0) 개요는 합집합 47명을 해지로 셌고, `users.tsx`의 `planOf`와 계정 상세는 `status`만 봤다 — 같은 계정이 개요에서는 `해지`, 표에서는 `개인`, 상세에서는 `이용 중`이었다.

- `Entitlement.status`를 유일한 사실로 두고 `canceledPersonalAt`은 **날짜만** 돌려준다. `scaleStat`도 `isActiveEntitlement` 하나만 본다.
- 로그인 테스트 계정 보호(`if (account.password) return undefined`)가 지키던 것은 "화면 확인용 계정의 이용권이 사라지지 않는 것"이다. 그 보호는 `solo.ts`가 구조적으로 이미 지킨다 — 해지를 넣는 계정은 전부 생성된 개인 사용자이고 비밀번호·전화번호가 없어 로그인할 수 없다. 그 사실을 `solo.ts` 주석에 명시했다.
- **해지일을 마지막 활동일로 두면 안 됐다.** 합성 활동은 구독 해지와 무관하게 이어지므로 활동하는 해지자의 마지막 활동일이 전부 기준일 근처가 되고, 23건이 마지막 주 한 칸에 몰려 `개인학습 구독자` 추이가 절벽이 됐다(실측: 227 → 212). 시작일과 기준일 사이에 남은 기간에 비례해 결정적으로 흩뜨렸다(고친 뒤 마지막 6주: 210 · 210 · 213 · 212 · 213 · 212).

### 바뀐 숫자 (기본 정책 `DEFAULT_PRICING`)

| 값 | 이전 | 이후 |
|---|---|---|
| 개인학습 구독자 | 188명 | **212명** |
| 해지 | 47명 | **23명** |
| GRR (개인 구독) | 80% | **90%** |
| MRR | ₩41,086,500 | **₩40,459,520** |
| ARR | ₩493,038,000 | **₩485,514,240** |
| ARPPU | ₩11,009 | **₩10,908** |
| ARPU | ₩13,292 | **₩13,089** |
| 개인 매출 | ₩5,259,300 | **₩4,632,320** |
| 개인 이용권 건수 | 235건 | **212건** |
| 돈을 내는 사람 | 3,732명 | **3,709명** |

학원 매출(₩35,827,200)·좌석(3,498)·계약 좌석(3,850)은 그대로다 — **A-049는 고치지 않았다**(아래 `남긴 것`).

### ④ 학생이 아닌 계정에도 합성 학습 활동을 만들어 보여 줬다 (A-057)

`activityOf`는 역할을 보지 않는다. 그래서 원장·선생님·학부모·운영자 계정을 열면 `학습 활동`에 주별 활동일 스파크라인이 나오고 캡션이 "문항 1개 이상 답을 저장한 날"이라고 말했다 — 원장이 국어 문항을 풀었다는 뜻이다.

- `accountMeta`에 `hasLearningRecords(account)`(= `roles.includes('student')`, `gradeOf`와 같은 판정)와 `lastActiveLabelOf`를 뒀다. `lastActiveAtOf`는 반환형을 바꾸지 않고 학생이 아니면 `undefined`를 낸다(호출부는 `users.tsx`·`user/[id].tsx` 둘뿐이고 모두 이번 소유다).
- 계정 상세는 `학습 활동` 섹션 본문을 **`이 역할은 학습 기록이 없어요`** 한 줄로 대체하고 `합성` 배지도 함께 걷는다(보여 줄 합성 숫자가 없다). 활동 프로파일 자체를 만들지 않는다.
- 계정 표의 `최근 활동`은 **`해당 없음`**. D-072의 "항상 노출"과 충돌하지 않고(노출이다) 값을 지어내지 않는다 — 마스터 플랜 7절의 D-072 문장을 그 사실에 맞게 보강했다.

### ⑤~⑫ 나머지

- **A-056 출처 배지**: `users.tsx`에 `SourceBadge`를 들이고 표 위에 열 묶음별 범례(`합성 가입일 · 최근 활동 · 학년 · 고객지원 코드`)와 "실제 접속 기록이 아니에요" 한 줄을 뒀다. 개요는 알림·코호트·L7·성장·MRR 구성비에 같은 범례(`SourceLegend`, 이 화면 안에만 두는 지역 컴포넌트)를 뒀다. 셀마다 붙이지 않는다 — 좁은 열에서 값이 덮인다(D-068이 학원 표에서 정한 방법).
- **A-058 계절성**: `calendar.EVENTS`가 어느 화면에서도 import되지 않았다. 북극성 블록에 `가정한 학사 일정 기준이에요 …` 캡션과 **지금 보이는 기간의 이벤트**를 적는다(12주 뷰 실측: `6월 모평 · 기말고사`). 조사(`이`/`가`)가 마지막 이벤트 이름의 종성에 따라 갈리므로 문장을 `주가 들어 있어요`로 끝냈다(`기말고사이 있어요`가 실제로 화면에 찍혔다). `Sparkline`은 건드리지 않았다.
- **A-077 성장 표**: `rowLabel`을 주고 Quick Ratio 임계 1을 값 아래 `1 이상`·`1 미만` 글자로 말한다. 셀과 라벨이 같은 함수(`quickRatioText`)를 쓴다.
- **A-074 Quick Ratio 수식**: 섹션 캡션이 `METRICS.quickRatio.formula`를 그대로 읽는다.
- **A-063·M3 기간**: `ANCHOR_LABEL`에서 주 수를 뺐다(`2026-07-28 기준`). 토글이 닿지 않는 코호트·적재용량은 제목에 기간을 못박았다(L7은 이미 그랬다). `ANCHOR_LABEL`을 읽는 다른 세 화면(`academies`·`academy/[id]`·`metrics`)은 문장이 그대로 성립한다.
- **A-064·H4 primary**: `학원 보러 가기`를 없앴다. 목적지가 사이드바 항목이고 바로 위 알림 2행이 이미 같은 곳으로 보낸다.
- **A-065 어투**: `MetricDef.desc`·`fake` 21개를 `-어요`로 바꿨다. `metrics.tsx`는 `METRICS`를 읽기만 하므로 함께 따라온다.
- **A-066**: 성장 캡션의 `**부활**` 별표를 지웠다(`AppText`는 RN `Text`라 마크다운을 파싱하지 않는다).
- **M4 변화 표기**: `0`도 단위를 붙이고(`0%p`·`0곳`·`₩0`) `tone="secondary"`로 올렸다. 금액 행은 `+₩23,740`처럼 통화 기호를 붙인다. `—`의 뜻은 표 아래 캡션이 밝힌다.
- **A-068 L7**: `0일` 버킷을 남기고(`filter(b => b.days > 0)` 제거) 캡션에 전체 수를 적는다(실측: 학생 4,100명 중 1,255명).
- **A-067 이탈 학원 고지**: 개요에도 뒀고 **금액·좌석을 세어** 말한다(D-075 ⑥과 같은 방식). 값이 0이 되면 문장이 스스로 사라진다.
- **M10 폭**: `/admin/user/[id]`에서 `wide`를 뗐다(표가 없다).
- **A-076 뒤로가기**: `/admin/users`의 `backFallback`을 없앴다(탭 화면).
- **M8 감사 시각**: 계정 상세의 감사 로그 시각을 `meta` → subtitle 맨 앞으로 옮겼다(`ops.tsx`는 건드리지 않았다).
- **L2 북극성 숫자**: 손으로 쓴 `fontSize: 34`·`lineHeight: 40`을 `AppText variant="display"` + `tabular-nums`로 바꿨다.

### 검증

- `npm run typecheck` 통과
- `npm run lint` **오류 0 · 경고 5**(기준선 그대로: `.expo/types/router.d.ts` 1 + `src/theme/fonts.web.ts` 4)
- `npm test` **135건 통과**(7스위트). 기준선 123건 + **12건 추가**. 지운·skip한·완화한 테스트는 없다
  - 추가: 규모/매출 추이의 마지막 점 = 지금 값 · 계정 누적 단조성 · 이탈 학원이 학원 수에서 빠짐 · 해지 판정 단일 소스 · 해지일 범위 · 해지 미청구 · GRR = 실제 해지 비율 · L7 0일 버킷과 합계 · 12주 뷰의 학사 일정 · 학생 아닌 계정의 최근 활동 없음 · 학생 계정의 최근 활동 노출
- `npx playwright test` **444 passed / 6 failed**(450건, 3뷰포트, 5.1분). 실패 6건은 **이번 변경과 무관하다** — 전부 `e2e/admin-flow.spec.ts:34`의 `await expect(page).toHaveURL(/\/admin$/)`이고, 같은 시각에 다른 작업이 `app/admin/new.tsx:44`를 `router.replace('/admin/content/{created.id}')`로 바꿔(D-075 ⑧) 등록 완료 후 목적지가 세트 상세가 됐다. `/admin/user`·`/admin/users`·개요를 지나는 E2E 12건은 모두 통과한다
- 화면 확인(`expo export` + `serve` 8081, 1280 · 390 + 다크): `docs/evidence/admin-overview-desktop.png` · `admin-overview-mobile.png` · `admin-scale-desktop.png` · `admin-scale-mobile.png` · `admin-scale-dark.png` · `admin-money-desktop.png` · `admin-money-dark.png` · `admin-input-desktop.png` · `admin-input-dark.png` · `admin-cc-desktop.png` · `admin-growth-desktop.png` · `admin-north-desktop.png` · `admin-users-desktop.png` · `admin-users-dark.png` · `admin-user-parent-desktop.png` · `admin-user-director-desktop.png` · `admin-user-student-desktop.png`
  - 1280: 규모 8행·매출 5행 모두 추이선과 변화가 채워졌고 적재용량은 두 열이 없다. 390: 추이 열은 `priority: 2`라 접히고(84px 열을 더 펼치면 표가 가로로 스크롤한다) `변화`는 남는다 — 값이 화면 안에 있다
  - 개요 `개인학습 구독자 212명 / 해지 23명`과 `매출 추정`의 `MRR ₩40,459,520`이 같은 모수를 쓴다(단위 테스트가 등식으로 고정)
  - 학부모(`최민지`)·원장(`한빛 원장`) 상세에 `이 역할은 학습 기록이 없어요` 한 줄만 있고 스파크라인·`합성` 배지가 없다. 학생(`정예린`)에는 그대로 있다
  - 다크: 표 값·범례·배지·추이선 모두 읽힌다

### 남긴 것

- **A-049는 고치지 못했다.** `seatsByAcademy()`를 계약 중 학원만 세게 바꾸면 `app/admin/billing.tsx`의 학원별 청구액 표에서 이탈 행이 사라져 `상태` 열이 구조적으로 `계약 중` 하나가 되고, 그 화면의 합계(`footer = revenue.academy`)와 표에 보이는 금액이 어긋난다. `billing.tsx`는 같은 시각에 다른 작업이 편집 중이라 함께 고칠 수 없었다. 그래서 이탈을 **값과 추이 양쪽에 함께 남기고**(같은 표 안에서 값과 추이가 어긋나지 않게) 개요가 곳수·금액·좌석을 세어 밝힌다. 6절 A-049에 함께 고쳐야 하는 네 곳을 적었다
- 북극성 블록에서 `/admin/metrics`로 가는 **별도 컨트롤은 두지 않았다.** 화면 아래 `지표 사전 보기` 행이 같은 목적지라 버튼을 더 두면 A-064에서 방금 없앤 내비 복제가 된다. 대신 캡션이 "일정을 만드는 규칙은 아래 지표 사전에 적어 뒀어요"로 가리키고 그 행의 부제에 `가정한 학사 일정`을 넣었다. 검토 지적을 그대로 따르지 않은 유일한 항목이다
- **`매출 추정`의 추이는 지금 단가로 과거 규모에 값을 매긴 값이다**(과거 요금 정책 기록이 없다). 화면이 그 사실을 캡션으로 밝힌다. 실제 청구 기록이 붙으면 정책 이력을 함께 저장해야 한다
- `moneySeries`는 정책이 바뀔 때마다 26주를 다시 계산한다(15ms, `useMemo(policy)`). 정책과 무관한 부분(`stockBase`)만 캐시했다
- 개요·계정 목록의 `Table`은 여전히 **현재 페이지만 정렬**한다(A-050, 6절에 등록돼 있다)
- `입력 지표`의 DAU·고착도는 `추이 없음`으로 남겼다. 주 단위 시계열을 만들면 "그 주 마지막 날의 DAU"라는 다른 지표가 되어 이름과 값이 어긋난다

## 7/31 — `/product-review` 총괄관리자: 두 관점 병렬 검토와 합치기

### 범위와 방법

직전에 전면 개편한 `/admin` 영역을 범위로 잡았다(9라우트 + 이번에 신설한 `Table`·`Sparkline`·`Stepper`·`SourceBadge`·`ImpersonationBanner`, `adminMetrics.ts`·`revenue.ts`, 합성 데이터 5모듈, 대리 보기 세션 경계). **개편 직후라 아무것도 검토를 거치지 않은 상태였다.**

`product-manager`(요구 충족·흐름·정직성)와 `ux-auditor`(위계·가시성·부품 규칙)를 동시에 띄웠다. 두 보고에서 나온 항목을 하나로 합친 뒤 **영향이 큰 주장 네 개를 내가 코드로 직접 확인**하고 나서 수정에 넘겼다.

| 확인한 주장 | 결과 |
|---|---|
| 데스크톱 배너가 세로 띠로 무너진다 | **사실.** `RoleShell.tsx:208`의 `deskRoot`가 `flexDirection:'row'`인데 `:92`에서 배너가 그 첫 행 자식이었다 |
| 대리 보기가 읽기 전용이 아니다 | **사실.** `progress.tsx`의 쓰기 함수 16개 중 `readOnly` 검사가 **4개에만** 있었다 |
| `signIn`이 대리 상태를 지우지 않는다 | **사실.** `setAccount`·`setAcademyLinked`만 했다 |
| 매출이 해지한 개인 구독까지 청구한다 | **사실.** `revenue.ts:71-77`이 `isActiveEntitlement`를 부르지 않았다 |

### 파일 소유권을 갈라 4묶음 병렬 수정

같은 파일을 두 에이전트가 동시에 고치면 서로의 작업을 덮는다. 그래서 **파일 단위로 소유권을 갈라** 겹치지 않는 둘씩 두 번에 걸쳐 보냈고, `e2e/`는 라운드마다 한 곳만 소유하게 했다.

| 묶음 | 소유 파일 | 항목 |
|---|---|---|
| 세션·대리 보기 | `session.tsx`·`progress.tsx`·`academy.tsx`·`content.tsx`·`audit.tsx`·`ImpersonationBanner`·`RoleShell`·`AccountSettings`·`app/_layout.tsx`·`user/[id].tsx` | 11건 (D-073) |
| 공용 표 | `Table.tsx`·`SourceBadge.tsx` | 8건 (D-074) |
| 개요·지표 | `admin/index.tsx`·`users.tsx`·`user/[id].tsx`·`adminMetrics.ts`·`revenue.ts`·`accountMeta.ts`·`solo.ts` | 19건 (D-076) |
| 학원·요금제·콘텐츠 | `academies`·`academy/[id]`·`billing`·`ops`·`content/*`·`new`·`metrics` | 13건 (D-075) |

각 묶음의 상세는 위의 네 절에 있다.

### 소유권 때문에 남은 것을 내가 적용했다

에이전트가 자기 소유 밖이라 고칠 수 없다고 보고한 3건이다.

1. **A-078 닫음** — `app/admin/index.tsx`의 `오답률 70% 이상 문항` 알림 `href`를 `` `/admin/content?wrong=${HARD_WRONG_RATE}` ``로. 콘텐츠 목록은 이미 `?wrong=N`을 받게 고쳐졌지만 **앱에서 그 화면에 닿을 길이 없었다.**
2. **E2E 단정 2건** — `admin-flow.spec.ts`의 헬퍼 `createGrammarSet`이 `toHaveURL(/\/admin$/)`을 단정했는데 등록 완료 목적지가 세트 상세로 바뀌었다(D-075 ⑧) → `/\/admin\/content\/ct_new_\d+$/` + 제목 가시성. 그리고 `로그아웃`은 개요에만 있으므로(A-082) 그 앞에 개요로 가는 이동을 넣었다. 낡은 주석도 갱신했다.
3. **E2E 1건 추가** — 알림 클릭 → `?wrong=70` 좁힘 → `점검 문항` 열 → `전체 목록 보기`로 복귀. A-078이 다시 열리면 이 테스트가 잡는다.

### 화면에서 직접 확인한 것

에이전트는 각자 자기 영역만 봤다. **합쳐진 상태**를 preview 빌드로 확인했다.

| 확인 | 결과 |
|---|---|
| 1280 첫 화면 가시성 | `확인이 필요해요` 제목 **y=429**, 알림 4줄이 768 안에 들어온다. 개편 전에는 추정값만 481까지 있고 할 일은 접힌 선 아래였다 |
| 1280 가로 넘침 | `scrollWidth 1280 = clientWidth`. 없다 |
| `규모` 8행 추이 | **8행 전부 스파크라인·변화·출처 배지**(`추이 없음` 0행) — 사용자 요구 6번이 실제로 채워졌다 |
| primary 제거 | `학원 보러 가기` 없음(A-064) |
| 마크다운 별표 | 본문에 `**` 없음(A-066) |
| 390 하단 탭 6칸 | 칸당 62px, `운영 기록` 라벨 48px — **잘리지 않는다**(ux-auditor가 계산으로 여유 5px이라 실측을 요청한 항목) |
| 390 가로 넘침 | 문서·표 모두 없다. `규모` 표는 `지표/값/변화` 3열로 접히고 8행 전부 값·변화가 있다 |
| 다크 | 표 값·변화·스파크라인·배지 모두 읽힌다 |
| `이탈 증가`의 색 | `churn +10명`이 `rgb(224,113,90)`(danger) — `LOWER_IS_BETTER`가 의도대로 동작한다 |

### 내가 직접 고친 문구 1건

`규모` 표의 수식 두 줄이 **내부 필드명을 화면에 노출**하고 있었다 — `academyRole이 director인 학원 역할 계정 수`. 다크 스크린샷에서 발견했다. `학원에서 원장으로 등록된 계정 수` / `학원에서 선생님으로 등록된 계정 수`로 바꿨다(`src/features/adminMetrics.ts`).

### 검증 (합쳐진 최종 상태)

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | **오류 0 · 경고 5**(기준선 유지. 구성이 바뀌었다 — `content.tsx` 1건이 사라지고 `.expo/types/router.d.ts` 1건이 들어왔다) |
| `npm test` | **135건 통과 / 7스위트**(기준선 112 → 135, 새 `table.test.tsx` 11건 + `data.test.ts` 12건) |
| `npx playwright test` | **453건 전부 통과**(3뷰포트, 4.5분. 기준선 426 → 453) |
| `admin-flow` 재확인 | 66/66 (문구 수정 후) |

**고친 기존 테스트는 하나도 없다.** 위 E2E 2건은 의도한 목적지 변경(D-075 ⑧)을 따라간 것이고 그 이유를 주석에 적었다.

### 남긴 것

- **A-079 · A-080**을 `결정 대기`(M9-08 · M9-09)로 올렸다. 앞은 대리 보기의 대상 역할을 제한할지(학부모 대리가 자녀 기록 전부를 연다 — 확정 정책 2절과 맞닿는다), 뒤는 팔레트에 상시 고지 면 토큰을 둘지(배너 면이 본문과 1.09:1인데 `danger`는 쓸 수 없다). **둘 다 사람이 정할 일이라 고치지 않았다.**
- **A-081**(`/admin/user/[id]`에서 사이드바 활성 표시가 없다 — 라우트를 `users/[id]`로 옮겨야 하고 링크·E2E를 함께 봐야 한다) · **A-082**(`RoleShell.onSignOut`이 죽은 prop이라 로그아웃이 개요에만 있다 — 네 역할이 함께 걸리고 잘못 손대면 관리자가 로그아웃할 수 없다) · **A-083**(공용 `Toggle` 34px) 신설.
- **A-049**는 열려 있다. `estimateRevenue`의 개인 구독 해지는 걸렀지만 `seatsByAcademy()`가 여전히 이탈 학원 좌석을 센다. 세 화면이 곳수·금액을 **세어서** 밝히고 0이면 문장을 렌더하지 않으므로, 어느 쪽으로 고쳐도 낡은 문구가 남지 않는다.
- 개편으로 바뀐 숫자: 개인학습 구독자 188 → **212명** · 해지 47 → **23명** · GRR 80 → **90%** · MRR ₩41,086,500 → **₩40,459,520**. 해지를 두 소스가 각자 정하던 것을 `Entitlement.status` 하나로 모은 결과다(D-076 ②).

## 7/31 — 선택 UI를 `SegmentedControl` 하나로 통일 (D-077)

### 요청과 실제 상태의 차이

요청은 "계정 관리의 필터 칩을 4주/12주/26주 토글 디자인으로 바꾸고, 같은 패턴을 프로젝트 전체에서 교체하고, 공통 컴포넌트로 만들라"였다. 조사해 보니 **그 토글은 이미 공통 컴포넌트였다**(`src/components/Toggle.tsx`, `app/admin/index.tsx:181`). 그래서 새로 만들지 않고 **기존 `Toggle`을 표준으로 승격해 `SegmentedControl`로 옮기고 `Chips`를 흡수해 삭제**했다.

**이 변경은 `DESIGN.md` §8의 확정 규칙을 뒤집는다** — "걸러내는 것은 `Chips`, 보기 전환은 `Toggle`, 둘을 섞으면 무엇이 바뀌는지 읽히지 않는다". 사용자에게 확인하고 진행했고 문서를 함께 고쳤다(D-077).

### 사용자가 정한 것 세 가지

| 물은 것 | 답 |
|---|---|
| 옵션이 한 줄을 넘칠 때 | **트랙 안에서 줄바꿈**(가로 스크롤 아님 — 오른쪽 옵션이 안 보이면 있는 줄도 모른다) |
| 필터가 아닌 폼 선택(정답 보기·세부 유형·마감 빠른 선택)도 바꿀지 | **전부 교체하고 `Chips` 삭제** |
| 통일 높이 | **현재 `Toggle` 그대로 34px**(44px 규칙의 예외를 감수) |

### 컴포넌트에서 실제로 바꾼 것 (셋뿐)

`Toggle` → `SegmentedControl`로 옮기면서 바꾼 것은 세 가지고, 선택 표현·색·폰트·눌림·`accessibilityRole`·testID 규약은 **한 글자도 건드리지 않았다**.

| 항목 | 전 | 후 | 이유 |
|---|---|---|---|
| 옵션 타입 | `{ value, label }` | `{ value, label, count? }` | `Chips`의 개수 표기를 흡수(`` `${label} ${count}` ``, 렌더 방식도 동일) |
| 줄바꿈 | 없음(넘침) | `flexWrap: 'wrap'` | 모바일 390에서 `users-plan` 한 줄 폭이 500px대였다 |
| 트랙 radius | `pill(999)` | `card(22)` | 한 줄이면 트랙 높이의 절반(18.5)으로 잘려 **알약과 픽셀 동일**, 두 줄부터 거대한 알약 대신 둥근 사각형 |

치수는 `src/theme/tokens.ts`의 **`control`** 하나로 모았다(`trackPadding`·`gap`·`paddingX`·`paddingY`·`trackRadius`·`itemRadius`·`labelSize`). 하드코딩돼 있던 `padding: 3`·`gap: 3`이 여기로 들어갔다. 애니메이션은 **넣지 않았다** — 기존 토글에 없었고 "4주/12주와 동일"이 기준이다.

### 교체 24곳

- **기존 `Toggle` 5곳** 이름만 바뀜: 개요 기간, 결과·학부모 리뷰 범위, 풀이 모드, 소개 페이지 방문자 유형
- **`Chips` 18곳** → 목록 필터 12(계정 역할·이용권, 운영 기록 분류, 콘텐츠 영역 ×2, 반, 제출·반·과제·메모, 배정 학년·출처) · 폼 입력 6(유형·학년·영역·세부 유형·정답 보기·마감 빠른 선택) · 대상 전환 1(자녀 고르기)
- **손으로 그린 칩 1곳**: `app/student/notebook.tsx`의 영역 필터. `accessibilityState`가 없고 `minHeight`도 없어 **접근성이 오히려 좋아졌다**. `areaFilter`를 `string | null`에서 `'all' | 영역`으로 바꿔 testID(`note-area-all`·`note-area-문학`)를 그대로 지켰다.
- **소개 페이지의 정지 미리보기**(`WebLanding`의 `PickMock`)도 같은 모양으로 맞췄다. 누를 수 없는 장식이라 컴포넌트를 쓰지 않고 `control` 토큰만 참조한다 — 소개 화면이 실제 앱과 다른 UI를 광고하지 않게.
- 이름이 낡은 식별자도 함께 정리: `CHIP_MAX` → `SEGMENT_MAX`, `useChips` → `useSegments`, `dueChips`/`memoChips` → `dueOptions`/`memoOptions`.

### 실측 (브라우저 계산 스타일, 라이트)

| 위치 | 모바일 390 | 데스크톱 1280 |
|---|---|---|
| `admin-range` (4·12·26주 · **기준점**) | 180×37 · 1줄 | 180×37 · 1줄 |
| `users-role` (5칸) | 358×72 · **2줄** | 419×37 · 1줄 |
| `users-plan` (4칸 · 최장 라벨) | 358×72 · **2줄** | 467×37 · 1줄 |
| `new-topic` (문법 9칸 · 최장 17자) | 358×140 · **4줄** | 960×72 · 2줄 |
| `new-q0-answer` (보기 4) | 276×37 · 1줄 | 276×37 · 1줄 |

칸 높이는 어디서나 **31px**, 트랙은 **37px**로 같다. `admin-range`가 변경 전과 같은 값이라 기준점이 흔들리지 않았음을 확인했다. 다크에서도 트랙 `offset #132a2a` / 선택 면 `surface #0e1f1f` + accent 글자로 읽힌다(스크린샷 확인).

### 검증

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | **오류 0 · 경고 5**(기준선 그대로. 전부 `.expo/types/router.d.ts`·`fonts.web.ts`로 이번 변경과 무관) |
| `npm test` | **139건 통과 / 8스위트**(기준선 135/7 → 새 `__tests__/segmented.test.tsx` 4건) |
| `npx playwright test` | **453건 전부 통과**(3뷰포트, 4.6분). 기준선과 같은 수 |
| 화면 | `/admin`(기준점) · `/admin/users` 라이트·다크 · 문제 등록 폼을 **모바일 390 / 데스크톱 1280**에서 확인 |

**기존 테스트는 하나도 고치지 않았다.** e2e가 전부 `getByTestId('users-role-parent')` 같은 testID 규약이나 `getByRole('button', { name: '정예린' })`을 쓰는데, 두 규약을 그대로 유지했기 때문이다. `note-area-*`를 클릭하는 `student-flow.spec.ts:815`도 수정 없이 통과했다.

### 남긴 것

- **`app/student/notebook.tsx`의 필터는 스크린샷을 남기지 못했다.** 오답을 서로 다른 영역으로 두 개 이상 담아야 렌더되는데(`areas.length > 1`) 스크립트로 그 상태를 만들지 못했다. 컴포넌트 자체는 다른 5개 화면에서 확인했고, 이 화면은 `student-flow.spec.ts:815`(`note-area-*` 클릭)가 통과하는 것으로만 확인했다.
- **A-083을 P3 → P2로 올렸다.** 44px 미달이 예전에는 5곳이었는데 이제 **선택 컨트롤 24곳 전부**다. 34px 유지는 사용자 결정이고 `DESIGN.md` §10에 예외로 적어 뒀다. 고칠 때는 `control.paddingY` 한 곳만 바꾸면 24곳이 함께 올라간다.
- **줄바꿈된 트랙은 마지막 줄 오른쪽에 빈 트랙이 남는다**(모바일 `users-role`의 `운영자 1` 뒤). `alignSelf: 'flex-start'`가 컨테이너 폭까지 늘어나기 때문이다. 지금은 한 덩어리로 읽혀서 그대로 뒀다.

---

## 학원 대시보드 개편과 배정 이력 합성 데이터 (D-078 ~ D-082)

사용자 지시: `대시보드에 뭐가 없어도 너무 없고 가시성도 떨어진다` · `그래프와 숫자가 가장 중요하다` · `카드형식 진짜 싫다` · `반 전체보기 들어갔을 때 뒤로가기 버튼이 없는 것도 매우 이상하다` · `전체 학생을 보는 것도 중요하다` · `아마 가데이터를 더 만들어야 하겠지`.

### 무엇이 문제였나 (읽고 확인한 사실)

1. **데이터가 없었다.** 배정 4건 · 제출 27행 · 제출일이 있는 행 4개. 원장 계정의 한빛학원은 반 122개인데 **데이터가 있는 반이 2개**였다. 무엇을 그려도 추이선의 점이 4개도 안 나온다. 오늘(2026-07-31) 기준 시드 마감일이 전부 지나서 선생님 대시보드는 `오늘 마감 0개`만 떴다.
2. **집계에 시간 축이 없었다.** `academyStats.ts`의 함수 6개가 전부 기간 인자 없는 스냅샷이라 `지난달보다 나아졌나`에 답할 화면이 학원 전체에 없었다.
3. **비교할 수 없는 형태였다.** 학원 화면 11개가 전부 `Screen wide`(960)인데 `Table`·`Sparkline`을 **한 번도 쓰지 않았다**. 값은 `제출 3/9 · 평균 82%`처럼 `·`로 이어 붙어 행마다 x좌표가 달라 위아래 비교가 불가능했다(`Table.tsx:14-15`가 이미 결함으로 적어 둔 형태).
4. **뒤로가기.** 탭 라우트로 `push`하는 곳이 6군데, 사이드바 활성 메뉴가 0개인 라우트가 3개(`class/[id]`·`students`·`new`).

### 한 것

- **`src/data/assignmentHistory.ts` 신설**(D-079). 배정 777건 · 제출 17,247행 · 생성 141ms(실측). `c_kor1`·`c_kor2`는 건드리지 않았다.
- **`academyStats.ts` 확장**(D-078): `scopedAssignments`·`byClass`·`weeklySeries`·`lastCompleteWeek`·`deltaOf`·`areaBreakdown`·`accuracyDistribution`·`gradeBreakdown`·`hardestQuestions`·`studentSummaries`·`studentPerformance`. 기존 6개는 손대지 않았다.
- **대시보드 전면 교체**(`app/academy/index.tsx`), **반 목록·학생 목록을 표로**, **학생 상세 신설**(D-080), **라우트 이동**(D-081), **`Table` 제어형 정렬**(D-082), **`StatTiles` 삭제**.
- **`AcademyClass.grade` 신설.** 반 이름(`고2 국어 3반`)을 파싱하지 않는다 — `renameClass`로 이름을 바꾸는 순간 깨진다.
- **`useAcademyStaff().studentInScope`** 신설. 학생 상세의 권한을 화면 숨김이 아니라 함수 안에서 판단한다.

### 실측으로 고친 것 세 가지

1. **생성 404ms → 141ms.** `dateOfIndex`가 부를 때마다 `Date`를 두 개 만들어 제출 행 1.7만 개에서 그 비용이 대부분이었다. 날짜 표를 미리 만들고, 값마다 `pick`을 부르던 것을 `digits(seed, 64, 5)` 하나로 나눠 쓰고, 학생별 성실도·실력을 계정 단위로 캐시했다.
2. **정답률 분포가 들쭉날쭉했다.** 학생 아이디가 `u_rs_0001`처럼 뒤 네 자리만 달라 FNV-1a 결과가 좁게 움직였다(`hash.ts`가 적어 둔 성질 그대로). 아이디를 **뒤집어서** 씨앗에 넣으니 균일해졌다 — 625명 10구간 `55,47,77,29,93,47,94,84,44,55` → `65,53,63,66,60,76,66,61,56,59`.
3. **추이선 마지막 점이 늘 바닥이었다**(`72,75,73,75,69,68,71,16`). 진행 중인 이번 주가 들어갔기 때문이다. `lastCompleteWeek`로 끝난 주까지만 그린다.

### E2E가 알려 준 제품 결함

라우트 이동과 데이터 증가로 `academy-flow` 21건이 **시간 초과**로 실패했다. 원인을 보니 테스트만의 문제가 아니었다.

- 배정이 419건인데 **과제를 이름으로 찾을 길이 없었다** → 성과 분석에 `submit-search`를 더했다.
- 확인이 필요한 학생이 585명인데 **학생을 이름으로 찾을 길이 없었다** → `need-search`를 더했다.
- `전체` 필터의 기본 정렬이 마감 이른 순이라 **반년 전에 지난 배정이 늘 맨 위**였다 → `전체`는 최근 마감 순, 좁힌 필터는 이른 마감 순으로 갈랐다.
- 합성 배정이 콘텐츠 제목을 그대로 써서 **콘텐츠 하나를 찾으면 수백 건이 함께 걸렸다** → `4월 3주 문법 점검` 형식으로 바꿨다.

이 넷을 고친 뒤 `academy-flow` 14건이 데스크톱에서 10.1초에 통과했다(고치기 전 6.1분 · 21건 실패).

### 검증

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | **오류 0 · 경고 4**(전부 `src/theme/fonts.web.ts`의 `require()` — 기준선 그대로) |
| `npm test` | **165건 통과 / 9스위트**(기준선 139/8 → 새 `__tests__/academyStats.test.ts` 24건 + `data.test.ts` 2건) |
| `npx playwright test` | **453건 전부 통과**(3뷰포트, 6.0분). 기준선과 같은 수 |
| 화면 | 원장·선생님 대시보드, 반 목록, 학생 목록, 학생 상세를 **390 / 820 / 1280**에서 확인. 대시보드는 라이트·다크 둘 다 확인 |
| 성능 | 합성 데이터 생성 141ms(1회) · 원장 계정 집계 29ms · 선생님 계정 2~4ms(실측) |

**기존 테스트를 약화하지 않았다.** 고친 단정은 두 종류뿐이다 — ① `data.test.ts`의 담당 반 목록(fixture를 의도적으로 바꿨으므로 새 목록과 개수를 그대로 단정하고, 학년이 섞이지 않는다는 단정을 **더했다**) ② `academy-flow`에서 목록을 좁히는 단계 추가(단정 문구는 그대로다). `report.test.ts` 45건은 한 줄도 고치지 않고 통과한다 — 학부모 리포트가 흔들리지 않았다는 뜻이다.

### 남긴 것

- **`academy-kpi` testID는 유지했다.** 타일에서 표로 바뀌었지만 "대시보드의 지표 블록"이라는 뜻은 같아서 E2E 단정을 살렸다.
- **`화법과 작문`은 영원히 빈 막대다.** 콘텐츠가 0세트다(S-011). 막대를 지우지 않고 `콘텐츠 없음`이라고 적었다.
- **`가장 이른 마감 2월 4일`처럼 반년 전 미제출이 알림에 뜬다.** 합성 데이터가 26주치라 사실이지만, 실제 학원이라면 그 전에 정리했을 것이다. 데이터의 성격이지 화면의 결함은 아니라고 보고 두었다.
- **admin의 `Table` 정렬은 아직 페이지 안에서만 일어난다**(A-050). D-082의 제어형 정렬을 학원 두 화면에만 적용했다.
- **성과 분석·반 상세·문제 목록은 표로 바꾸지 않았다.** 사용자가 이번 범위를 대시보드+반+학생으로 정했다.

---

## 7/31 — 학생 상세 검토 지적 6건 (D-083 · Q-037)

범위는 `app/academy/classes/student/[id].tsx` **한 파일**이다(나머지는 같은 시각 다른 작업이 손대고 있었다).

### 고친 것

1. **마감일을 비워 두고 `다시 배정하기`를 누르면 마감이 지워졌다**(Critical). `parseDueDate(due, today)`를 옵션 없이 불러 **빈 입력이 `{ok:true, value:undefined}`로 통과**했고(`src/features/learning.ts:60`) `reassign(id, '')`가 `dueDate`를 비웠다. 그러고도 토스트는 `마감일을 다시 정했어요`였다. 마감이 빈 배정은 `overdueAssignments`·`dueSoon`에서 빠져 **재배정 버튼이 다시는 나타나지 않는다** — 되돌릴 자리가 없다. 성과 분석과 **같은 검사**로 맞췄다: `{ allowToday: false }` + 빈 값은 `새 마감일을 적어 주세요.`(D-083).
2. **`가장 최근 배정`이 실제로는 가장 오래된 배정이었다**(Critical). `mine`은 정렬되지 않은 원본 순서라 `mine[0]`은 합성 데이터의 26주 전 배정이다. 같은 화면의 이력 표는 제대로 최신순이라 한 화면이 반대 순서를 근거로 말했다. **그 행을 지웠다** — 같은 값을 `낸 과제` 표의 `반 평균 대비` 열이 배정마다 이미 정확히 말한다. 섹션 이름도 사실에 맞게 `반에서 이 학생은` → `소속 반`으로 바꿨다(이제 반 링크만 있다).
3. **`반 평균 대비`가 모바일·태블릿에서 먼저 접혔다**(High). `priority: 3` → 기본(1)로 올려 늘 보이게 하고, `제출일`을 `priority: 3`으로 내렸다. 실측: 390에서 `과제 · 정답률 · 반 평균 대비`, 820에서 `과제 · 마감 · 정답률 · 반 평균 대비`.
4. **재배정 패널이 대상 행에서 멀었고 설명이 없었다**(Medium). 패널을 **누른 행 바로 아래**로 옮기고 성과 분석의 두 문장을 그대로 가져왔다. 이 화면은 학생 한 명으로 좁혀 보는데 실제 대상은 반 전원이라, 첫 줄에 `{반 이름} 전체가 받은 과제예요.`를 더하고 버튼 라벨을 `이 과제의 반 마감일 다시 정하기`로 바꿨다(열면 `접기`, `analytics.tsx`와 같은 토글·아이콘).
5. **`마감일이 있는 과제만 세요`가 거짓이었다**(Medium). `studentPerformance`의 `pending`은 `submitted === false`인 **모든** 배정이다. 부제를 사실로 바꿨다 — 배정이 없으면 `아직 배정받은 학습이 없어요`, 다 냈으면 `배정받은 것을 모두 냈어요`, 마감이 없으면 `아직 마감일이 정해지지 않았어요`, 마감일 없는 건이 섞여 있으면 `가장 이른 마감 7월 24일 · 마감일 없는 과제 2건 포함`.
6. **오답 메모 본문이 값 자리(`trailing`)에 있었다**(Medium). `trailing`은 짧은 값의 자리다(DESIGN.md §20 · D-070). 메모를 행 **본문 아래 블록**으로 옮기고 폭 제약(`maxWidth: 320`)을 없앴다. 라벨은 성과 분석의 `NoteCard`와 같은 `학생이 AI와 정리한 메모`다.
7. **추이에 시간 축이 없었다**(Medium). `perf.rows`가 들고 있는 제출일로 캡션 한 줄을 더했다 — `7월 19일에 낸 것부터 7월 25일에 낸 것까지예요.` 추이 값 자체는 `perf.trend` 그대로이고 화면에서 다시 만들지 않았다(D-061).

`missing`은 화면에서 세지 않고 `submitStat(a)`에서 받는다(D-061). 새 컴포넌트·새 색은 만들지 않았다(`Group`·`Row`·`Button`·`Field`·`Icon`·`Table`·`RichText` + `colors.*`·`spacing`).

### 고치다가 발견했지만 손대지 않은 것

- **`영역별 정답률`이 학생이 아니라 반 전체를 센다**(Q-037로 남겼다). `areaBreakdown`이 배정의 **모든 제출**을 돌기 때문에, 한 건도 내지 않은 박도윤의 화면에도 `문학 76% · 80문항`이 뜬다(같은 화면의 `평균 정답률`은 `—`다). 고치려면 `src/features/academyStats.ts`를 손대야 해서 이번 범위 밖이다.

### 검증

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | **오류 0 · 경고 5**(`src/theme/fonts.web.ts` 4 + `.expo/types/router.d.ts` 1 — 기준선 그대로). 고친 파일은 경고 0 |
| `npm test` | **165건 통과 / 9스위트**(변경 없음 — 이 화면을 덮는 단위 테스트는 없다) |
| `npx playwright test` | **462건 통과**(3뷰포트). 새 `e2e/academy-student.spec.ts` 9건 포함 |
| 화면 | `/academy/classes/student/...`를 **390 / 820 / 1280** + 다크에서 확인. `docs/evidence/academy-student-{desktop,tablet,mobile}.png` · `-history-*`(낸 과제 4건) · `-table-*`(표 열) · `-notes-*`(메모 블록) · `-reassign-*`(패널 위치) · `-dark.png` |

**새 E2E 3건을 더했다**(`e2e/academy-student.spec.ts`) — 이 화면에는 테스트가 하나도 없었다. ① 빈 마감일을 막고 **마감이 그대로 남는지**(고치기 전 코드로 되돌려 실패하는 것을 확인했다) ② `반 평균 대비` 열과 추이 기간 문장, `가장 최근 배정`이 사라진 것 ③ `소속 반` → 반 상세 이동. 기존 테스트는 한 줄도 고치지 않았다.

### 남긴 것

- Q-037(영역별 정답률의 집계 대상)이 이 화면의 남은 사실 오류다.
- `학생이 AI와 정리한 메모` 라벨은 성과 분석과 같은 문장을 쓴 것이라 D-054 범위 안이다. 개인 학습 오답과 메모는 여전히 열지 않는다.

## 7/31 — 학원 웹 검토 지적 7건 (D-084)

범위는 네 파일이다: `app/academy/classes.tsx` · `app/academy/classes/students.tsx` · `app/academy/analytics.tsx` · `app/academy/assign.tsx`. 집계는 손대지 않았다(D-061 — `src/features/academyStats.ts` 그대로).

### 고친 것

1. **좁힘 배너가 필터와 다른 조건·다른 수를 말했다**(High, `analytics.tsx`). `마감이 지났는데 안 낸 학생이 남은 배정 ${overdueCount}개`라고 적었는데 `overdueCount`는 `a.dueDate < today` **전부**라 "안 낸 학생이 남은"을 세지 않았고, 대시보드의 `overdueAssignments`(missing > 0)와도 갈렸다. 실측: 한빛 원장 대시보드 알림 **380개** → 성과 분석 필터 **383개**. 이제 배너는 `taskRows.length`(지금 필터를 적용한 결과)를 말하고 문장도 필터 라벨과 같다 — `대시보드에서 넘어왔어요. 마감이 지난 배정 383개만 남겼어요.` / 선생님 경로는 `오늘·내일 마감인 배정 2개만 남겼어요.`(세그먼트 `오늘·내일 마감 2`와 일치). 반·과제 검색으로 더 좁혀도 참이다.
2. **선생님이 보는 합계 행이 `학원 전체`인데 값은 담당 반 합계였다**(High, `classes.tsx`). 오선생 화면 실측: `학원 전체 · 84명 · 1,234건 · 59% · 66%`(실제 한빛학원은 3,002명). 라벨만 역할로 갈랐다 — 원장 `학원 전체`, 선생님 `담당 반 합계`. **값은 그대로 뒀다**(선생님에게 담당 밖 집계를 여는 것은 3절 권한 문제라 이번 범위가 아니다).
3. **학생 전체 보기에서 `반` 열이 390에서 접혔다**(High, `classes/students.tsx`). 이 화면의 목적이 "이름만 아는 학생이 어느 반인지"인데 모바일에 남는 열이 `이름`+`안 낸 과제`뿐이었고, 접은 뒤 폭 184px < 컬럼 358px이라 **자리가 남는데도** 접혔다. `반`을 `priority: 1`로 올리고 `안 낸 과제`를 2로 내렸다.
4. **표의 어떤 행이 눌리는지 화면이 말하지 않았다**(High, 두 파일). 반 목록·학생 목록 마지막에 이동 표시 열(`go`, 24px, `chevron-right` `inkTertiary`)을 더했다 — 대시보드 반별 현황 표와 같은 형태이고 `priority`가 없어 390에서도 보인다. 반 목록 캡션에 `행을 누르면 반 상세로 가요.`를 더했다(학생 목록에는 이미 같은 문장이 있다).
5. **같은 목적지를 세 이름으로 불렀다**(Medium, `classes.tsx`). 버튼 라벨을 `학생 찾기` → `학생 전체 보기`로 맞췄다(대시보드와 같은 말). 아이콘은 이미 `users`였다. `class-goto-students` testID는 그대로다.
6. **배정 빈 상태에 다음 행동이 없었고 원장에게 `담당 반`이라고 말했다**(Medium, `assign.tsx`). 대시보드 알림과 같은 문구로 역할을 갈랐다 — 원장 `아직 등록된 반이 없어요.` + `반을 만들고 학생을 넣으면 학습을 배정할 수 있어요.` + `반 만들러 가기`(`assign-goto-classes` → `/academy/classes`, `router.navigate`), 선생님 `담당하는 반이 아직 없어요.` + `원장이 반을 배정하면 여기에 보여요.`(버튼 없음 — 선생님이 할 수 있는 일이 아니다).
7. **목록 안의 `마감일 다시 정하기` 두 곳이 32px이었다**(Medium, `analytics.tsx`). 같은 행동이 반 상세·학생 상세에서는 44px(`styles.tap`)이다. 두 버튼에 `height: 44`를 줬다. 섹션 제목 옆 action 버튼은 건드리지 않았다.

새 컴포넌트·새 색 리터럴은 만들지 않았다(`Table`·`Icon`·`Button`·`Group`·`Row`·`AppText` + `colors.*`·`spacing`). 기존 testID는 전부 유지했다.

### 검증

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | **오류 0 · 경고 5**(`src/theme/fonts.web.ts` 4 + `.expo/types/router.d.ts` 1 — 기준선 그대로) |
| `npm test` | **170건 통과 / 9스위트**(변경 없음) |
| `npx playwright test e2e/academy-flow.spec.ts` | **42건 통과**(3뷰포트 × 14) |
| 화면 | 원장·선생님 두 계정으로 **1280 / 820 / 390** + 다크 확인. `docs/evidence/academy-analytics-narrowed-overdue.png`(383개) · `-narrowed-soon-dark.png` · `academy-classes-footer-teacher.png`(`담당 반 합계`) · `academy-classes-goto-{desktop,mobile}.png` · `academy-students-class-{mobile,tablet,dark}.png` · `academy-assign-empty-{director,teacher}.png` |

빈 상태(6번)는 반이 0개인 fixture 계정이 없어 `classes.length` 분기를 잠깐 강제해 두 역할을 캡처하고 되돌렸다(diff에 남지 않았다).

### 남긴 것

- **E2E를 더하지 못했다.** 이번 지시가 네 파일로 범위를 제한해(`e2e/`는 다른 작업이 손대는 중) 스펙 파일을 건드리지 않았다. 다음에 `e2e/academy-flow.spec.ts`에 두 건을 더할 것: ① 대시보드 `마감이 지난 미제출 N개` → 배너의 수 = `submit-filter`의 `마감 지남` 수 = 목록 길이가 서로 같은지 ② 선생님 계정 반 목록에 `담당 반 합계`가 있고 `학원 전체`가 없는지.
- 성과 분석 세그먼트의 `마감 지남` 수(`overdueCount`)는 반·과제 검색을 반영하지 않는다 — 세그먼트가 "다른 필터로 바꾸면 몇 개가 되는지"를 말하는 자리라 그대로 뒀다. 배너만 목록 길이를 말한다.
- 선생님에게 학원 전체 기준선을 보여 줄지는 열지 않았다(2번). 권한 결정이라 `결정 대기` 후보다.

## 7/31 — 학생 상세 집계 오류와 학원 응답의 권한 경계 (D-085 · Q-037 닫음)

지시: `src/features/academyStats.ts` · `src/features/progress.tsx` · `app/academy/classes/student/[id].tsx` **세 파일만** 고친다.

### 고친 것

1. **학생 상세의 `영역별 정답률`이 그 학생이 아니라 반 전체를 셌다**(High, Q-037). `areaBreakdown`은 넘겨받은 배정의 **모든 제출 행**을 돌았다. 화면은 배정을 "그 학생이 받은 것"(`mine`)으로 좁혀 넘겼지만 배정은 반 단위라 그 안에 같은 반 다른 학생의 제출 행이 함께 있다 — 좁히는 것으로는 막을 수 없었다. `areaBreakdown(assignments, sets, studentId?)`로 선택 인자를 더했고(`s.studentId !== studentId`면 건너뛴다), 학생 상세만 `studentId`를 넘긴다. **대시보드(`app/academy/index.tsx`)는 인자를 주지 않으므로 값이 그대로다** — 시드 전체로 `areaBreakdown(ALL, SEED_CONTENT)`와 `(…, undefined)`가 같은지 테스트로 고정했다.
   실측(한빛 원장 → 박도윤, 제출 0건): 고치기 전 `문학 76% · 80문항` → 고친 뒤 네 영역 모두 `기록 없음`. 같은 화면의 `평균 정답률 —`과 이제 같은 말을 한다. 값이 있는 학생(정예린)은 `문학 80%·10문항 / 독서 60%·10문항 / 문법 77%·35문항`이고 요약의 `평균 정답률 75%`(= 41/55, 반올림)와 어긋나지 않는다.
   설명 문장도 세는 대상에 맞췄다: `배정 학습의 문항 수로…` → `이 학생이 낸 배정 학습의 문항 수로 가중해 냈어요.`
2. **`academyNotesOf`가 `WrongNote` 원본을 그대로 돌려줬다**(Medium, 권한 경계). 학원 일치 → 담당 반 → 우리 배정 3중 검사는 제대로였지만 값에 `starred`(별표) · `mastered`(이해 완료) · `pickedIndex`(고른 답)가 실려 있었다. 확정 정책 2절·D-054가 열지 않기로 한 것이 **화면이 그리지 않는다는 사실 하나로만** 지켜지고 있었다(`CLAUDE.md`: 인증·권한을 화면 숨김만으로 판단하지 않는다). `AcademyNote` 타입으로 좁히고 `toAcademyNote`로 필드를 하나씩 골라 투영한다(스프레드로 두면 새 필드가 조용히 따라 나간다).
   **뺀 필드를 `?: never`로 다시 못박았다** — 구조적 타이핑에서는 `Omit`만으로는 `WrongNote`가 그대로 `AcademyNote` 자리에 들어가 다음 사람이 투영을 지워도 컴파일이 통과한다. 실제로 확인했다: 투영을 지우고 `tsc`를 돌리면 `Type 'WrongNote' is not assignable to type 'AcademyNote'. Types of property 'starred' are incompatible.`로 선다.
   **다른 두 호출부가 쓰는 필드를 먼저 확인하고 전부 남겼다** — `app/academy/analytics.tsx`: `itemId` · `createdAt` · `qId` · `prompt` · `dig` · `area` · `choices` · `answerIndex`(+ `NoteRow.note: WrongNote` 자리에 그대로 들어간다), `app/academy/classes/[id].tsx`: `length`만. 두 파일은 손대지 않았고 타입 검사·E2E로 확인했다.

빈 값은 `NO_ACADEMY_NOTES`를 따로 뒀다(`NO_NOTES`는 `WrongNote[]`라 재사용하면 위 방어가 풀린다). 새 컴포넌트·새 색 리터럴 없음, 기존 testID(`student-areas` 등) 유지, 화면이 열지 않는 것과 고지 문장은 그대로다.

### 검증

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | **오류 0 · 경고 5**(`src/theme/fonts.web.ts` 4 + `.expo/types/router.d.ts` 1 — 기준선 그대로) |
| `npm test` | **170건 통과 / 9스위트**(`academyStats` 24 → 29건, 아래) |
| `npx playwright test e2e/academy-flow.spec.ts e2e/academy-student.spec.ts e2e/boundary-flow.spec.ts e2e/session-boundary.spec.ts` | **78건 통과**(3뷰포트) |
| `npx playwright test`(전체) | 1회차 **462건 전부 통과**. 타입만 조인 뒤 2회차에서 3건 실패(`auth-flow` 신규 가입 · `queue-flow` 담은 목록 빈 상태 · `admin-flow` 대리 보기)했는데 **셋 다 이번 변경과 무관한 파일**이고 재실행하면 통과한다(재실행 167건 중 1건이 또 다른 자리에서 로그인 대기로 실패 → 그 스펙 단독 실행 11건 통과). 로그인 대기 타이밍 흔들림으로 본다 |
| 화면 | 한빛 원장 → 박도윤(제출 0건) **1280 / 820 / 390** + 다크, 정예린(제출 4건) 1280. `docs/evidence/academy-student-areas-{desktop,tablet,mobile,dark,submitted}.png` |

`__tests__/academyStats.test.ts`에 `영역별 정답률 > 학생 필터` 5건을 더했다(삭제·완화 없음): ① 학생을 지정하지 않으면 배정의 모든 제출을 세고 시드 전체에서 `undefined`를 넘긴 것과 같다 ② 지정하면 그 학생의 제출만 센다 ③ 한 건도 내지 않은 학생은 네 영역 모두 `questions: 0` · `accuracy: null` · `enough: false` ④ 배정받지 않은 학생도 같다 ⑤ 시드의 박도윤으로 증상 자체를 고정한다(학생을 지정하지 않으면 값이 잡히고, 지정하면 비어 있다).

### 남긴 것

- **E2E를 더하지 못했다.** 이번 지시가 세 파일로 범위를 제한해 `e2e/`(다른 작업이 손대는 중)를 건드리지 않았다. 다음에 `e2e/academy-student.spec.ts`에 한 건을 더할 것: 박도윤 상세에서 `student-areas`가 네 줄 모두 `기록 없음`이고 `평균 정답률`이 `—`인지(한 화면이 같은 말을 하는지).
- `academyNotesOf`는 호출마다 새 배열·새 객체를 만든다(투영을 더하기 전에도 `filter`로 새 배열이었다). 반 상세는 학생 행마다 이 함수를 부르므로 학생 수가 늘면 값비싸진다 — 목록용 개수 집계를 따로 두는 것이 다음 후보다.
- `app/academy/analytics.tsx`의 `NoteRow.note` 타입은 아직 `WrongNote`다(할당은 되지만 실제 값은 `AcademyNote`다). 그 파일이 범위 밖이라 두었다 — 다음에 `AcademyNote`로 바꾸면 학원 화면 전체가 좁힌 타입만 보게 된다.

## 7/31 — 검토 마무리: 화면에서만 보이는 네 가지 (`/product-review` 종합)

`product-manager`·`ux-auditor` 두 검토를 합쳐 `product-fixer` 네 배치로 고친 뒤, **3뷰포트·라이트/다크로 실제 화면을 보고** 코드만으로는 못 잡은 것을 마저 고쳤다.

1. **기간 토글이 값에 닿는지 실측으로 확인했다.** `academy-range-4`↔`academy-range-12`를 눌러 지표 표의 텍스트를 비교했다 — desktop·tablet·mobile 셋 다 `false`(= 값이 바뀐다). 고치기 전에는 같은 값이었다. 예: 12주 `배정한 학습 198개 · 제출률 72%`, 4주 `65개`.
2. **학생 목록 모바일에서 정렬 기준이 안 보였다.** `반` 열을 1로 올린 뒤 `안 낸 과제`가 2로 내려가 390에서 사라졌는데, 캡션은 `안 낸 과제가 많은 학생부터예요`라고 말했다. 실측 폭 `이름 88 + 반 88 + 안 낸 과제 88 + 이동 24 + gap 24 = 312 < 358`이라 셋 다 들어간다 → `안 낸 과제`도 1로 되돌렸다.
3. **`다시 다룰 문항`의 두 행이 같은 줄로 보였다.** 문법 은행 세트는 세트 안 모든 문항이 같은 발문을 쓴다(`grammarBank.ts`의 `build(id, prompt, items)`). `DESIGN.md` §17이 정한 대로 **정답 선지**를 부제 맨 앞에 붙였다 — `정답 선생님께 여쭤봤습니다` / `정답 주문하신 커피 나왔습니다`로 갈린다.
4. **표본 1개짜리 문항이 목록 맨 위를 먹었다.** `1명 중 1명`(오답률 100%) 두 줄이 `39명 중 21명`을 밀어냈다. 선생님이 수업에서 다시 볼 문항은 그것이 아니다. `HARD_MIN_ANSWERS = 5`를 두고 **표본이 충분한 문항을 먼저** 준다(지우지는 않는다 — 뒤로 보내고 `표본 적음`을 글자로 붙인다). 영역별의 `WEAK_MIN_QUESTIONS`와 같은 성격의 하한이다. 단위 테스트로 고정했다.

### 검증

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | **오류 0 · 경고 5**(기준선 그대로) |
| `npm test` | **171건 통과 / 9스위트**(개편 전 139 → 검토 전 170 → +1) |
| `npx playwright test` | **462건 통과**(3뷰포트) |
| 화면 | 원장·선생님 × 1280 / 820 / 390 + 다크. 기간 토글 4주↔12주 전환 |

### 고치지 않고 남긴 것 (사람이 정할 일)

- 마감 지난 미제출 380건의 **일괄 재배정** — 한 번의 조작이 학생 수천 명의 홈을 바꾼다(D-046·D-033).
- 선생님에게 **학원 평균 기준선**을 줄지 — 3절 권한(선생님 = 담당 반과 학생)과 맞닿는다. 이번에는 합계 행 이름만 `담당 반 합계`로 고쳤다.
- 원장 대시보드에 **다시 다룰 문항**을 둘지 — D-078이 `원장=학년별 / 선생님=문항`으로 갈랐다.
- **반 만들기에 학년 입력**을 둘지 — 지금은 화면에서 만든 반이 영원히 `학년 미정`이고, 배정 화면은 반 이름을 파싱해 학년을 판정한다(두 화면이 같은 반을 다르게 잡을 수 있다).
- 학생 상세에 **문항별 오답 펼침** — 데이터(`wrongQIds`)는 이미 있다. 학부모가 앱에서 문항별 정오를 보는데 학원은 못 본다.
- 섹션 제목 옆 action 버튼 **32px** — `DESIGN.md` §8(32 허용)과 §10(44 최소)이 이 자리에서 서로 다른 말을 한다(A-083과 같은 성격). 목록 **안**의 행동은 44px로 맞췄다.
- 대시보드 `반별 현황`이 122행·13페이지라 `반 전체 보기` 화면과 목적이 겹친다 — 5행 미리보기로 줄일지.
- `Sparkline`의 `sparkLabel`이 마지막 점을 `지금 N%`라고 읽는다. 실제로는 **지난주** 값이라 스크린리더에게만 틀린 말을 한다(운영자 화면도 같다).

## 8/1 — 검토가 남긴 개선 후보 4건 (D-086 ~ D-089 · A-050 닫음)

`/product-review`가 남긴 다음 후보 중 **사람 판단이 필요한 것(마감 지난 미제출 일괄 처리)을 뺀 네 가지**를 처리했다.

### 1. `sparkLabel`이 스크린리더에게만 틀린 말을 했다 (D-089)

- `지금 75%` → **`마지막 75%`**. 추이는 끝난 주까지만 그리므로(`lastCompleteWeek`) 마지막 점은 지난주 값이다. 보는 사람은 화면 위 지표에서 지금 값을 읽는데 스크린리더만 지난주 값을 `지금`으로 들었다.
- 고치면서 **두 번째 오류**를 찾았다: 점 단위가 `주`로 못박혀 있어 **낸 순서로 그리는 학생 상세의 정답률 추이가 `최근 16주 추이`**로 읽혔다. `step` 인자를 두고 학생 상세는 `번`을 넘긴다.
- 화면을 봐도 알 수 없는 문장이라 **`__tests__/sparkline.test.ts` 5건**으로 고정했다.

### 2. 반의 학년을 값으로 받는다 (D-087)

- `addClass({ grade })` + 반 만들기 폼에 `학년 미정 / 고1 / 고2 / 고3`.
- 학습 배정 1단계의 학년 필터를 **이름 파싱 → `c.grade` 비교**로 바꿨다. 예전에는 `국어 심화반`이 어느 학년에도 걸리지 않았고, 이름을 바꾸면 조용히 학년이 바뀌었다 — 대시보드 학년별 요약은 값을 쓰고 이 화면만 이름을 써서 **같은 반을 두 화면이 다르게 잡았다**.
- 학년을 정하지 않은 반이 있을 때만 `학년 미정` 칸을 만든다(0건인 칸은 두지 않는다).
- E2E 2건 추가. 그중 하나가 처음에 **잘못된 이유로 통과**했다 — `getByText('국어 심화반')`이 토스트를 잡았다. 행 testID로 바꾸니 실제로는 고3 반 41개 중 5페이지에 있어 못 찾았고, 검색으로 좁히는 단계를 넣었다.

### 3. 학원이 배정 학습의 문항별 오답을 본다 (D-088)

- 학생 상세 `낸 과제` 행을 펼치면 **번호·발문·정답 선지**가 나온다(`Table`의 `expand`).
- 학생이 고른 답은 제출 기록에 없어(`Submission`에 `wrongQIds`만) **적지 않는다**. 문항별 기록이 없는 제출은 `정답률만 남아 있어요`.
- 4절이 학부모에게는 문항별 정오를 주는데 **학원이 낸 과제인데 학부모만 봤다**. 데이터는 이미 있었고 선생님 대시보드가 같은 값으로 `다시 다룰 문항`을 그리고 있었다.

### 4. `useTableSort` — A-050을 닫았다 (D-086)

- `src/components/Table.tsx`에 훅을 두고 **여섯 화면**이 함께 쓴다: 학원 대시보드 `반별 현황` · 반 목록 · 학생 목록 · `/admin/content` · `/admin/academies` · `/admin/academy/[id]`. `sort` 열이 없는 `/admin/users`는 해당 없다.
- **`/admin/academy/[id]`는 A-050에 적혀 있지 않던 6번째 자리**였다(페이지 10개 + 정렬 열 3개). 찾아서 함께 고쳤다.
- 비교 함수는 화면마다 `COMPARE` 맵 하나이고 **컬럼의 `sort`와 훅이 같은 값을 가리킨다**.
- 설계를 한 번 되돌렸다: 처음에는 훅이 `columns`를 받아 `sort`를 읽게 했는데, 대시보드 `반별 현황`은 **컬럼 셀이 현재 페이지의 추이를 참조**해서 순환이 됐고 React Compiler가 메모이제이션을 보존하지 못해 린트 오류가 났다. 비교 맵을 받는 형태로 되돌리고 컬럼이 그 맵을 가리키게 했다.
- **`__tests__/table.test.tsx`에 2건 추가** — 3행·2개씩에서 값 열을 누르면 2페이지에 있던 행이 1페이지로 오는지, 정렬을 바꾸면 페이지가 처음으로 돌아가는지.

### 검증

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | **오류 0 · 경고 5**(기준선 그대로) |
| `npm test` | **178건 통과 / 10스위트**(171 → 새 `sparkline.test.ts` 5건 + `table.test.tsx` 2건) |
| `npx playwright test --grep-invert "M3 학부모 흐름"` | **399건 통과 / 0 실패**(3.9분, 3뷰포트) — 이번 개선 4건에 회귀 없음 |
| `npx playwright test`(전체) | 429 통과 / **42 실패** — 전부 `parent-flow`이고 원인은 아래 `Q-038`(달이 바뀜). 이번 변경과 무관하다 |

**기존 테스트를 약화하지 않았다.** 삭제·skip·완화 0건.

전체 실행이 6.1분 → 15분으로 늘어난 것도 이 42건의 30초 타임아웃 때문이다(학부모를 뺀 실행은 3.9분).

### 검증 중에 드러난 것 — 달이 바뀌자 `parent-flow` 42건이 깨졌다 (Q-038)

개선 4건을 끝내고 전체 E2E를 돌리자 `parent-flow` 14건 × 3뷰포트가 실패했다. **내 변경과 무관한 날짜 문제였다.**

- 처음에는 **원인을 잘못 짚었다.** 앞선 화면 확인 작업이 남긴 `expo start --web`이 8081을 잡고 있었고 `playwright.config.ts`의 `reuseExistingServer: !CI` 때문에 빌드본 대신 개발 서버를 쓰고 있어서, 그것이 원인이라고 보고했다. 정리하고 다시 돌렸더니 **같은 42건이 그대로 실패**했다. 개발 서버는 관계가 없었다.
- 실제 원인: `src/features/report.ts:339-348`이 고를 수 있는 달에 **이번 달을 항상 넣고** 최신순 첫 번째를 기본값으로 쓴다. 오늘이 2026-08-01이 되면서 기본 달이 `8월`이 됐고 시드 기록은 6~7월이라 리포트가 빈 화면으로 열린다.
- **증명**: 학부모 리포트에서 기본 달 라벨 `8월` → `metric-personal-rate` **0개**, `month-prev`로 7월 → **1개**. 브라우저 콘솔 오류는 없었다(렌더는 정상, 그 달에 셀 것이 없을 뿐).
- 이번 배치가 바꾼 12개 파일 중 학부모 코드 경로에 있는 것은 **하나도 없다**(`app/parent/*`·`ChildReport`의 import는 `clock·content·learning·openrouter·pricing·progress·prompts·report·toast`뿐이다). 7월 31일 같은 코드로 462건이 전부 통과했다.
- **fixture 문제가 아니라 화면 동작 문제다.** 실제 데이터에서도 매달 1일에는 부모가 빈 리포트를 본다. `Q-038`(P1)로 남겼고, 고치는 방법이 셋이며 **홈과 리포트가 같은 달을 말하는지**·D-051의 `이번 주 요약` 노출 조건과 함께 정해야 해서 사람 판단으로 올렸다.
- 테스트를 고치거나 skip하지 않았다.

## 2026-08-01 — 학부모 리포트가 매달 1일에 비어 열리는 문제 (Q-038 → D-090)

사람이 선택지 ②를 골랐다: **이번 달을 그대로 열되, 비어 있으면 기록이 남은 달로 가는 길을 준다.**

### 왜 ①(기록이 있는 가장 최근 달로 열기)이 아니었나

홈과 리포트가 **같은 함수**를 기본값으로 쓴다(`useChildReports` / `useChildReport`, 둘 다 `buildChildReport`). 기본 달을 지난달로 옮기면 홈은 `8월에 0일 공부했어요`, 리포트는 `7월`을 열어 두 화면이 다른 달을 말한다. D-051의 `이번 주 요약`도 `r.month === monthOf(today)`일 때만 뜨므로 통째로 사라진다. 달은 그대로 두고 빈 상태에 길을 놓았다.

### 고친 것

- `src/features/report.ts` — 기록이 있는 달만 모은 `recorded`를 따로 두고, 기본 달은 `months[0]`이 아니라 **`thisMonth`**로 못박았다. 기록이 남은 가장 최근 달을 `latest`로 함께 돌려준다(없으면 `null`).
- `src/components/ChildReport.tsx` — 빈 달 안내에 `7월까지의 기록은 그대로 있어요` + `7월 리포트 보기`(`report-latest-month`). 갈 달이 없으면 예전 문장(`다른 달을 골라…`) 그대로다. 달 바꾸기가 세 곳(스테퍼·달별 막대·이 버튼)이 되어 `pickMonth`로 합쳤다.
- `__tests__/report.test.ts` **2건 추가** — `today: '2026-08-01'`에서 `month === '2026-08'`·`totals.count === 0`·`latest === '2026-07'`, 그리고 기록이 하나도 없으면 `latest === null`.

### E2E 14건을 어떻게 고쳤나 (약화하지 않았다)

`openRecordedMonth(page)` 헬퍼를 두고 **화면이 주는 버튼을 사람처럼 누른다**. 이번 달에 기록이 있으면 버튼이 없어 아무 일도 하지 않는다 — 그래서 7월이든 8월이든 같은 테스트가 돈다. 리포트 **내용**을 보는 11건이 이 헬퍼를 쓴다.

달 자체를 확인하는 3건은 헬퍼를 쓰지 않고 다시 썼다.

- `홈과 리포트가 같은 숫자를 말한다` → **`같은 달의 같은 숫자`**. 홈 줄에서 달과 날짜를 함께 읽어 `month-label`이 그 달인지 단정하고, 0일이면 빈 안내와 `report-latest-month`가 있는지 본다. **여기서는 달을 옮기지 않는다** — 이 테스트가 지키는 것이 그 일치다.
- `지난달 리포트에는 이번 주 요약을 두지 않는다` → 리터럴 `6월` 대신 **현재 라벨을 읽고 한 칸 뒤로 간 뒤 라벨이 바뀌었는지**로 바꿨다. 달 이름에 기대지 않는다.
- `달 이동은 왼쪽이 과거이고 갈 곳이 없으면 막힌다` → 이번 달에서 오른쪽이 막혔는지 보고, 왼쪽 끝까지 눌러 이하은의 첫 기록인 `6월`에서 멈추는지 본다. 이번 달과 6월 사이 칸 수가 시간이 갈수록 늘어나서 클릭 수를 고정할 수 없다.

`자녀가 정리한 오답노트 메모와 별표를 학부모가 본다` 1건은 **다른 이유로 깨져 있었다.** 오답노트 목록 맨 위는 지난달 시드 오답인데 테스트가 `.first()`에 별표와 메모를 붙이고 있었다 — 7월에는 시드 첫 장에 이미 메모가 있어서 우연히 통과했다. `.last()`(방금 담은 오답)로 바꾸고 `별표 [1-9]`도 함께 단정했다. 이제 이 테스트는 **자녀가 방금 정리한 것**을 본다.

### 검증

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | **오류 0 · 경고 5**(기준선 그대로) |
| `npm test` | **180건 통과 / 10스위트**(178 → `report.test.ts` 2건) |
| `npx playwright test` | **471건 통과 / 0 실패**(6.2분, 3뷰포트) — 직전 429/42에서 회복 |
| 화면 | 390 라이트 · 820 다크 · 1280 라이트·다크. 빈 안내 → `7월 리포트 보기` → 7월 리포트가 열리고 `이번 주 요약`이 사라지는 것까지 확인 |

`parent-flow` 단독은 3.7분(14건 실패) → **20.9초**가 됐다. 30초 타임아웃이 사라진 만큼이다.

기존 테스트를 삭제·skip·완화한 것은 0건이다. 문구와 흐름을 의도적으로 바꾼 4건은 위에 무엇을 왜 바꿨는지 적었다.

## 2026-08-01 — UI 일관성 정리 (D-091~D-095)

파비콘·CTA 중복·전폭 버튼·글자만 있는 행동·누락된 알림·섹션 경계·모션·스크롤을 한 번에 맞췄다.
사람이 정한 것: ① 오답노트 지우기는 토스트 ② 구분선은 경계가 무너진 곳만 ③ 모션은 토큰 + 핵심 4곳 ④ 범위는 지목한 항목 + 명백한 규칙 위반.

### 공용 조각 먼저

- `layout.actionMaxWidth = 360`을 만들고 **`Button`이 직접 상한을 건다.** 컨테이너를 새로 만들면 쓰는 것을 잊는다 — A-033이 두 번 재발한 이유가 "`hug`을 안 써서 늘어난 것"이라 늘어날 수 있는 대상에서 막았다. **실측으로 확인**: 인증 패널 안쪽은 348px, 모바일 본문은 342px이라 `login`·`signup`·`join`은 픽셀 그대로다.
- `src/theme/motion.ts`(시간 3 · 곡선 2) + `useMotion.ts`(훅 2). `tokens.ts`가 아닌 이유는 그 파일이 런타임 의존성 없는 순수 값이고 `Easing`은 `react-native`에서 오기 때문.
- `IconButton`(44px 누름 영역, 글리프 16, `inset`으로 줄 높이 보존), `Section`의 `separated`, `Screen`의 `scrollResetKey`.

### 확인한 것 — `LayoutAnimation`은 웹에서 아무 일도 하지 않는다

설치된 react-native-web 0.21.2의 `UIManager.configureNextLayoutAnimation`이 완료 콜백만 즉시 부르고 끝난다. 웹이 주 타깃이라 **높이 애니메이션은 하지 않고 `opacity`·`transform`만** 썼다. iOS에서만 움직이고 웹에서 뚝 끊기는 것이 제일 나쁜 결과다.

### 고친 것

| 갈래 | 내용 |
|---|---|
| 파비콘 | `Mark.tsx` 삭제, `Brand`의 `withMark` 제거. `public/favicon.svg`·`.ico`는 그대로 |
| CTA 중복 | `classes/[id]` 동시 3개 → 1개 · `solve` `다음` → secondary · 랜딩 상단 바 강등 |
| 전폭 | `records` 2개 + `manage`(960) → `hug` · `assign`·`ContentComposer`(960) → 360 상한 · `result`·`LegalDocView`·`join` |
| 어포던스 | 되돌리기 4곳을 같은 모양으로(`ghost`+`refresh-cw`+44px) · 아이콘 버튼 4개를 `IconButton`으로 · `review`의 `★` 글리프와 **`onPress`가 없는 죽은 버튼** 제거 |
| 알림 | `Toast`에 행동 슬롯 · 별표·담기·메모 저장·이해 완료·선생님 제외 6곳 추가 |
| 경계 | `parent/detail` 2곳 · 선생님 대시보드 2곳 · `admin/metrics` 1곳 |
| 모션 | 문항 페이지 교차 페이드 · 표 펼침 · 별표·담기 토글 |
| 스크롤 | `solve` + 목록 8곳 |

### `solve`의 `다음`은 §16을 이미 어기고 있었다

§8(primary 하나)만이 아니라 **§16 line 254가 "이전·다음 두 버튼은 같은 무게로 둔다"**고 적어 뒀는데 `이전`=secondary, `다음`=primary였다. 두 규칙이 같은 곳을 가리켰다.

### 함정 — 대리 보기에서 알림이 거짓말을 한다

`src/features/progress.tsx`의 모든 쓰기는 `readOnly`에서 조용히 no-op이다(D-071). 별표·담기에 그냥 토스트를 달면 **일어나지 않은 저장을 알린다.** `admin-flow.spec.ts:290-305`가 대리 보기에서 별표·담기가 안 바뀌는 것을 단정하고 있다. 각 화면에서 `readOnly`를 읽어 건너뛰게 했고, **`app/student/pick.tsx`에 이미 있던 같은 버그**도 함께 고쳤다.

### 검증

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | **오류 0 · 경고 5**(기준선 그대로) |
| `npm test` | **180건 통과 / 10스위트** — `table.test.tsx`가 `Pager`를 provider 없이 그리므로 `Pager`는 손대지 않았다 |
| `npx playwright test` | **471건 통과 / 0 실패**(5.2분, 3뷰포트) |
| 화면 | 390·820·1280 라이트·다크 |

**E2E는 1건만 바뀌었다** — `student-flow.spec.ts`의 `오답노트에서 지우면 바로 빠지고 되돌릴 수 있다`(배너 → 알림). 나머지 470건은 testID·접근성 이름·박스 크기를 건드리지 않아 그대로 통과했다. 삭제·skip·완화 0건.

화면에서 실제로 확인한 것: ① 로그인에 파비콘 도형이 없고 워드마크만 ② `기록`의 세 행동이 한 줄에 무게로 갈리고 390에서 자연스럽게 접힘 ③ 태블릿에서 되돌리기 알림이 떠 있는 탭 알약을 가리지 않음(행동이 있을 때만 아래 여백 `spacing.xxl` 추가) ④ 선생님 대시보드에서 막대 목록과 문항 목록 사이에 hairline이 보이고 표 앞뒤에는 없음 ⑤ **5문항 화면에서 `다음`을 누르면 6번이 맨 위에 온다**(고치기 전에는 10번이 먼저 보였다).

### 남긴 것

`docs/UI_CONSISTENCY_CHECKLIST.md`에 화면 34개를 7개 항목으로 적었다. 안 고친 것은 등급과 이유를 함께 남겼다 — A-083(`SegmentedControl` 34px), Q-010(화면 전환), `Button` 기본값 뒤집기, 배정 버튼 3개의 이름 통일(모양은 맞췄고 이름은 E2E 3곳이 함께 움직여 사람 판단으로 올린다).

### 같은 날 — 되돌린 것: 폭 상한은 틀린 해법이었다

사용자가 화면을 보고 지적했고, 확인해 보니 맞았다.

**무엇이 틀렸나.** `Button`의 `fullWidth`에만 360px 상한을 걸었는데,
- `fullWidth`를 **선언한** 버튼만 줄어들고 그냥 늘어난 버튼(`학습 시작하기` 680px)은 그대로라 규칙이 반쪽만 적용됐다.
- 줄어든 `제출할게요`가 `alignSelf: stretch` 때문에 컬럼 **왼쪽에 붙어** 어긋나 보였다. 고치기 전보다 나빠졌다.

**진짜 문제는 폭이 아니라 자리였다.** 학습 상세(`/student/[id]`)는 `결과 다시 보기`(hug) → `기록을 바꾸고 다시 풀기`(전폭) → `그대로 둘게요`(전폭 ghost) → `담아 두기`(hug) 네 개가 **세로로 쌓여** 폭이 제각각이었다. 결과 화면은 `오답노트 하러 가기`(32px 오른쪽)와 `홈으로 갈게요`(40px 왼쪽)가 한 화면에서 크기도 자리도 달랐다.

**바꾼 것.**
- 상한을 걷고 **`ActionBar`**를 만들었다 — 가로 배치, 왼쪽 정렬, 주 행동이 맨 앞, 좁으면 접힘, 최대 폭은 읽기 폭(680).
- 목적을 끝내는 행동 하나뿐일 때만 `stretch`로 줄을 채운다(`제출할게요`·`학습 시작하기`·`등록할게요`·`배정하기`).
- **`ghost`를 진짜 명령에 쓰지 않는다.** `그대로 둘게요`·`질문하고 메모하기`를 `secondary`로 올렸다.
- 학습 상세는 상태별로 줄을 하나만 둔다: 확인 중이면 `기록을 바꾸고 다시 풀기` + `그대로 둘게요`, 이미 푼 것이면 `결과 다시 보기` + `다시 풀기` + `담아 두기`, 안 푼 것이면 `학습 시작하기` 한 줄.
- 결과 화면은 `오답노트 하러 가기`(주) + `홈으로 갈게요`(보조)를 같은 크기로 한 줄에.

**애니메이션도 안 보였다.** 페이드만 넣어 두고 누름 반응은 불투명도 0.9 그대로였다. `Button`에 눌림(0.97 축소)과 **화살표 밀림**(누름 4px, 웹 hover 2px)을 넣었다. 실측으로 idle/hover/press 세 장을 찍어 화살표가 실제로 움직이는 것을 확인했다.

**이번에는 지적된 화면을 전부 눈으로 봤다**: 학습 상세(안 푼 것/푼 것/확인 중) · 풀이 제출 · 결과 아래 · 기록 아래 — 3뷰포트.

| 항목 | 결과 |
|---|---|
| typecheck / lint | 통과 / 오류 0 · 경고 5(기준선) |
| `npm test` | 180건 통과 |
| `npx playwright test` | **471건 통과 / 0 실패**(6.7분, 3뷰포트) |

**앞선 검증이 부실했다는 지적이 맞다.** 로그인·기록·오답노트·대시보드·학부모 상세만 봤고 학습 상세·결과 아래·제출 버튼 자리는 보지 않은 채 완료로 보고했다.

### 같은 날 — `ActionBar`를 나머지 화면에 마저 적용

학생 화면에서 세운 기준을 남은 곳에 그대로 폈다. 화면마다 손으로 만들던 행 스타일(`styles.actions`·`confirmActions`·인라인 `flexDirection: 'row'`)을 전부 걷고 한 컴포넌트로 모았다.

| 화면 | 전 | 후 |
|---|---|---|
| `/academy/assign` 완료 | hug 3개가 세로로 | `제출 현황 보기`(주) + `계속 배정하기` + `되돌리기` 한 줄 |
| `/academy/index` 빈 상태 | 낱개 hug | 행동 줄 |
| `/academy/classes` · `/academy/classes/[id]` · `/academy/manage` | 화면마다 다른 행 스타일 | 같은 `ActionBar` |
| `/student/queue` · `/student/review` · `/student/learn` | 낱개 hug / 인라인 행 | 행동 줄 |

**규칙 하나를 더 못박았다: 행동 줄 안에는 `ghost`를 두지 않는다.** 테두리 없는 버튼이 줄 안에 섞이면 그것만 글자로 보인다 — `학생 전체 보기`·`방금 배정한 것 되돌리기`를 `secondary`로 올렸다. `ghost`는 목록 줄 안(R3)과 펼침·링크에만 남는다.

지운 것: `learn.tsx`·`classes.tsx`의 `styles.actions`, `manage.tsx`의 `confirmActions`, `result/[id].tsx`의 `nextBtn`.

| 항목 | 결과 |
|---|---|
| typecheck / lint | 통과 / 오류 0 · 경고 5(기준선) |
| `npm test` | 180건 통과 |
| `npx playwright test` | **471건 통과 / 0 실패**(5.4분, 3뷰포트) |
| 화면 | 학습 탭 · 반·학생 · 학원 관리(제외 확인) · 배정 완료 — 3뷰포트 |

## 2026-08-05 — 출시 전 UI/UX 전수 정리 (D-096~D-104)

화면 56개 · 공용 컴포넌트 35개를 전부 읽고 감사한 뒤 6단계로 고쳤다. 벤치마킹은 Apple HIG 44pt · Material 48dp · WCAG 2.5.5(AAA) 44px / 2.5.8(AA) 24px · UX Movement의 모바일 CTA 배치 · Duolingo의 눌림 반응.

### 감사에서 나온 것 중 추측이 아니라 실측으로 확인한 셋

**1. 모든 화면이 세로 공간 약 47px을 잃고 있었다.** `RoleShell`이 상단바를 `SafeAreaView edges={['top']}`로 감싸는데 본문은 그 **형제**라 컨텍스트로는 원래 값을 봤고, `Screen`이 `insets.top`을 한 번 더 더했다. `ask.tsx`가 같은 이유로 `Screen`을 안 쓴다고 주석에 적어 둔 것이 근거였다. 셸이 본문에 `top: 0`을 알리게 고쳤다(D-101).

**2. 웹 접근성 상태 선언 14곳이 전부 무효였다.** react-native-web 0.21.2가 `accessibilityState`·`accessibilityValue` 객체를 DOM으로 옮기지 않는다(`forwardedProps` 허용 목록에 두 이름이 없다). 그 안에 **모든 문항의 답 선택 상태**와 앱의 유일한 선택 컨트롤(28곳)이 있었다. `Table.tsx:296`이 이미 발견해 우회했지만 나머지가 따라가지 않았다 — 규칙만으로는 재발하므로 **ESLint로 막았다**. 규칙을 켜자 정확히 14곳이 잡혔다(감사에서 센 수와 같았다). 고친 뒤 브라우저 DOM을 직접 열어 `aria-checked` 20개, `aria-selected` `["true","false"]`, `aria-valuenow` 14개, `aria-live` 1개, `accessibilityState` **0개**를 확인했다. 반대로 **`disabled`는 정상 동작했다** — 중복 선언 4곳은 지웠다(D-096).

**3. AI 실패 문장이 학생 오답노트 메모로 저장됐다.** `askScodyAI*`가 실패도 문장으로 반환하는 계약이라 `Scody AI 연결 오류: … (브라우저 CORS/네트워크 확인)`이 그대로 `setDig`에 들어갔다. `isAiFailure()`로 저장 전에 막았다(D-102).

### 고친 것 (Wave별)

| Wave | 내용 |
|---|---|
| 0 | `touch`(44/36) · `spacing.xxs/xs2` · `columnBreakpoints` · `shadow` · `FOCUS_CSS` · `font.size.reading` 토큰 / `useColumn` / `styles.ts`(`row`·`inset`·`a11y`) / `AppText`의 `weight`·`danger`·`success`·`numeric` / ESLint 금지 규칙 |
| 1 | 접근성 상태 14곳 → `aria-*`. `aria-current="page"` 추가 |
| 2 | `Button` md 40→44(우회 6선언 13호출부 삭제) · 미달 10종 · `IconButton` 확장 → **`QueueToggle.tsx` 삭제**(같은 컴포넌트 3중 복사) · `EmptyState`·`ConfirmStep`·`BarRow`·`SourceValue`·`Disclosure`·`LiveRegion` 신설 · `ActionBar`에 `align` · `Toast` 대비·경계·live region |
| 3 | `Table` 쌓기 모드. `minWidth` prop 삭제(17호출부), 분기점 판단을 **컬럼 폭 맞춤 루프**로 통합, `priority` 24곳 교정 |
| 4 | 학생 Critical/High 12건 · 학부모 · 학원(어포던스 없는 행 2곳, 파괴적 확인 2곳, 대시보드 접기) · 관리자 계정 목록 순서 · 인증 |
| 5 | `DESIGN.md`(낡은 팔레트 표 제거, §8·§10·§11) · 마스터 플랜 D-096~D-104 · A-083 닫음 · 체크리스트 2차 |

### 뜻밖의 소득

`priority`를 "분기점 등급"에서 "폭이 모자랄 때 포기하는 순서"로 바꾸니 **데스크톱에서도 열이 늘었다.** 학생 목록이 8열 전부 나온다 — 예전에는 1024 창에서 `최근 제출`이 자리가 있는데도 접혔다. 분기점 판단과 맞춤 판단을 서로 다른 폭 개념으로 두 번 하던 것이 원인이었다.

### 검증

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | **오류 0 · 경고 5**(기준선 그대로). 새 ESLint 규칙이 재발을 막는다 |
| `npm test` | **181건 통과**(180 → 표 쌓기 정렬 1건 추가) |
| `npx playwright test` | **471건 통과 / 0 실패**(7.1분, 3뷰포트) |
| 터치 실측 | 로그인·홈·기록·오답노트·대시보드·반학생·학원관리 **7화면 × 3뷰포트에서 44px 미달 0개** (예외 `sm` 32 · `SegmentedControl` 36 제외) |
| 접근성 실측 | DOM에서 `aria-current` 1 · `aria-selected` 14 · `aria-expanded` 1 · `aria-valuenow` 14 · `aria-live` 1 · `accessibilityState` **0**. live region 문구 `별표를 달았어요` 확인 |
| 화면 | 390·820·1280 라이트·다크 |

### 테스트를 고친 것 — 무엇을 왜 (지우거나 skip으로 통과시킨 것은 0건)

1. **표 접기 2건** — 옛 규칙(분기점 등급)을 단정하고 있었다. 새 규칙(맞춤 + 쌓기)으로 다시 쓰고 `쌓아도 정렬은 남는다` 1건을 **추가**했다.
2. **화살표 감지 heuristic 3곳** — `LiveRegion`이 1×1 절대배치라 "작은 절대배치 = 화살표"에 걸렸다. `width > 0` → `>= 4`로 좁혔다.
3. **`이번 주 요약을 만들면`** — 주가 바뀌어 이번 주 기록이 없어졌다. 달력에 기대는 대신 테스트가 스스로 조건을 만들게 했다.
4. **빈 상태 문구 2곳** — `EmptyState`가 제목/부제를 나눠 그려 마침표가 없어졌다.
5. **`정리와 대화 지우기`** — 확인 단계가 생겨 한 번 더 누른다. `.first()`가 다른 문항의 확인을 집을 수 있어 **id로 묶었다**(전체 실행에서 한 번 흔들린 원인).
6. **추이·필터 접기 2곳** — 좁은 화면에서 접히므로 사람처럼 펼치고 확인한다.

### 남긴 문제 — E2E가 실제 OpenRouter를 호출한다

`.env`에 실제 키가 있어 e2e가 **유료 API를 네트워크로 탄다.** 오답노트 정리 테스트 2건이 그 호출 결과에 매달려 있었고, **예전에는 호출이 실패해도 실패 문장이 메모로 저장돼 테스트가 틀린 이유로 통과했다.** 저장을 막은 뒤 그 취약성이 드러나 전체 실행에서 간헐 실패로 나타났다.

두 테스트에 `test.skip(reason)`을 두어 **못 한 것을 통과로 위장하지 않고 건너뛴 사실을 남기게** 했다. 근본 해결(AI 호출을 e2e에서 끊기)은 별도 항목이다 — 이번 범위 밖이고, 테스트 인프라 결정이 필요하다.

### 넣지 않은 것과 이유

`Cluster`/`Inline`(121곳 JSX를 고쳐 스타일 객체 하나를 아끼는 거래 — 출시 직전 최악의 위험/이득비, `row.*` 상수로 대신) · `FilterBar`(화면마다 재료가 달라 props 가방이 된다) · `Checkbox`(`IconButton`으로 흡수) · 반응형 타이포(시각 위험이 가장 크고 모든 화면 제목이 움직인다 — 계획에서 선택 항목으로 두고 버렸다).

---

## 2026-08-05 — 오답노트 화면 지적 7건 (D-105~D-110)

`app/student/notebook.tsx` **한 파일만** 고쳤다. 넘겨받은 7건을 코드에서 먼저 재현하고 고쳤다. 7건 모두 재현됐다.

### 고친 것

1. **[High] 필터를 켠 채 마무리하면 남은 오답을 감췄다**(D-105). 마무리 카드가 걸러진 목록의 `pending`만 봐서, `문법`으로 좁혀 문법만 정리하면 독서 오답 3개가 그대로인데 `오답을 모두 정리했어요.`가 뜨고 주 버튼이 `기록 보러 가기`로 바뀌었다. 집계를 `pendingAll`(= `allNotes` 기준)로 바꾸고, 좁혀 본 영역만 끝난 경우를 세 번째 분기로 두어 두 값을 함께 말한다 — `문법 오답은 다 정리했어요.` + `다른 영역에 3개 남아 있어요.`(존댓말 `-어요`, 한 문장에 한 가지). 영역 이름 뒤에 `오답은`을 붙여 은/는 조사 처리를 피했다. 화면 안 요약(`8개 중 3개는…`)은 지금 보고 있는 목록을 말하는 것이 맞아 그대로 뒀다. `setWrapUp` 중간 단계는 손대지 않았다(문장과 집계만).
2. **[Medium] 마지막 노트를 지우면 선택된 칸이 없는 컨트롤이 남았다**(D-106). `areaOptions`는 `allNotes`에서 파생되는데 `areaFilter`는 상태에 남아, `SegmentedControl`의 `o.value === value`가 아무 칸에도 맞지 않았다. 상태를 지우는 대신 **그릴 값을 파생**했다(`activeArea` — 옵션에 없으면 `'all'`). 그래서 알림의 `되돌리기`로 오답이 살아나면 보고 있던 필터도 함께 돌아온다(실측: `문법` → 지우기 → `전체 7` 선택 → 되돌리기 → `문법 1` 선택, 목록 1건). 빈 상태의 `전체 보기` 탈출구와 그 주석은 그대로 뒀다 — 이 수정으로 그 분기는 방어용으로 남는다.
3. **[High] AI 실패가 정상 답변처럼 보이고 질문이 사라졌다**(D-107). `ask()`에 `isAiFailure(answer)` 검사를 넣어 실패는 **대화에 넣지 않고**, 그 카드 안 인라인 캡션(`tone="danger"`, `지금은 답하지 못했어요. 잠시 뒤 다시 물어봐 주세요.`)으로 알린다(§9). 개발자용 문구는 화면에 나가지 않는다. **입력은 성공했을 때만 비운다** — 실패하면 쓴 질문이 입력창에 그대로 남는다(실측: 실패 후 `inputValue()`가 그대로, 대화 줄 0).
4. **[High] 답을 기다리는 동안 아무 표시가 없었다**(D-108). 스트리밍 블록의 조건을 `live` → `busy === n.id || live`로 바꾸고, 조각이 오기 전에는 `답을 쓰고 있어요`를 그린다(대화 화면 `ask.tsx`와 같은 문구·방식).
   - **판단**: `ask.tsx`처럼 보낸 질문을 대화에 미리 올리지는 **않았다.** 3번이 입력을 유지하므로 질문이 입력창과 대화에 두 번 보이고, 실패 시 그 pending 줄을 지우면서 입력을 되살리는 두 단계가 생긴다. 입력창이 카드 바로 아래에 붙어 있는 화면이라(대화 화면은 입력창이 하단 고정 + 즉시 비움) 질문은 입력창에 두고 **진행만** 대화 카드에 띄우는 쪽이 상태가 하나다. `e2e/student-flow.spec.ts:721`이 "질문이 대화에 올라온 것"을 답 도착 신호로 쓰는 것도 이 선택으로 그대로 유효하다.
5. **[High] 한 문항이 대화 중이면 다른 문항의 보내기 버튼이 죽은 버튼이었다**(D-108, A-034 일부). `busy={busy === n.id}` → `busy={!!busy}`로 바꿔 작업 중에는 모든 보내기 버튼이 함께 꺼진다(실측: 다른 문항 `aria-disabled=true`). **판단**: 문항별 `busy`가 근본이지만 동시 호출이 열려 미뤘다 — 어느 문항이 작업 중인지는 4번의 진행 표시가 그 카드에서 말한다. 정리 아이콘·`추가로 …정리하기`는 작업 중에도 여전히 눌리면 조용히 되돌아간다(A-034에 남겼다) — 지금 끄면 답이 온 직후 정리를 누르는 기존 E2E 흐름과 부딪힌다.
6. **[High] 390에서 아이콘 3개가 발문을 접고 그 가운데에 걸렸다**(D-109). 머리 줄을 `NoteHead`로 떼어 **좁은 컬럼에서는 아이콘 줄을 발문 아래**로 내리고(발문 전폭 324px), 한 줄로 둘 때는 `alignItems: 'flex-start'`로 아이콘을 첫 줄에 고정했다. 휴지통은 `spacing.sm`을 더해 별표와 떼었다. 아이콘 순서(정리·별표·휴지통, §17)는 그대로.
   - **판단**: 폭 판단은 `useColumn()`이 규칙인데, 화면 함수 본문에서 부르면 `Screen`의 `ColumnWidthProvider` **밖**이라 창 폭으로 조용히 되돌아간다(실측: 창 620 → 컬럼 588인데 모바일로 판정). 그래서 머리 줄만 담당하는 작은 컴포넌트를 같은 파일에 두고 그 안에서 불렀다. 실측(아이콘 중심 − 발문 첫 줄 중심): 390 = +30(아래 줄) · 620 = −2 · 820 = −2 · 1280 = −2, 발문이 두 줄일 때도 1280에서 −2(첫 줄 고정).
7. **[Medium] 반복되는 두 버튼이 32px이고 한쪽 라벨에 상태가 들어 있었다**. `size="sm"`을 떼어 기본 `md`(44)로 올렸다(§8·§10 — `sm`은 섹션 제목 옆 전용). 라벨은 `추가로 대화한 내용까지 더해서 정리하기`로 고정하고, 진행은 **캡션**(`정리하는 중이에요`)으로 옮겼다 — 첫 정리(머리 아이콘)와 다시 정리(아래 버튼)가 같은 캡션을 쓴다. `ghost`에 `refresh-cw`를 붙였다(§8: 테두리 없는 행동에는 뜻이 통하는 아이콘 하나). 정렬 상쇄 마진은 **행에서 버튼으로** 옮겼다 — 행에 두면 390에서 줄바꿈한 `정리와 대화 지우기`의 테두리가 카드 선에 닿는다. `ConfirmStep`·`tone="danger"`·`secondary`는 그대로.
8. **[High] 출처가 화면에 없었다**(D-110). 각 노트 카드 첫 줄에 `SourceTag`를 뒀다(§18, `review.tsx`·`ChildReport`와 같은 배치). 학원 출처 노트에는 정답 줄 아래에 `학원 과제에서 담은 오답의 메모는 선생님이 볼 수 있어요.`를 캡션으로 뒀다 — **메모가 없을 때에도** 둔다(정리하기 전에 알아야 한다). 개인 학습 노트에는 붙이지 않는다(실측: 정예린 8건 중 학원 5건에만 표시).

### 검증

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | **오류 0 · 경고 5**(기준선 그대로) |
| `npx playwright test --grep "오답노트\|추가 대화까지\|추천 학습을 담아도"` | **desktop 13건 · mobile 12건 통과 / 0 실패**(오답노트를 만지는 모든 스펙: student-flow 8 · parent-flow 3 · recommend-flow 1 · admin-flow 1) |
| `npx playwright test e2e/a11y.spec.ts --project=desktop` | 3건 통과 |
| 화면 | 390·820·1280 라이트 + 390 다크. `docs/evidence/notebook-{mobile,mobile-dark,tablet,desktop}-{head,academy-notice,ai-writing,ai-failed,memo-actions,wrapup-filtered}.png` · `notebook-mobile-summarizing.png` · `notebook-filter-reset-mobile.png` |

`npm test`와 playwright 전수는 넘긴 쪽에서 마지막에 돌린다(요청). 이 화면을 참조하는 단위 테스트는 없다(`__tests__`에 `notebook` 참조 0건).

### 테스트를 고친 것

**없다.** `note-*`·`notebook-*`·`summ-*`·`addsum-*`·`resum-*`·`del-*`·`ask-*`·`send-*`·`dig-*` testID와 화면 문구·토스트 문구를 모두 유지했다. 실패·지연 상태는 `page.route('**openrouter.ai/**')`로 만들어 실측했다 — 그 방법으로 E2E를 추가하는 것은 A-084로 남겼다(다른 파일을 고칠 수 없는 범위였다).

### 남긴 것

- **A-084**: 이번에 바꾼 5가지 상태(필터 마무리 문장 · 필터 복귀 · 실패 캡션·입력 유지 · 작업 중 잠김 · 학원 고지)에 E2E가 없다.
- **A-034**: 문항별 `busy`. 죽은 버튼 증상만 닫았고 정리 버튼은 작업 중에 여전히 조용히 되돌아간다.
- **A-043**: `app/student/ask.tsx`가 아직 실패 문장을 답변처럼 그린다(오답노트·카드 복습은 걸렀다).
- 필터를 켠 채 마무리했을 때 `전체 보기`로 이어 주는 행동은 두지 않았다(문장·집계만 고치는 범위였다). 지금은 `더 정리할게요`로 돌아가 필터를 직접 바꿔야 한다.
- `styles.body` 위에 남아 있던 옛 주석(`별표·지우기…`)은 아이콘 줄로 옮겨 갔다. 노트 id·`mastered`·`정리됨` 라벨·추천 섹션 위치는 사용자 판단 대기라 손대지 않았다.

---

## 2026-08-05 — 오답노트 흐름 제품 검토(`/product-review`)와 수정

### 범위

`결과 → 오답노트 담기 → 오답노트(AI 대화·정리) → 기록 → 카드 복습`. 전체 앱을 훑지 않고 직전 정리에서 가장 많이 바꿨고 화면 확인이 가장 얕았던 한 흐름만 봤다.

파일: `app/student/result/[id].tsx` · `notebook.tsx` · `review.tsx` · `records.tsx` · `src/features/progress.tsx`(읽기) · `openrouter.ts` · `recommend.ts` · `QuestionReview`·`AskField`·`Passage`·`EmptyState`·`ConfirmStep`·`IconButton`.

제품 관점(`product-manager`)과 사용성 관점(`ux-auditor`)을 각각 읽기 전용으로 돌려 합쳤다. 두 보고가 **같은 줄을 가리킨 항목 3건**(AI 데모 응답 저장 · 출처 표시 없음 · `EmptyState` 미적용)은 하나로 묶었고, 등급이 갈린 것은 사용자 영향으로 다시 판단했다.

### 확인한 Critical 5건 — 전부 코드에서 재현됐다

1. **결과 화면이 저장된 채점 결과를 안 썼다**(D-111). 세션 메모리 `answers`로 판정했고 그 값은 로그인마다 비어 있다 → 이 세션에서 직접 풀지 않은 기록은 **전 문항이 오답**으로 보였다. 실측: 정예린 · `평상 위의 노인`이 `10문항 중 8문항 정답`인데 아래는 `틀린 문항 10`. 고친 뒤 `틀린 문항 2` / 정답 배지 8 · 오답 배지 2 / `내 답 · 아이들을 귀찮아한다`.
2. **오답노트 키가 문항 id 하나여서 개인·학원이 같은 노트를 공유한다**(→ **A-085**, 고치지 않았다). `ct_read_1`·`ct_gram_1`이 `publishToStudents: true`이면서 학원 배정에도 쓰여(`src/data/content.ts:18,286` / `src/data/fixtures.ts:271,290`) **잠재 결함이 아니라 재현 가능**하다. 저장된 노트 id가 바뀌는 마이그레이션 성질의 변경이라 시점을 사람이 정한다.
3. **키 없을 때의 데모 응답이 학생 메모로 저장됐다**(D-112). `isAiFailure`가 접두어만 봤고 데모 문장은 사용자 질문으로 시작한다 → D-102의 구멍. 표식을 상수로 뽑아 두 함수가 같은 값을 쓰게 했다. 실측: 수정 전 `isAiFailure(데모) = false` → 후 `true`, HTTP 실패·빈 응답·연결 오류·정상 요약문 판정은 회귀 없음.
4. **`처음부터 다시 복습하기`가 카드 상태를 초기화하지 않았다**(D-113). `picked`가 남아 1번 카드가 답을 고르기 전인데 정답이 공개되고 판정이 찍혔다. 초기화를 `resetCard()` 한 함수로 모았다.
5. **별표를 빼면 덱에서 카드가 빠져 내 답·대화가 다음 문항에 옮겨 붙었다**(D-113). 덱을 세션 시작 시 id 스냅샷으로 고정했다. 실측: `1 / 8`에서 별표를 눌러도 머리글이 `1 / 8`.

### 함께 고친 것

| 화면 | 변경 |
|---|---|
| 결과 | `걸린 시간`을 `meta`(3.23:1, AA 미달) → `trailing` + `label`(§8) · `SourceTag` 추가(§18) · `다 풀었어요!` → `다 풀었어요.` |
| 카드 복습 | 지문을 카드 **밖** 형제로 옮기고 `collapsible defaultOpen`(펼치면 접을 수 없었다) · 선지에 `정답`·`내 답` 텍스트 표식(§11 색만으로 금지) · 빈 상태 `EmptyState` + 버튼 `hug` · 진행 막대를 머리글과 같은 수로(D-114) · 평문 `학원 학습` → `SourceTag`(`학원 과제`) |
| 오답노트 | D-105~D-110 (앞 항목 참조) |
| 기록 | `showChevron` + `trailing` 동시 사용 제거 — 정답률이 이동 화살표 **뒤로** 밀려 있었다(§8·`Row` docblock) · 빈 상태 2곳 `EmptyState`(D-104) · `결과 화면에서…` → `완료한 학습을 열면…`(그 이름의 화면이 없었다) |

### 검증

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | **오류 0 · 경고 5**(기준선 그대로: `.expo/types/router.d.ts` 1 · `fonts.web.ts` 4) |
| `npm test` | **181 통과 / 10 스위트** |
| `npx playwright test` | **471 통과 / 0 실패**(11스펙 × 3뷰포트, 6.8분) |
| 화면 | 390·820·1280 라이트 + 390 다크. `docs/evidence/review-*.png`(7) · `notebook-*.png` · `records-{empty,filled}-*.png` |

**코드만으로 확정할 수 없어 실측한 것**(두 검토가 남긴 목록):

- 카드 복습 선지 표식 대비 — 라이트 `정답` 4.91:1 · `내 답` 5.59:1, 다크 7.54:1 · 5.41:1. **넷 다 AA(4.5) 통과.**
- 카드 복습 행동줄 390 — 1줄, `다음 문제` 112×44가 맨 앞(x=16), `이제 이해했어요` 152×44.
- 오답노트 마무리 이후 — 펼쳐진 블록이 화면 안에 들어온다(`wrapup-later` top 528 < 844).
- 토스트 `되돌리기` — 누름 영역 **76×44**, 하단 탭(top 791)과 겹치지 않는다(bottom 695).
- 결과 화면 390 길이 — `오답노트 하러 가기`가 문서 **1534px = 1.8화면 아래**(문학 세트, 오답 2개). → **A-086**으로 올렸다.

### 테스트를 고친 것

`e2e/student-flow.spec.ts` 두 줄만. `getByText('다 풀었어요!')` → `getByText('다 풀었어요.')` — 느낌표를 뺀 문구 변경(`CLAUDE.md` 말투 규칙)에 따른 정확 문자열 갱신이다. 삭제·skip·완화 없음. testID는 하나도 바뀌지 않았다.

### 고치지 않은 것과 이유

- **A-085** 노트 키 충돌 — 저장된 id가 바뀌는 변경(마이그레이션 성질). 사람이 시점을 정한다.
- **A-086** 결과 화면의 두 목록 — 정보 구조 변경이고 방법이 둘이다(M9-11).
- **A-087** `mastered`가 아무것도 바꾸지 않는 것 — 덱에서 제외할지가 정책 결정이다.
- **M9-10** 이름 통일 — `질문하고 메모하기`가 `DESIGN.md` §8에 예시로 박혀 있고 E2E가 이름으로 클릭한다.
- 카드 복습의 `메모 다시 정리하기`가 오답노트 메모를 확인 없이 덮어쓰는 것 · `이전 카드로` 없음 · 대리 보기 중 AI 호출이 실제로 나가는 것(D-071 취지와 어긋난다) — 각각 정책·기능 판단이 필요해 남겼다.

### 남긴 사실

E2E가 `.env`의 실제 키로 **OpenRouter를 실제 호출한다.** D-112로 데모 응답까지 실패로 판정하게 되면서, 키가 없는 환경에서는 오답노트 정리 관련 테스트가 `test.skip` 경로로 간다(가드가 이미 있다 — `student-flow.spec.ts:618`·`699`). 이번 전수 471건은 키가 있는 상태에서 통과한 값이다. 네트워크 의존을 끊는 것은 A-084(`page.route('**openrouter.ai/**')`)와 같은 뿌리다.

---

## 2026-08-06 — 작업 트리 전수 코드 리뷰(high)와 수정

`/code-review high --fix`. 대상은 커밋되지 않은 작업 트리 전체(`git diff HEAD`, 165개 변경 파일). 파인더 4개 → 후보 37개 → 위치마다 독립 검증 → **31 확인 / 6 반박**, 중복을 합쳐 **10건**으로 보고했다. 열 건 모두 고쳤다.

### 두 갈래로 모인다

**① Scody AI 배관.** 직전 판단(D-112)이 데모 응답을 실패로 묶었는데, 그러면 **키 없는 빌드에서 오답노트 대화가 시작되지 않아** 정리 흐름 전체가 죽는다는 것이 드러났다. 막아야 할 것은 보여 주는 것이 아니라 학생의 메모로 남는 것이라, 질문을 둘로 나눴다(D-115).

- `isAiFailure` — 화면에 답변으로 그릴 수 없는 것. **빈 문장을 포함한다.**
- `isAiSavable` — 거기에 키 없는 데모까지 더해 저장을 막는다.

빈 문장이 여기 들어간 이유는 별개 결함이다: `askScodyAIStream`의 **비스트림 경로**(네이티브는 항상 이 경로다 — `Response.body.getReader`가 없다)가 파싱 결과를 그대로 돌려줘 `''`가 성공으로 통과했다. 그러면 `setDig(id, '')` 뒤에 `노트에 정리했어요`가 뜨고, 아이콘은 `노트에 정리됐어요`로 바뀌는데 메모는 어디에도 없고 캡션은 그 오답을 계속 미정리로 센다. 두 경로가 **같은 빈 응답 문장**을 쓰도록 상수로 묶었다.

데모 문장 자체도 고쳤다 — 질문을 되돌려 주지 않고 `.env`·dev 서버 안내를 담지 않는다. 그 되울림이 "학생의 메모가 자기 질문 + 정답 컨텍스트가 되는" 결함을 처음 만든 자리였다(§19: 개발자 문구를 사용자 화면에 내보내지 않는다).

카드 복습은 실패 문장을 **거르지 않고 있었다**(오답노트만 걸렀다). `Scody AI 연결 오류: … (브라우저 CORS/네트워크 확인)`이 `Scody AI` 이름표 아래 정상 답변 서식으로 그려졌고, 그 대화가 생기면 `노트에 정리해 두기`가 나타나 **오류 문장을 컨텍스트로 메모를 만들었다.** 오답노트와 같은 규칙(D-107)으로 맞추고 대기 표시도 같은 문장으로 뒀다.

**② 대리 보기 경계.** 세 부류가 나왔다.

- `PricingProvider`가 `SessionProvider` **밖**이라 `readOnly`를 읽을 수 없었다. `offerToPay`/`cancelOffer`는 학부모 화면에서 쓰는데, 대리 중 운영자가 누르면 **학부모 계정의 `대신 내주기`가 실제로 바뀌었다.** provider를 안으로 옮겼다(D-116) — `ContentProvider`가 같은 이유로 이미 안에 있었다.
- 쓰기가 거부됐는데 **성공을 알리는** 자리 6곳: `notebook`의 정리·초기화, `ChildReport`의 다시 풀기·주간 요약·칭찬, `queue`의 빼기, `academy/manage`의 선생님 제외. 전부 `if (readOnly) return;`으로 막았다. `notebook`은 자기 파일 안에서 별표·담기·지우기는 이미 지키고 있었는데 정리만 빠져 있었다.

### 나머지 넷

- **`/parent/child/[id]`의 소유 확인이 사라졌다.** 리다이렉트로 바꾸면서 `getChildren(...).find(...)`가 빠져, 모르는 id도 `/parent/report?child=…`로 넘겼다. 리포트는 모르는 id를 **조용히 버리고 첫 자녀로 되돌린다** — 주소는 다른 학생을 가리키는데 화면은 내 첫 자녀의 성적·약점·다시 풀기를 보여줬다. 모르는 id는 붙이지 않는다.
- **카드 복습에서 진행 중인 호출이 다음 카드로 넘어갔다.** 답을 기다리는 동안에도 `다음 문제`가 눌리고, 그러면 A 카드의 답이 B의 대화가 되고 **그 대화로 만든 메모가 B의 오답노트 메모로 저장됐다.** 호출을 카드에 묶어 회차가 다르면 결과와 조각을 버린다(D-118).
- **정리된 상태의 머리 아이콘이 메모를 덮어썼다.** 이름이 `노트에 정리됐어요`라 상태로 읽히는데 누르면 확인도 되돌리기도 없이 새 요약으로 바뀌었다. 정리된 뒤에는 상태 표시로 두고, 다시 정리하는 행동은 메모 아래 이름 달린 버튼 둘이 맡는다.
- **담아 둔 학습의 순서 바꾸기가 죽어 있었다.** 담긴 순서와 보이는 순서가 공개 종료만큼 어긋나는데 바로 옆 칸과 바꿔서, 옆이 빠진 칸이면 화면에서 아무 일도 일어나지 않았다. 보이는 순서를 넘겨 건너뛰게 하고 순수 함수에 단위 테스트 3개를 더했다(D-117).
- **`Passage`의 `key`에 `firstId`가 들어가 필기가 지워졌다.** 첫 문항이 바뀌면 목록의 **모든** 지문이 새로 마운트돼 학생이 그려 둔 획이 사라졌고 되돌리기로도 살아나지 않았다. `key`를 그 노트의 콘텐츠로 바꿨다 — `defaultOpen`은 첫 마운트에만 쓰이므로 대신 학생이 접고 펼친 상태가 남는다(`review.tsx`와 같은 판단).

### 검증

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | **오류 0 · 경고 5**(기준선 그대로) |
| `npm test` | **184 통과 / 10 스위트**(순서 바꾸기 테스트 3개 추가, 181 → 184) |
| `npx playwright test` | **471 통과 / 0 실패**(11스펙 × 3뷰포트, 6.8분) — 실제 키가 있는 상태 |
| **키 없는 빌드** | `EXPO_PUBLIC_OPENROUTER_API_KEY=`로 다시 빌드해 오답노트 AI 스펙 8개: **6 통과 / 2 skip / 0 실패**. 고치기 전이라면 `summ` 아이콘을 못 찾아 하드 타임아웃했을 자리다. 지금은 아이콘까지 도달하고(데모 답이 대화에 그려진다) 저장 가드에서 skip한다(데모는 메모가 되지 않는다) |

키 없는 빌드는 확인 뒤 정리했다(`dist/`는 `.gitignore`에 있다). 번들에 키 형태 문자열이 없는 것도 함께 확인했다.

### 테스트를 고친 것

주석 한 줄(`데모 응답은 질문을 되돌려 주므로…` → `모델이 질문을 되풀어 줄 수 있으니…`). 데모 문장에서 되울림을 없앴으니 이유가 달라졌고, 단정(`.first()`)은 그대로다. **삭제·skip·완화 없다.**

### 반박된 것 6건

`numeric` 스타일 중복 · `ClassPerf` 비교자 복사 · `byDueAsc` 재구현 · 복습 딥링크의 `encodeURIComponent` · `Table.sorted` 메모 없음 · `useQueuedItems`의 `Map` 재생성. 검증에서 근거가 서지 않아 고치지 않았다.

---

## 2026-08-06 — 정리 리뷰(`/simplify`)와 적용

재사용·단순화·효율·고도 네 관점을 작업 트리 전체(약 100개 코드 파일)에 병렬로 돌렸다.

### 네 관점이 한 갈래로 수렴했다 — "뽑아 놓고 옮기지 않았다"

`BarRow`·`SourceValue`·`theme/styles.ts`의 `row`/`inset`이 **전부 호출부 0곳**인데, 그것들이 대체하려던 손코드는 그대로 살아 있었다. 셋 다 자기 주석이 문제를 **과거형으로** 적어 두었지만 현재형이었다.

가장 아팠던 것은 `BarRow`다. 주석이 *"390에서 학원 영역별은 트랙이 94px, 학생 상세는 82px까지 눌려 있었다"*고 적었는데, **그 두 숫자가 당시 코드의 산술 결과와 한 자리도 다르지 않았다** — 컬럼 358 기준 `358−92−148−24 = 94`, `358−84−168−24 = 82`. 즉 고쳤다고 기록된 결함이 화면에 그대로 있었고, 트랙이 120px 미만이면 두 줄로 쌓는 동작은 컴포넌트 안에만 있었다.

**결정: 지우지 않고 이관을 끝냈다.** `BarRow`는 실측된 모바일 결함을 고치는 물건이라 지우면 그 수정을 잃는다. 반대로 `styles.ts`의 `row`는 **지웠다** — 다섯 개 전부 호출부가 0인데 `row.end`의 주석만 "오른쪽 정렬은 이 하나로만 한다"고 규칙을 선언하고 있었다. 손으로 쓴 `space-between`이 23곳, `flexDirection:'row'` 뭉치가 60곳이라 이관은 이 작업 범위 밖의 일괄 치환이고, **지켜지지 않는 규칙을 선언한 파일이 남아 있는 것이 제일 나쁘다.** `inset`은 복사본이 4개뿐이라 이관했다.

| 컴포넌트 | 전 | 후 |
|---|---|---|
| `BarRow` | 호출 0 · 손코드 5벌 | 호출 **8곳** |
| `SourceValue` | 호출 0 · 축자 복사 5벌 | 호출 **28곳** |
| `inset` | 호출 0 · 복사 4벌 | 호출 **8곳** |
| `row` | 호출 0 | **삭제** |

### 함께 드러난 것

- **`inset.action`이 이미 갈라져 있었다.** 세 화면이 주석으로 ``(`analytics.tsx`와 같은 자리)``라고 주장하는데 하단 여백이 `md`/`sm`으로 달랐다. `md`로 통일했다(선언과 다수가 `md`, 같은 파일 안의 `panel`도 `md`).
- **`BarRow`의 한 줄 렌더 순서가 라벨/값/트랙이었다** — 막대가 행 오른쪽 끝에 붙는다. `DESIGN.md:367`("라벨 / `ProgressBar` / 값")과 자기 doc 첫 줄과 옮겨야 할 손코드 셋 다 반대를 말한다. 순서를 고쳐야 "화면을 바꾸지 않으면서 `BarRow`를 쓴다"가 가능했다.
- **`BarRow` 채택으로 실제로 바뀌는 것 셋**: 라벨 색 `secondary`→`default`, 행 높이 `28`→`touch.dense`(36), 스크린리더 문장이 생김(`accessibilityLabel="{라벨} {값}"`). 앞의 둘은 눈에 보인다 — 값보다 라벨이 진해지고 막대 줄이 8px씩 높아진다.
- **`Table`에 죽은 prop이 다섯 개** 있었다(`stackFull`·`stackTitleKey`·`stackSubtitleKeys`·`stackTrailingKeys`·`narrow:'fold'`). 전부 호출부 0인데 문단 단위 주석이 달려 규칙처럼 읽혔다 — 다음 사람이 "그 화면"을 찾으러 간다. 지우면서 `stackSubtitle()` 전용 함수와 분기 셋도 사라졌다.
- **`ExpandPanel`의 페이드는 한 번도 실행되지 않았다.** `useReplayFade('open', {from:0})`의 키가 문자열 리터럴이라 절대 바뀌지 않고, 컴포넌트는 펼칠 때마다 새로 마운트되므로 effect가 항상 첫 렌더 가드에 걸린다. `opacity`는 영원히 1이었는데 주석 두 개가 "짧게 떠오른다"고 말했다.
- **행 껍데기가 글자 그대로 두 벌**이었다(쌓기·표). `aria-expanded`·`accessibilityLabel`·펼침 토글이 두 곳에 있어 **한쪽만 고치면 좁은 화면에서만** 스크린리더가 달라진다. 정렬 UI도 같아서 함께 합쳤다 — 실제로 `__tests__/table.test.tsx`는 헤더의 `aria-selected`만 보고 쌓기 칩은 보지 않는다.
- **`justSaved`가 `n.dig`의 두 번째 진실**이었다. `setJustSaved(true)`는 `setDig` 성공 뒤에만 도달하므로 항상 파생 가능하다. `justSaved[n.id] || n.dig`가 한 블록에서 네 번 반복되고 있었다.
- **오답노트와 카드 복습이 요약 프롬프트를 각자 들고 있었고 두 글자만 달랐다**(`학생이 나중에 다시 볼` / `학생이 다시 볼`). 같은 기능의 두 화면이 다른 요약을 내놓는 경로이고 테스트로 안 잡힌다. `ctx()`와 함께 `src/features/prompts.ts`로 모았다(`WRONG_MEMO_SYSTEM`·`wrongCtx`).
- **대리 보기 토스트 가드가 두 곳 더 빠져 있었다** — `parent/children.tsx`(`offerToPay`/`cancelOffer`)와 `parent/attempt.tsx`(`requestRetryFor`). 뒤엣것은 **같은 행동이 `ChildReport`에서는 지켜지고 있었다.** 한 행동, 두 화면, 한쪽만.
- **`hardestQuestions`가 푼 사람 수를 제출당 셌다** — 한 배정의 모든 제출이 같은 문항 집합을 보므로 배정당 한 번이면 된다. 원장 26주 실측 Map 쓰기 97,073회 → 5,452회.
- **`useStudentItems`가 렌더마다 두 번 돌았다** — `useQueuedItems`가 안에서 다시 부르는데 둘 다 쓰는 화면(학생 홈·학습 탭)이 있고, 홈은 질문 입력을 같은 컴포넌트에 들고 있어 **글자 하나마다** 두 벌이었다. 배정 필터가 앱 전체 제출 행(실측 16,899행 → 결과 15건)을 훑는다. `useMemo`로 감쌌다.

### 확정 정책과 부딪혀 멈춘 것

`Table`의 접힘 표시를 `Disclosure`와 같은 관용구(`chevron-down`/`chevron-right`)로 통일하려 했으나 **D-074 ⑤**(펼침 표는 아래·위 chevron, 이동의 오른쪽 chevron과 갈려야 한다)와 **D-084 ③**(눌리는 표의 마지막 열 `chevron-right` = 이동)에 걸린다. 접힘을 `chevron-right`로 두면 같은 표 오른쪽 끝에서 그 글리프가 두 뜻을 갖는다. 정책을 임의로 바꾸지 않고 **글리프 이름만 사실대로**(`chevron-right` 90° 회전 → `chevron-down`) 고쳤다. 픽셀은 같다. D-074 ⑤ 괄호의 "`chevron-right`를 90° 돌려 쓴다"가 이제 구현과 다르다 — 통일하려면 정책 개정이 먼저다.

### 검증

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | **오류 0 · 경고 5**(기준선) |
| `npm test` | **184 통과 / 10 스위트** |
| `npx playwright test` | **471 통과 / 0 실패**(3뷰포트, 6.8분) |
| 화면 | 학원·운영자·학부모 화면을 1280·820·390에서 확인. 390에서 막대가 두 줄로 쌓이는 것을 캡처로 확인 |

### E2E가 어느 서버로 도는지에 따라 결과가 갈린다 (→ A-088)

전수 중 학부모 테스트 2개가 3뷰포트에서 실패했다가, 서버를 바꾸니 통과했다. 원인을 끝까지 봤다:

- `npm run web`(Metro 개발 서버) → `.env`의 키가 들어가 Scody AI가 동작 → 통과
- `npm run web:preview`(= `expo export` + `serve dist`) → **번들에 키가 없어** 모든 AI가 데모 폴백 → 실패

`playwright.config.ts`의 `webServer`는 `web:preview`이고 `reuseExistingServer`가 켜져 있다. 그래서 개발 서버가 떠 있으면 그것을 재사용해 통과하고, 없으면 키 없는 빌드를 만들어 실패한다. **오늘 앞선 전수들이 통과한 것은 세션 내내 개발 서버가 떠 있었기 때문이다.**

코드 문제가 아니라 빌드·환경 문제이고, 더 중요한 뜻이 있다 — **지금 만들어지는 출시용 웹 빌드에서는 AI가 죽어 있다.** M9-02(키를 클라이언트에서 빼고 서버 프록시로)와 정면으로 맞물리므로 A-088로 올렸다.

### 하지 않은 것

- **A-090** `ProgressProvider` 시작 시 합성 이력 생성(모든 방문자 36.7ms + 2.69MB) — `assignments` 배열의 내용이 시점에 따라 달라지므로 읽는 화면 전부를 함께 봐야 한다. 정리 범위 밖.
- **A-089** `useTableSort` 페이지 보정 누락 5곳 — 실제 결함이지만 6개 화면의 동작 변경이라 별도 작업.
- **A-091** `AppText`의 `weight`/`tone`/`numeric` 미사용(약 70곳) · 생 숫자 `gap` 35곳 — 일괄 치환이라 `CLAUDE.md`의 "요청과 무관한 리팩터링 금지"에 걸린다.
- `useNativeDriver: false` — 애니메이션 대상이 전부 `opacity`/`transform`이라 네이티브에서는 바꿀 값이 있으나, react-native-web은 이 플래그를 무시하고 네이티브 실측을 하지 않았다. 관례로 두고 남긴다.
- `solve/[id].tsx`의 2단 판단이 `useResponsive`(창)인 것 — `Table`이 방금 고친 것과 같은 종류라는 지적이 있었으나, 그 2단을 **만드는** 것이 이 화면 자신이라 창으로 재는 쪽이 규칙에 맞을 수 있다. 판단이 갈려 손대지 않았다.
- `EmptyState` 이관이 12곳 넘게 남은 것(`Row title="…없어요"`) — 학부모 세 화면만 이번에 합쳤다.

---

## 2026-08-06 — 절제된 모션: reduce motion 기반 + Lottie 구조 + AI 대기 4곳

### 조사가 뒤집은 전제 셋

**① 토스의 그 마이크로 인터랙션은 Lottie가 아니다.** 비공개 코드 엔진 `Rally`다(SLASH 23 발표 · [토스 인터랙션 디자이너의 모든 것](https://toss.oopy.io/)). 토스가 Lottie를 쓰는 곳은 3D 일러스트와 로딩/완료 상태뿐이고 **전부 CDN 원격 로드, JS 번들에 넣지 않는다**(`@toss/tds-react-native` 번들에 `static.toss.im/lotties-common/*.json` 절대 URL이 하드코딩돼 있다).

토스 CDN에서 실제 파일을 받아 재 봤다 — 이 표가 우리 상한의 근거다:

| 파일 | 크기 | 레이어 | 내장 PNG 비중 |
|---|---|---|---|
| `check-green-spot.json` (토스트 체크마크) | **3.0 kB** | 2 | **0% — 순수 벡터** |
| `error-yellow-spot.json` | 115.8 kB | 34 | 93% |
| `alarm-spot.json` | 245.7 kB | 44 | 95% |

토스의 3D 애셋은 **PNG 시퀀스를 base64로 박아넣은 것**이라 gzip도 28%밖에 안 줄고, 저사양 안드로이드에서 Lottie가 느려지는 알려진 원인과 정확히 겹친다(`airbnb/lottie-android#167` — matte·mask·이미지). 반대로 마이크로 인터랙션은 3 kB다. → `assets/motion/README.md`의 상한(벡터 20 kB, 이미지 임베드 금지)이 여기서 나왔다.

토스 공식 그래픽 가이드 원문도 우리 판단과 같다: *"그래픽은 장식이 아니라, 사용자가 화면의 의미를 더 쉽게 이해하도록 돕는 역할이에요"*, *"기다릴 필요가 없는데 로딩 애니메이션을 사용하는 경우 사용자가 상황을 오해할 수 있어요."*

**② 안전하게 검증된 CC0 Lottie 라이브러리가 없다.** LottieFiles "Free"는 **Lottie Simple License** — 상업 이용은 되지만 CC0가 아니고 share-alike이며 **비침해 보증이 없다**(유저 업로드 플랫폼이라 남의 IP가 "Free"로 올라와 있어도 책임은 우리다). IconScout "Public Domain"은 이름만 그렇다. 진짜 퍼블릭 도메인은 loading.io `LD-FREE` 하나인데 로더 전용이다. → **애셋을 하나도 커밋하지 않았다**(A-092). 이 레포는 폰트에서 같은 판단을 한 전례가 있다(D-053).

**③ 이 앱에서 기다리는 곳은 AI 호출 4곳뿐이다.** 나머지는 전부 메모리 fixture라 즉시 끝난다. `ActivityIndicator` 사용처도 원래 0건이었다.

### 한 것

**1. reduce motion 지원 (D-119)** — 레포에 처리가 **0건**이었다. `src/theme/useReduceMotion.ts` 하나로 웹·네이티브를 덮는다(RNW 0.21.2가 `AccessibilityInfo.isReduceMotionEnabled()`를 `matchMedia`로 구현해 둔다 — `node_modules` 실물 확인, 플랫폼 분기 불필요). `useMotion`의 훅 둘 · `Button` · `IconButton` · `Toast` · `Reveal`에 게이트를 달았다. **느리게가 아니라 아예 하지 않는다.**

**2. `PendingDots`** — 점 셋이 차례로 옅어진다. `opacity`만, `motion` 토큰만, 의존성 0. 모션 줄이기면 정적. `aria-hidden`.

**3. Lottie 구조 (D-121)** — `lottie-react-native@7.3.8` + `@lottiefiles/dotlottie-react@0.13.5`(정확히 핀 — 최신 0.19.12는 peer `^0.13.5`와 ERESOLVE 충돌), `metro.config.js`에 `lottie` 확장자, `npm run motion:wasm`(WASM 1.79 MB를 `public/`으로 복사, **레포에 커밋하지 않는다**), `assets/motion/registry.ts`(비어 있음) + `README.md`(라이선스 확인 절차).

**핵심 판단**: 재생부를 `MotionAsset.lottie.tsx`로 격리하고 **부르지 않는다.** 실측으로 갈렸다 —

| | 번들 gzip | 델타 |
|---|---|---|
| 기준 | 498,115 B | — |
| 재생부를 부를 때 | 558,375 B | **+60,260 B (+12.1%)** |
| **부르지 않을 때(현재)** | **498,944 B** | **+829 B (+0.17%)** |

`web.output: "single"`이라 코드 분할이 없어 함수 안 `require`로 미뤄도 번들에서 빠지지 않는다. 레지스트리가 비어 있어 **아무것도 재생되지 않는데** 모든 방문자가 60 kB를 내는 것은 사용자 원칙("번들 크기 고려")에 어긋난다. +829 B는 실제로 도는 코드(`PendingDots`·`useReduceMotion`·`MotionAsset`)다.

**4. AI 대기 4곳 (D-120)** — `ask.tsx` · `notebook.tsx`(답 대기·정리 대기) · `review.tsx` · `ChildReport.tsx`(주간 요약). **문구는 그대로 두고** 옆에 표시만 붙였다.

**함께 고친 것**: `ChildReport.tsx`의 `label={busy ? '만들고 있어요' : '다시 요약하기'}` — 상태를 버튼 이름 자리에 넣어 §8을 위반했고(같은 파일 아래 블록의 주석이 같은 규칙을 이미 적어 두고 있었다), `busy` 중에도 눌리는데 `make`가 첫 줄에서 되돌아가는 **죽은 버튼**이었다. 라벨을 고정하고 작업 중에는 누를 수 없게 했다. 두 분기가 같은 진행 문구를 쓰도록 `WeekSummaryPending`으로 모았다.

### 검증

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | **오류 0 · 경고 5**(기준선) |
| `npm test` | **184 통과** |
| `npx playwright test` | **471 통과 / 0 실패**(3뷰포트, 6.8분) |
| 번들 | **498,944 B gzip (+0.17%)**. `dotlottie`·`lottie-react-native` 문자열이 번들에 **0건** |

**브라우저 실측**(OpenRouter를 `page.route`로 지연시켜 대기 구간을 붙잡음):

| 확인 | 일반 | 모션 줄이기 |
|---|---|---|
| 대기 표시 | 보임 23×5, 점 3개 | 보임 23×5, 점 3개 |
| 400 ms 뒤 opacity | `0.93,0.25,0.58` → `0.29,0.76,0.98` **움직인다** | `0.45,0.45,0.45` → 동일 **정지** |
| `aria-hidden` | `true` | `true` |
| **Lottie·WASM 요청** | **0건** | **0건** |

증거: `docs/evidence/motion-review-pending-{mobile,desktop}.png`.

전수 중 오답노트 AI 테스트 2건이 한 번 실패했다가 단독 재실행에서 6/6 통과했다 — 오늘 반복 호출로 인한 업스트림 일시 실패이고, 최종 전수는 471 전부 통과했다.

### 남긴 것

- **A-092**: 실제 애셋 0개. 라이선스 원문을 사람이 확인한 뒤 넣는다. 켜면 번들 +60 kB이므로 그만한 값이 있는지 먼저 판단한다.
- **A-093**: Lottie 경로가 네이티브에서 미검증(빌드 환경 자체가 없다). 웹·네이티브가 **완전히 다른 렌더러**라 웹에서 됐다고 네이티브가 되는 것이 아니다.
- 제출 완료·빈 상태·오류·온보딩에는 넣지 않았다(D-120) — 지금 화면이 이미 조용한 확인을 하고 있고 §9의 `폭죽·큰 배지 금지`가 그 자리를 겨냥한다.

### 이어서 — Lottie를 실제로 켰다

첫 판에서 애셋을 하나도 넣지 않아 화면에 Lottie가 **하나도 보이지 않았다.** 사용자가 그것을 지적했고, 맞는 지적이었다 — 라이선스를 막다른 길로 판단하고 멈춘 것이 문제였다.

**놓친 길: 직접 만들면 된다.** Lottie JSON은 공개 포맷이고 순수 벡터는 손으로 쓸 수 있다. 우리가 저작권자면 라이선스 문제가 우회가 아니라 **소거**된다(D-121). A-092를 닫았다.

`assets/motion/build.ts`가 애니메이션을 코드로 만든다:

| 이름 | 내용 | 왜 Lottie인가 |
|---|---|---|
| `pending` | 점 셋이 크기·불투명도를 함께 줄였다 돌아온다(반복) | 코드로도 되지만 같은 경로를 쓴다. 대체물이 그대로 이 역할을 한다 |
| `check` | 선이 스스로 그려지는 완료 체크(trim path, **한 번만**) | **코드로 하기 어렵다** — `react-native-svg`의 `strokeDashoffset`을 `Animated`로 몰아야 하고 그 경로가 레포에 없다. 토스도 토스트 완료 아이콘을 같은 방식으로 만든다 |

**파일이 아니라 함수인 이유는 색이다.** Lottie는 색을 파일에 굽는데 강조색이 라이트 `#20808d` / 다크 `#3aa7b1`로 갈린다. 정적 파일이면 다크에서 색이 틀리거나 같은 그림을 두 벌 든다. `lottie-react-native`가 `source`로 객체를 받으므로 그릴 때 넣는다.

적용: 대기 4곳 + **`Toast`의 완료 체크**(빼기는 완료가 아니라 정적 글리프 그대로).

### 고치면서 부딪힌 것

1. **파일명 `MotionAsset.lottie.tsx`가 번들을 깨뜨렸다.** `metro.config.js`에 `lottie`를 애셋 확장자로 넣어서 Metro가 모듈이 아니라 애셋으로 해석했다(`Unable to resolve "./MotionAsset.lottie"`). `LottiePlayer.tsx`로 이름을 바꿨다.
2. **정사각 박스에 가로로 긴 애니메이션이 눌렸다.** 애셋이 자기 캔버스 `w`/`h`를 들고 있으므로 `MotionAsset`이 그 비율로 폭을 정하게 했다. 토큰도 갈랐다 — `inline 12`(글자 옆 높이) / `sm 20`(아이콘 자리).
3. **모션 줄이기를 켜도 WASM을 받고 있었다.** `useReduceMotion`의 초기값이 `false`고 실제 값은 비동기로 왔다 — 그 한 프레임에 재생부가 떠서 이미 내려받았다. 내가 세운 규칙("무거운 것은 불러오지도 않는다")을 스스로 어긴 것이다. 웹은 같은 미디어 쿼리를 동기로 읽을 수 있어 초기값을 그것으로 바꿨다.

### 검증

| 항목 | 결과 |
|---|---|
| `typecheck` · `lint` | 통과 · **오류 0 · 경고 5**(기준선) |
| `npm test` | **184 통과** |
| `npx playwright test` | **471 통과 / 0 실패** |
| 번들 | **559,286 B gzip (+61,171 B / +12.28%)** — 재생부를 켠 값이다. 애니메이션을 더할 때가 아니라 **재생부를 켤 때 한 번** 드는 비용이라 새 애셋은 그 위에서 거의 공짜다(애셋 소스 전체가 6.5 kB) |
| WASM | `public/`에 자체 호스팅. 실측으로 요청이 **jsDelivr가 아니라 `/dotlottie-player.wasm`**으로 나간다. 바이너리는 `.gitignore`에 넣고 `npm run motion:wasm`으로 만든다 |

**브라우저 실측**(390):

| 모드 | Lottie canvas | 대기 표시 | WASM 요청 |
|---|---|---|---|
| 일반 · 라이트 | **1** | 보임 | `dotlottie-player.wasm` |
| 일반 · 다크 | **1** | 보임 | `dotlottie-player.wasm` |
| 모션 줄이기 | **0**(정적 폴백) | 보임 | **없음** |

콘솔 오류 0. 증거: `docs/evidence/motion-{toast-check,pending-lottie}-mobile.png` · `motion-{normal-light,normal-dark,reduce-light}.png`.

## 2026-08-06 — 학생 화면의 행동 줄: 한 줄에 버튼 하나

사용자가 `ActionBar`의 규칙을 셋으로 다시 정했다(구현은 `src/components/ActionBar.tsx`, 이 작업 밖에서 먼저 들어왔다): **①한 줄에 버튼 하나 ②오른쪽 끝 정렬 ③한 대상에 속한 행동은 행동 줄에 두지 않는다**. 개발 빌드에서 자식이 둘 이상이면 `console.warn`이 뜬다. 그 경고가 남아 있던 `app/student/**` 일곱 자리를 옮겼다. **기능·데이터·API는 건드리지 않았다 — 자리와 이름만 다뤘다.**

| 자리 | 있던 것 | 옮긴 곳 | 판단 |
|---|---|---|---|
| `[id].tsx` 확인 단계 | `기록을 바꾸고 다시 풀기` + `그대로 둘게요` | `ConfirmStep` | 확인 단계의 형태는 앱에 하나뿐이다. 손으로 만든 두 버튼 줄이 그 하나를 비켜 가고 있었다. 문구가 `role="alert"`로 읽히고 포커스가 확인 버튼으로 간다 |
| `[id].tsx` 푼 학습 | `결과 다시 보기` + `다시 풀기`(+ 담기) | `Group` + `Row` 둘 | 위 캡션이 이미 "결과를 다시 보거나 한 번 더 풀 수 있어요"라고 두 갈래를 말한다. 그 갈래를 그대로 두 줄로 폈다. chevron은 바로 화면을 여는 `결과 다시 보기`에만 |
| `[id].tsx` 안 푼 학습 | `학습 시작하기` + 담기 | 시작하기만 남김 | — |
| `[id].tsx` 담기 토글 | 행동 줄 끝 | **학습 이름 옆**(`DetailHead`) | 이 학습 하나에 딸린 행동이다(규칙 3). 390에서는 이름 아래로 내린다 — 이름 옆에 두면 `헷갈리는 맞춤` / `법·어법`처럼 낱말 가운데서 접혔다(D-109와 같은 방식, `useColumn`) |
| `learn.tsx` | `풀러 가기` + `학습할 문제 담으러 가기` | `Group` + `Row` 둘 | 갈 곳이 둘이면 목록으로 고르게 한다. 순서가 위계다(담아 둔 것 → 새로 고르기, D-047). `풀러 가기`는 줄 제목으로는 뜻이 서지 않아 스크린리더가 읽던 이름(`담아 둔 학습 풀러 가기`)을 올렸다 |
| `notebook.tsx` 마무리 카드 | `나중에 할게요`/`기록 보러 가기` + `더 정리할게요` | 카드 안 `Row` 둘 | 위 물음("나중에 오답노트 하시겠어요?")에 대한 두 답이라 카드에 붙어 있어야 한다. 나가는 줄에만 chevron |
| `result/[id].tsx` | `오답노트 하러 가기` + `홈으로 갈게요` | 오답노트는 **`오답노트할 문제 담기` 섹션 제목 옆**, 행동 줄에는 `홈으로 갈게요`만 | 둘 다 `…가기`로 끝나는 버튼이 나란히 서서 어느 것이 화면의 끝인지 몰랐다. 오답노트는 방금 담은 문항들에 딸린 길이다 |
| `review.tsx` 완료 요약 | `처음부터 다시 복습하기` + `기록으로 돌아가기` | 다시 복습은 요약 카드 안 `Row`, 행동 줄에는 기록으로만 | 다시 복습은 방금 읽은 숫자를 그대로 되감는 일이다 |
| `review.tsx` 카드 | `다음 문제` + `노트에 정리해 두기` + `이제 이해했어요` | 정리 → `더 파고들기` 섹션 제목 옆, 이해 완료 → **문항 카드 안**, 행동 줄에는 `다음 문제`만 | `다음 문제`가 이 화면의 목적을 끝내는 행동이고 나머지 둘은 각각 대화와 문항에 딸린 것이다. `이해 완료`는 여전히 버튼이 아니라 글자다(§8·D-036) |

### 화살표를 뗀 곳

화살표는 **지금 하던 일을 끝내고 다음으로 넘어가는 행동**에만 둔다(기록 화면에서 정한 기준). 그 기준으로 셋을 뗐다.

- `learn.tsx`의 `풀러 가기`·`학습할 문제 담으러 가기` → 방식을 고르는 목록 줄이라 `Button`의 `arrow-right` 대신 목록의 chevron.
- `result/[id].tsx`의 `오답노트 하러 가기` → 담은 것을 어디서 보는지 알려 주는 옆길이다(기록 화면의 `질문하고 메모하기`와 같은 자리·같은 규칙).
- `review.tsx`의 `노트에 정리해 두기` → 카드를 넘기는 행동이 아니다.

남긴 화살표는 `학습 시작하기`·`다음 문제`/`복습 마치기` 둘뿐이다.

### 고친 테스트

| 파일 | 무엇을 | 왜 |
|---|---|---|
| `e2e/student-flow.spec.ts:183` | `그대로 둘게요` → `취소` 버튼 | 확인 단계를 `ConfirmStep`으로 바꿨다. 되돌리는 쪽 이름은 앱 전체가 `취소` 하나다(§17의 "문장형 확인 버튼은 쓰지 않는다"와 같은 방향) |
| `e2e/student-flow.spec.ts:265` | `solve.x < pick.x` + 폭 상한 → `solve.y < pick.y` + `x`가 같음 | 학습 탭의 두 버튼이 목록 두 줄이 됐다. 단정의 뜻(담아 둔 것이 먼저)은 그대로 두고 축만 바꿨다 |

지우거나 skip한 테스트는 없다.

### 검증

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npx eslint app/student` | **오류 0 · 경고 0** |
| `npm test` | **184 통과** (10 스위트) |
| `npx playwright test --project=desktop` | **157 통과 / 0 실패** |
| `npx playwright test e2e/student-flow.spec.ts --project=mobile` | **40 통과** |
| `ActionBar` 경고 | 개발 서버 콘솔에서 **0건** — 바뀐 화면 전부를 훑는 브라우저 스크립트로 확인(1280·390·다크). 남은 콘솔 경고 3종은 기존 것(require cycle · `shadow*` · `pointerEvents`) |

증거: `docs/evidence/actionbar-{learn-mobile,detail-mobile,detail-dark-mobile,detail-done-desktop,detail-confirm-desktop,result-mobile,notebook-wrapup-mobile,review-desktop,review-mobile,review-done-desktop}.png`

### 남긴 것

- `DESIGN.md` §8의 `ActionBar` 항목과 `SCODY_MASTER_PLAN.md` D-093은 아직 **"왼쪽 정렬, 주 행동이 맨 앞"**이라고 적혀 있다 — 규칙이 바뀌기 전 문장이다. 규칙 자체를 바꾼 변경(`ActionBar.tsx`)의 기록이라 이 작업에서 손대지 않았다. §14-1(학습 탭)은 내가 바꾼 화면이라 함께 고쳤다.
- `app/academy/**`·`app/parent/**`·`app/admin/**`에도 같은 경고가 남아 있는지는 확인하지 않았다(이 작업의 범위는 `app/student/**`).

---

## 2026-08-06 — 버튼 배치 규칙 뒤집기 · 필기 제거 · 진행 표시 교체

사용자 지시 넷을 처리했다. 셋은 규칙을 바꾸는 일이라 `DESIGN.md`와 결정 기록을 함께 고쳤다.

### 1. 필기 기능 제거

`Passage`의 `필기`·`지우기` 버튼과 그 아래 전부(`PanResponder`·`Svg`/`Path` 오버레이·`strokes`/`current`/`pts`/`size` 상태·`onLayout`)를 걷어냈다. 파일 상단의 `eslint-disable`(PanResponder ref 패턴)도 함께 사라졌다. `react-native-svg`는 `Sparkline`·`WebLanding`이 계속 써서 패키지는 남는다.

`notebook.tsx`·`review.tsx`에 필기를 근거로 삼던 `key` 주석 두 개가 있었다 — 근거를 지금 사실(접고 펼친 상태 보존)로 고쳤다.

### 2. 접기/펼치기 — 같은 모양의 중복을 찾아 둘 다 새로 만들었다

**중복이 실제로 있었다.** `Passage`의 `tool`과 `ThemeToggle`의 `btn`이 **바이트 단위로 같은 스타일**이었다(테두리만 있는 알약, `paddingHorizontal: md` · `minHeight: touch.min` · `radius.pill` · hairline). 둘 다 앱의 다른 버튼과 모양이 달랐다.

- **`Passage`**: 알약 버튼을 없애고 **제목 줄 전체를 누르는 자리**로 바꿨다. `지문` 글자와 chevron뿐이고 누름 영역은 356×44(모바일)로 오히려 넓어졌다. 접근성 이름(`지문 접기`/`지문 펼치기`)은 그대로라 E2E가 깨지지 않는다.
- **`ThemeToggle`**: 자체 알약을 버리고 `Button variant="secondary"`로. 앱에 버튼 모양이 하나 줄었다.

### 3. 진행 막대 — 같은 말을 두 번 하는 것만 걷어냈다

막대가 20곳에 있었는데 **두 가지 다른 일**을 하고 있었다.

| 하는 일 | 판단 |
|---|---|
| 값 하나 옆에서 같은 비율을 다시 그린다 | **뺀다.** §13의 `의미 없는 배지·수치·그래프`가 이 자리다 |
| 여러 값을 나란히 놓고 길이를 훑게 한다(`BarRow`, 월별 히스토그램, 표 안 행) | **남긴다.** 비교가 실제 정보다 |

뺀 곳: `ScoreCard`(정답률 — 숫자와 `10문항 중 8문항 정답`이 이미 두 번 말한다) · `admin/index`(개인/학원 구성비) · `admin/academy/[id]`(제출률).

**셀 수 있는 진행은 `Steps`로 바꿨다**(신설) — 한 칸이 하나를 뜻한다. 남은 학습 4개면 칸이 넷이다. 비율이 아니라 **개수**를 말해서 옆 숫자와 다른 것을 전한다. 12개를 넘으면 칸이 실처럼 가늘어져 스스로 아무것도 그리지 않는다(25문항 세트). 적용: 학생 홈(남은 학습) · 풀이 화면(문항 진행) · 카드 복습(카드 진행).

### 4. 버튼 배치 — D-093을 뒤집었다 (→ D-122)

사용자 판단이다: *"버튼이 꼭 왼쪽에 몰려있는 거 진짜 어색해"*, *"한 줄에는 반드시 버튼이 하나"*.

`ActionBar`의 규칙을 셋으로 바꿨다:

1. **한 줄에 버튼 하나** — 둘 이상이면 개발 중 `console.warn`. 문서에만 두면 다시 늘어난다.
2. **오른쪽 끝 정렬** — 왼쪽에 몰면 본문 글줄과 붙어 읽을 것과 누를 것의 경계가 흐려진다.
3. **한 대상에 속한 행동은 그 대상 안으로** — 행의 `trailing`, 섹션 제목의 `action`.

`ConfirmStep`만 예외다. 그 자체가 고르는 단계라 `취소`가 결론 바로 옆에 있어야 해서, `ActionBar`를 쓰지 않고 자기 줄을 갖는다.

**전수조사 결과 `ActionBar`에 버튼이 2개 이상인 자리가 14곳이었다.** 전부 고쳤고 지금은 0곳이다.

지목받은 셋:
- **`학원 연결 끊기`** → 학원 이름 행의 `trailing`으로. 카드 아래 행동줄에 있어서 무엇에 대한 연결 끊기인지 카드와 떨어져 보였다.
- **`별표 3개만`** → 이름만으로 뜻이 서지 않았다(*"도대체 뭘 원하는 건지 하나도 모르겠다"*). 세 버튼을 **`Row` 목록**으로 폈다 — `전체 복습하기` / `별표 친 것만 복습하기` / `{영역}만 복습하기`, 넓은 것부터 좁은 것 순. 목록으로 펴자 이름 문제가 저절로 풀렸다.
- **`질문하고 메모하기`의 화살표** → 뗐다. 화살표는 **지금 하던 일을 끝내고 다음으로 넘어가는 행동**에만 붙인다. 이 버튼은 공부 방식을 고르는 옆길이라 `Section`의 `action`(제목 오른쪽)으로 올렸다. 같은 기준으로 학생 화면 3곳, 학원 화면 1곳(`chevron-right`를 버튼 안에 넣은 것)도 고쳤다.

### 검증

| 항목 | 결과 |
|---|---|
| `typecheck` · `lint` | 통과 · **오류 0 · 경고 5**(기준선) |
| `npm test` | **184 통과** |
| `npx playwright test` | **471 통과 / 0 실패** |
| `ActionBar` 경고 | 학생·학원·학부모 화면을 훑어 **0건** |
| 2개 이상 `ActionBar` | 앱 전체 **0곳**(전수 스캔) |

증거: `docs/evidence/rules-{student,academy,parent,records-mobile}.png` · `passage-{simple,collapsed}-{mobile,desktop}.png` · `steps-{home,result}-mobile.png`.

### 테스트를 고친 것

`e2e/student-flow.spec.ts` 두 곳(삭제·skip 없음):
- `그대로 둘게요` → `취소` — 손으로 만든 확인 줄을 `ConfirmStep`으로 바꿔 되돌리는 쪽 이름이 앱 공통이 됐다.
- 두 버튼의 `x` 비교 → `y` 비교 — 두 버튼이 목록 두 줄이 되어 축만 바꿨다. 단정의 뜻(순서가 위계다)은 그대로다.

### 이어서 — 낱개 버튼까지 마무리

앞 단락에서 "8곳 남았다"고 적은 것을 끝냈다. 앱 전체에서 `ActionBar` **밖에** 있는 `<Button>`을 스캔해 둘로 갈랐다.

**행동줄로 옮긴 것(14곳)** — 화면을 끝내는 행동이거나 폼 제출이라 대상이 화면 자체다:
`analytics-goto-assign` · `assign-goto-classes` · `class-add-submit` · `teacher-add` · `manage-goto-classes` · `academy-content-new` · `impersonate-start` · `billing-reset` · `반 목록으로` · `학생 목록으로` · `홈으로 갈게요`×3(학습·결과·풀이의 '찾을 수 없어요') · `학습 탭으로 갈게요`.

**그대로 둔 것** — 규칙 ③에 따라 **이미 자기 대상 안에** 있다: 펼친 행의 마감일 토글(`inset.action`), 학생 행의 `이 반에서 빼기`, 자녀 카드의 결제 표시, `EmptyState`의 `action`, 풀이 화면의 `이전`/`다음` 페이저 쌍, 목록 줄의 도구 버튼.

**함께 정리**: 행동줄 안으로 들어간 버튼에서 `hug`을 뗐다(10개 파일). 가로 줄에서 `alignSelf: flex-start`는 세로 정렬을 위로 밀어 규칙과 어긋난다.

**작업 중 두 파일을 망가뜨렸다가 복구했다.** 한 줄짜리 `<Button ... />`를 감싸는 스크립트가 닫는 `/>`를 같은 들여쓰기의 **다른 컴포넌트 것**으로 잘못 잡아 `app/student/[id].tsx`와 `result/[id].tsx`의 JSX 구조가 깨졌다(`</ActionBar>`가 엉뚱한 자리에, 그 사이 80줄이 2칸 과들여쓰기). 타입 검사가 바로 잡아 냈고 손으로 되돌렸다.

### 최종 검증

| 항목 | 결과 |
|---|---|
| `typecheck` · `lint` | 통과 · **오류 0 · 경고 5**(기준선) |
| `npm test` | **184 통과** |
| `npx playwright test` | **471 통과 / 0 실패** |
| `ActionBar` 경고 | 학원(대시보드·반학생·학원관리) · 운영자(요금제) · 학생(홈·학습) 순회 **0건** |
| 2개 이상 `ActionBar` | 앱 전체 **0곳** |

증거: `docs/evidence/final-{academy,admin,student}-*.png`.

### 남긴 것

- `classes.tsx`에서 `반 만들기`(행동줄)와 `학생 전체 보기`(섹션 제목)가 1280에서 오른쪽에 계단처럼 두 줄로 보인다 — 규칙에는 맞으나 눈으로 볼 값이 있다.
- **A-087**(`이해 완료`가 어떤 화면도 바꾸지 않는다)은 자리만 카드 안으로 옮겼고 뜻은 그대로다.

### 이어서 — 주 행동은 좌우로 늘인다 (D-122 보강)

사용자 지시: *"시작하기, 학습 시작하기, 홈으로 가기 이렇게 한 줄에 메인컬러 온통 칠해진 버튼… 좌우로 길게 늘여줘."*

**`ActionBar`가 `variant`를 보고 자동으로 판단한다.** 화면마다 `stretch`를 손으로 붙였다 말았다 하면 같은 종류의 버튼이 화면마다 다른 폭으로 뜬다 — 실제로 `primary` 행동줄 25곳 중 `stretch`가 붙어 있던 것은 4곳뿐이었다.

- `primary`(강조색 배경 + 흰 글씨) 하나면 → **전폭**. 그 화면에서 할 일 그 자체라 폭이 곧 위계다.
- `secondary`·`ghost`·`kakao` → **오른쪽 끝, 내용 폭**. 되돌아가기·건너뛰기를 같이 늘이면 주 행동과 무게가 같아진다.

이미 붙어 있던 `stretch`·`fullWidth` 군더더기는 걷어냈다(4개 파일). `stretch` prop은 **`primary`가 아닌데 화면의 목적을 끝내는 드문 자리**에만 손으로 준다.

실측: `학습 시작하기`가 모바일 **358px**(컬럼 전폭) · 데스크톱 **680px**(읽기 폭에서 멈춤, 컬럼은 1032px). `wide`(960) 화면에서 960px 버튼은 배너로 읽히므로 상한을 둔다.

앞서 사용자가 지적한 "터무니없이 좌우가 긴 버튼"(`오답노트 복습하기`·`별표 2개만 집중 복습하기`)과 어긋나지 않는다 — 그것들은 주 행동이 아니라 **선택지**였고, 지금은 버튼이 아니라 `Row` 목록이다.

| 항목 | 결과 |
|---|---|
| `typecheck` · `lint` | 통과 · **오류 0 · 경고 5**(기준선) |
| `npm test` | **184 통과** |
| `npx playwright test` | **471 통과 / 0 실패** |

증거: `docs/evidence/wide-{detail,solve}-{mobile,desktop}.png`.

### 고침 — 첫 판은 `ActionBar` 안만 바꿔서 실제로 달라진 게 거의 없었다

사용자 지적이 맞았다. *"시작하기 버튼 그대로잖아. 로그인 버튼은 왜 버튼처럼 안 생겼냐?"*

실측으로 확인한 것:

| | 첫 판 | 고친 뒤 |
|---|---|---|
| 홈 히어로 `시작하기` | **84px** (그대로) | **308px**(모바일) · 630px(데스크톱) |
| 로그인 `휴대폰 번호로 로그인` | `rgb(255,253,247)` = 배경과 거의 같은 면 | `rgb(32,128,141)` = 강조색 |

**원인**: 규칙을 `ActionBar`에 넣었는데, `primary` 버튼 41개 중 행동 줄 안에 있는 것은 일부였다. 홈 히어로의 `시작하기`는 `heroCta`라는 **가로 `View`** 안에 있어 손도 닿지 않았다.

**고친 것**: 규칙을 `Button`으로 내렸다. `variant="primary"`이고 `hug`이 아니면 스스로 전폭이다.

- **`alignSelf`가 아니라 `width: '100%'`**여야 한다. 가로로 놓인 부모(`heroCta`) 안에서 `alignSelf: stretch`는 **세로**로 늘어나고 폭은 그대로다. 첫 판이 실패한 진짜 이유다.
- 곁다리 자리는 `hug`으로 뺀다 — 실측으로 `질문하고 메모하기`(섹션 제목 옆)가 133px로 그대로인 것을 확인했다.
- `ActionBar`는 이제 **줄의 정렬만** 정한다(전폭이면 세로 한 칸, 곁다리면 오른쪽 끝).

**인증 화면**: `휴대폰 번호로 로그인`·`휴대폰 번호로 가입하기`가 `secondary`였다. 크림 배경 위에서 면 색이 거의 같아 상자로만 보였고, 옆의 노란 카카오 버튼과 나란히 놓이니 더 안 보였다. 이 앱의 **실제 로그인 경로**라(카카오는 데모) 강조색을 칠했다. 함께: `leading` 아이콘이 호출부에서 `colors.ink`로 고정돼 있어 채운 배경 위에 어두운 글리프가 남았다 — `accentText`로 바꿨다.

| 항목 | 결과 |
|---|---|
| `typecheck` · `lint` | 통과 · **오류 0 · 경고 5**(기준선) |
| `npm test` | **184 통과** |
| `npx playwright test` | **471 통과 / 0 실패** |

증거: `docs/evidence/wide-{login,home}-mobile.png` · `wide-home-desktop.png`.

### 고침 — `hug`이 가로 줄에서 세로 정렬을 덮어썼다

사용자 지적: *"연결 끊기 부분이 카드 안의 오른쪽에 있는건 좋은데, 위아래 간격이 안 맞네."*

실측: 카드 안에서 버튼 **위 13px / 아래 24px** — 11px 위로 붙어 있었다.

**원인은 바로 앞 로그인 버튼과 같은 축 문제다.** `hug`은 `alignSelf: 'flex-start'`인데, **가로 줄에서 `alignSelf`는 세로 축**이라 부모의 `alignItems: center`를 이긴다. 학원 행은 `onPress`가 없어 `trailing`이 `styles.row`(`alignItems: center`) 안에 바로 들어가는데, 버튼의 `alignSelf`가 그걸 덮었다.

같은 함정이 `trailing`·`action` 슬롯 **20곳**에 있었다(`질문하고 메모하기`·`학생 전체 보기`·`자세히 보기`…).

**호출부 20곳에서 `hug`을 빼는 대신 슬롯이 감싸게 했다** — `Section`의 `action`과 `Row`의 `trailing`을 `<View>`로 한 겹 두른다. 내용 높이인 그 안에서는 `alignSelf`가 아무 일도 하지 않고, 바깥에서는 가운데 정렬이 그대로 산다. 다시 틀릴 여지가 없는 쪽이다.

실측(고친 뒤): 위 **18px** / 아래 **18px**. 섹션 제목 옆 `질문하고 메모하기`는 버튼 중심과 줄 중심이 **0px 차이**.

| 항목 | 결과 |
|---|---|
| `typecheck` · `lint` | 통과 · **오류 0 · 경고 5**(기준선) |
| `npm test` | **184 통과** |
| `npx playwright test` | **471 통과 / 0 실패** |

증거: `docs/evidence/row-trailing-{before,after}.png` · `section-action-after.png`.

### 고침 — 전폭 규칙이 만든 회귀 셋과 재풀이의 지난 답 넷

`Button`이 `primary`면 스스로 전폭이 되도록 바꾼 뒤(D-122), `hug`을 주지 않은 자리들이 의도치 않게 전폭이 됐다. 학생 화면(`app/student/`) 넷을 고쳤다.

**① 학습 상세 390에서 `담아 두기`가 전폭이었다.** `queueButton()`이 `hug` 없이 `secondary`를 돌려주고, 모바일에서는 `DetailHead`가 세로(`headStack`)로 감싸 컬럼 전체(358px)로 늘어났다. 화면 순서가 `제목 → 358px 테두리 버튼 → 정보 → 358px 강조 버튼`이 되어 **먼저 눈에 닿는 것이 보조 행동**이었다(§12 `보조 버튼을 전폭으로 늘리기`). 바로 위 주석이 *"토글은 아래 줄 왼쪽 끝에 선다(`hug`이 정렬을 맡는다)"*라고 적고 있었지만 호출부에 `hug`이 없었다. `hug` 하나를 줬다 — 데스크톱 가로 줄에서는 `alignSelf: 'flex-start'`가 부모의 `alignItems: 'flex-start'`와 같아 그대로다(캡처로 확인).

**② `문제 담으러 가기`가 한 앱 안에서 네 모양이었다**(D-123). 다섯 자리를 **강조색 + `hug` + `arrow-right`** 한 벌로 맞췄다: `index.tsx`의 `home-empty-start`(전폭 → `hug`) · `home-queue-empty-start`(`secondary+accent` → `primary`) · `queue.tsx`의 `queue-empty-start`(전폭 → `hug`) · `queue-go-learn`(`secondary+accent` → `primary`) · `records.tsx`의 `records-empty-start`(이미 맞았다). 채운 배경 위 화살표 색은 `colors.accentText`로 함께 바꿨다(§8). 높이는 `sm`/`md` 두 가지로 남겼다 — `sm`을 44로 올리는 것은 §8 R2와 §10이 서로 반대라 문서 결정이 먼저다(A-094).

**③ `Steps`가 안 그려질 때 진행 상황 줄이 다음 섹션에 붙었다.** `styles.progress`가 `marginBottom: -spacing.md`를 상시로 들고 있었는데 `Steps`는 개수가 12를 넘으면 `null`을 돌려준다. 그때 컬럼 `gap`(모바일 16) − 12 = **4px**가 되어 `남은 학습 16개`와 `Scody AI에게 물어보기`가 한 덩어리로 읽혔다(담아 둔 학습 12개 + 학원 과제 4개 계정에서 재현). 음수 마진을 지우고 **줄과 칸을 `View` 하나로 묶어** 그 안에서만 `spacing.xs`를 쓴다 — 칸이 없으면 바깥 컬럼 간격이 그대로 산다. `Steps.tsx`의 상한(12)을 화면이 다시 알 필요가 없는 쪽이다.

**④ `다시 풀기`인데 지난 답이 칠해져 있고 제출 버튼이 처음부터 떠 있었다**(D-124). 상세의 확인 단계만 `?retry=1`을 달고 가고, 풀이 화면은 그 표시가 있으면 **이번에 다시 고른 문항만** 칠한다. 세션 답안(`answers`)은 건드리지 않는다 — 지우는 함수가 세션에 없고, 다 풀어야 제출할 수 있으므로 제출 시점에는 전부 이번 것으로 덮여 있다. `이어서 풀기`(D-035)는 표시가 없어 그대로 이어받는다. 대리 보기에서는 `saveAnswer`가 거부하므로 화면도 비어 있는 채로 남는다(D-071).

E2E 2건을 더했다(`e2e/student-flow.spec.ts`): `다시 풀기로 들어가면 지난 답이 지워지고 다 풀어야 제출할 수 있다`(`0 / N 풀었어요` · 칠해진 라디오 0개 · `solve-submit` 0개) · `이어서 풀기는 풀던 답이 그대로 남는다`(칠해진 라디오 1개). 기존 테스트는 고치지 않았다.

| 항목 | 결과 |
|---|---|
| `typecheck` · `npx eslint app/student` | 통과 · **오류 0 · 경고 0** |
| `npm test` | **184 통과** |
| `npx playwright test`(학생 관련 6개 스펙 × 3뷰포트) | **201 통과 / 0 실패 / 6 스킵**(스킵은 AI 업스트림 실패 시 조건부, 기준선) |
| `npx playwright test`(`parent`·`academy`·`admin` × 3뷰포트) | **180 통과 / 6 실패** — 전부 AI 업스트림 실패(`숫자로 요약을 만들었어요` · `지금은 정리하지 못했어요`)로 이번 변경과 무관한 기준 실패(A-088) |

화면 확인: 390 · 1280 · 다크(390). 증거 `docs/evidence/student-detail-queue-{mobile,desktop}.png` · `student-home-empty-mobile.png` · `student-queue-{golearn-mobile,empty-mobile}.png` · `student-home-progress-{mobile,many-mobile}.png` · `student-solve-retry-mobile.png`.

---

## 2026-08-06 — 제품 검토(`/product-review`): 학생 진입 흐름

### 범위

`로그인/가입 → 학생 홈 → 학습 상세 → 풀이 → 결과`(+ 학습 탭·고르기·담아 둔 학습). 최근 변경(주 행동 전폭·행동줄 규칙·인증 강조색·`Steps`)이 가장 많이 얹혔고 흐름으로는 검토한 적이 없는 곳이다.

제품 관점과 사용성 관점을 병렬로 돌려 합쳤다. 같은 줄을 가리킨 항목 **6건**은 하나로 묶었다.

### 내 최근 변경이 만든 회귀 셋 — 전부 같은 뿌리

`Button`이 `primary`를 스스로 전폭으로 만들게 하면서(D-122), **`hug`을 주지 않은 곁다리 자리가 의도치 않게 전폭이 됐다.**

1. **학습 상세의 `담아 두기`가 390에서 전폭**(High). 화면 순서가 `제목 → 358px 테두리 버튼(담아 두기) → 정보 → 358px 강조 버튼(학습 시작하기)`이 되어 **먼저 눈에 닿는 것이 보조 행동**이었다. 바로 위 주석이 `hug이 정렬을 맡는다`라고 적어 놓고 호출부에 `hug`이 없었다.
2. **홈 빈 상태의 `문제 담으러 가기`가 전폭 강조 버튼**. `DESIGN.md` §8이 **이 라벨을 이름까지 지목해** 금지한 자리다. 같은 화면 아래 같은 라벨은 `secondary + sm`이라 한 화면에 두 모양이었다.
3. 같은 라벨이 다섯 자리에서 네 모양이었다 → **`primary` + `hug` + `arrow-right`** 하나로 통일(D-123). 색을 남긴 이유는 어느 자리에서도 그 자리의 다음 행동이기 때문이고, 폭을 뺀 이유는 **어느 화면에서도 그 화면을 끝내지 않기** 때문이다.

### 그 밖에 고친 것

- **[High] `다시 풀기`인데 지난 답이 그대로 칠해져 있었다**(D-124). `submit`도 `recordAttempt`도 `answers`를 비우지 않아, 재풀이로 들어가면 이전 선택이 전부 살아 있고 `allAnswered`가 즉시 true였다 — **문제를 하나도 다시 읽지 않고 제출해 같은 점수를 새 기록으로 덮을 수 있었다.** 학부모가 요청한 재풀이도 같다. D-036의 "제출 버튼이 나타나는 것 자체가 다 풀었다는 신호"가 재풀이에서 뜻을 잃고 있었다. `?retry=1`로 그 진입만 갈라 이번에 다시 고른 문항만 칠한다(`이어서 풀기`는 D-035대로 그대로).
- **[High] 카카오가 데모라는 사실을 화면이 말하지 않았다**(D-125). 고정 fixture 계정으로 들어가는데 **화면에서 가장 강한 요소**(맨 위·채운 브랜드색·52px)였다. 순서를 `휴대폰 → 또는 → 카카오`로 뒤집고 캡션을 달았다.
- **[Medium] 인증 오류가 스크린리더에 안 읽히고, 오류가 가리키는 행동으로 갈 길이 그 화면에 없었다**(D-126). `role="alert"` + 오류 바로 아래 링크.
- **[Medium] `SourceTag`가 한글 금지 변형 `eyebrow`였다**(D-127). 이 앱에서 가장 중요한 구분이 가장 작은 12px + 벌어진 자간이었다.
- **[Medium] 입력 15px → iOS 자동 확대**(D-129). 16px로.
- **[Medium] `Steps`가 null일 때 진행 줄이 다음 섹션에 4px까지 붙었다.** 음수 마진이 상시였다 — 진행 줄과 칸을 한 블록으로 묶어 화면이 상한(12)을 다시 알 필요가 없게 했다.
- **[Low] 이름 없는 `progressbar`**(D-128) → 장식으로 확정.
- **[Medium] 결과 화면**: 학원 과제 오답을 **담기 전에** 열람 사실을 알린다(예전에는 오답노트 화면에만 있어 담은 뒤였다). 추천 목록이 개인 학습이라는 사실을 밝힌다(위에 `학원 과제` 태그가 있으면 학원이 더 낸 것처럼 읽혔다).
- **가입 마지막 단계 이탈 경로**가 워드마크에만 있었다 → 글자 링크 추가. 인증번호 발송 사실도 알린다.

### 검증

| 항목 | 결과 |
|---|---|
| `typecheck` · `lint` | 통과 · **오류 0 · 경고 5**(기준선) |
| `npm test` | **184 통과** |
| `npx playwright test` | **486 통과 / 0 실패**(3뷰포트) — 471 → 486, **E2E 5건 추가**(인증 3 · 재풀이 2) |

**코드만으로 확정할 수 없어 실측한 것**:

| 확인 | 결과 |
|---|---|
| 인증 주 버튼 대비(방금 강조색으로 채움) | 라이트 **4.63:1** · 다크 **5.91:1** — 둘 다 AA 통과(하한 4.5, 라이트는 아슬아슬) |
| 홈 히어로 제목 줄바꿈 | 1줄(390) — 계산상 경계선이었으나 실제로는 접히지 않았다 |
| `SourceTag` 다크 대비 | 개인 **8.4:1** · 학원 **6.9:1** |
| `Field` 높이(16px로 올린 뒤) | **50px 불변** — 다만 `DESIGN.md` §8은 `44~48`이라 **문서와 2px 어긋나 있다**(이번 변경 이전부터) |
| 재풀이 진입 | `0 / 10 풀었어요`, 칠해진 라디오 0, 제출 버튼 없음 |

### 고치지 않은 것과 이유

- **A-096**(가입 직후 계정이 막다른 길) — 결제 미구현(5절)이라 방법이 둘이다. M9-04와 함께 사람이 결정.
- **A-097**(초대 링크가 연결하지 않고 역할도 안 맞음) — 3절이 정의한 동작의 구현이 없다. 백엔드 범위.
- **홈 `시작하기`의 목적지·라벨**(상세 경유 vs 풀이 직행) — M9-03과 같은 자리라 함께 결정.
- **홈 진행 분모**(완료해도 칸이 사라짐) — §14 확정 정책.
- **`size="sm"`(32px) 버튼** — `DESIGN.md` §8 R2와 §10이 서로 반대다. 문서 결정이 먼저(A-094).
- **제목 줄높이·자간이 §4와 어긋남** — 모든 화면 제목이 움직인다. 실측상 지금 접히지는 않는다.
- **가입 폼의 아이디·비밀번호** — D-020과 맞물려 사용자 판단.

### 테스트

**고친 테스트 없음.** 5건을 **추가**했다 — 인증 오류에서 회원가입/로그인으로 가는 길 2건, 가입 마지막 단계 이탈 1건, 재풀이 답안 초기화 1건, `이어서 풀기`가 안 깨지는지 반대편에서 고정 1건.

## 2026-08-07 — 폰트 전환 제거 · 오답노트를 학습 탭으로

사용자 지시 셋 중 둘(폰트·오답노트)을 마쳤다. 카드 안 버튼 우측 정렬은 별도 작업으로 진행 중이다.

### 폰트 — 전환 2회 → 0회, 흰 화면 버그(D-131)

신고: `Scody 처음 들어오면 폰트가 5초 동안 2번 바뀌어서 총 3개의 폰트가 보인다`. 그대로 재현했다(개발 서버 @4Mbps): 7,667ms에 화면이 뜨고 12,974ms까지 시스템 폴백 → Space Grotesk → ScodyKR 순으로 두 번 바뀐다.

**원인은 문서에 적혀 있던 것과 달랐다.**

- `expo-font`의 `ExpoFontLoader.web.ts:140`이 **이미 붙어 있는 `<style>`을 `appendChild`로 재삽입**한다. DOM 규칙상 remove→insert가 되어 CSSOM이 재파싱되고 받아 둔 폰트 4종이 전부 무효화된다. 방아쇠는 `Icon`의 feather 폰트 로드이고, 하필 `if (!loaded) return null` 게이트가 풀린 **직후**다 — 게이트가 지킨 폰트를 게이트가 풀리자마자 스스로 버렸다.
- **A-046의 진단(`loaded`가 다운로드를 안 기다린다)은 Chromium에서 틀렸다.** `isFontLoadingListenerSupported()`가 Chrome에서 참이라 실제로 기다린다. **Safari·iOS에서만 맞다.**
- **D-053의 `FontFace API vs CSS 두 배치` 진단도 틀렸다.** 진짜 원인은 위 재삽입이다.

**그리고 더 심각한 버그를 찾았다.** 회선이 느려 `FontFaceObserver` 12초 타임아웃을 넘기면 `useFonts`가 reject되는데 `app/_layout.tsx`가 `error`를 받지 않아 `if (!loaded) return null`이 영원히 유지된다. **60초까지 흰 화면**인 것을 확인했다. 경계는 실효 1.75Mbps다.

고친 것 셋(하나만 해서는 성립하지 않는다):

1. `Feather.font`를 본문 폰트와 **같은 `useFonts` 배치**에 넣었다 → 나중 `Font.loadAsync`가 `if (isLoaded(fontFamily)) return;`에서 즉시 반환해 `<style>`을 다시 붙지 않는다.
2. `loaded` 뒤에 `document.fonts.ready`를 한 번 더 기다린다(`src/theme/useFontsReady.ts`). **함정**: `@font-face` 등록 전에 부르면 `size === 0`이라 즉시 resolve된다(실측 2,398ms) — 반드시 `loaded === true` 뒤에만 기다린다. `document.fonts.check()`도 매칭 face가 없으면 `true`라 쓰지 않는다.
3. `error`를 받아 실패하면 폴백으로라도 그린다.

**실측**

| 조건 | 결과 |
|---|---|
| 개발 @4Mbps | 첫 글자 8,434ms · **폭 변화 0회** · 폰트 요청 6개 · **재요청 0개** |
| 1.6Mbps | 화면이 뜬다(전에는 60초까지 흰 화면) |
| 폰트 전면 차단 | 15s에 폴백으로 뜬다 |
| 프로덕션(`expo export`) | 첫 글자 6,577ms · 전환 0회 · 재요청 0개 |

비용은 프로덕션 첫 글자 6,381ms → 6,577ms로 **+196ms**다. 계획에 적은 예상(+111ms)보다 크다 — 예상은 `document.fonts.ready` 대기를 개발 서버 수치에서 추정한 값이었고, 실제로는 프로덕션에서도 그만큼 붙었다.

**남은 것**: iOS Safari 실기기 검증 환경이 없다. A-046에 그대로 남겼다.

### 오답노트를 기록 탭 → 학습 탭으로(D-130)

지시: `오답노트로 공부하기가 기록에 있을 이유가 없다. 학습에 가야 함. 그리고 너무 못생겼고 내용도 이상하게 들어가 있다.`

**확정 정책과 부딪혔다.** 마스터 플랜 2절이 `상위 정보 구조: 4절 그대로`를 확정 정책으로 두는데, 4절이 `기록`에 오답노트 섹션을 명시하고 `학습`은 `섹션은 … 둘이고`로 개수를 못박았다(`DESIGN.md` §14-1은 `둘뿐이고`). 사용자 지시이므로 **문서를 함께 고쳤다** — 코드만 옮기면 정책 위반 상태로 남는다.

못생김의 원인은 코드로 짚였고 여섯 가지였다.

| # | 지금 | 고친 것 |
|---|---|---|
| 1 | 부제 형식 3종 혼재(`오답 8개` / `3개` / `오답 4개 · 별표 2개`) | 숫자를 `meta`로 옮기고 `오답 N개` 한 형식으로 |
| 2 | 캡션 `오답 8개 · 별표 3개 · 메모 정리 5개`의 두 값이 바로 아래 목록과 중복, 남는 `메모 정리`는 대응하는 줄이 없음 | 캡션은 `다시 풀 범위를 골라요.` 하나. 메모 정리는 제목 옆 버튼이 맡는다 |
| 3 | 한 제목 아래 목적지 둘 | 제목은 `오답노트`, 목록은 복습 범위, 질문·메모는 `Section`의 `action` |
| 4 | `화법과 작문만 복습하기` — 조사가 붙어 안 읽힘. `별표 친 것만`(상태)과 `문학만`(분류)이 같은 접미사로 다른 뜻 | 영역 줄에서 `만`을 뺐다 |
| 5 | 오답이 한 영역뿐이면 `전체`와 그 영역이 완전히 같은 덱 | 영역이 하나면 영역 줄을 그리지 않는다 |
| 6 | 담아 둔 오답이 없어도 빈 섹션이 그려짐 | 없으면 섹션 자체를 그리지 않는다 |

되돌아오는 길 8곳(`review.tsx` 5 · `notebook.tsx` 3)의 목적지와 라벨을 함께 바꿨다(`기록으로 돌아가기` → `학습으로 돌아가기` 등).

**E2E 16개 단정을 새 위치로 옮겼다.** `session-boundary.spec.ts`의 계정 간 누수 검증은 성격상 안전망이라 **지우지 않고** 새 위치에서 살렸다 — 담아 둔 오답이 없으면 섹션을 그리지 않으므로, `섹션도 줄도 없다 + 남의 발문이 없다`로 확인한다.

`Section`의 제목은 `accessibilityRole="header"`가 아니라 `AppText variant="subheading"`이라 `getByRole('heading')`으로 잡히지 않는다. `getByText(..., { exact: true })`로 썼다(역할을 새로 붙이는 것은 이번 범위 밖이다).

### 화면 확인

정예린(개인+학원, 오답 8개) 390 · 1280 · 390 다크. 소속 없는 학생의 유일한 primary(`learn-pick`)가 첫 화면 안인지 재 봤다 — 390에서 바닥 625px(뷰포트 844) · 1280에서 605px(900)로 둘 다 안이다. 김서준(오답 없음) 390에서 오답노트 섹션이 그려지지 않는 것을 확인했다. 기록 탭은 정답률 카드 + `완료한 학습`만으로 성립한다.

### 검증

- `npm run typecheck` 통과
- `npm run lint` 오류 0 · 경고 4(기준선 5에서 줄었다 — 필기 제거로 `require` 하나가 빠졌다)
- `npm test` 184개 통과
- `npx playwright test`(개발 서버 기준, A-088) — 아래 `테스트` 절

### 카드/면 안 버튼을 마지막 줄 오른쪽으로

`문제 담으러 가기` 다섯 자리가 이미 세 가지 자리(카드 안 왼쪽 3 · 카드 밖 오른쪽 1 · 섹션 본문 왼쪽 1)였다. 뿌리는 `EmptyState`의 `action` 슬롯에 정렬이 없어 기본 `stretch`인 것.

**계획에 적은 `alignItems: 'flex-end'`로는 안 됐다.** `hug`은 `alignSelf: 'flex-start'`를 켜고 flex에서 `alignSelf`가 부모의 `alignItems`를 이긴다 — 세로 줄로 두면 세 호출부 모두 왼쪽에 그대로 남는다. 슬롯을 **가로 줄 + `justifyContent: 'flex-end'`**로 바꿨다. 가로 줄에서는 `alignSelf`가 세로 축이 되어 아무 일도 하지 않으므로 호출부에서 `hug`을 뺄 필요가 없다 — `DESIGN.md` §8이 `Section.action`·`Row.trailing`을 View로 감싸는 것과 같은 이유이고, 이번 세션에서 세 번째로 같은 축 함정에 걸렸다.

공유 상수 `src/theme/styles.ts`에 `endRow.action`을 두고 호출부 4곳(`EmptyState` · `student/index.tsx` 2 · `queue.tsx` 1)이 함께 쓴다. `inset.action`에도 더했다.

`styles.cleared`(공유 2자리)는 **부모를 그대로 뒀다.** `alignItems: 'flex-end'`로 바꾸면 위 두 줄 글자(`학원에서 내준 과제물을 모두 마쳤어요.`)까지 오른쪽에 붙는다. 버튼 줄만 감쌌다.

`hug` 누락 6곳을 함께 채웠다(`academy/index.tsx` · `analytics.tsx` · `content/index.tsx` · `assign.tsx` · `manage.tsx` 2). `content/index.tsx`와 `manage.tsx`는 **주석이 이미 "전폭으로 늘리지 않는다" · "→ `hug`(§8)"라고 적어 두고 코드가 반대였다.**

**실측**(버튼 오른쪽 끝과 면 안쪽 오른쪽 끝의 거리, px — 왼쪽이 크고 오른쪽이 패딩값이면 붙은 것이다)

| 자리 | 390 (좌/우) | 1280 (좌/우) |
|---|---|---|
| `home-empty-start` | 179 / **25** | 501 / **25** |
| `home-queue-empty-start` | 196 / **17** | 518 / **17** |
| `home-go-learn` | 209 / **17** | 531 / **17** |
| `queue-go-learn` | 229 / **16** | 959 / **16** |
| `records-empty-start` | 203 / **17** | 685 / **17** |
| `manage-goto-classes` | 216 / **16** | 558 / **16** |
| `reassign-open-*` | 182 / **16** | 784 / **16** |

390에서 히어로 제목 높이 32.4px(한 줄)로 변경 전후 같다 — 버튼은 늘 마지막 줄이라 글자 칸이 좁아지지 않는다. 증거: `docs/evidence/align-end-*.png` 10장.

**고치지 않은 것**: `inset.panel` 안 버튼. 글자와 버튼이 섞인 패널이라 컨테이너 한 속성으로는 버튼만 옮길 수 없고, 대상 6곳 중 둘(`analytics.tsx` · `classes/student/[id].tsx`)이 문장까지 같은 쌍둥이라 한쪽만 고치면 같은 패널이 두 모양이 된다. `M9-12`로 결정 대기에 남겼다. `academy/classes/[id].tsx`의 펼친 학생 카드 버튼 둘은 계획대로 손대지 않았다(390에서 한 줄에 두면 넘친다).

**도달하지 못한 상태**: `academy` 빈 상태 CTA 4개는 한빛학원 fixture에 반·배정·콘텐츠가 다 있어 화면으로 재현할 수 없었다. 넷 다 `manage-goto-classes`와 같은 모양(`ActionBar` + `hug` primary)이고 그 자리는 위 표에서 확인했다.

### 테스트

| 명령 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run lint` | 오류 0 · 경고 5(기준선과 같다) |
| `npm test` | 184 / 184 |
| `npx playwright test` | **486 / 486**(기준선 486, 3뷰포트). 개발 서버(`npm run web`)로 돌렸다 — A-088 |

### 학생 홈에서 오답노트 빼기(D-132)

지시: `학생 홈화면 분명 오답노트도 없애고 했었는데 왜 다 롤백했냐`.

**먼저 확인한 사실**: 홈의 `오답 복습` 섹션은 초기 커밋(`git show HEAD:app/student/index.tsx`)부터 있었고, 이 세션의 어떤 편집도 그것을 지운 적이 없다. 전체 세션 기록(`Edit`/`Write` 입력에 `app/student/index.tsx` + `오답 복습`)을 훑어도 삭제 이력이 없다. 롤백이 아니라 **처음부터 지운 적이 없었던 것**이다. D-122 작업에서 그 섹션 제목 옆에 버튼을 붙이는 수정만 했다.

그래도 뜻은 맞다 — D-130으로 오답노트가 학습 탭에 자리를 잡자 홈의 `오답 복습`이 같은 일을 두 번 말하게 됐다. 홈은 **오늘 할 일**을 말하는 곳이라, 이미 푼 것을 다시 하라는 말이 그 아래에 붙으면 오늘 할 일이 둘로 갈린다. 지웠다.

지운 것: `오답 복습` 섹션(목록 5줄 + 제목 옆 `오답노트` 버튼) · 목록이 빌 때의 `오답노트 하러 가기` 버튼 · 그 버튼만 쓰던 `noteBtnWide` 스타일 · `review`와 `done` 파생.

`오늘 할 일을 다 끝냈어요` 히어로의 캡션도 고쳤다 — `오답을 다시 보거나, 학습 탭에서 더 풀어볼 수 있어요.`는 홈에 없는 길을 가리키게 됐다. `학습 탭에서 오답을 다시 풀거나 새 학습을 골라볼 수 있어요.`로 바꿔 실제 있는 곳 하나만 가리킨다.

`result/[id].tsx`의 `오답노트 하러 가기`는 **남겼다.** 그 자리에서 방금 담은 오답으로 가는 길이라 홈의 상시 진입과 성격이 다르다.

`DESIGN.md` §14의 6번(`오답 복습 / 오답노트`)을 함께 고쳤다.

**검증**: `typecheck` 통과 · `lint` 오류 0 · `npm test` 184/184 · `npx playwright test` **486/486**. 390 홈에서 `오답`이 들어간 텍스트 노드 **0개**를 확인했다(E2E는 `home-notebook`을 쓰지 않아 단정 수정 없음).


---

## 2026-08-13 — Supabase 전환 (Phase 0~3)

프로토타입의 fixture·메모리 provider를 Supabase(Postgres)로 옮겼다. 확정 정책의 데이터 공개
범위를 RLS로 내렸고, 규모용 합성 데이터는 버렸다.

### 무엇을 만들었나

- 마이그레이션 **18개**: 표 27 · 뷰 5 · 함수 14 · RLS 정책 전체 · Storage 버킷.
- `supabase/seed.sql`(1,200여 줄, 자동 생성). 생성기는 `scripts/gen-seed.ts` — 기존 fixture
  모듈을 **읽어서** SQL로 펼친다. 한국어 지문 189문항을 손으로 옮기면 정답 인덱스가 어긋난다.
- `src/repo/*` 5개(mappers · directory · content · learning · parent). 화면이 쓰던 도메인
  타입을 그대로 돌려주므로 화면 57개의 형태가 유지된다.
- provider 4개를 서버 하이드레이션으로 재작성: `session`(인증+스냅샷) · `academy` · `content` ·
  `progress`(883줄 → repo 호출).
- 명령: `npm run db:push` · `db:seed` · `db:types` · `db:verify`.

### 스키마에서 함께 닫힌 기존 결함

| ID | 어떻게 닫혔나 |
|---|---|
| A-085 (P1) | 오답노트 유니크 키가 `(학생, 문항, 출처, 배정/콘텐츠)`라 개인 학습과 학원 과제가 처음부터 다른 행이다. 개인 쪽 토글을 꺼도 학원 노트와 메모가 남는다 |
| A-036 | `attempts.attempt_no`로 재풀이 회차가 쌓인다. 화면은 최신 회차만 읽어 동작이 같다 |
| A-025 | 담아 둔 학습이 `study_queue`에 남는다. 새로고침해도 순서까지 유지된다 |
| A-049 | `rpc_revenue_estimate`가 이탈 학원 좌석을 기본적으로 세지 않는다(`p_include_churned`로 옛 동작 확인 가능) |
| S-013·S-014 | `academy.tsx`의 오버레이(약 120줄)가 사라졌다. 반·학생을 모든 역할이 같은 표에서 읽는다 |

### 실행하면서 드러난 결함 9개

전부 **실제 실패**로 확인한 것이다.

1. `classes` ↔ `class_students` 정책이 서로의 표를 조회해 Postgres가 정책을 거부했다 →
   `class_academy_id()`·`in_class()`를 `security definer`로 두어 고리를 끊었다.
2. seed의 `crypt()`가 `extensions` 스키마에 있어 못 찾았다 → `set search_path`.
3. `SEED_CONTENT`가 이미 `EXTRA_CONTENT`를 스프레드하고 있어 9세트가 두 번 들어갔다(PK 충돌).
   실제 세트 수는 22가 아니라 **13**이다.
4. `auth.users`의 토큰 컬럼이 NULL이면 GoTrue가 `Database error querying schema`로 떨어져
   **아무도 로그인할 수 없다** → 빈 문자열로 채운다.
5. `can_read_content`가 익명을 막지 않아 **유료 지문·문항이 로그인 없이 읽혔다**.
6. 같은 함수가 학생 쪽만 봐서 **선생님이 자기가 배정한 콘텐츠의 문항을 못 읽었다.** 문항 수를
   세지 못해 학원 대시보드의 `평균 정답률`이 `—`로 비었다(제출률은 정상으로 보여 한 화면에서
   어떤 값은 맞고 어떤 값은 비는 형태였다) → `0018`에서 담당 반 배정 분기를 더했다.
7. `db push --include-seed`는 올릴 마이그레이션이 있을 때만 seed를 돌린다 →
   `scripts/run-sql.ts`(pg)로 seed만 다시 넣는다.
8. `pg`의 `connectionString`이 `password` 옵션을 덮어썼다(풀러 주소에는 비밀번호가 없다).
9. `supabase db reset --linked`는 스키마를 먼저 지워서 seed의 "운영 DB면 중단" 가드가 실행될
   기회조차 없다 → 정기 재시드는 `run-sql.ts`로 한다.

### 화면 쪽 변경

- 로그인: 카카오·휴대폰 버튼은 그대로 두고 **연결되지 않았다는 사실을 말한다.** 테스트 계정
  패널이 seed 계정으로 들어간다(확정 정책 D-020의 수단 구성은 건드리지 않았다).
- 회원가입: 계정을 만들지 않고 그 사실을 말한다. 예전에는 이용권 없는 메모리 계정으로 홈에
  들어가 두 번째 화면에서 흐름이 끊겼다(A-096).
- 학원 관리: `선생님 추가` → **`선생님 초대`**. 이름·아이디로 계정을 대신 만들던 자리는 실제
  인증에서 존재할 수 없다(마스터 플랜 3절이 정한 초대 방식으로 맞췄다).
- 풀이 제출: `session.submit()` + `recordAttempt` + `markAssignmentSubmitted` 세 걸음이
  `rpc_submit_attempt` 한 번이 됐다. **채점을 서버가 한다** — 클라이언트가 보낸 정답 수를 믿지
  않는다.
- 학원 화면의 `합성` 배지와 `개발용 로스터` 고지를 지웠다. 더 이상 사실이 아니다.

### 검증

- `npm run db:verify` **40/40**(익명 차단 · 학생/학부모/학원/운영자 경계 · append-only ·
  RPC만이 쓰기 문 · 배정 권한 · 서버 채점).
- `npm run typecheck` 통과 · `npm run lint` 오류 0(기존 경고 5) · `npm test` **182/182**
  (`mergeResult` 테스트 2건은 지웠다 — 그 계산이 서버로 갔고 `verify-rls.ts`가 대신 단정한다).
- 웹에서 실제 로그인 확인: 정예린(기록 정답률 72% · 완료 7개) · 오선생(담당 반 1개 · 학생 9명 ·
  제출률 89% · 평균 정답률 74% · 안 낸 학생 박도윤) · 최민지(자녀 2명 79%·72%). 직접 URL
  진입에서 로그인으로 튀지 않는다(로딩 게이트).
- **E2E는 아직 돌리지 않았다.** 로그인 방식이 바뀌어 `e2e/_auth.ts`부터 고쳐야 한다.


## 2026-08-13 — AI 프록시와 E2E 되살리기 (Phase 4·6)

### AI 프록시 (M-DB-4 · A-088 · M9-02)

`supabase/functions/ai-proxy`를 만들고 배포했다. 클라이언트에서 OpenRouter 키를 없앴다.

- 키는 서버 환경변수(`OPENROUTER_API_KEY`)에만 있다. `npm run ai:secret`으로 설정한다.
- 로그인한 사용자의 JWT로만 부를 수 있다. 익명 호출은 401이다.
- **모델을 클라이언트가 고르지 못한다** — 서버가 정한 모델만 쓴다(비싼 모델로 바꿔치기 방지).
- 사용자별 상한: 분당 10회 · 일일 200회. `ai_usage` 표에서 센다(`0019`). **학습 활동과 섞지
  않는다** — `learning_events`에 넣으면 활성 지표가 AI 호출 수만큼 부풀고, 지표가 행동이 아니라
  호출을 세게 된다.
- 사용자는 자기 사용량을 **지울 수 없다**. 읽기 정책만 두고 쓰기는 `service_role`(프록시)만 한다.

**검증**: `npm run ai:verify` — 익명 401 · 학생 200(실제 모델 응답 확인) · 사용량 기록.
`hasOpenRouterKey()`는 이름을 유지하되 Supabase 설정 유무를 본다(호출부 여러 곳이 이 함수로
안내를 가른다).

### E2E (M-DB-1)

**뿌리 원인은 상태가 남는 것이었다.** 프로토타입은 상태가 메모리에 있어 페이지를 새로 열면
초기화됐다. 지금은 서버에 남아서, 한 테스트가 선생님을 제외하거나 반을 폐강하면 뒤 테스트가 그
상태를 물려받는다(실측: 학원 흐름 15건이 이 때문에 갈렸다).

고친 방식 넷:

1. **재시드 픽스처**(`e2e/_fixtures.ts` + `_seed.ts`). 테스트마다 `supabase/seed.sql`을 다시
   넣는다. 연결은 프로세스당 한 번, 재시드 **약 330ms**(실측)라 전체에 몇 분만 더한다.
   `workers: 1`이라 서로 밟지 않는다.
2. **id 매핑**(`e2e/_ids.ts`의 `sid`). 화면 `testID`가 데이터 id를 담고 있어(`assign-class-<반id>`)
   uuid로 바뀌자 83곳이 갈렸다. seed가 옛 id의 해시로 uuid를 만들므로 같은 규칙을 테스트에 두어
   `sid('c_kor1')`로 계속 가리킨다. **더 나은 방향은 화면 `testID`에서 id를 빼는 것이다** —
   레포 규칙이 보이는 텍스트·역할로 쓰라고 말한다. 그 변경은 화면 작업이라 따로 다룬다.
3. **날짜 동적화**. `2026-08-11`처럼 미래 날짜를 박아 둔 곳이 그 날이 지나 마감일 검증에 막혀
   배정 자체가 실패했다. `dayFromToday(14)`로 바꿨다.
4. **달 단정 동적화**. `7월`·`6월`을 박아 둔 자리를 seed 오프셋에서 계산한다(`seedMonths`).
   D-090이 기록한 "달이 바뀌면 깨진다"를 근본에서 없앤다.

### E2E가 드러낸 제품 쪽 사실 3개

- **A-026이 닫혔다.** 제출 판정이 서버의 풀이 기록 하나로 모이면서, 학원 과제를 낸 학생의 화면이
  미제출로 보이던 결함이 사라졌다. 그 결함을 단정하던 스펙(`정예린`으로 남은 학습을 세던 것)을
  실제로 안 낸 학생(`박도윤`)으로 옮겼다.
- **로그인 실패가 화면에 보이지 않았다.** 오류 블록이 휴대폰 단계에만 있어서 테스트 계정·카카오
  로그인이 실패하면 아무 일도 일어나지 않는 것처럼 보였다. 첫 단계에도 오류 자리를 뒀다.
- **학년 값의 표시 자리가 없다.** 반의 `grade`는 배정 화면의 학년 필터에만 쓰이고, 그 필터는 반이
  한 페이지를 넘을 때만 나온다. 규모 데이터를 버린 뒤에는 어디에도 보이지 않는다. 학년으로 묶는
  규칙 자체는 단위 테스트가 지킨다(`academyStats.test.ts`).


### E2E 실패의 두 번째 뿌리: `loading`이 되돌아오지 않았다

재시드·id 매핑·날짜 동적화로도 11건이 남았다. 증상은 학습 고르기에서 학년을 눌러도 다음 단계로
가지 않는 것이었다 — 수동 브라우저에서는 늘 잘 됐다.

원인은 provider의 `loading` 초기화 순서였다. 계정이 없는 첫 렌더에서 `loading`을 false로 내리고,
로그인 뒤 실제 조회가 도는 동안에는 **다시 true가 되지 않았다.** 그래서 화면이 빈 데이터를 사실처럼
그렸다: 세 학년 모두 `아직 준비 중이에요`(개수 0)로 보이고 그 줄은 눌리지 않는다. 사람은 로딩이
끝난 뒤 누르니 눌렸고, 테스트는 즉시 누르니 아무 일도 일어나지 않았다.

`ContentProvider`·`ProgressProvider`가 조회를 시작할 때 `loading`을 다시 켠다. 함께 고친 것:
`app/student/pick.tsx`가 로딩 중에는 개수를 말하지 않고 `학습을 불러오고 있어요`만 둔다.

**역할 레이아웃 전체를 `null`로 게이트하는 방식은 되돌렸다** — student-flow 실패가 13 → 20으로
늘었고, 단계형 화면이 쿼리 파라미터를 잃었다. 데이터가 아직 없을 때의 문장은 화면마다 따로 다룬다.

**측정**: student-flow desktop 24 → **35 통과**(실패 18 → 7). 30초 타임아웃이 사라져 실행 시간도
9.2분 → 3.7분.


### 운영자 계정 화면을 서버로 (M-DB-3 일부)

`app/admin/users.tsx`·`app/admin/user/[id].tsx`를 `src/repo/admin.ts`로 옮겼다. `adminMetrics.ts`
전체 재작성은 아직이지만, **대리 보기가 이 두 화면을 지나기 때문에** admin-flow 12건이 여기 걸려
있었다.

- `listAccounts()` — 상한 500. 세션 스냅샷은 **내 범위만** 담으므로 운영자 전체 목록은 따로 읽는다.
- 최근 활동일은 `learning_events`에서 사람별 최댓값으로 낸다. `accountMeta.lastActiveLabelOf`가
  해시로 파생하던 자리다. **학생이 아닌 역할에는 `해당 없음`으로 적는다** — 합성 활동은 역할을 보지
  않아서 원장 계정에도 활동일이 붙었다.
- `weeklyActivity()` — 최근 12주 주별 활동일. 학생일 때만 읽는다.
- 고객지원 코드·가입일은 저장된 컬럼을 그대로 쓴다(해시 파생이 아니다).

**대리 보기 종료 버그**: 끝낸 뒤 운영자 스냅샷을 서버에서 다시 읽는 동안 `account`가 대상 계정으로
남아, 운영자 화면의 역할 가드가 `/login`으로 보냈다(admin-flow 4건). 시작할 때의 스냅샷을 들고
있다가 **즉시 되돌리고** 최신 값은 뒤이어 읽는다.

**측정**: admin-flow desktop 12 실패 → **22/22 통과**.

## 독립 감사 3건과 쓰기 범위 조이기 (0024)

읽기 전용 감사 세 개를 병렬로 돌렸다: ①운영 실행 경로에 남은 fixture ②화면→repo→DB 데이터
흐름과 스키마·타입 일치 ③RLS·역할 격리. **기존 완료 보고를 근거로 쓰지 않고 코드와 DB를 직접
확인하게 했다.** 세 감사가 공통으로 가리킨 것은 하나다 — **읽기 정책은 촘촘한데 쓰기 정책이 넓다.**

`supabase/migrations/0024_write_scope_hardening.sql`로 고친 것:

- **자동저장이 한 번도 저장되지 않았다.** `saveDraft`가 보내는 `onConflict` 컬럼 목록과 맞는
  유니크 인덱스가 없었다(유일한 인덱스가 `coalesce(...)` **표현식**이라 컬럼 목록으로는 못 찾는다).
  매 호출이 `42P10`으로 떨어지고 `console.warn`으로만 남아서, 화면은 답을 고른 것처럼 보이고
  새로고침하면 사라졌다. `이어서 하기`가 새로고침 뒤에 절대 켜지지 않던 뿌리다. 그리고
  `answer_drafts_event` 트리거가 못 돌아 `answer_saved` 활동이 **제출 때만** 생겼다 —
  MAU 정의(문항 하나라도 답을 저장한 날)가 사실은 제출 수였다.
  → `unique nulls not distinct (student_id, question_id, source, assignment_id, content_set_id)`.
- **활동 지표를 손으로 넣을 수 있었다.** `note_learning_event`가 `security definer`인데 PostgREST에
  노출돼 있었고 `p_student`를 인자로 받는다. 남의 id로 활동을 만들 수 있었고 표는 append-only다.
  → 클라이언트 역할에서 `execute` 회수. 트리거 함수 셋은 모두 `security definer`라 영향이 없다.
  (읽기 판단 헬퍼는 **뺄 수 없다** — 정책 안의 함수 호출은 조회하는 역할 권한으로 평가된다.)
- **감사 로그에 아무나 남의 이름으로 넣을 수 있었다.** `actor_id = auth.uid()`만 봤다.
  → `is_admin()` 추가.
- **대리 보기 기록을 본인이 지울 수 있었다.** `for all`이 DELETE를 포함했다.
  → insert·update(종료)만. 시작 정보 변경과 재개방은 트리거로 막는다.
- **원장 권한이 학원 경계를 넘었다.** `is_director()`가 어느 학원인지 보지 않았고 `my_academy_id()`가
  `order by` 없는 `limit 1`이었다. → 같은 학원 원장일 때만, 그리고 결정적 순서로.
- **소속이 끝난 학생의 메모를 선생님이 계속 읽었다.** `removeMember`는 `academy_members.left_at`만
  채우는데 `can_see_student`의 선생 분기가 `class_students`만 봤다. 원장은 접근을 잃고 선생만
  남는 **비대칭**이었다. → 소속을 함께 확인한다.
- **주간 요약을 남의 이름으로 쓸 수 있었다.** `created_by`·`by_ai` 미검사 + DELETE 허용.
- **자녀가 칭찬의 보낸 사람을 바꿀 수 있었다.** 화면이 `from_user_id`를 조인해 이름을 보여 준다.
- **재풀이 요청을 지울 수 있었다.** `canceled_at`을 둔 이유가 사라진다.
- **학생이 자기 `scody_id`·`kakao_linked`를 바꿀 수 있었다.** 로그인 키와 인증 상태 주장이다.
  불변 트리거에 `set search_path`가 없던 것(레포 유일한 예외)도 함께 고쳤다.
- **요금 정책을 모두가 읽었다.** 학원 좌석 단가·할인율 같은 B2B 계약 조건이 열려 있었다.
  → 표는 운영자만, 개인 요금 두 개는 `v_public_pricing` 뷰로.

**검증**: `scripts/verify-rls.ts`에 위 항목을 전부 시험하는 검사를 더했다(실제 로그인 → 실제 호출).
`npm run db:seed && npx tsx scripts/verify-rls.ts` → **72개 통과, 0개 실패**. RLS로 막힌 delete는
오류 없이 0행을 지우므로, 지워졌는지는 **행이 남았는지로** 확인한다(처음엔 오류 유무로 봐서 통과처럼
보였다).

### 클라이언트 쪽 같은 종류의 결함

- `wrongNotesOf(studentId)`가 **가리지 않은 메모를 돌려줬다.** 바로 위 `wrongNotes`는 대리 보기 중
  `dig`를 지우는데(D-071) 이 함수는 원본을 줬다. 학부모·학원 화면이 이 경로로 노트를 읽는다.
- **대리 보기 종료 기록이 안 남으면 그 뒤로 시작할 수 없었다.** `impersonation_open_key`가 운영자당
  열린 기록을 하나로 제한하는데 종료 업데이트가 fire-and-forget이었다. 탭을 닫거나 네트워크가
  끊기면 영구 자기 차단이다. → **시작할 때 닫히지 않은 이전 기록을 먼저 닫고**(사유 `시간 만료`)
  종료 실패는 삼키지 않고 기록한다.
- **학부모 홈이 불러오는 중에 `0일 · 학습 기록 없음`이라고 말했다.** 실측으로 확인: 같은 달에
  리포트는 `5일`, 홈은 `0일`이었다 — D-090이 막으려던 바로 그 불일치다. 없는 것이 아니라 아직
  모르는 것이므로 `기록을 불러오고 있어요`로 바꿨다. `parent-flow`의 `loginParent`도 이 값이
  사라질 때까지 기다린다.
- `parent-flow`의 `이하은은 이번 주 기록이 없다` 단정을 지웠다. seed 날짜가 **돌린 날 기준 상대값**
  (`HAEUN_OFFSETS = [-2, -4, -30]`)이라 요일에 따라 이번 주에 들어온다. 그 테스트가 확인하려는
  성질은 **요약이 자녀별로 따로 남는다**는 것이고 그건 날짜와 무관하다 — 그 성질로 바꿨다.

## 2026-08-13 — 학원 화면에 남아 있던 fixture 조인 3곳

독립 감사가 가리킨 결함이다. **화면은 서버에서 배정을 읽는데 반 목록만 fixture였다.** fixture의
반 id는 `c_kor1` 같은 문자열이고 서버 `assignments.class_id`는 uuid라서, 두 값을 맞춰 보는
조인은 **한 번도 성립할 수 없었다** — 숫자가 틀린 것이 아니라 구조적으로 항상 0이었다.

### 고친 곳

| 화면 | 무엇이 틀렸나 | 어떻게 고쳤나 |
|---|---|---|
| `app/academy/content/index.tsx` | 목록의 `배정 N회`가 항상 `0회`. `ACADEMY_CLASSES`로 우리 반을 좁혔다 | `useAcademyStaff().classesFor(account)`(세션 스냅샷의 실제 `classes`)로 좁힌다. 서버가 주는 배정 범위(`my_class_ids`)와 같은 경계다 |
| `app/academy/content/[id].tsx` | `배정 N회` 섹션이 늘 비어 `아직 배정하지 않았어요`. 그래서 위 고지 문장도 배정된 콘텐츠에 `지금은 고치는 기능이 없어요` 쪽을 골랐다 | 같은 방식으로 반 목록을 세션에서 읽는다. 반 이름·마감·제출 수가 실제 배정에서 나온다 |
| `app/academy/manage.tsx` | 대기 중 초대가 `INVITES` fixture 3개. 한빛학원에만 붙어 있어 **다른 학원 원장은 아무것도 못 봤고**, `초대 링크 만들기`가 실제로 만든 초대(`invites` 표)는 목록에 나타나지 않았다 | `src/repo/directory.ts`의 `loadInvites(academyId)`로 읽는다. 만든 직후 목록을 다시 읽어 방금 만든 초대가 그 자리에 보인다 |

### 초대 조회

`loadInvites`는 `invites`에서 `accepted_at`·`expires_at`을 함께 읽어 상태를 셋으로 가른다
(`pending`·`accepted`·`expired`). 아직 전달할 수 있는 초대가 위로 오고, 수락했거나 기간이 지난
초대는 **링크와 복사 버튼을 주지 않는다** — 눌러도 되지 않는 링크를 주면 원장이 그것을 전달한다.
권한은 RLS가 강제한다(`invites_select`: 자기 학원 또는 운영자). `academy_id`를 질의에 적은 것은
권한 검사가 아니라 범위 좁히기다(운영자 권한으로 읽을 때 남의 학원 초대까지 오지 않게).

### 모르는 값을 0으로 단정하지 않는다

세 화면 모두 서버 응답을 기다리는 창이 생긴다. 그 사이에 `배정 0회`·`배정 0회 목록`·`초대 없음`을
그리면 화면이 **없다고 단정한다**(D-090·학부모 홈에서 같은 실수를 이미 고쳤다).

- 문제 목록: `배정 N회` 값을 그리지 않고 섹션 아래에 `배정 횟수를 불러오고 있어요.`
- 문제 상세: 섹션 제목을 `배정`으로 두고 `배정 기록을 불러오고 있어요`
- 학원 관리: `초대를 불러오고 있어요` · 읽기 실패는 `초대를 불러오지 못했어요`(빈 목록과 다르게 말한다)

### 검증

- `npm run typecheck` 통과 · `npx eslint app/academy src/repo/directory.ts` 오류 0 ·
  `npm test` **181/181**.
- `npx playwright test academy-flow academy-student --project=desktop` **20/20 통과**,
  `--project=mobile` 20/20(첫 회 1건 실패 → 단독 재실행 통과, 같은 DB를 쓰는 다른 작업과 겹친
  플레이크다. `e2e/_fixtures.ts`가 경고하는 그 상황이다).
- `boundary-flow --project=desktop` 3건 실패는 **이 변경과 무관하다**: 가입 → `/select-space`
  전환과 `학원 연결 끊기` 뒤 학원 학습 잔존이고, 둘 다 학원 교직원 화면을 지나지 않는다.

### 남은 것

- `/join`은 별도 작업에서 서버 조회로 옮겨졌다(같은 `invites` 표). 그래서 학원 관리의 초대 캡션에
  있던 `링크를 열면 데모 계정으로 로그인돼요`는 지웠다 — 이 화면이 다른 화면의 동작을 단정하지
  않는다.
- `app/admin/ops.tsx`·`app/admin/academy/[id].tsx`는 아직 `ACADEMY_CLASSES`를 읽는다(M-DB-3).

## 2026-08-13 — 표는 있는데 메모리 state만 쓰던 provider 3곳

독립 감사가 가리킨 결함이다. 세 건 다 같은 종류다: **표와 함수가 이미 서버에 있는데 provider가
`useState`만 쓴다.** 새로고침하면 사라지고, 화면은 그 사이 "남았어요"라고 말했다.

### 고친 곳

| provider | 무엇이 틀렸나 | 어떻게 고쳤나 |
|---|---|---|
| `src/features/audit.tsx` | `log()`가 React state만 바꿨다. `audit_logs`(0011)를 아무도 쓰지 않아 **새로고침하면 감사 로그가 전부 사라졌다** — 접속기록이 사라지는 것은 없는 것과 같다 | `src/repo/ops.ts` 신설. `writeAuditLog`로 넣고 `listAuditLogs`로 읽는다. 시각은 서버(`at default now()`)가 정한다 — 클라이언트 시계로 적으면 기록 순서를 조작할 수 있다 |
| `src/features/pricing.tsx` (요금) | `setValue`/`bump`가 state만 바꿨다. `pricing_policies`와 `current_pricing()`(0010)이 있는데 초기값이 `DEFAULT_PRICING` 상수였다 | `src/repo/pricing.ts` 신설. 변경은 **새 행을 쌓고**(이력이라 지난 행을 고치지 않는다) 초기값은 `current_pricing()`에서 읽는다 |
| `src/features/pricing.tsx` (`parentPays`) | `대신 내주기`가 state만이었다. `parent_payment_offers`(0009)가 있는데 학부모가 표시해도 새로고침하면 사라졌다 | 표시는 upsert(`canceled_at`을 비워 되살린다), 취소는 `canceled_at`을 채운다 — 취소도 기록이다 |

### 읽는 범위가 역할에 따라 갈린다

0024가 `pricing_policies_select`를 `is_admin()`으로 좁혔다. 좌석 단가·규모 할인·연 결제 비율은
B2B 계약 조건이라 학생·선생님에게 열지 않는다. 그래서 provider가 두 경로를 쓴다.

- 운영자: `current_pricing()` → 정책 한 벌 전체
- 그 외: `v_public_pricing` → **개인 요금 두 개만**(`student_paid`·`parent_paid`)

`v_public_pricing`이 생성 타입에 없어서 `npm run db:types`로 재생성했다.

`parent_payment_offers`는 `auth.uid()`가 아니라 **화면이 보고 있는 사람**으로 좁힌다
(`loadPaymentOffers(parentId)`). 대리 보기 중에는 둘이 다르고(`auth.uid()`는 운영자),
그때 그려야 하는 것은 대상 학부모의 표시다.

### 계정 상세의 열람 기록은 서버에서 좁힌다

`app/admin/user/[id].tsx`는 provider의 최근 목록을 걸러 쓰지 않고 `listAuditLogsFor(userId)`로
`subject_id`를 서버에서 맞춘다. 감사 로그는 append-only라 계속 자라서 목록에 상한
(`AUDIT_LIMIT = 200`)이 필요하고, 그 상한을 넘긴 뒤에는 클라이언트 필터가 조용히 적게 말한다.

### 쓰기가 성공한 다음에 말한다

세 화면 모두 낙관적 갱신을 걷어냈다.

- 요금제: 저장이 실패하면 값도 바뀌지 않고 **운영 기록에도 남지 않는다**. 실패 문구를 화면에 낸다.
- 자녀 탭: 서버가 받아 준 다음에 `내가 내기로 표시했어요`를 띄운다. 실패는 `removed` 톤으로 말한다.
- 대리 보기 시작·종료: 기록을 남긴 뒤에 화면을 옮긴다(`await log(...)`).

### 로딩 중에 "없어요"라고 말하지 않는다

`content.tsx`의 패턴(비동기 IIFE + 계정이 바뀌면 `loading`을 다시 켠다)을 그대로 따랐다.

- `/admin/ops`: `기록을 불러오고 있어요` · `요금 정책을 불러오고 있어요`. 필터 칩도 조회가 끝난
  뒤에 그린다(0건 분류를 칩으로 두지 않는 D-065 ③과 같은 이유)
- `/admin/billing`: 조회 중에는 화면의 값이 기준값이라는 사실을 말한다
- `/parent/children`: `이용권을 불러오고 있어요`. 조회 전 `parentPays`가 빈 배열이라 이미 표시해
  둔 자녀에게도 `내가 대신 낼게요`가 보였다

### 화면이 자기 자신에 대해 하던 거짓말을 고쳤다

`/admin/ops`와 계정 상세가 `기록은 이 세션에만 남아요. 새로고침하면 사라져요`라고 적어 두고 있었다.
그대로 두면 방금 남은 감사 로그까지 못 믿게 된다(D-065). `아직 없는 것`의 `영속 데이터베이스` 줄도
이미 사실이 아니었다 — 지금 세션에만 남는 것은 `학원 연결 끊기`처럼 화면 안에서만 쓰는 값이다.

### provider 순서

`AuditProvider`를 `SessionProvider` 안으로 옮겼다(D-116). 서버 쓰기를 갖게 됐고, 읽기가
`is_admin()`이라 로그인한 사람이 바뀌면 다시 읽어야 한다. `session.tsx`는 여전히 감사 로그를
부르지 않으므로 의존 방향은 한쪽이다.

### 검증

- `npm run db:verify` **72/72 통과**. 이 변경이 기대는 서버 계약을 그 안에서 확인한다:
  학생이 감사 로그를 넣을 수 없다 / 운영자는 넣을 수 있다 / 운영자도 지울 수 없다 /
  학생에게 `pricing_policies`가 0행 / 운영자에게는 보인다 / 학생은 개인 요금만 뷰로 읽는다.
- `npx playwright test parent-flow -g "자녀 탭에서 이용권을 보고" --project=desktop` **통과**.
  테스트에 `page.reload()` 뒤에도 `표시 취소`가 남는지, 취소 뒤에도 취소 상태가 남는지 더했다.
- `npm test` **168/181**. 실패 13건은 전부 `__tests__/data.test.ts`의
  `adminMetrics`·`revenue` 미이관 함수(`money`·`scaleSeries`·`estimateRevenue` 등)로,
  M-DB-3 진행 중인 기준 실패다. 요금·감사 로그와 무관하다.
- `npm run typecheck`·`npm run lint`: 오류는 전부 `app/admin/index.tsx`·`app/admin/metrics.tsx`·
  `__tests__/data.test.ts`의 M-DB-3 기준 실패다. 이 작업이 만든 파일
  (`src/repo/ops.ts`·`src/repo/pricing.ts`·`src/features/audit.tsx`·`src/features/pricing.tsx`)과
  고친 화면에는 오류가 없다.
- **운영자 화면 E2E는 지금 돌릴 수 없다.** `app/admin/index.tsx`가 `adminMetrics`의 사라진
  함수를 불러 렌더에서 죽고, 로그인이 `/admin`에 착지하지 못해 `admin-flow` 20/22가 같은 자리에서
  실패한다. M-DB-3이 진행 중인 상태의 기준 실패다(요금제·운영 기록 화면 자체는 타입·린트 깨끗).
  `admin-flow`의 요금제·대리 보기 테스트에 새로고침 뒤 값·기록이 남는지 확인하는 단정을 넣어 뒀다.

### 남은 것

- **A-098(신설)**: 학원 관리 화면의 `좌석 단가`·`규모 할인`·`월 청구액`이 서버 값이 아니다.
  0024가 학원 계정의 `pricing_policies` 읽기를 닫았고 `v_public_pricing`에는 개인 요금만 있어서
  `DEFAULT_PRICING` 값이 그대로 나간다. 화면에서 그 줄을 빼는 것은 원장이 계약 금액을 확인할
  길을 없애는 일이라 하지 않았다 — 결정 대기 **M9-13**으로 올렸다.
- 감사 로그 **보관 기간 정책**은 여전히 없다(A-048).

## 2026-08-13 — 초대 링크가 서버 토큰을 읽고 수락까지 잇는다 (A-097)

독립 감사가 가리킨 결함이다. `app/join.tsx`가 초대 토큰을 **fixture로** 해석했다
(`getInvite` → `src/data/fixtures.ts`의 `INVITES` 3개). 그래서 방향이 양쪽으로 틀렸다:

- 가짜 토큰 `INV-STUDENT`·`INV-PARENT`·`INV-TEACHER`가 `로그인하면 한빛학원과 연결됩니다`라는
  완전한 초대 화면을 만들었다. 출처 표시도 없었다.
- 원장이 실제로 만든 서버 토큰(`inviteTeacher` → `invites` 표)은 `유효하지 않은 초대 링크예요`로
  떨어졌다. 초대를 만든 사람은 그 링크가 되지 않는다는 사실을 알 수 없었다.

서버에는 두 함수가 이미 있었고 **아무도 부르지 않았다**(`supabase/migrations/0013_functions.sql`).

### 서버 함수의 실제 계약

- `rpc_invite_info(p_token text) returns jsonb` · `stable` · `security definer`.
  `{ token, academy_name, invitee_role, accepted, expired }`를 준다. 없는 토큰이면 질의가 0행이라
  **`null`이 온다**. 토큰 비교는 `lower(btrim(...))`이라 대소문자·공백을 무시한다.
  `invites` 표는 익명에게 닫혀 있고(`invites_select`), 이 함수만 열려 있다 — 토큰이 열쇠다.
- `rpc_accept_invite(p_token text) returns uuid` · `security definer`. `academy_members`에
  소속을 넣고(`on conflict … do update set left_at = null`) `user_roles`에 역할을 붙이고
  `invites.accepted_at`·`accepted_by`를 적는다. **`entitlements`는 건드리지 않는다** — 기존
  계정에 소속만 추가한다(3절). 거부 사유는 한국어 예외로 던진다: `로그인이 필요해요` ·
  `초대를 찾을 수 없어요` · `이미 사용한 초대예요` · `기간이 지난 초대예요` ·
  `학부모 초대는 자녀 확인이 필요해요`. 돌려주는 uuid는 `academy_id`다.

### 고친 곳

| 파일 | 무엇을 했나 |
|---|---|
| `src/repo/directory.ts` | `inviteInfo(token)`과 `acceptInvite(token)`을 더했다. `inviteInfo`는 **예외를 던지지 않는다** — 화면이 `없는 초대`와 `조회 실패`를 다르게 말해야 하는데 던지면 두 경우가 한 `catch`에서 합쳐진다. 상태는 `loadInvites`가 이미 쓰던 `InviteStatus`(`pending`·`accepted`·`expired`)에 `missing`·`failed`를 더해 쓴다. 매핑은 이미 있던 `toInvite`를 쓴다(그때까지 아무도 부르지 않는 함수였다) |
| `app/join.tsx` | 조회를 서버로 옮기고 상태를 다섯으로 갈랐다: 확인 중 · 없음 · 기간 만료 · 이미 사용됨 · 수락 가능. 로그인한 사람은 그 자리에서 수락하고, 로그인하지 않았으면 `/login?next=`로 보낸다 |
| `app/login.tsx` | `?next=` 처리를 더했다. 값이 **앱 안의 경로일 때만**(`/`로 시작하고 `//`가 아닐 때) 따라간다 — 웹에서 로그인 화면이 밖으로 내보내는 문이 되지 않게 |
| `src/data/index.ts` · `src/data/fixtures.ts` | `getInvite`와 `INVITES` fixture를 지웠다. 마지막 사용처였던 `app/academy/manage.tsx`가 같은 날 `loadInvites`로 옮겨 갔다 |
| `__tests__/data.test.ts` | fixture 토큰 조회를 확인하던 describe를 지웠다(함수가 없다). 그 자리에 어디서 확인하는지 적었다 |

### 읽는 동안 "없어요"라고 말하지 않는다

이 화면의 핵심 위험이다. 조회는 왕복이 필요한데, 결과가 없는 상태를 `유효하지 않은 초대 링크`와
같게 두면 **정상 링크로 들어온 사람이 먼저 그 문장을 읽는다.** 그래서 `확인 중`을 따로 두고,
조회 결과를 `어떤 조회의 결과인지`(토큰+재시도 횟수)와 함께 들고 있는다 — 토큰이 바뀌면 키가
어긋나 곧바로 `확인 중`으로 돌아간다. 효과 안에서 상태를 비우지 않아도 예전 초대가 새 토큰의
답으로 보이지 않는다(린트 `react-hooks/set-state-in-effect`도 그 자리를 막는다).

조회 자체가 실패하면(`failed`) `초대를 확인하지 못했어요` + `다시 확인하기`를 준다. 연결이 끊긴
것을 `잘못된 링크`라고 말하면 사용자가 학원에 새 링크를 요청하게 된다.

### 소속이 생겼다는 말은 확인한 뒤에 한다

수락이 성공하면 `useSession().reload()`로 스냅샷을 다시 읽고, `account.academyName`이 초대의
학원 이름과 같을 때만 `{학원}과 연결됐어요`라고 말한다. 그 값은 `academy_members`를 읽어 채운
값이다(`loadDirectory`). 아직 비어 있으면 `연결을 확인하는 중이에요`로 두고 `소속 다시 확인하기`를
준다 — 수락은 끝났다는 사실과 화면이 아직 그것을 못 봤다는 사실을 함께 말한다.

### 카카오 데모 버튼을 이 화면에서 내렸다

`join-kakao`는 `signInWithTestAccount(DEV_KAKAO_SCODY_ID)`로 **정예린(학생)** 계정을 열고 학생
홈으로 갔다. 선생님 초대로 들어와도 그랬다(A-097의 절반). 초대 화면의 행동은 이제
`로그인하고 연결하기` 하나이고, 카카오는 로그인 화면에서 고른다 — 그 화면에는 데모 계정으로
들어간다는 안내가 이미 있다. 로그인으로 갈 때는 `push`가 아니라 `replace`를 쓴다: `push`로 가면
로그인이 초대 화면을 되돌려 놓을 때 앞의 초대 화면이 스택에 남아 웹에서 같은 화면이 두 벌
붙는다(실측: 숨은 쪽이 조회를 한 번 더 하고 E2E가 strict mode 위반으로 멈췄다).

학부모 초대는 서버가 수락을 거부하므로 **누르면 거부되는 버튼을 두지 않는다.** 자녀 확인이
필요하다는 사실을 미리 말한다.

### 검증

- `npm run typecheck` · `npm run lint`: 이 작업이 만진 파일에 오류 없음
  (`app/join.tsx`·`app/login.tsx`·`src/repo/directory.ts`·`src/data/*`·`e2e/auth-flow.spec.ts`).
- `npm test` **181/181 통과**(이 변경 직후 기준). 이후 같은 날 다른 작업이 진행되면서
  `__tests__/data.test.ts`의 `adminMetrics`·`revenue` 미이관 함수 13건이 다시 기준 실패로 보인다 —
  M-DB-3 진행 중 상태이고 초대와 무관하다.
- `npx playwright test e2e/auth-flow.spec.ts --project=desktop` **31/31 통과**. 더한 스펙 4개:
  없는 토큰은 유효하지 않다고 말한다(초대 내용을 지어내지 않는다) / 초대 링크에서 로그인하면
  토큰을 들고 돌아와 수락 단계로 이어진다 / 로그인한 상태로 수락하면 소속이 생기고 **같은 링크를
  다시 열면 `이미 사용한 초대예요`**(서버에 수락이 남았다는 증거) / 학부모 초대는 자녀 확인이
  필요하다고 말한다. 기존 스펙(`초대 링크는 역할과 학원을 인식한다`)은 `join-kakao` 대신
  `join-login`을 확인하도록 고쳤다.
- **E2E는 원격 DB 하나를 공유한다.** 다른 작업의 Playwright 실행과 겹치면 재시드가 `auth.users`를
  지워 로그인이 403이 되고, 원인을 찾기 어려운 실패로 보인다(실측: 겹친 구간에서 4건이 갈렸다가
  단독 실행에서 전부 통과). `e2e/_fixtures.ts`의 경고가 말하는 그대로다.

### 남은 것

- **초대 링크에 회원가입 경로가 없다.** 초대는 보통 계정이 없는 사람에게 가는데, 지금 이 화면의
  길은 로그인뿐이다. 계정 만들기가 아직 연결되지 않아서(A-096·M-DB-2) 회원가입으로 보내도 그
  화면이 `계정 만들기는 아직 연결되지 않았어요`로 끝난다 — 실제 인증이 붙을 때 함께 잇는다.
- **역할이 맞지 않는 계정으로도 수락할 수 있다.** 학생 테스트 계정으로 선생님 초대를 수락하면
  서버가 그 계정에 `academy` 역할을 붙인다. 토큰이 특정 사람에게 묶여 있지 않기 때문이다
  (`invites`에 대상 사용자가 없다). 실제 인증이 붙으면 초대에 대상 연락처를 묶을지 정해야 한다.
- **이미 다른 학원에 속한 계정이 수락하면 소속이 두 개가 된다.** `academy_members`는
  `(academy_id, user_id)`가 키라 다른 학원 행이 함께 살아 있고, `loadDirectory`의 `memberByUser`는
  둘 중 하나를 임의로 고른다. 한 사람이 학원 두 곳에 속하는 경우를 확정 정책이 다루지 않는다.

## 운영자 지표를 서버 집계로 (M-DB-3) — 2026-08-13

운영자 화면 8개가 아직 fixture 위에서 돌고 있었다. `adminMetrics.ts`(1013줄)가 `ACCOUNTS`(합성
계정 4,186개)·`ACADEMY_CLASSES`·`activityOf`(FNV-1a 해시로 만든 26주 활동)·`DATA_ANCHOR`
(`2026-07-28` 고정 기준일)에 걸려 있었고, `revenue.ts`가 같은 fixture로 MRR을 냈고,
`src/data/usage.ts`가 문항 id 해시로 콘텐츠 사용 집계를 만들었다. 서버에는 `rpc_admin_overview`·
`rpc_revenue_estimate`·`rpc_content_usage`·`v_daily_activity`가 있었지만 **부르는 곳이 없었다.**

### 서버로 옮긴 값

| 값 | 원천 |
|---|---|
| 계정 수 · 역할별 수 · 학원 수 · 반 수 · 콘텐츠 수 · 개인 이용권(살아 있는 것·해지) · 풀이 총계 | `rpc_admin_overview()` |
| MRR · ARR · ARPPU · 개인/학원 매출 · 유료 인원 · 학원 좌석 | `rpc_revenue_estimate(false)` |
| 원장 수 · 선생님 수 | `academy_members`(교직원만, `left_at is null`) |
| 학원 목록 · 계약 좌석 · 갱신일 · 재원생 · 반 수 · 28일 활성 | `academies` + `classes` + `v_class_roster` + `learning_events` |
| 반별 제출률 · 문항 수 가중 정답률 | `assignments` + `v_assignment_submissions` |
| 콘텐츠 상세의 풀이 수·정답률·문항 오답률 | `rpc_content_usage(id)` |
| 콘텐츠 목록·개요 알림의 누적 풀이·정답률·문항 오답률 | `attempts` + `attempt_answers` 한 번에(`contentUsageAll`) |
| DAU · 일별 활동 | `v_daily_activity` |
| WAU · WAL · MAU · 주간 계열 · L7 분포 | `learning_events`(창 26주) |
| 신규 가입 · 코호트 분모 | `profiles.created_at` |

**`rpc_class_stats`는 부르지 않는다.** 그 함수는 `my_class_ids()`로 범위를 좁히는데 운영자는 어느
학원에도 소속되지 않아 그 목록이 비어 있다 — 운영자가 부르면 항상 `[]`다. 대신 운영자에게 열려
있는 기본 표에서 같은 수식으로 냈다(`src/repo/admin.ts`의 `classSubmissions`). 서버로 옮기려면
그 함수에 `or public.is_admin()`을 더하는 마이그레이션이 필요하다 — 이번 범위에서는 스키마를
건드리지 않았다.

**콘텐츠 목록은 세트마다 RPC를 부르지 않는다.** 세트가 13개면 왕복이 13번이고 콘텐츠가 늘면
그대로 늘어난다. 목록·개요 알림은 `attempts`·`attempt_answers`를 한 번에 읽어 RPC와 **같은
수식**으로 집계한다(누적 풀이 = 풀이 건수, 정답률 = `sum(correct)/sum(total)`, 문항 오답률 =
오답/응답).

### 없는 값을 0으로 채우지 않는다 — 이 작업의 핵심

합성 활동을 버리면서 **원천을 잃은 지표**가 생겼다. 코호트 잔존·Quick Ratio·주간 이탈·
Carrying Capacity·Activation은 "그 사람의 그 기간을 우리가 실제로 기록했는가"에 걸려 있는데,
활동 기록은 서버를 붙인 날부터 쌓인다. 90일 전에 만든 계정의 W0 잔존을 0%로 적으면 화면은
"전원 떠났다"고 말하지만 사실은 "안 봤다"다.

그래서 계산 함수가 값 대신 **`reason`(왜 못 내는지)** 을 돌려줄 수 있게 하고, 화면이 그 문장을
값 자리에 그대로 쓴다. 화면과 지표 사전(`METRICS` 24개)은 하나도 지우지 않았다.

| 지표 | 지금 화면이 하는 말 | 게이트 |
|---|---|---|
| 주간 코호트 잔존 | `활동 기록은 2026-07-11부터예요. 그 뒤에 가입한 코호트부터 잔존을 볼 수 있어요` | 가입 주가 기록 시작 주보다 이르면 줄을 만들지 않는다 |
| 주간 이탈 · Quick Ratio · 성장 구성 | `활동 기록이 34일치예요. 35일이 모이면 값이 나와요` | 기록 < 이탈 창(28일) + 비교 주(7일) |
| Carrying Capacity · 적재용량 소진율 | 같은 문장 | 성장 구성이 없으면 못 낸다 |
| Activation율 · 예측력 | `그 뒤에 가입해 7·28일이 지난 계정이 생기면 값이 나와요` | 기록 시작 뒤에 가입해 기한이 지난 계정만 분모 |
| ARPU | `MAU가 있어야 나와요` | MAU가 0이면 0으로 나누지 않는다 |
| 규모 8행 · 매출 5행의 26주 추이 | 추이 열을 **만들지 않고** `과거 시점의 규모를 남긴 기록이 없어서 추이는 두지 않아요` | 그 시점의 상태를 남긴 기록이 없다 |

`activationPredictiveness`가 판정 불가일 때 개요의 `확인이 필요해요`에서 경고를 만들지 않는다 —
못 낸 값으로 행동을 요구하지 않는다. 지표 사전은 `지금 값을 낼 수 없는 지표 (N개)` 섹션을
계산에서 받아 그린다(문구를 손으로 적으면 기록이 쌓인 뒤에도 남아 거짓말을 한다).

### `합성` 배지를 낱말째 지웠다

`SourceBadge`의 `Source` 타입에서 `'합성'`을 제거했다(`'실측' | '추정'`). 낱말을 남겨 두면 다음
사람이 합성 값을 다시 화면에 올릴 자리가 생긴다. `MetricSource`도 `'실측(세션)'` → `'실측'`으로
맞췄다 — 두 타입이 같은 낱말을 쓰게 되어 지표 사전이 배지 대신 문자열을 적던 우회가 사라졌다.
지운 배지: 개요 지표 표 · 개요 북극성 · 학원 목록 5행 + 범례 · 학원 상세 8행 + 범례 · 요금제 표
범례 · 콘텐츠 목록 범례 · 콘텐츠 상세 4행 · 계정 목록 범례 · 계정 상세 활동 · 지표 사전 3행.
`추정`만 남았다: 매출 추정(개요·요금제) · 월 청구액(학원 목록·상세).

`MetricTable`은 `추정`이 섞여 있을 때만 `출처` 열을 만든다. 규모 표는 전부 서버 집계라 열을 두면
헤더 하나와 빈 칸 여덟 개가 남는다.

### 가장 중요한 결함: `실측`이라고 적힌 0

`app/admin/academy/[id].tsx`가 반을 `ACADEMY_CLASSES.filter(c => c.academyName === name)`로 찾고,
제출률·정답률을 `useProgress().assignments`(운영자 세션에는 비어 있다)에서 계산해
**`source="실측"`** 으로 표시했다. fixture 반 id와 서버 `class_id`(uuid)는 만나지 않으므로 그 값은
구조적으로 언제나 `0/0건 · 0% · 기록 없음`이었다. 지금은 `classes.academy_id`로 조인하고 제출
집계도 `v_assignment_submissions`에서 온다(실측: 고1 국어 9/9건 · 고2 국어 등).

라우트 파라미터도 학원 이름 → `id`(uuid)로 바꿨다. 이름이 조인 키면 학원 이름을 바꾸는 순간
링크가 죽는다(확정 정책의 영구 식별자 원칙과 같은 이유).

### 그 밖에 고친 사실 관계

- **A-049의 반대 방향**: 이제 `rpc_revenue_estimate`가 기본으로 이탈 학원 좌석을 빼므로, 화면의
  "이탈한 학원 N곳의 ₩M도 아직 합계에 들어가요"는 거짓이 됐다. 세 화면(개요·학원 목록·요금제)에서
  빼는 쪽으로 문구를 바꿨고, 이탈 학원이 없으면 문장 자체가 사라진다.
- **신규 가입 행이 자기 안에서 다른 말을 했다.** 수식은 `그 주에 계정을 만든 학생 수`인데 값은
  누적 계정 수(16명)를 쓰고 있었다. 값을 마지막 완성 주로 맞췄다(누적은 규모의 `학생 계정` 행이
  이미 말한다).
- **문항 오답률에 표본 수를 붙였다.** `88%`만 있으면 8명 중 7명인지 1명 중 1명인지 알 수 없다.
  아직 아무도 답하지 않은 문항에는 막대를 그리지 않는다 — 0% 빈 막대는 "쉬운 문항"으로 읽힌다.
- **`accountMeta.gradeOf`를 지웠다.** 저장된 학년과 반 이름이 모두 없으면 해시로 학년을 정했고
  (`pick('grade:'+userId, 1, 3)`), `src/repo/admin.ts`에도 같은 이름의 함수가 있어 한 계정이 두
  값을 보고할 수 있었다. 화면은 원래 repo 쪽만 썼으므로 죽은 코드였다.
- `app/admin/ops.tsx`의 `이 숫자는 어디서 왔나요`·`아직 없는 것`을 실제 상태로 고쳤다(감사 로그
  목록 부분은 건드리지 않았다).

### 파일

지운 것: `src/data/usage.ts`(읽는 곳이 없었다).

**남긴 것과 이유**: `academies`·`activity`·`calendar`·`accountMeta`는 `__tests__/data.test.ts`가
읽는다. `roster`·`solo`·`assignmentHistory`·`hash`·`fixtures`·`content`·`attempts`는
`scripts/gen-seed.ts` 또는 위 테스트가 읽는다. 런타임 참조(`app/`·`src/features/`·`src/repo/`)는
전부 끊었지만, `src/data/index.ts`를 화면이 `findContent`·`gradeLabel`·`taxonomy`로 아직
import하므로 fixture 그래프는 번들에 들어간다(M-DB-5).

바꾼 파일: `src/repo/admin.ts`(+약 420줄) · `src/repo/content.ts`(`contentUsageAll`·`emptyUsage`) ·
`src/features/adminMetrics.ts`(1013→924줄, 전면 재작성) · `src/features/revenue.ts`(`share`만 남김) ·
`src/components/SourceBadge.tsx` · `src/data/accountMeta.ts` · `app/admin/index.tsx` ·
`metrics.tsx` · `ops.tsx` · `academies.tsx` · `academy/[id].tsx` · `billing.tsx` ·
`content/index.tsx` · `content/[id].tsx` · `users.tsx` · `user/[id].tsx` ·
`__tests__/data.test.ts` · `__tests__/table.test.tsx` · `e2e/admin-flow.spec.ts`.

### 테스트 단정 변경과 근거

`__tests__/data.test.ts`의 `운영자 지표`·`운영자 지표의 과거 수치` 두 블록은 전역 합성 데이터에
기대 있었다. 지표가 **순수 함수 + 서버 스냅샷**이 되면서 입력을 인자로 넘기게 됐고, 그래서
"기록이 짧을 때 무엇을 말하는가"를 테스트가 직접 세울 수 있다. 성질은 그대로 옮겼다(MAU ≥ WAU ·
성장 네 갈래 비겹침 · Quick Ratio 정의 · GRR ≤ 100 · ARPU 분모 = MAU · L7 합계 = 학생 수 ·
코호트 W0 ≤ 100%와 null 꼬리) 그리고 **없는 값 처리 단정 8건을 새로 더했다.** 잔존을 코호트
사람만 세는지 확인하는 단정도 더했다 — 예전 구현은 전체 활동을 세어 한 명짜리 코호트가 200%가
될 수 있었다.

지운 단정 2건과 그 이유:
- `해지한 개인 구독에는 청구하지 않는다` — 매출 계산이 클라이언트에서 사라졌다. 지금은
  `rpc_revenue_estimate`가 `canceled_at is null`로 좁혀 센다. **그 조건은 SQL이라 jest로 확인할 수
  없고, 지금 서버 확인 스크립트도 없다**(남은 문제).
- `GRR은 실제 해지 비율과 같다` — `personalGrr(overview)`로 옮겼고 새 블록이 같은 성질을 단정한다.

E2E 단정 변경(`e2e/admin-flow.spec.ts`):
- `합성 활동 데이터로 계산한 값이에요` → `계정·학원·콘텐츠·풀이는 서버 기록이고 요금은 추정이에요`
  + `활동 기록은 YYYY-MM-DD부터예요` + `합성 활동 데이터`가 **0건**임을 단정. 앞 문구는 화면에
  남아 있으면 거짓말이다. 기간 단정을 더한 이유: 기간을 밝히지 않으면 작은 값이 하락으로 읽힌다.
- 콘텐츠 상세의 `테스트 집계` → `실제 풀이 기록에서 세요` + `N명이 답했어요` + `테스트 집계` 0건.
- 학원 상세에 단정 3건을 **더했다**: 주소가 uuid인지 · 제출 건수가 `N/M건` 형태로 실제 값인지 ·
  반 표에 `고1 국어`가 있는지. 예전에는 구조적으로 0이던 값이라 단정할 것이 없었다.
- 개요에 `원천이 아직 없는 지표는 0이 아니라 이유를 보여 준다`를 **새로 더했다**: 지표 사전이
  Quick Ratio·Activation율 정의를 그대로 갖고 있는지 · `지금 값을 낼 수 없는 지표 (N개)` 섹션이
  있는지 · 예측력 자리에 `0.00배`를 쓰지 않는지 · 코호트·성장 표가 비었으면 이유가 함께 있는지.
- 지운 단정은 없다.

### 검증 (2026-08-13 실측)

- `npm run typecheck` 통과.
- `npm run lint` 통과(오류 0 · 기존 경고 5건은 `.expo` 생성물과 `fonts.web.ts`의 `require`).
- `npm test` **187/187 통과**(10 스위트). 이 작업 전 기준도 187/187이었다.
- `npx playwright test admin-flow --project=desktop --project=tablet --project=mobile`
  **69/69 통과**(23 × 3뷰포트).
- 화면 확인: 개요·지표 사전·학원 목록·학원 상세·요금제·운영 기록·콘텐츠 목록을 데스크톱
  (1280)·태블릿(820)·모바일(390)에서 캡처해 확인. 실측 값 — 계정 21 · 학생 16 · 학부모 2 ·
  학원 1곳 · 반 2개 · 콘텐츠 13세트 189문항 · 풀이 32건 · 개인 이용권 3건(해지 0) ·
  MAU 14 · WAU 14 · WAL 14 · DAU 0 · 좌석 활용률 52%(재원생 14 / 계약 27) · MRR ₩230,980 ·
  ARPPU ₩14,436(유료 16명) · ARPU ₩16,499 · GRR 100% · 활동 기록 2026-07-11부터 34일치.
- `npx playwright test a11y boundary-flow session-boundary theme --project=desktop`:
  11 통과 · **2 실패**. 실패는 `boundary-flow`의 `다른 학원이 등록한 문제는 배정 목록에 보이지
  않는다`·`학원 연결을 끊으면 학원 학습은 사라지고 안내가 남는다`로, 학원 콘텐츠 화면과 학생
  연결 끊기(M-DB-8)에 걸린 **기준 실패**다. 이 작업이 만진 모듈을 그 경로가 import하지 않는다.

### 남은 문제

- **`rpc_class_stats`가 운영자에게 빈 배열을 준다.** 반별 집계 수식이 지금 두 곳(SQL과
  `classSubmissions`)에 있다. `or public.is_admin()` 한 줄을 더하는 마이그레이션으로 한곳으로
  모을 수 있다.
- **`rpc_revenue_estimate`의 해지 제외를 확인하는 테스트가 없다.** jest는 SQL을 못 보고
  `scripts/verify-rls.ts`는 권한만 본다. 집계 RPC의 성질을 확인하는 서버 스크립트가 필요하다.
- **`v_daily_activity`는 DAU 한 값에만 쓰인다.** 기간 중복 제거 수(WAU·MAU·WAL)는 하루치를 더해
  낼 수 없어 원본 이벤트에서 센다. 창을 26주로 좁혔지만 `learning_events`는 계속 자라므로,
  이벤트가 많아지면 주간 계열도 서버 집계(주별 distinct RPC)로 옮겨야 한다.
- **개요가 조회를 6번 던진다**(개요·매출·교직원·학원·활동·콘텐츠 사용). 화면 하나에서 병렬로
  나가지만, 지표가 늘면 `rpc_admin_dashboard()` 하나로 묶는 편이 낫다.
- **`Activation`·`이탈`이 기록 34일에서 35일로 넘어가는 순간 값이 생긴다.** 그때 화면의 문장이
  숫자로 바뀌는 것을 한 번 확인해야 한다(지금은 게이트 쪽만 실측했다).

## 2026-08-14 — 실DB 스키마 대조로 찾은 repo·세션 결함 6건

실제 DB 스키마·정책·트리거와 클라이언트 코드를 대조해 나온 결함만 고쳤다. **마이그레이션은
쓰지 않았다** — 여섯 건 모두 스키마가 맞고 클라이언트가 어긋난 자리다.

### 고친 것

- `src/repo/learning.ts` `loadAcademyNotes` — 학원용 뷰 응답을 `NoteRow`로 단정하고 있었다.
  뷰는 8개 컬럼(`id·student_id·question_id·content_set_id·source·assignment_id·dig·created_at`)만
  주는데 `NoteRow`에는 `picked_index`·`starred`·`mastered`가 남아 있어, 나중에 누가
  `row.starred`를 읽어도 타입 검사를 통과하고 값은 조용히 `undefined`가 된다(D-054가 막으려는
  값이다). 응답 스키마를 그대로 적은 `AcademyNoteRow`를 따로 뒀다. 매퍼 출력은 그대로다.
- `src/repo/learning.ts` `saveDraft` — `student_id`에 `?? ''`를 넣고 있었다. 그 컬럼은
  `uuid not null`이라 로그인이 끊긴 순간 Postgres `22P02`(잘못된 uuid 입력) 문구가 그대로
  올라간다. 같은 파일의 `addNote`·`restoreNote`·`addToQueue`·`setQueueOrder`와 같은 모양으로
  먼저 막고 `다시 로그인해 주세요.`를 돌려준다.
- `src/repo/parent.ts` `setWeekSummary` — `created_by: uid ?? null`이었다. `week_summaries_insert`가
  `created_by = auth.uid()`를 요구하므로 null이면 RLS 거절 문구만 남는다. 형제 함수들처럼
  먼저 막는다.
- `src/repo/content.ts` `createContent` — `content_sets.created_by`를 아예 넣지 않아 앱에서 만든
  첫 세트는 작성자가 빈다(지금 있는 행은 전부 seed라 값이 있다). 로그인한 사람으로 채우고,
  이 파일의 규칙대로 로그인이 없으면 `throw`한다(`addContent`가 `errorMessage`로 받아 폼이 말한다).
- `src/session/session.tsx` `endImpersonation` — 종료 update가 `.eq('id', recordId)`만 봤다.
  시작 쪽이 그 행을 `시간 만료`로 이미 닫아 둔 경우 `tg_impersonation_append_only`가
  `이미 끝난 대리 보기 기록이에요.`로 막고, 진짜 종료 사유는 `console.error`로만 남는다.
  아직 열린 행으로 좁힌다(`.is('ended_at', null)`).
- `src/session/session.tsx` `startImpersonation` — 닫히지 않은 기록을 정리하는 update의 오류를
  보지 않고 insert로 넘어갔다. `impersonation_open_key`가 운영자당 열린 기록을 하나로 제한하므로,
  이 정리가 조용히 실패하면 그 운영자는 **대리 보기를 영구히 시작할 수 없다**(바로 위 주석이
  적어 둔 실패다). 오류를 그대로 돌려준다.

### 검증 (2026-08-14 실측)

- `npm run typecheck` 통과.
- `npm run lint` 오류 0 · 경고 5건(기존: `.expo` 생성물과 `fonts.web.ts`의 `require`).
- `npm test` **187/187 통과**(10 스위트). 이 작업 전 기준도 187/187이었다.
- Playwright는 돌리지 않았다 — 개발 서버와 공용 DB를 다른 작업이 쓰고 있었다. 대리 보기
  경로(`e2e/admin-flow.spec.ts`)는 이 변경이 닿는 자리라 서버를 되찾은 뒤 확인해야 한다.

## 2026-08-14 — 성공 토스트가 서버 확인보다 앞서던 자리를 닫았다

`app/parent/children.tsx`가 이미 쓰던 방식(`await` → `res.ok` 분기 → 실패 시 서버 문장)을
같은 결함이 남아 있던 provider·화면에 그대로 옮겼다. **새 계약을 만들지 않았다** —
`WriteResult { ok, error }`는 `src/repo/*`에 이미 있었고, 그것을 삼키던 자리를 없앤 것이다.

### 무엇이 문제였나

`src/features/progress.tsx`의 쓰기 함수 여럿이 `Promise<void>`였다. 실패하면
`if (!result.ok) await reload()`로 서버 값을 다시 읽어 되돌리기는 했지만 **그 사실을 아무에게도
말하지 않았다.** 부르는 화면은 기다리지도 않고 곧바로 성공을 알렸다:

- 오답노트에서 별표를 눌러 `별표를 달았어요`를 읽고, 다음 조회에서 별표가 사라진다.
- 리포트에서 `다시 풀기를 요청했어요`를 읽고, 요청 표시가 조용히 없어진다.
- 학원 관리에서 `○○ 선생님을 제외했어요`를 읽고, 그 선생님이 목록에 그대로 남는다
  (`src/features/academy.tsx`의 `removeTeacher`는 `repo.removeMember`의 결과를 **버렸다**).

RLS 거부·연결 끊김에서 화면이 일어나지 않은 일을 알리는 것이라, 학생·학부모는 저장됐다고
믿고 나간다.

### 고친 것

- `src/features/progress.tsx` — 쓰기 함수 전부가 `WriteResult`를 돌려준다
  (`addWrongNote`·`removeWrongNote`·`restoreWrongNote`·`patchNote`(→`setDig`·`toggleStar`·
  `setMastered`)·`addToQueue`·`dropFromQueue`(→`removeFromQueue`·`removeManyFromQueue`)·
  `persistOrder`(→`moveInQueue`·`restoreToQueue`)·`requestRetryFor`·`setWeekSummary`·
  `sendPraise`·`dismissPraise`). 낙관적 표시는 그대로 두고 실패 시 `reload()`가 되돌리는 것도
  그대로다 — 달라진 것은 **결과가 화면까지 간다는 것**이다. 대리 보기(D-071)는 모듈 상수
  `DENIED`로 돌려준다.
- `src/features/academy.tsx` `removeTeacher` — 결과를 버리지 않고 다른 쓰기와 같은
  `afterWrite`를 탄다. 막는 이유(고르지 못함·권한·자기 자신·학원 없음)도 문장으로 갈랐다.
- 화면 10곳이 `await` 뒤 `res.ok`로 갈린다: `app/student/notebook.tsx`(담기·별표·빼기·
  되돌리기·정리·정리 지우기) · `app/student/review.tsx`(정리·별표·이해 완료) ·
  `src/components/ChildReport.tsx`(다시 풀기·주간 요약·칭찬) · `app/parent/attempt.tsx`
  (다시 풀기) · `app/student/pick.tsx` · `app/student/[id].tsx` ·
  `app/student/result/[id].tsx`(담기·오답노트 담기/빼기) · `app/student/queue.tsx`
  (빼기·되돌리기) · `app/academy/manage.tsx`(선생님 제외) · `app/student/index.tsx`(칭찬 확인).

### 문구 규칙

- **성공 문구는 한 글자도 바꾸지 않았다.** E2E가 텍스트로 단정하는 자리다
  (`학습을 담아 뒀어요` · `담아 둔 학습에서 뺐어요` · `오답노트에서 뺐어요` ·
  `문항을 오답노트에 담았어요` · `노트에 정리했어요` · `정리와 대화를 지웠어요` ·
  `다시 풀기를 요청했어요` · `이번 주 요약을 만들었어요` · `칭찬을 보냈어요`).
- 실패는 **서버 문장을 그대로 쓴다**(`errorMessage`가 이미 `권한이 없어요.` ·
  `연결이 끊겼어요. 잠시 뒤 다시 시도해 주세요.` 로 사람 말로 바꿔 준다). 서버가 아무 말도
  주지 않은 경우에만 그 행동의 짧은 대체 문장을 쓴다(`담아 두지 못했어요` 등).
- `readOnly`(대리 보기) 검사는 결과 분기보다 **먼저** 둔다 — 일어나지 않은 일은 성공도 실패도
  알리지 않는다(D-071).
- `app/student/queue.tsx`의 되돌리기 안내와 `notebook.tsx`의 `되돌리기` 버튼은 이제 **서버가
  빼기를 받아 준 뒤에만** 나타난다. 빠지지 않은 것을 되돌릴 자리를 만들면 이미 있는 행을
  다시 넣으려 한다.
- `app/student/queue.tsx`·`app/student/index.tsx`에 `useToast`를 새로 들였다(실패를 말할 자리가
  없었다). 성공은 여전히 알리지 않는다 — 줄이 사라지고 안내가 뜨는 것이 그 자체로 결과다.

### 검증 (2026-08-14 실측)

- `npm run typecheck` 통과.
- `npm run lint` 오류 0 · 경고 5건(기존: `.expo` 생성물과 `fonts.web.ts`의 `require`).
- `npm test` **187/187 통과**(10 스위트). 이 작업 전 기준도 187/187이었다.
- Playwright는 돌리지 않았다 — 개발 서버와 공용 DB를 다른 작업이 쓰고 있었다. 토스트 문구를
  텍스트로 단정하는 `student-flow`·`parent-flow`·`queue-flow`·`academy-flow`는 서버를 되찾은
  뒤 반드시 돌려야 한다(성공 문구는 그대로 두었으므로 단정은 그대로 맞을 것이고, 달라진 것은
  **토스트가 서버 왕복 뒤에 뜬다**는 타이밍이다).

### 남은 문제

- `app/student/queue.tsx`의 순서 바꾸기(`moveInQueue`)는 실패해도 여전히 말이 없다. 성공
  토스트가 없는 자리라 이번 결함(성공을 앞질러 알림)에 해당하지 않아 손대지 않았다 —
  낙관적 재정렬이 조용히 되돌아가는 것은 별 항목으로 남긴다.
- `src/features/progress.tsx`의 `submitAttempt`·`addAssignment`·`removeAssignment`·`reassign`은
  전부터 `WriteResult`를 옳게 돌려주고 있어 그대로 뒀다. 대리 보기 문장만 `DENIED` 상수를
  쓰지 않는데, 값이 같아 굳이 고치지 않았다.

## 2026-08-14 — `reload()`가 기다리지 않아 화면이 도착하지 않은 값을 말하던 자리를 닫았다

### 무엇이 문제였나

`src/features/progress.tsx`의 `reload()`는 다시 읽기 신호(`nonce`)만 올리고 곧바로 풀렸다.
조회는 그 뒤 효과에서 시작하므로 **`await reload()`는 아무것도 기다리지 않았다.**

- 제출이 성공하면 `submitAttempt`가 `await reload()` 뒤에 결과를 넘기고, 풀이 화면은 곧바로
  결과 화면으로 `replace`한다. 그 화면은 `attempts[id]`가 없으면 `결과를 찾지 못했어요` +
  `홈으로 갈게요`를 그리고 `loading`을 보지 않았다 — **다 푼 직후에 막다른 화면이 스쳤다**
  (실측: 스쳤을 뿐 아니라 브라우저 스크립트가 `URL 전환 직후 점수 줄 있음: false`를 찍었다).
- `if (!result.ok) await reload()` 되돌리기도 낙관적으로 바꿔 둔 **틀린 값과 실패 문장을 함께**
  보여 주다가, 나중에 조회가 도착하면 조용히 바뀌었다.

같은 파일의 쓰기 13곳은 `try`가 하나도 없었다. `src/repo/*`는 서버 오류를 `{ ok: false }`로
돌려주지만 **그 전에 던질 수 있다**(`supabase()`는 설정이 없으면 예외, 여러 쓰기가 먼저
`auth.getUser()`를 기다린다). 화면은 결과를 `void`로 흘려보내므로 그 예외는 어디에도 닿지 않고,
낙관적 변경만 남아 **저장되지 않은 값이 성공처럼** 보였다.

### 고친 것

- `src/features/progress.tsx`: 조회를 `read(account)`로 꺼내 **효과와 `reload()`가 같은 함수를**
  쓴다. `reload()`는 조회가 화면에 얹힌 뒤에 풀린다. 앞선 응답을 버리는 `alive` 플래그는 조회마다
  붙는 번호(`runId`)로 옮겼고, 조회를 시작할 때 `loading`으로 되돌리는 동작은 그대로 남겼다
  (E2E 11건이 그 창에서 갈렸던 자리다). `nonce`는 없앴다.
- `src/features/progress.tsx`: 쓰기 하나를 감싸는 `write()`를 뒀다. 예외를 `{ ok: false, error }`로
  바꾸고 낙관적 변경을 `reload()`로 서버 값에 맞춘다. 13곳에 같은 `try`를 두지 않는다.
- `src/features/progress.tsx`의 `dropFromQueue`: 담긴 칸을 하나도 못 찾으면
  `{ ok: false, error: '담아 둔 학습에서 찾지 못했어요.' }`다. 예전에는 빈 배열이 내려가
  `repo.removeFromQueue`가 서버에 닿지도 않고 `{ ok: true }`를 줬다.
- `app/student/result/[id].tsx`: `useProgress().loading`·`useContent().loading`을 본다. 읽는 중에는
  `결과를 불러오고 있어요`이고, 없다고 단정하지 않는다(결과 주소로 바로 들어온 경우도 같다).
- `app/student/notebook.tsx`의 `resetNote`: 대화를 **서버가 메모를 지운 뒤에** 비운다. 대화는
  화면에만 있고(A-031) 되돌릴 수 없는데, 먼저 비우면 저장이 거부됐을 때 메모는 그대로인 채
  대화만 사라졌다 — 다시 정리하는 버튼들이 `msgs.length > 0`에 걸려 있어 재시도도 막혔다.
- `app/student/queue.tsx`: 순서 바꾸기 실패를 말한다(**A-099 닫음**).
- `app/academy/manage.tsx`의 `onAdd`: `readOnly`를 결과 분기보다 먼저 본다(D-071). 대리 보기에서
  내부 거부 문장이 빨간 인라인 오류로 새어 나가던 자리다. 실패하면 지난번 `방금 만든 초대 링크`
  블록도 지운다 — 성공과 실패가 한 화면에 함께 서지 않게.
- AI 대기 표시를 `finally`에서 되돌린다: `app/student/notebook.tsx`(질문·정리) ·
  `app/student/review.tsx`(질문·메모 저장) · `src/components/ChildReport.tsx`(주간 요약).
  스트림이 끊기면 호출이 예외로 끝나 대기 표시가 켜진 채 남고, 그 화면의 보내기·정리 버튼이
  **화면을 나갈 때까지** 눌리지 않았다.
- `src/features/openrouter.ts`: 같은 결함의 뿌리를 함께 닫았다. 스트림 읽기 루프와
  `auth.getSession()`·`res.text()`를 `try` 안에 넣어 **실패를 값으로** 돌려준다(이 모듈이 스스로
  적어 둔 계약이다). 끊긴 조각은 답으로 쓰지 않고 `onDelta`로 흘리지도 않는다 — 이미 그려 둔
  조각 뒤에 오류 문장이 붙으면 답변의 일부로 읽힌다.

### 문구 규칙

- 성공 문구는 한 글자도 바꾸지 않았다. 새로 생긴 문장은 셋뿐이다:
  `순서를 바꾸지 못했어요`(A-099가 지정한 문장) · `담아 둔 학습에서 찾지 못했어요.` ·
  `결과를 불러오고 있어요`(다른 화면의 `계정을 불러오고 있어요`와 같은 꼴).
- `readOnly` 검사는 결과 분기보다 먼저다(D-071).

### 검증 (2026-08-14 실측)

- `npm run typecheck` 통과.
- `npm run lint` 오류 0 · 경고 5건(기존: `.expo` 생성물과 `fonts.web.ts`의 `require`).
- `npm test` **187/187 통과**(10 스위트). 이 작업 전 기준도 187/187이었다.
- 브라우저 실측(개발 서버 8081, 정예린, Playwright 스크립트):
  - 제출 흐름 — 고친 뒤 `결과를 찾지 못했어요` 렌더 **0회**, URL이 결과로 바뀐 **그 순간**
    `10문항 중 7문항 정답`이 이미 있었다. 제출 클릭 → 결과 화면 373~408ms.
    고치기 전 같은 스크립트는 렌더 1회 · 점수 없음이었다.
  - 순서 바꾸기 — 줄이 뒤바뀌고 새로 읽어도 그 순서, 토스트 0개(성공은 조용하다).
  - 오답노트 질문 — 답변이 오고 실패 캡션 없이 보내기 버튼이 다시 눌린다(스트리밍 손질이
    정상 경로를 깨지 않았다).
- Playwright 스펙은 돌리지 않았다. `e2e/_fixtures.ts`가 테스트마다 `supabase/seed.sql`을 공용
  원격 DB에 다시 넣는데, 그 파일을 다른 작업이 들고 있었다. 토스트 문구를 텍스트로 단정하는
  `student-flow`·`queue-flow`·`academy-flow`·`parent-flow`는 DB를 되찾은 뒤 반드시 돌려야 한다
  (성공 문구는 그대로라 단정은 맞을 것이고, 달라진 것은 **결과 화면이 조회를 기다린다**는
  타이밍이다).

### 남은 문제

- `src/features/progress.tsx`의 `buildAttempt`(103행)는 레포 어디에서도 부르지 않는다. 결과 화면이
  서버 응답을 기다리지 않고 그릴 때 쓰려고 둔 함수인데, 이번에는 경쟁 상태 자체를 고쳐서 필요가
  없었다. 전부터 죽어 있던 코드라 지우지 않고 남긴다 — 지울지는 따로 판단한다.
- `app/student/ask.tsx`의 `send()`도 `busy`를 `finally`에서 되돌리지 않는다. 이번에는
  `openrouter.ts`가 예외를 값으로 바꿨으니 실제로 걸리는 경로는 없지만, 그 화면만 규칙이 다르다.

## 2026-08-14 — Supabase 전환 독립 검증 루프

전환이 끝났다는 **보고를 근거로 쓰지 않고** 실제 DB·번들·브라우저를 직접 측정했다. 기준선부터
문서와 달랐다 — 마스터 플랜 M-DB-1은 E2E가 "거의 끝났다"고 적었지만 `--project=desktop` 전체
실행은 **14 실패 / 154 통과**였다.

같은 날의 다른 세 항목(성공 토스트가 서버 확인보다 앞섬 · `reload()` 경합 · 실DB 스키마 대조로
찾은 repo·세션 결함 6건)은 위에 따로 적었다. 여기 적는 것은 **마이그레이션 0025~0030**,
`src/data` 분리, `scripts/verify-rls.ts` 상태 되돌리기다.

### 0025 — 가입 중복 검사를 서버가 답한다

**무엇이 문제였나.** `app/signup.tsx`가 `isPhoneTaken`·`isScodyIdTaken`으로 **번들에 실린 픽스처
배열**(`ACCOUNTS` 4,186개)을 뒤졌다. 두 가지가 동시에 틀렸다 — ①합성 로스터 번호를 넣으면
`이미 가입된 번호예요`라고 말했다(어느 DB에도 없는 번호다) ②실제로 `profiles`에 있는 번호는 그
배열에 없으면 통과했다.

**원인.** 검사가 답해야 하는 것은 `profiles`의 사실인데 참조가 픽스처였다. 스키마에는 이미 그
검사를 위한 유니크 인덱스가 있었다(`profiles_scody_id_key` = `lower(btrim(scody_id))` ·
`profiles_phone_digits_key`).

**고친 방법.** `rpc_signup_phone_taken`·`rpc_signup_scody_id_taken`(0025)을 두고
`src/repo/directory.ts`가 그것을 부른다. 가입 화면은 로그인 전이라 `anon`으로 부르므로
`security definer`이고, **밖으로 나가는 값은 boolean 하나**다. 아이디 비교식은 유니크 인덱스와
같은 `lower(btrim(...))`로 맞췄다 — 식이 다르면 검사를 통과한 아이디가 insert에서 깨진다.
조회 실패는 `false`가 아니라 `null`(모른다)로 돌려주고 화면이 `지금은 확인할 수 없어요`라고
말한다. 실패를 `false`로 떨어뜨리면 "쓸 수 있는 번호"라는 **틀린 말**이 된다.

**검증(live DB 실측).** `scody_id_taken('yerin')=true` · `(' YERIN ')=true` ·
`('brandnew')=false` · `('')=false` · `phone_taken('')=false` · `('010-9999-9999')=false` ·
`('010-1000-0001')=true` · `(박도윤 번호)=true`. 둘 다 `prosecdef=true` ·
`search_path=public, pg_temp`. E2E `auth-flow` desktop **전부 통과**(중복 번호·중복 아이디
테스트 포함 — 이제 실제 DB가 근거다). `e2e/_auth.ts`의 "가입 흐름은 아직 fixture 검증을 쓴다"
주석이 이 변경으로 거짓이 됐으므로 함께 고쳤다. 지금 픽스처인 것은 **고정 인증번호 하나**뿐이다.

### 0026 ① — 비로그인 사용자가 아무 학생의 정답률·반 순위를 읽었다

**무엇이 문제였나.** anon 키만으로(세션 없이) 남의 집계가 그대로 나왔다. 실측:

```
rpc_class_comparisons(정예린) →
  {"21e971cb…":{"avg":60,"mine":60,"rank":3,"submitters":6},
   "5df5e1c7…":{"avg":73,"mine":90,"rank":1,"submitters":6}, …}
```

대조군은 정상이었다 — `select attempts` 0행 · `rpc_content_usage` 거부. 즉 정책이 넓은 것이
아니라 **이 두 함수의 가드만** 통과됐다.

**원인.** `can_read_student(target)`가 `target = auth.uid() or is_my_child(target)`였다. 세션이
없으면 `target = null` → **NULL**이고 `is_my_child`는 `exists(...)`라 `false` ∴ `NULL or false`
→ **NULL**. 가드는 `if not (can_read_student(…) or is_admin()) then raise`이고 `not NULL` →
NULL인데 **plpgsql은 `if NULL then`을 거짓으로 본다** — `raise`를 건너뛰고, 본문은
`security definer`라 RLS를 우회한 채 집계를 계산했다.

RLS 정책 안의 같은 함수는 안전하다 — `using` 절의 NULL은 행을 **버린다**(실측: anon은 표 28개
전부 0행). 위험한 것은 plpgsql `if not (…)` 가드뿐이다.

**고친 방법.** 뿌리와 호출부 양쪽. `can_read_student`를 `case`로 다시 써 세션이 없으면 `false`를
돌려주게 하고, `rpc_class_comparison`·`rpc_class_comparisons`의 가드도 `coalesce(…, false)`로
감쌌다(중복이지만 다음 사람이 뿌리를 다시 nullable하게 만들어도 여기서 막힌다).

**검증.** anon → `이 학생의 기록을 볼 수 없어요.`(두 함수 모두). 회귀: 본인(정예린) 4건 ·
학부모(최민지) 4건 · 운영자 4건 정상. 선생님은 거부 — 원래 의도다.

### 0026 ② — `v_academy_visible_notes`가 RLS를 우회하는 **쓰기** 경로였다

**무엇이 문제였나.** 로그인하지 않은 사람이 남의 `student_id`로 오답노트 행을 만들 수 있었다.

**원인(전부 실측).** `owner=postgres` · `reloptions=null`(`security_invoker` 없음) ·
`pg_relation_is_updatable(oid, true)=28`(insert·update·delete 자동 가능) · anon·authenticated가
INSERT·UPDATE·DELETE·TRUNCATE 보유 · `wrong_notes.relforcerowsecurity=false`(뷰 소유자는 RLS
면제) · `with check option` 없음. 그래서 이 뷰를 통한 쓰기는 `postgres`로 실행돼
`wrong_notes_write`(`student_id = auth.uid()`)가 적용되지 않았다. 더 나쁜 것은 그 INSERT가
`wrong_notes_event` 트리거를 깨워 `note_learning_event`를 부른다는 점이다 — 0024가 그 함수의
실행 권한을 뺀 조치를 우회하고, `learning_events`에는 delete 정책이 없어 들어간 행은 영구히 남는다.

**고친 방법.** `security_invoker = on`은 답이 아니다 — 이 뷰는 D-054(선생님이 담당 학생의 학원
오답 메모를 본다)를 위해 **일부러** 소유자 권한으로 돈다. 읽기는 두고 **쓰기 권한만 revoke**했다.
같은 구멍이 다시 열리지 않게 나머지 뷰 5개(`v_assignment_submissions`·`v_daily_activity`·
`v_public_pricing`·`v_class_roster`·`v_latest_attempts`)도 읽기 전용임을 권한으로 못박았다 —
지금은 집계·distinct 때문에 `pg_relation_is_updatable = 0`이지만 뷰 정의가 단순해지는 순간
같은 일이 생긴다.

**검증.** anon INSERT·학생 INSERT 모두 `permission denied for view`. 위조 행 0건. 기능 유지:
선생님 SELECT 2행 · 원장 SELECT 5행. 권한은 anon·authenticated = `REFERENCES,SELECT,TRIGGER`.

### 0027 + 0028 — 초대 토큰을 서버가 만든다

**무엇이 문제였나.** `src/repo/directory.ts`의 `inviteTeacher`가 토큰을 브라우저에서 만들었다:
`INV-T-${Math.random().toString(36).slice(2,8)}` = base36 6자(≈31비트)이고 암호용 난수가 아니다.
`expires_at`·`inviter_id`도 쓰지 않아 live `invites` 세 행이 전부 `expires_at` null = **영구
유효**였다.

**원인이 왜 심각한가.** 그 토큰은 `rpc_accept_invite`의 **유일한 자격 증명**이다 — 그것 하나로
`academy_members`에 소속이 생기고 `user_roles`에 `academy` 역할이 붙는다. 그리고
`rpc_invite_info`는 초대 링크가 로그인 전에 열려야 해서 **일부러 anon이 부를 수 있다** — 추측한
토큰을 확인할 창구가 열려 있다. 그래서 추측 비용을 올리는 것이 유일한 방어다.

**고친 방법과 한 번의 실패.** 0027이 토큰을 서버(`rpc_create_invite`)로 옮기고
`pgcrypto`의 `gen_random_bytes(8)`를 썼는데 원장이 부르면 **실패했다**(실측:
`function gen_random_bytes(integer) does not exist`). Supabase는 pgcrypto를 `public`이 아니라
**`extensions` 스키마**에 설치하고, 이 함수는 0024 규칙대로 `search_path = public, pg_temp`로
고정돼 있어 그 스키마를 보지 못한다. `extensions.`를 붙이면 이 마이그레이션이 Supabase 전용이
된다(0001은 스키마 없이 확장을 만들므로 일반 Postgres에서는 `public`에 들어간다). 그래서 0028이
**`pg_catalog.gen_random_uuid()`**(PG13+ 코어)로 바꿨다 — hex 20자에서 74비트가 난수다.

0027의 백필 기준은 `created_at + 14일`이 아니라 **`now() + 14일`**로 잡았다. 전자로 계산하면
오래된 초대가 스키마 변경만으로 **소급 만료**되고, seed 토큰으로 초대 화면을 검증하는
`auth-flow`가 그것만으로 깨진다.

**검증.** anon → `로그인이 필요해요.` · 학생 → 거부 · **선생님 → 거부**(원장만) · 원장 → 성공.
3회 호출 모두 서로 다른 토큰 · `INV-T-` 접두어 유지(`e2e/academy-flow.spec.ts:271`이 단정한다) ·
길이 26자 · 전부 `expires_at`·`inviter_id`가 있다. 검증용으로 만든 초대는 삭제했다.

### 0029 — NULL 가드 두 곳 · 초대 불변식 · 초대 생성 단일화

독립 반박 검증이 0026·0027의 빈틈을 실측으로 찾았다. 네 가지를 함께 닫았다.

- **`rpc_add_assignment`의 `not in`이 NULL을 만든다.** `not in`은 인자가 NULL이면 NULL이고
  `if NULL`은 거짓이라 가드가 통째로 건너뛰어졌다. 실측: 선생님이 `p_class_id=null`을 보내면
  거부가 아니라 `23502`까지 갔다. 고친 뒤 → `반을 골라 주세요.`
- **`rpc_submit_attempt`의 `<>`가 NULL을 만든다.** 같은 성질이다. 두 컬럼이 `not null`이라
  트랜잭션이 결국 깨지므로 악용되지는 않지만, 가드가 우회되는 것 자체가 결함이고 `23502`
  메시지가 실패한 행의 컬럼 이름을 알려 준다. 고친 뒤 → `p_source=null`은
  `학습 출처가 없어요.` · `p_content_set_id=null`은 `어떤 학습인지 알 수 없어요.`
- **`invites.expires_at`을 스키마 불변식으로.** 0027은 한 번짜리 UPDATE로 채웠는데 그것으로는
  지켜지지 않았다(아래 "정직하게 적어 두는 것" 2번). 이제 컬럼이 `not null` + 기본값
  `now() + 14일`이라 seed와 직접 insert도 기본값을 받는다. 검증: `is_nullable=NO` · default 있음 ·
  null 행 0 · 원시 insert도 기본값을 받았다.
- **초대를 만드는 문을 하나로.** `invites_write`가 `for all`이라 원장이 RPC를 건너뛰고 직접
  insert할 수 있었고, 검증자가 `INV-T-WEAK1`을 201로 만들어 다른 사용자로 **끝까지 수락**해
  보였다. 0026이 방금 닫은 것과 같은 모양이다 — 함수는 조였는데 그 옆에 제한 없는 직접 쓰기가
  열려 있다. 이 레포는 이미 답을 갖고 있다(`assignments`·`attempts`는 표 정책이 **없고**
  `security definer` 함수만이 문이다). 초대도 같게 만들고 원장에게는 **취소**(update·delete)만
  남겼다. 검증: 원장 직접 insert → `new row violates row-level security policy` · RPC 성공 ·
  취소는 그대로 동작한다.

정상 경로 회귀도 확인했다 — 학생 개인 제출 성공 · 원장 정상 배정 성공(둘 다 검증용 행 삭제).

### 0030 — `revoke ... from anon`이 듣지 않았다

**무엇이 문제였나.** 0029가 `revoke execute on function rpc_create_invite from anon`을 적었는데
그 뒤에도 `has_function_privilege('anon', …, 'EXECUTE')`가 **true**였다.

**원인.** `pg_proc.proacl`을 보면 바로 드러난다:

```
rpc_create_invite   → {=X/postgres, postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres}
                       ↑ 이 빈 grantee가 PUBLIC이다
note_learning_event → {postgres=X/postgres, service_role=X/postgres}
                       ↑ 0024가 닫은 함수에는 PUBLIC 항목이 없다
```

`anon`에서 revoke하면 **명시적인 `anon=X` 항목만** 사라진다. Postgres는 함수를 만들 때 EXECUTE를
PUBLIC에 기본 부여하므로 `anon`은 그것을 물려받는다.

**고친 방법.** `from public` + `to authenticated`. 가입 검사 두 개는 **의도적으로** 익명이
부르지만 PUBLIC이 아니라 `anon, authenticated`에 명시적으로 준다 — 권한이 어디서 오는지 읽을 수
있게. 검증: anon → `permission denied for function` · 가입 검사는 그대로 200.

레포의 다른 RPC들도 같은 PUBLIC 부여를 갖고 있다. 여기서 함께 손대지 않았다 — 그 함수들은 본문
첫 줄이 `if auth.uid() is null then raise`이고 익명 호출은 실측에서 전부 거부된다. 함수 30여 개의
부여를 한꺼번에 바꾸는 일이라 **A-101**로 남긴다.

### `src/data/index.ts` ↔ `src/data/seed.ts` 분리 (M-DB-5 일부)

**무엇이 문제였나.** `src/data/index.ts`(barrel)가 픽스처를 **값으로** re-export했다. Metro에는
tree shaking이 없어서, 화면이 `findContent` 하나만 가져와도 `ACCOUNTS`(4,186개)·로스터 3,000명
그래프가 모듈 평가 시점에 만들어져 **운영 번들에 그대로 실렸다.**

**고친 방법.** `index.ts`를 **픽스처 없는** 경계로 바꿨다(타입 + 국어 분류 상수 + 인자만 보는 순수
함수). 픽스처와 그 조회 함수는 `src/data/seed.ts`로 옮기고, 테스트 3개(`data`·`academyStats`·
`report`)의 import만 `@/data/seed`로 바꿨다. 유일한 production 소비자였던 `app/signup.tsx`는
0025로 없어졌다.

**검증(`expo export -p web` 전/후 번들 grep).**

| | BEFORE | AFTER |
|---|---|---|
| bytes | 2,791,396 | 2,684,802 |
| `ACADEMY_CLASSES` | 9 | 0 |
| `ROSTER_CLASSES` | 3 | 0 |
| `EXTRA_ACADEMY_CLASSES` | 3 | 0 |
| `c_kor1` | 2 | 0 |
| `u_rs_00…` | 34 | 0 |
| `ct_acad_1` | 18 | 0 |
| `ASSIGNMENTS_SEED` | 3 | 0 |

남은 `publishToStudents` 12는 `ContentSet` 타입 필드다(정상). `test1234`·`@scody.test` 각 1은
`src/session/session.tsx`의 개발용 로그인이다(M-DB-2 — 지금은 **유일한 로그인 수단**이라 뺄 수
없다). **M-DB-5는 닫지 않는다** — 픽스처 모듈은 레포에 그대로 있고 `scripts/gen-seed.ts`와
`__tests__`가 읽는다.

### `scripts/verify-rls.ts`가 상태를 되돌린다

**무엇이 문제였나.** D-054 읽기(선생님이 담당 학생의 학원 오답 메모를 본다)를 live에서 시연하려
했더니 선생·원장 **모두 `[]`**를 받았다. D-054가 깨진 것처럼 보였다.

**원인.** 깨진 것이 아니라 검증 스크립트가 DB를 seed 상태가 아닌 곳에 두고 끝냈다.
`원장이 소속을 끝낼 수 있다` 블록이 `academy_members.left_at`을 채우고 되돌리지 않았고, 학원
오답의 유일한 소유자가 그 학생이라 소속이 끝난 채 남으면 `v_academy_visible_notes`가 모두에게
빈 목록이 된다. 앞서 측정한 선생님 2행·원장 5행은 **재시드 전**이라 참이었다.

**고친 방법.** 블록 끝에서 `left_at`을 `null`로 되돌리고, 되돌리기 성공과 "되돌린 뒤 메모가 다시
보인다"까지 검사로 남겼다 — 조용히 넘기면 다음 실행이 이유 없이 흔들린다. 검사 2개가 늘어
`npm run db:verify`는 **74개**가 됐다.

### 정직하게 적어 두는 것 세 가지

다음에 이 코드를 보는 사람에게 가장 도움이 되는 부분이라 따로 적는다. 셋 다 이 루프에서 **내
보고가 틀렸던 것**이다.

1. **0026의 "레포 전체에서 그 모양은 `0021`·`0022` 두 곳이다"는 거짓이었다.** `or`가 NULL을
   만드는 경우만 찾고 같은 성질의 다른 연산자를 보지 않았다. 0029가 정정한다. 교훈은 연산자
   목록이 아니라 규칙이다 — **plpgsql에서 `if <NULL> then`은 거짓이므로, 불리언 식이 NULL이 될
   수 있는 모든 가드가 통째로 우회된다.** `or`뿐 아니라 `not in`·`<>`도 그렇고, 다음에 또
   찾을 때는 "NULL이 될 수 있는 식"으로 찾아야 한다.

2. **"기간 없는 미사용 초대 0건"은 측정 시점에는 참이었고 그 뒤 무효가 됐다.** 0027의 백필
   직후에 확인해 그것을 근거로 보고했는데, **내가 직접 돌린 `npm run db:verify`가 재시드**하면서
   `supabase/seed.sql:291`이 `expires_at` 없이 초대를 다시 넣어 세 행 모두 NULL로 돌아갔다.
   `rpc_accept_invite`는 `expires_at is not null and expires_at < now()`만 보므로 **NULL은
   "영원히 유효"**다. 불변식이 RPC 하나와 한 번짜리 UPDATE에만 있었고 스키마에는 없었다.
   0029가 그것을 **컬럼**으로 옮겼다. 교훈: 재시드로 되돌아가는 사실은 검증 근거가 아니다.

3. **0029 초안이 함수 본문을 부분만 읽고 재작성해 하마터면 큰 회귀를 낼 뻔했다.** 원문과 diff를
   떠 보니 내가 hallucinate한 것이 이만큼이다 — 없는 파라미터(`p_subject`·`p_question_count`)
   추가 · **콘텐츠 소유권 검사(`배정할 수 없는 문제예요`) 삭제** · 중복 배정 검사 삭제 ·
   `attempt_no`→`try_no` 오타 · `p_time_sec default 0`→`null` · **제출 후 `answer_drafts`·
   `study_queue` 정리 삭제** · `original_due_date`·`created_by` 누락 ·
   `v_class_roster`→`class_students`. 적용 전에 diff로 잡았다.
   → **규칙: 함수 본문을 다시 쓰지 않는다. 원문 텍스트에 가드 줄만 기계적으로 끼워 넣고 diff가
   그 줄뿐임을 확인한다.** 0029는 그 방식으로 만들었다.

### 검증 (2026-08-14 실측)

| 검사 | 기준선 | 이 작업 뒤 |
|---|---|---|
| `npm run typecheck` | 통과 | 통과 |
| `npm run lint` | 0 오류 / 5 경고 | 0 오류 / 5 경고 |
| `npm test` | 187/187 | 187/187 |
| `expo export -p web` | 통과 2,791,396 B | 통과 2,684,802 B |
| `npm run db:verify`(clean seed) | 마스터 플랜에 40건 | **74 통과 / 0 실패** |
| `playwright --project=desktop` | 14 실패 / 154 통과 | 12 실패 / 156 통과 |

**persistence는 이번에 처음 측정했다.** clean seed에서 정예린으로 브라우저를 띄워 담아 두기부터
따라갔다:

| 단계 | 화면 | DB `study_queue` |
|---|---|---|
| 담아 두기 | — | 0 → **1**(실제 Postgres 쓰기) |
| 새로고침 | 1행 | 1 |
| 로그아웃 → 재로그인 | 1행 | 1 |
| 완전히 새 브라우저 컨텍스트(쿠키·스토리지 없음) | 1행 | 1 |

A-025(담아 둔 학습 영속)는 문서상 이미 닫혀 있었지만 **측정된 적은 없었다.** 검증으로 만든 행
1개는 삭제해 DB를 원래대로 뒀다.

### E2E 차이 분석 (정직한 회계)

- **고쳐진 것 2건**: `parent-flow:345 이번 주 요약을 만들면 그 주 내내 남는다` ·
  `student-flow:716 추가 대화까지 다시 정리하고, 지우면 처음 상태로 돌아간다`. 둘 다 "서버 확인
  뒤에 말한다" 수정의 결과다(`setWeekSummary`·`setDig`를 await하게 됐다).
- **통과 수가 실행마다 흔들린다.** 루프 중간 실행에서는 `parent-flow:260`이 실패했고 마지막
  실행에서는 그것이 통과하고 `parent-flow:294`·`:537`이 실패했다. `:260`은 단독
  `--repeat-each=3`에서 3/3 통과했고(각 5~6초), 전체 스위트에서는 30초 타임아웃에 실패 지점이
  `:271 page.getByText('로그아웃').click()`의 `element was detached from the DOM, retrying`였다 —
  데이터·단정 실패가 아니라 **DOM 분리 경합**이다. 같은 파일 `:537`도 같은 로그아웃 클릭에서
  실패한다. **그래서 "E2E 전부 통과"를 종료 조건으로 쓸 수 없다**(M-DB-15로 올린다).
- **오탐 하나를 정정했다.** 처음에 0026이 `rpc_class_comparisons` 집계를 바꿨다고 의심했으나,
  0022 원문 전체를 다시 읽어 대조한 결과 옮겨 쓴 본문이 원문과 **완전히 동일**했다.

### `verify-rls.ts`는 clean seed 뒤에만 믿을 수 있다

오염된 실행에서는 67/1, 68/4가 나왔다. 실패는 전부 seed 총계와의 **등호 단정**이었다
(`풀이 32건`인데 실제 33 · `배정 4건` · `정예린 풀이 7건`인데 실제 8). 원인은 E2E가 테스트
*사이*에 재시드하지만 마지막 테스트의 쓰기는 남기 때문이다. `npm run db:verify`(재시드 후 검증)로
돌리면 74/0이다. **이전 RLS 감사들의 실행도 같은 이유로 신뢰할 수 없었다.**

### 남은 문제

- **학원 간 격리가 전혀 검증되지 않았다** — DB에 학원이 1곳뿐이다(M-DB-13).
- **소속이 끝난 학생이 좌석을 계속 차지한다** — `v_class_roster`가 `left_at`을 보지 않는다
  (M-DB-14).
- **E2E가 순서 의존으로 흔들린다** — 통과 수가 실행마다 다르다(M-DB-15).
- **가입 검사 RPC 두 개는 상한 없는 익명 열거 오라클이다**(A-100). 0025가 스스로 적어 둔 위험이고,
  실측으로 확인했다: 익명 키로 `rpc_signup_phone_taken`을 40회 연속 호출하면 1,932ms에 **전부
  200**(약 21회/초)이고 차단·지연·상한이 하나도 없다. 0025 주석은 이 항목을 `A-099`로 적었는데
  그 번호는 담아 둔 학습 순서 항목이 먼저 썼다 — 마스터 플랜에는 `A-100`으로 올렸다.
- **PUBLIC EXECUTE 전수 정리**는 0030이 의도적으로 범위 밖에 뒀다(A-101).
- `answer_drafts`에 겹치는 유니크 인덱스 2개(`answer_drafts_key` 표현식 + `_target_key` 컬럼)가
  있다. 지금 동작을 바꾸지는 않아 손대지 않았다.
- `src/features/openrouter.ts`가 `no-session`을 `no-config`와 같은 데모 문장으로 말한다 — AI는
  연결돼 있고 세션만 없는 경우에 거짓말이 된다.

## 2026-08-14 — 예외가 계약을 빠져나가던 자리 넷을 닫았다

같은 날 `reload()` 항목이 **남은 문제로 적어 둔 두 가지**를 포함해, 감사에서 지목된 네 곳을
코드로 다시 확인한 뒤 고쳤다. 성공 토스트 문구는 한 글자도 바꾸지 않았다.

### 1. `app/student/ask.tsx` `send()` — `busy`가 켜진 채 남았다

`try`가 없어 `setBusy(false)`가 마지막 순차 문장이었다. 그 사이에서 예외가 나면 입력창이 화면을
나갈 때까지 죽었다. 형제 셋(`notebook.tsx`·`review.tsx`·`ChildReport.tsx`)과 같은 꼴로
`try/catch/finally`를 뒀다. 예외로 답이 비면 이름표만 있는 빈 답변을 그리지 않고, 보낼 때 비운
질문을 입력창에 되돌린다(기다리는 동안 새로 쓴 글은 지우지 않는다).

### 2. `src/features/openrouter.ts` — `try` 밖에 남아 있던 던지는 자리들

`body.getReader()`·`new TextDecoder()`가 `try` 앞에 있어 그 예외만 계약(`실패는 값`)을 빠져나갔다.
둘을 `try` 안으로 옮겼다 — 실패 문장은 기존 `Scody AI 연결 오류: …`(`isAiFailure`가 아는 꼴)
그대로이고 새 실패 통로를 만들지 않았다. `onDelta` 호출 다섯 곳은 `emit()`으로 감쌌다. 소비자
콜백(대개 `setState`)이 던지면 그것이 거절로 새어 나가 부르는 화면의 대기 표시가 꺼지지 않았다.
그리기 실패는 답을 무르지 않으므로 삼키고 반환값은 그대로 준다. 끊긴 조각을 답으로 쓰지 않고
실패 문장을 `onDelta`로 흘리지 않는 규칙은 그대로다.

### 3. `app/academy/manage.tsx` — 대리 보기에서 쓰기를 먼저 시도했다

`onAdd`·`onRemoveTeacher`의 `if (readOnly) return;`이 **await한 쓰기 뒤에** 있었다. 앞선 워크로그가
`결과 분기보다 먼저 본다`고 적은 것은 사실이지만, 그 자리는 여전히 호출 **뒤**여서 대리 보기에서도
쓰기가 시도되고 제공자가 안에서 거부한 뒤(`src/features/academy.tsx:93`) 화면에는 아무 말도 남지
않았다. 가드를 호출 앞으로 옮겨 **시도 자체가 없게** 했다. 대리 보기는 그대로 조용하다(토스트
없음 — 학생 화면들과 같은 규칙).

### 4. `src/features/progress.tsx` — 겹친 `reload()`에서 앞선 것이 먼저 풀렸다

`read()`가 `if (!alive()) return`으로 아무것도 얹지 않고 끝나는데 그 약속은 정상적으로 풀렸다.
연달아 두 번 쓰면 첫 `await reload()`가 자기 값이 도착하기 전에 풀렸다 — 증상은 새 조회가
`loading`을 다시 켜서 가려져 있었지만 `reload()`가 약속한 보증은 거짓이었다. 밀린 조회가 자기를
밀어낸 조회(`running` ref의 번호 + 약속)를 기다리게 했다. 번호는 늘 커지므로 기다림은 한 방향이고
고리가 생기지 않는다. 취소(계정 변경·언마운트)에는 기다릴 대상이 없어 그대로 끝낸다 — 취소 동작,
`setLoading(true)` 재무장(E2E 11건이 갈렸던 자리), `finally`의 `loading` 해제는 모두 남겼다.

### 검증 (2026-08-14 실측)

- `npm run typecheck` 통과 · `npm run lint` 오류 0 · 경고 5건(기존) · `npm test` **187/187**.
- 브라우저 실측(개발 서버 8081, Playwright 스크립트, 고치기 전/후 대조):
  - #1 — `askScodyAIStream`이 예외로 끝나게 만들었을 때, 고치기 전은 `ask-pending`이 남고
    `ask-submit aria-disabled=true`(죽은 입력창), 고친 뒤는 대기 표시 0개에 버튼이 다시 눌렸다.
    ai-proxy를 `route.abort()`로 끊는 실제 실패에서도 입력창이 살아 있었다.
  - #2 — 브라우저에서 `ReadableStream.prototype.getReader`가 던지게 했을 때, 고친 뒤는 실패
    문장이 **값으로** 돌아왔고(화면에 `Scody AI 연결 오류…`) 고치기 전은 값이 돌아오지 않았다
    (거절로 나갔다).
  - #3 — 관리자로 한빛 원장을 대리 보기하고 `초대 링크 만들기`를 눌렀더니 서버 쓰기 POST **0건** ·
    토스트 0개 · 내부 거부 문장 노출 없음. 진짜 원장으로는 그대로 `초대 링크를 만들었어요`와
    `/join?invite=INV-T-…`가 나왔다(e2e `academy-flow:269`가 단정하는 문구 그대로).
  - #4 — 계측(값이 화면에 얹힌 횟수)을 임시로 붙이고 `reload()`를 연달아 두 번 불렀다.
    고치기 전은 `reload1`이 **얹힘 0회**로 먼저 풀렸고, 고친 뒤는 `reload2`가 얹힌 뒤에
    `reload1`이 풀렸다. 계측 코드는 되돌렸다(레포에 남은 `TEMP-PROOF` 0건).
- Playwright 스펙은 돌리지 않았다(공용 DB를 재시드하고 선생님 제외 흐름이 seed를 깬다).
  토스트 문구를 단정하는 스펙은 문구를 바꾸지 않았으므로 그대로 맞는다.

### 남은 문제

- `app/student/ask.tsx`는 실패 문장(`Scody AI 호출 실패. …`)을 여전히 `Scody AI`의 답으로 그린다.
  `notebook.tsx`·`review.tsx`는 `isAiFailure`로 걸러 따로 말한다(§19·D-107). 이번 범위가 아니라
  손대지 않았다 — 화면 문안 결정이 필요하다.
- `src/features/openrouter.ts`가 `no-session`을 `no-config`와 같은 데모 문장으로 말하는 문제는
  그대로다(앞 항목에서 적어 둔 것).

## 2026-08-14 — 학생 홈·학습 탭이 조회 중에 `없어요`라고 단정하던 자리를 닫았다 (D-133)

### 무엇이 문제였나

학생 홈(`app/student/index.tsx`)과 학습 탭(`app/student/learn.tsx`)이 두 provider의 `loading`을
받지 않았다. 학습 목록은 **콘텐츠 조회와 학습 기록 조회 둘**에서 오는데(`src/features/learning.ts`),
첫 조회가 끝나기 전에는 배정도 담아 둔 학습도 비어 있다. 그 창에서

- 홈은 `nothingYet = all.length === 0 && queued.items.length === 0`이 참이 되어
  **`아직 시작한 학습이 없어요` + `문제 담으러 가기`** 히어로를 그렸다.
- 진행 상황 블록은 절반만 온 목록으로 개수를 셌다.
- 학원 과제 면은 `hasAcademy`가 거짓인 동안 사라졌다가, 배정이 절반만 온 순간
  `학원에서 내준 과제물을 모두 마쳤어요.`로 나타났다.
- 담아 둔 학습 면은 `hasPersonal`(이용권이라 조회를 기다리지 않는다)만 보고 열려
  `담아 둔 학습이 없어요.`를 먼저 말했다.
- 학습 탭은 `inAcademy`가 계정 값이라 참인 채 목록만 비어 `아직 학원에서 받은 학습이 없어요.`를 그렸다.

즉 **학원 과제 4건이 있는 학생이 홈을 새로고침할 때마다 첫 화면이 "아직 시작한 학습이 없어요"였다.**

### 고친 것

같은 레포가 이미 두 번 쓴 패턴을 그대로 썼다(`app/student/pick.tsx:158-175`의 학년 목록,
`app/student/result/[id].tsx`의 `결과를 찾지 못했어요`).

- `app/student/index.tsx` · `app/student/learn.tsx`: `useProgress().loading`과
  `useContent().loading`을 받아 `reading`으로 묶고, **개수를 말하거나 `없어요`라고 말하는 자리만**
  게이트했다. 화면 전체는 막지 않는다 — `pick.tsx` 주석이 그 이유를 적어 뒀다(역할 레이아웃에서
  막았더니 단계형 화면이 쿼리 파라미터를 잃었다). 게이트한 자리는 홈의 히어로 빈 상태 분기 ·
  진행 상황 블록 · 학원 과제 면 · 담아 둔 학습 면, 학습 탭의 학원 학습 빈 문장 다섯이다.
- 로딩 자리에는 `학습을 불러오고 있어요.` 한 줄(`AppText variant="caption" tone="secondary"`)만
  둔다. 문장·무게가 `pick.tsx`와 같다. 히어로는 카드째 그리지 않는다 — 껍데기만 남기면 빈 칸이
  곧 `할 일이 없다`는 뜻으로 읽힌다.
- **문장은 하나도 바꾸지 않았다.** 확정 정책이 고정한 다섯 문장(`아직 시작한 학습이 없어요` ·
  `문제 담으러 가기` · `아직 학원에서 받은 학습이 없어요.` · `오늘 할 일을 다 끝냈어요` ·
  `학원에서 내준 과제가 있어요`)은 그대로 두고 **언제 보이는지만** 바꿨다.
- 히어로가 무엇을 고르는지(`queued.items[0] ?? todo[0]`)와 `academyLinked` 분기는 각각 M9-03 ·
  M-DB-8 결정 대기라 손대지 않았다.
- `src/features/content.tsx:103` · `src/features/progress.tsx:369`의 주석이 오류·재시도를
  `M-DB-9`로 가리켰는데 그 ID는 `attempts.submitted_on` 항목이다. 이번에 만든 `M-DB-16`으로 고쳤다.

### 검증

- `npm run typecheck` 통과. `npm run lint` 오류 0 · 경고 5(기존과 같음:
  `.expo/types/router.d.ts` 1 · `src/theme/fonts.web.ts` 4). `npm test` 187/187.
- **브라우저 계측**(dev 서버 `http://localhost:8081`, 정예린 계정, 스크립트는 `/tmp` 스크래치패드에
  두고 레포에 남기지 않았다). `page.addInitScript`로 이동 **전에** `MutationObserver`를 심어
  문장이 화면에 나타난 횟수와 시각을 세고, `page.route`로 Supabase REST를 요청당 1.5초 늦췄다.

  | 창 | 고치기 전 | 고친 뒤 |
  |---|---|---|
  | 홈 새로고침 `아직 시작한 학습이 없어요` | 1회 · +3,527ms (데이터 +7,290ms) | **0회** |
  | 홈 새로고침 `학원에서 내준 과제물을 모두 마쳤어요` | 1회 · +5,666ms(거짓) | 1회 · +6,919ms(로드 후, 참) |
  | 홈 새로고침 `담아 둔 학습이 없어요.` | 1회 · +3,527ms(거짓) | 1회 · +6,919ms(로드 후, 참) |
  | 학습 탭 새로고침 `아직 학원에서 받은 학습이 없어요.` | 1회 · +3,479ms | **0회** |
  | `학습을 불러오고 있어요.` | 0회 | 1회 · +3,4xxms |
  | 합계(조회 완료 전 거짓 문장) | **4건** | **0건** |

  게이트가 화면을 영구히 막지 않는 것도 같은 실행에서 확인했다 — 로드 뒤 홈은 히어로와
  진행 상황(`남은 학습이 없어요` · `4 / 4 완료`)을, 학습 탭은 학원 학습 목록(`현대소설 점검`)을 그린다.
- **화면 확인**: `/student`(홈)과 `/student/learn`을 1280 · 820 · 390 + 390 다크에서 조회 중과
  로드 후로 찍었다. 근거 이미지는 `docs/evidence/false-empty-{home,learn}-{loading,loaded}-*.png`.
  (다크는 새로고침하면 테마가 초기화되므로 로딩 창을 **로그인 순간**에 잡았다.)
- **Playwright는 돌리지 않았다.** 공용 DB를 쓰는 스펙이라 실행이 데이터를 바꾼다(지금 정예린은
  이전 실행 때문에 배정 4건이 모두 제출 상태다 — seed 모양이 아니다). 대신 이 변경이 닿는 단정을
  전부 grep해 확인했다: `boundary-flow:110` · `student-flow:317,485,493-504,540,550,566-569` ·
  `auth-flow:133` · `academy-flow:171,181`. 전부 `toBeVisible()`(자동 재시도라 게이트가 풀린 뒤
  단정이 맞는다) 아니면 `toHaveCount(0)`(게이트는 개수를 늘리지 않는다)이고, 문구를 바꾸지
  않았으므로 단정을 고칠 것이 없었다. **다음에 스위트를 돌리는 사람이 실측으로 확인해야 한다.**

### 남은 문제

- **조회 실패는 이 게이트가 덮지 못한다**(M-DB-16으로 남겼다). 두 provider가 실패해도 `loading`을
  내리고 `error`를 내보내지 않으므로 화면은 실패와 빈 계정을 가를 수 없다. 실측: REST를 500으로
  막고 홈을 새로고침하면 `아직 시작한 학습이 없어요`가 +441ms에 나타나 그대로 남는다(고치기 전
  +468ms와 사실상 같다). 이번 범위가 오류·재시도 UI를 만들지 않는 것이라 손대지 않았다.
- 계측 중에 알게 된 것: `answer_drafts` 조회를 막으면 **세션 스냅샷이 실패해 로그인 화면으로
  튕긴다.** 세션 복구 실패와 데이터 조회 실패가 같은 처리를 받고 있다 — M-DB-16에 함께 적었다.
- **로딩 창을 지키는 자동 테스트가 없다.** 이번 근거는 손으로 돌린 브라우저 계측이라 회귀를
  못 잡는다. E2E로 옮기려면 스펙 하나를 더하면 된다 — `e2e/_fixtures`의 `test`로 정예린을
  로그인시키고, `page.route('**/rest/v1/**')`로 응답을 1초 늦춘 뒤 `page.reload()` 하고
  `await expect(page.getByText('아직 시작한 학습이 없어요')).toHaveCount(0)`을
  `학습을 불러오고 있어요.`가 보이는 동안 단정한다(학습 탭은
  `아직 학원에서 받은 학습이 없어요.`로 같게). 이번에는 그 스펙을 넣지 않았다 — `_fixtures`의
  `test`가 테스트마다 `supabase/seed.sql`로 **DB를 재시드**하는데 이번 작업 범위에서 재시드를
  돌리지 않기로 했고, 돌려 보지 않은 테스트를 레포에 남기지 않는다.

## 2026-08-14 — 학원을 떠난 학생이 좌석을 차지하고 새 배정까지 받던 것을 고쳤다 (M-DB-14 · D-134)

`removeMember`는 `academy_members.left_at`만 채우고 `class_students`는 그대로 둔다(0024가 의도한
대로다 — 그 학생이 그 반에서 낸 제출 기록의 근거가 필요하다). 문제는 `v_class_roster`가
`class_students.removed_at is null`만 보고 `left_at`을 **보지 않은 것**이었다(0012:105).

### 고치기 전 실측 — 같은 학생에 대해 세 곳이 다른 답을 냈다

접속은 `scripts/run-sql.ts`와 같은 풀러 경로를 쓰고, 실험은 **`begin … rollback` 안에서만** 했다
(커밋된 상태를 바꾸지 않는다). 정예린의 `left_at`을 세운 뒤 재고 되돌렸다.

| 재는 것 | 소속 활성 (기준) | 소속 종료 · 고치기 전 | 소속 종료 · 고친 뒤 |
|---|---|---|---|
| `v_class_roster` 전체 행 | 15 | **15**(안 줄어든다) | 13 |
| 정예린의 로스터 행 | 2 | **2** | 0 |
| `rpc_revenue_estimate.academy_seat_count` | 14 | **14** | 13 |
| `rpc_revenue_estimate.academy`(청구액) | ₩168,000 | **₩168,000** | ₩156,000 |
| `rpc_class_stats` 인원(고1 / 고2) | 9 / 6 | **9 / 6** | 8 / 5 |
| `rpc_add_assignment` 대상 수 | — | **9명 (떠난 학생 포함)** | 8명 (제외) |
| 선생님·원장의 `can_see_student` | true | **false** | false |
| `assignment_targets`(정예린) | 4 | 4 | **4 (그대로)** |
| `attempts`(정예린) | 7 | 7 | **7 (그대로)** |

굵은 칸이 결함이다 — `can_see_student`는 거짓인데 청구·배정은 계속 됐다. **청구는 하는데 가르칠
수는 없는 상태**였다. 고친 뒤에는 셋이 함께 움직여 `can_see_student`와 어긋나지 않는다.

`paying_people`은 16으로 전·후 같은데 **그것이 맞다** — 정예린에게 활성 개인 이용권이 따로 있어
(`entitlements`에 `personal`/`student` 1건) 좌석에서 빠져도 개인 결제자로 계속 세어진다.

### 고친 자리는 뷰 하나다 — 함수 본문을 건드리지 않았다

`rpc_add_assignment`(0029) · `rpc_class_stats`(0014) · `rpc_revenue_estimate`(0014)가 **모두
`v_class_roster`를 원천으로 쓴다.** 그래서 뷰에 조건을 더하면 셋이 함께 맞고, 함수는 한 줄도
다시 쓸 필요가 없다. 0026에서 본문을 부분만 읽고 옮겨 적어 콘텐츠 소유권 검사와 제출 후 정리를
잃을 뻔한 사고가 있었으므로, 이번에는 원문을 `awk`로 뽑아 `sed`로 줄만 끼워 넣고 `diff`로
확인한 뒤 적용했다. 확인한 diff는 **`create` → `create or replace` 한 줄 + 조인 두 개**뿐이다
(주석 제외):

```
-create view public.v_class_roster with (security_invoker = on) as
+create or replace view public.v_class_roster with (security_invoker = on) as
 from public.class_students cs
 join public.profiles p on p.id = cs.student_id
+join public.classes c on c.id = cs.class_id
+join public.academy_members m
+  on m.academy_id = c.academy_id
+ and m.user_id = cs.student_id
+ and m.left_at is null
 where cs.removed_at is null;
```

마이그레이션: `supabase/migrations/0033_roster_requires_active_membership.sql`.

**`classes`를 직접 조인한 이유**: 학원 id를 얻는 `class_academy_id()`는 `auth.uid()`가 없으면
NULL을 준다(0032가 익명 유출을 막으려고 넣은 검사다). 그것을 뷰 안에 쓰면 JWT 없이 도는
security definer 함수에서 로스터가 통째로 비어 버린다.

**행이 늘거나 줄지 않는다**: `academy_members`의 기본키가 `(academy_id, user_id)`이고 `classes`는
`id`로 조인하므로 두 조인 모두 최대 1행을 붙인다. 실측으로 커밋 상태의 로스터가 15행 → 15행
그대로다.

### 경계 — 무엇을 하지 않았나

- **기록을 지우지 않았다.** 이미 만들어진 `assignment_targets`·`attempts`는 그대로 남는다(확정
  정책: 학원 연결이 끝나도 계정과 과거 기록은 유지한다). 위 표에서 정예린의 4건·7건이 전·후
  동일한 것으로 확인했다. 바뀌는 것은 **앞으로의** 배정과 **현재** 좌석 수다.
- **월 중 이탈 안분(proration)은 손대지 않았다.** "이탈 시점 이후 구간만 제외할지"는 A-049가
  이미 결정 대기로 들고 있는 별 질문이다. 이번에 답한 것은 "떠난 사람을 셀지 말지"이고 답은
  세지 않는 것이다. 좌석 수는 여전히 지금 시점의 스냅샷이다. 이 구분을 마이그레이션 주석에
  적었다.
- **`src/repo/admin.ts`는 고칠 것이 없었다.** 두 곳(`listAcademies`·`academyClasses`)이 뷰를
  그대로 읽어 학원별 재원생을 세므로, 뷰가 좁아지면 함께 맞는다.

### 회귀 확인

- **활성 학생은 그대로다.** 커밋 상태에서 전·후 로스터 15행 · 좌석 14석 · 청구액 ₩168,000 ·
  반 인원 9/6명이 모두 같다. 로스터 15행 전부가 `member_role = 'student'`의 활성 소속을 갖고
  있어(소속 행이 없는 행 0건) 이 변경으로 빠지는 활성 학생이 없다.
- **`security_invoker = on`을 유지했고 좁아지지 않았다.** 더한 두 테이블도 호출자 권한으로
  읽히므로 역할별로 실측했다 — 뷰에서 읽는 행 수가 그 역할의 `class_students` 가시 행 수와
  정확히 같다: 운영자 15/15 · 원장 15/15 · 선생님 15/15 · 학생(정예린) 2/2 · 학부모 2/2.
  익명은 전과 같이 **오류가 아니라 0행**이다(0032가 지키려 한 성질).
- **권한이 그대로다.** `create or replace view`가 grant를 유지한다. 실측 `relacl`은
  `authenticated=rxtm`으로 select만이고 0026의 insert/update/delete 회수가 살아 있다.
- `npm run db:verify` **84개 통과 · 0개 실패** (전과 같다). 이 스크립트의 `[학원 경계]` 블록이
  이미 소속 종료를 시험하고 정리 단계에서 되돌린다 — 좌석 수를 등호로 단정하는 자리는 없어서
  고칠 단정이 없었다.
- `npm run typecheck` 통과. `npm run lint` 0 errors / 7 warnings(전부 기존 것이고 이 변경이 닿지
  않는 파일이다). `npm test` 187개 통과.
- **Playwright는 돌리지 않았다** — 다른 에이전트가 같은 레포의 코드를 고치는 중이고 공용 DB를
  쓰는 스펙이라 실행이 데이터를 바꾼다.

### 남은 문제

- **`npm run db:types`를 반영하지 않았다.** 돌려 보니 이 변경으로 생기는 diff는 **0줄**이다
  (뷰 컬럼이 그대로다). 대신 무관한 drift 3줄이 나왔다 — `invites.expires_at`이 DB에서는
  not null인데 커밋된 `src/lib/database.types.ts`는 `string | null`이다. 0029·0031 계열의 초대
  불변식 작업에서 생긴 것으로 보이고 이번 범위가 아니라 되돌렸다. **그 파일을 다음에 재생성하는
  사람은 이 3줄이 함께 따라온다는 것을 알고 있어야 한다.**
- **소속 종료를 지키는 자동 테스트가 뷰 수준에는 없다.** 이번 근거는 손으로 돌린 SQL 계측이다.
  `verify-rls.ts`의 `[학원 경계]` 블록이 이미 `left_at`을 세우고 되돌리므로, 그 안에 좌석 수와
  로스터 행 수 단정을 더하면 회귀를 잡을 수 있다. 이번에는 넣지 않았다 — 그 블록의 `victim`이
  실행마다 `v_academy_visible_notes`의 첫 학생이라 단정할 좌석 수가 고정되지 않는다(대상을
  이름으로 고정하는 변경이 먼저 필요하고, 그것은 요청 범위 밖이다).
- **학생이 스스로 학원 연결을 끊는 경로는 여전히 서버에 없다**(M-DB-8). 이 변경은 원장이
  `left_at`을 채운 뒤의 계산만 고친다.

## 2026-08-14 — 조회가 실패해도 `아직 시작한 학습이 없어요`라고 말하던 것을 고쳤다 (M-DB-16 · D-136)

D-133이 **읽는 중**을 닫았지만 **읽지 못했을 때**는 그대로였다. `src/features/content.tsx`와
`src/features/progress.tsx`가 실패를 `console.warn`으로만 남기고 `loading`을 내렸고, `error`를
밖으로 내보내지 않아서 **화면이 "실패"와 "빈 계정"을 구조적으로 가를 수 없었다.**

### 고친 것

| 자리 | 무엇을 | 왜 |
|---|---|---|
| `src/features/content.tsx:49-59` | `ContentValue`에 `error: string \| null`을 더했다 | 화면이 실패와 빈 목록을 가를 값이 없었다 |
| `src/features/content.tsx:83` · `115-126` · `144-154` | 실패 이유를 상태로 들고, `done(rows, failure)`가 성공에 `null`·실패에 문장을 얹는다. 실패해도 `sets`는 비우지 않는다 | 성공하면 실패 표시가 사라져야 하고, 이미 읽어 둔 목록은 여전히 사실이다 |
| `src/features/progress.tsx:136-146` · `245` | `ProgressValue`에 `error`를 더하고 상태를 뒀다 | 위와 같다 |
| `src/features/progress.tsx:330` · `375-386` | 로그아웃과 성공에서 `null`, `catch`에서 문장. `awaitSuccessor` 경로(밀린 조회)에서는 얹지 않는다 | 나를 밀어낸 조회가 자기 결과를 얹는다 — 밀린 조회의 실패를 남기면 성공한 화면에 빨간 줄이 남는다 |
| `app/student/index.tsx:77-99` · `186-210` | `loadError = reading ? null : (progressError ?? contentError)`. 인라인 `danger` 캡션 `학습을 불러오지 못했어요. {서버 문장}` + `다시 불러오기`(두 `reload()`를 함께 부른다) | 실패 문장은 서버가 준 것을 쓰고, 재시도는 provider에 이미 있던 `reload()`다. 다시 읽는 중에는 감춘다 — 실패와 로딩이 함께 서면 지금 무슨 일인지 알 수 없다 |
| `app/student/index.tsx:243-250` · `300` · `350` · `429` | 히어로 빈 상태 분기에 `loadError → null`, 진행 상황·학원 과제 면·담아 둔 학습 면에 `&& !loadError` | 못 읽은 목록으로 센 개수와 `없어요`는 읽는 중에 센 것과 똑같이 거짓이다 |
| `app/student/learn.tsx:30-36` · `55-66` · `85-113` | 같은 세 갈래. 실패 면은 **화면 맨 위 한 곳**이고, 학원 섹션 조건이 `academy.length > 0 \|\| (inAcademy && !loadError)`가 됐다 | 소속이 없는 학생에게는 학원 섹션이 아예 없어서 그 안에 두면 실패가 어디에도 남지 않는다. 개인 학습·오답노트도 같은 조회에 매달려 있다 |
| `app/student/pick.tsx:35` · `41-47` · `180-197` | 실패면 세 단계와 4단계 목록을 그리지 않고 실패 문장 + `다시 불러오기` | 실패한 조회는 모든 칸을 0개로 만들어 `아직 준비 중이에요`로 잘못 말하고, 그 줄은 눌리지도 않는다 |
| `app/student/result/[id].tsx:44` · `55-56` · `71-116` | 제목이 세 갈래(`결과를 불러오고 있어요` / `결과를 불러오지 못했어요` / `결과를 찾지 못했어요`), 실패에는 서버 문장 + `다시 불러오기` | 못 읽은 것과 없는 것은 다르다 — 없다고 하면 학생은 방금 푼 기록이 사라졌다고 믿는다 |

**모양은 새로 만들지 않았다.** 인라인 `danger` 캡션 + 다시 시도는 `DESIGN.md` §9이 정한 형태이고,
`app/academy/manage.tsx`의 `초대를 불러오지 못했어요`(읽기 실패를 빈 목록과 다르게 말하는 자리)와
같은 갈래다. `DESIGN.md` §9의 `이 게이트가 실패까지 덮지는 못한다(M-DB-16)` 줄을 실제 규칙으로 바꿨다.

**확정 정책이 고정한 5개 문장은 한 글자도 바꾸지 않았다**(`아직 시작한 학습이 없어요` ·
`문제 담으러 가기` · `아직 학원에서 받은 학습이 없어요.` · `오늘 할 일을 다 끝냈어요` ·
`학원에서 내준 과제가 있어요`). 히어로가 무엇을 고르는지(M9-03)와 `academyLinked` 분기(M-DB-8)도
그대로다.

### 검증

- `npm run typecheck` 통과. `npm run lint` **오류 0 · 경고 5**(기존과 같음: `.expo/types/router.d.ts` 1 ·
  `src/theme/fonts.web.ts` 4). `npm test` **187/187**.
- **브라우저로 실패 경로를 증명했다.** dev 서버 `http://localhost:8081`, 정예린 계정(테스트 계정
  패널), 390. `page.route`로 `content_sets`·`assignments`·`attempts`·`study_queue`·`wrong_notes`·
  `praises`·`week_summaries`·`retry_requests`를 500으로 막았다. **`answer_drafts`와 프로필 조회는
  막지 않았다** — 그것을 막으면 세션 스냅샷이 실패해 로그인 화면으로 튕긴다(M-DB-16의 메모).
  "고치기 전"은 두 provider의 `error`를 `null`로 되돌려(값 전달만 끊고) 같은 스크립트로 잼.

  | 화면 · 문장 | 고치기 전 | 고친 뒤 |
  |---|---|---|
  | 홈 `아직 시작한 학습이 없어요` | 1회 | **0회** |
  | 홈 `담아 둔 학습이 없어요.` | 1회 | **0회** |
  | 홈 실패 문장 · `다시 불러오기` | 0 · 0 | **1 · 1** |
  | 학습 탭 `아직 학원에서 받은 학습이 없어요.` | 1회 | **0회** |
  | 고르기 `아직 준비 중이에요` | 3회 | **0회** |
  | 결과 `결과를 찾지 못했어요` | 1회 | **0회**(제목이 `결과를 불러오지 못했어요`) |

  실패 문장 전문은 `학습을 불러오지 못했어요. boom`이었다(`boom`은 막은 응답의 메시지 —
  `errorMessage`가 RLS·네트워크 실패는 한국어로 바꾸고 그 밖은 서버 문장을 그대로 쓴다).
- **다시 시도가 실제로 복구한다.** 차단을 풀고 `다시 불러오기`를 누른 뒤: 학습 탭은 실패 문장
  0건 + `학습할 문제 담으러 가기` 복귀, 홈은 실패 문장 0건 + `today-primary` 히어로 1개 +
  `home-progress` 1개 + `아직 시작한 학습이 없어요` 0회. 고치기 전에는 두 화면 모두 다시 시도할
  버튼 자체가 없었다.
- **뷰포트**: 실패 상태를 820(태블릿)·1280(데스크톱)에서도 확인했다 — 홈·학습 탭 모두 거짓 빈
  문장 0회 · 실패 문장 1건 · 다시 시도 1개. 근거 이미지는 스크래치패드에 두고 레포에 남기지 않았다.
- **E2E 단정과 겹치지 않는지 grep으로 확인했다**: `학습을 불러오지 못했어요` · `다시 불러오기` ·
  `결과를 불러오지 못했어요`는 `e2e/`·`__tests__/`에 **0건**이다. 기존 단정
  (`student-flow:340`의 `아직 준비 중이에요`, `parent-flow:15`의 `기록을 불러오고 있어요`)은 실패가
  없는 정상 경로라 그대로다.
- **Playwright 전체 스위트와 `db:` 스크립트는 돌리지 않았다** — 공용 DB를 재시드한다.

### 남은 문제

- **세션 복구 실패는 여전히 다른 처리를 받는다.** `answer_drafts`나 프로필 조회를 막으면
  로그인 화면으로 튕긴다(`src/session/session.tsx:189`가 스냅샷 실패를 `console.warn`으로만 남긴다).
  이번 범위는 학생 화면의 **데이터 조회** 실패였다.
- **실패 창을 지키는 자동 테스트가 없다.** 근거는 손으로 돌린 브라우저 계측이다. E2E로 옮기려면
  `page.route`로 REST를 500으로 막고 `아직 시작한 학습이 없어요`가 `toHaveCount(0)`이면서 실패
  문장이 보이는지 단정하면 된다 — `e2e/_fixtures`의 `test`가 테스트마다 DB를 재시드하므로
  이번 범위에서 넣지 않았다(D-133이 같은 이유로 미룬 스펙과 한 벌로 넣는 것이 맞다).
- **`pick.tsx` 4단계는 아직 `contentLoading`을 보지 않는다.** 조회 중에도
  `이 유형은 아직 준비 중이에요.`가 스칠 수 있다(D-133이 1~3단계만 게이트했다). 이번 범위가
  실패 처리라 손대지 않았다 — 실패 게이트(`!loadError`)만 더했다.
- 학원·운영자·학부모 화면은 이번 범위가 아니다. 같은 계열의 자리가 남아 있다(예: 학부모 홈의
  `기록을 불러오고 있어요` 뒤 실패 경로).

## 2026-08-14 — seed의 초대 토큰 세 개를 모두 난수로 바꿨다 (A-103 · D-137)

`scripts/gen-seed.ts`는 선생님 토큰만 난수로 뽑고 학생·학부모는 `INV-STUDENT`·`INV-PARENT`
리터럴로 심었다. 남긴 이유는 `e2e/auth-flow.spec.ts`가 그 값을 6곳에서 직접 썼기 때문이다.
그래서 **레포를 읽을 수 있는 누구나 한빛학원 학생이 될 수 있었다** — 로그인만 하면
`rpc_accept_invite('INV-STUDENT')`가 통했다(학부모 계정 `minji`로 재현).

순서가 중요했다. E2E가 토큰을 서버 쪽에서 읽게 먼저 바꾸고, 그다음 seed를 난수로 바꿨다.

### 고친 것

| 자리 | 무엇을 | 왜 |
|---|---|---|
| `e2e/_seed.ts` | `inviteToken('student'\|'parent'\|'teacher')`를 더했다. `supabase/seed.sql`의 `insert into public.invites` 블록을 파싱해 역할별 첫 토큰을 준다(한 번 읽고 캐시) | `reseed()`가 넣는 것과 **같은 파일**이라 재시드 결과와 어긋날 수 없다. DB 왕복이 없어 모듈 최상단 상수로 쓸 수 있다 |
| `e2e/auth-flow.spec.ts:9-10` | `STUDENT_INVITE`·`PARENT_INVITE` 상수 | 6곳이 같은 값을 쓴다 |
| `e2e/auth-flow.spec.ts` 6곳 | `goto('/join?invite=INV-STUDENT')` 4곳 · `INV-PARENT` 1곳 → 템플릿 문자열. `toHaveURL(/\/join\?invite=INV-STUDENT/)` 1곳 → `new RegExp(...)` | **단정은 바꾸지 않았다.** 무엇을 확인하는지는 그대로고 토큰 값만 seed에서 온다 |
| `scripts/gen-seed.ts:506-519` | `teacherInviteToken` 상수를 `inviteTokenFor(prefix)`로 바꾸고 세 토큰을 `INV-S-`·`INV-P-`·`INV-T-`로 뽑는다. 주석도 함께 고쳤다 | 셋 다 74비트(`randomBytes(10)` → 대문자 hex 20자). 접두어를 나누는 것은 사람이 읽기 위한 것이고 엔트로피는 같다 |

`INV-T-` 접두어는 고정했다 — `e2e/academy-flow.spec.ts:271`이 원장이 만든 초대 링크가
`/join?invite=INV-T-`로 시작하는지 단정하고, 그 값은 서버의 `rpc_create_invite`(0031)가 만든다.

`grep -rn "INV-" e2e/ app/ src/` 전수: 남은 리터럴은 그 접두어 단정 하나와 `app/join.tsx:23`의
설명 주석뿐이다(`src/`에는 없다). 마이그레이션 0027~0031의 `INV-T-`는 서버 쪽 형식 설명이다.

### 재현 차단 실측 (2026-08-14)

`npm run db:seed` 뒤 학부모 `minji@scody.test`로 로그인해 `rpc_accept_invite`를 불렀다.

| 넣은 값 | 결과 |
|---|---|
| `INV-STUDENT` · `INV-PARENT` · `INV-TEACHER` | 전부 `초대를 찾을 수 없어요.` (data `null`) |
| `inv-student` · `inv-parent` · `INV-Student` | 전부 `초대를 찾을 수 없어요.` |
| 익명 `rpc_invite_info`로 같은 6종 | 전부 `null` (오류도 없다 — 있는지 없는지 구분되지 않는다) |

`minji`의 학원 소속은 그대로였다(변화 0). **실제 토큰은 정상 동작한다**: 익명
`rpc_invite_info`가 `INV-S-…`·`INV-P-…`·`INV-T-…` 셋에 `한빛학원` + 역할을 줬고,
`seojun`이 학생 토큰을 수락해 학원 uuid를 받았다. 그 수락은 `npm run db:seed`로 되돌렸다 —
`tg_invites_immutable`이 `accepted_at`을 지우지 못하게 막는다.

### 검증

| 명령 | 결과 |
|---|---|
| `npm run db:verify` | 84개 통과 · 0개 실패 |
| `npm run typecheck` | 통과 |
| `npm run lint` | 오류 0 (경고 5건은 기존 — `.expo/types` 1 · `src/theme/fonts.web.ts` 4) |
| `npm test` | 187/187 |
| `npx playwright test auth-flow academy-flow --project=desktop` | 47개 통과 |

전체 E2E 스위트는 돌리지 않았다 — 같은 시간에 다른 작업이 `app/`·`src/features/`를 고치고 있어
실패를 구분할 수 없다. 이번 변경이 닿는 두 파일만 돌렸다.

### 남은 문제

- **M-DB-7**(운영 프로젝트에 seed를 넣지 못하게 막기)은 그대로다. 토큰이 난수가 됐어도 seed 자체가
  운영 DB에 들어가면 테스트 계정 9종이 함께 들어간다.
- `e2e/_seed.ts`가 SQL을 정규식으로 파싱한다. 초대 insert의 열 순서가 바뀌면 조용히 못 찾는 대신
  `seed.sql에서 초대 목록을 찾지 못했어요`로 던진다 — 값이 틀리는 것보다 낫지만, `seed.sql` 형식에
  결합된 자리다. `gen-seed.ts`가 토큰을 별도 파일로 함께 내보내면 없앨 수 있다.

## 2026-08-14 — 학원 간 격리를 처음으로 실측했다 (M-DB-13 · D-138 · D-139)

`owner_academy_id`·`my_academy_id()`로 좁힌 RLS 정책은 처음부터 있었지만 **DB에 학원이 한빛학원
한 곳뿐이라 그 조건이 실제로 좁히는지 확인할 방법이 없었다.** 학원이 하나면 모든 조회가 "내 학원
것"이라 조건을 지워도 같은 결과가 나온다. 그래서 seed에 두 번째 학원을 넣고 네 방향으로 쟀다.

### seed에 더한 것 (`scripts/gen-seed.ts`)

| 무엇 | 값 |
|---|---|
| 학원 | `새길학원`(`ac_saegil`) · 계약 좌석 5 · 갱신일 `current_date + 200` · `active` |
| 원장 | `새길 원장` / `saegil.director` / 010-4000-0001 (로그인 가능) |
| 선생 | `새길 선생` / `saegil.teacher` / 010-4000-0002 (로그인 가능) |
| 반 | `새길 고1 국어`(`c_saegil_1`) · 담당 = 새길 선생 |
| 학생 | `강은우`·`문서아` — **로그인 없음**(반 친구와 같은 방식). 반과 학원 소속에 들어간다 |
| 콘텐츠 | `새길 전용 자료` 1세트 · 문법 3문항 · `publish_to_students = false` · `owner_academy_id = 새길` |
| 배정 | `맞춤법 첫 점검` 1건 (마감 `current_date + 7`) · 대상 2명 · **제출 없음** |
| 초대 | 학생 초대 1건(`INV-S-…`) · 초대자 = 새길 원장 |

`SeedAccount`에 `academyKey`를 더해 소속 학원을 고를 수 있게 했다(비우면 한빛학원). **한빛학원
데이터는 한 줄도 바꾸지 않았다** — 기존 84개 단정이 전부 같은 값으로 통과하는 것이 그 근거다
(`정예린 풀이 7건` · `최민지 자녀 10건` · `풀이 32건` · `오답노트 11건` · 한빛 로스터 15행).

`src/session/devAccounts.ts`의 `DEV_ACCOUNTS`(D-135의 `!DEV_LOGIN_ENABLED ? [] : [...]` 구조는
그대로 두고 두 줄만 더했다)와 `e2e/_auth.ts`의 `NAME_BY_ID`·`PHONE_BY_ID`에도 두 계정을 넣었다.

### 고친 등호 단정 (`scripts/verify-rls.ts`)

| 단정 | 이전 | 지금 |
|---|---|---|
| 계정 | 21개(로그인 9 + 반친구 12) | **25개**(로그인 11 + 반친구 12 + 새길 학생 2) |
| 콘텐츠 | 13세트 | **14세트** |
| 문항 | 189개 | **192개** |
| 배정 | 4건 | **5건** |
| 반 | 2개 | **3개** |
| 풀이 | 32건 | 32건(그대로 — 새길 배정에 제출이 없다) |
| 오답노트 | 11건 | 11건(그대로) |
| 학원 | (없었다) | **2곳** — 새로 더했다 |
| 초대 | (없었다) | **4건**(한빛 3 + 새길 1) — 새로 더했다 |

**`>=`로 약화하지 않았다.** 이 단정의 목적은 "seed가 정확히 무엇을 넣는지"를 고정하는 것이다.

`e2e/admin-flow.spec.ts:64`의 `content-pager` `1 / 2`는 **고치지 않았다** — 페이지 크기 10에
콘텐츠가 13→14세트라 여전히 2페이지다(20을 넘을 때 깨지는 조건에 아직 닿지 않았다).

### 격리 실측 결과 (2026-08-14, clean seed)

네 역할이 각각 상대 학원의 행을 몇 개 보는지. **전부 0행이다.**

| 보는 사람 | content_sets | classes | class_students | v_class_roster | assignments | v_assignment_submissions | invites | profiles | v_academy_visible_notes |
|---|---|---|---|---|---|---|---|---|---|
| 한빛 원장 | 0 / 13행 | 0 / 2행 | 0 / 15행 | 0 / 15행 | 0 / 4행 | 0 / 27행 | 0 / 3행 | 0 / 17행 | 0 / 5행 |
| 한빛 선생 | 0 / 13행 | 0 / 2행 | 0 / 15행 | 0 / 15행 | 0 / 1행 | 0 / 9행 | 0 / 3행 | 0 / 17행 | 0 / 2행 |
| 새길 원장 | 0 / 13행 | 0 / 1행 | 0 / 2행 | 0 / 2행 | 0 / 1행 | 0 / 2행 | 0 / 1행 | 0 / 4행 | 0 / 0행 |
| 새길 선생 | 0 / 13행 | 0 / 1행 | 0 / 2행 | 0 / 2행 | 0 / 1행 | 0 / 2행 | 0 / 1행 | 0 / 4행 | 0 / 0행 |

`유출 / 본 행 수`다. **비어서 통과한 것이 아니라는 근거를 함께 단정한다**: 네 역할 모두 자기 학원
콘텐츠 1세트 이상 · 자기 학원 반(한빛 2개 · 새길 1개) · 자기 반 로스터(한빛 15행 · 새길 2행)를 본다.

쓰기 쪽:

| 시도 | 결과 |
|---|---|
| 한빛 원장 → 새길 반에 `rpc_add_assignment` | 거부 `담당하는 반에만 배정할 수 있어요.` |
| 새길 원장 → 한빛 반에 `rpc_add_assignment` | 거부 (같은 문장) |
| 한빛 원장 → 자기 반에 **새길 콘텐츠** 배정 | 거부 `배정할 수 없는 문제예요.` |
| 새길 원장 → 자기 반에 **한빛 콘텐츠** 배정 | 거부 (같은 문장) |
| 한빛 원장 → 새길학원 `rpc_create_invite` | 거부 `이 학원의 초대를 만들 수 없어요.` |
| 새길 원장 → 한빛학원 `rpc_create_invite` | 거부 (같은 문장) |
| 한빛 원장 → 새길학원 `academy_members` insert | 거부(0행) |
| 새길 원장 → 한빛학원 `academy_members` insert | 거부(0행) |

**교차 실패는 하나도 없었다 — 격리가 깨진 곳을 찾지 못했다.**

### 검증하면서 알게 된 사실: seed에 한빛학원 소유 콘텐츠가 없다 (D-139)

첫 측정에서 `한빛 원장: 자기 학원 콘텐츠가 보인다 (0세트)`가 실패했다. 원인은 유출이 아니라
**seed의 사실**이었다: `src/data/content.ts`의 어느 세트에도 `ownerAcademyName`이 없어서 13세트가
전부 운영자 콘텐츠이고, `scripts/gen-seed.ts`의 `ownerAcademyName === ACADEMY_NAME` 분기는 지금
아무 세트에도 맞지 않는다.

그대로 두면 콘텐츠 격리가 한 방향만 시험된다. 그래서 검증이 한빛 원장으로 세트 하나를 등록해
대칭으로 재고, 정리 단계가 지운다. 실측: 그 세트가 한빛 원장·한빛 선생에게 **1행**, 새길
원장·새길 선생·개인 학생(김서준)에게 **0행**. 정리 뒤 `콘텐츠가 seed 상태(14세트)로 돌아왔다`.

### `boundary-flow:47`을 되살렸다

`다른 학원이 등록한 문제는 배정 목록에 보이지 않는다`는 가입 화면으로 새길 원장을 만들며 시작해서
첫 단계에서 실패했다(M-DB-2: 가입이 계정을 만들지 못한다). 그 앞부분을 **seed의 새길 원장
로그인**으로 바꿨다 — 자기 학원 콘텐츠가 자기에게 보이는 것을 먼저 확인하고(공허하지 않다는 근거),
로그아웃 뒤 한빛 원장으로 들어가 배정 검색에서 `새길 전용 자료`가 0건인지 본다. **단정은 바꾸지
않았다.** 콘텐츠를 화면에서 만들던 8줄이 없어졌고 대신 seed의 세트를 쓴다.

### 검증 (2026-08-14 실측)

| 검사 | 기준선 | 이 작업 뒤 |
|---|---|---|
| `npm run db:verify` | 84 통과 / 0 실패 | **160 통과 / 0 실패**(+76: 격리 76개) |
| `npx tsx scripts/verify-rls.ts` 연속 2회 | — | 160/0 · 160/0 — **두 출력의 `diff`가 0줄** |
| `npm run typecheck` | 통과 | 통과 |
| `npm run lint` | 0 오류 / 5 경고 | 0 오류 / 5 경고 |
| `npm test` | 187/187 | 187/187 |
| `playwright --project=desktop` | 156 통과 / 12 실패 | **157 통과 / 11 실패** |

더한 단정 76개의 구성: 기준선 2(학원 id가 다르다 · 반·학생 수) + 한빛 소유 콘텐츠 대칭 확인 6 +
격리 읽기 36(4역할 × 9표) + 공허하지 않음 12(4역할 × 3) + 교차 배정 5 + 교차 초대 2 + 교차 소속 2
+ 새 seed 총계 2(`학원 2곳`·`초대 4건`) + 정리 단정 9(교차 배정 4 · 교차 초대 2 · 교차 소속 2 ·
콘텐츠 1). 합 76.

E2E 차이는 정확히 한 건이다: `boundary-flow`의 `다른 학원이 등록한 문제는 배정 목록에 보이지
않는다`가 실패 → 통과로 넘어왔다(합계 168건은 그대로). 남은 11건은 기준선 12건에서 그 한 건을 뺀
집합이고, `boundary-flow`의 다른 기준 실패(`학원 연결을 끊으면 …`, M-DB-8)는 그대로 남아 있다.
**기준선 12건을 이 세션에서 다시 재지는 않았다** — 합계와 실패 집합이 어긋나지 않는 것으로 갈랐다.

### 남은 문제

- **`v_academy_visible_notes`의 격리는 한 방향만 실측됐다.** 새길학원에는 제출도 오답 메모도 없어서
  "한빛이 새길 메모를 못 본다"는 볼 대상이 없다. 확인된 것은 그 반대(새길 교직원에게 한빛 학생의
  메모 5행이 0행으로 보이는 것)다. 새길 쪽에 풀이 1건과 오답 1건을 넣으면 대칭이 되지만 그것은
  `풀이 32건`·`오답노트 11건` 단정을 움직이는 seed 모양 변경이라 이 작업 범위 밖에 뒀다.
- **`scripts/gen-seed.ts`의 `ownerAcademyName` 분기는 죽은 코드다**(D-139). 학원이 등록한 콘텐츠를
  seed에 두려면 그 값을 픽스처에 넣거나 새길학원처럼 생성기 안에서 적어야 한다.
- **학원이 둘이 되어 운영자 지표의 값이 움직였다**(학원 1곳 → 2곳 · 좌석·매출 추정의 분모). 그 화면의
  단정은 단가·문구 기준이라 깨지지 않았지만, 개요 숫자를 사람이 볼 때는 새길학원이 함께 세어진다.
- **M-DB-7**(운영 프로젝트에 seed를 넣지 못하게 막기)은 그대로다. 이제 seed가 테스트 계정 11종과
  학원 2곳을 넣는다.

## 2026-08-14 — 학생 홈이 시키지 않은 일을 오늘의 학습으로 올리지 않는다 (M9-03 · M9-04 · A-027 → D-140 · D-141 · D-142)

결정 대기 세 항목을 권고안대로 확정하고 구현했다. 셋은 한 갈래다 — **화면이 사실만 말한다.**

### 결정 1 — 히어로 후보를 좁혔다 (M9-03 → D-140)

`app/student/index.tsx`의 `next`가 `queued.items[0] ?? todo[0]`이었고 `todo`는 `all`(학원 배정 +
**공개 개인 학습 전부**)에서 왔다. 그래서 담아 둔 것도 배정도 없는 학생에게 카탈로그의 첫 세트가
`오늘의 학습`으로 올라왔다. 같은 화면의 진행 상황은 `academy.length + queued.items.length`를
세므로(D-034) 그 상태에서 **히어로는 `시작하기`, 바로 아래는 `남은 학습이 없어요`**였다.

지금은 `queued.items[0] ?? academyTodo[0]`이다 — 진행 상황의 분모와 같은 집합이다. 순서(담아 둔
학습 먼저)는 D-032·`DESIGN.md` §14.5 그대로다.

### 결정 2 — 할 수 없는 일에는 버튼을 두지 않는다 (M9-04 → D-141)

개인 이용권이 없는 학생(박도윤)에게 이 화면은 세 자리에서 사실이 아닌 말을 했다.

| 자리 | 예전 | 지금 |
|---|---|---|
| `academy-cleared` 면 | `개인 학습을 해볼까요?` + `개인 학습 고르기`(누를 것이 0개인 목적지) | 이용권이 있을 때만 둔다. 없으면 `학원에서 내준 과제물을 모두 마쳤어요.` 한 줄 |
| `오늘 할 일을 다 끝냈어요` 캡션 | `학습 탭에서 오답을 다시 풀거나 새 학습을 골라볼 수 있어요.`(고정) | 열린 길만 가리킨다 — 오답노트가 있을 때만 오답, 이용권이 있을 때만 고르기, 둘 다 없으면 이유 |
| `아직 시작한 학습이 없어요` 면 | `문제 담으러 가기`(A-096의 끊긴 자리) | 이용권이 있을 때만 둔다. 없으면 `개인 학습 이용권이 없어서 아직 고를 수 있는 학습이 없어요.` |

**결제 진입점은 만들지 않았다**(A-096은 P1 → P2로 내리고 열어 뒀다 — 화면이 거짓말하는 부분만
닫혔고, 이 계정이 할 수 있는 일은 여전히 0개다).

### 결정 3 — 목록 행도 오늘 기준으로 말한다 (A-027 → D-142)

`src/components/LearningRow.tsx`가 `formatDate` 대신 `dueLabel`을 쓴다(홈 히어로·학부모 리포트·
학원 성과 분석과 같은 문장). 글자가 먼저 바뀌고 색은 그다음이다. `app/student/[id].tsx`의 `마감`
줄이 내보내던 ISO 원문(`2026-08-20까지`)도 `formatDate`로 바꿨다.

**캡처를 보고 한 가지를 더 정했다**: 첫 판에서는 정예린의 학습 탭에서 **제출을 마친 네 줄이 모두
빨간 `마감이 지났어요`**가 되어 할 일이 남은 것처럼 보였다. 낸 과제에게 마감일은 지난 일이고
(`LearningRow`는 제출일과 마감일을 비교하지 않으므로 "늦게 냈다"는 뜻도 아니다) 그 줄이 알릴 것은
정답률이다. 그래서 오늘 기준 문장은 **아직 남은 학습에만** 쓰고, 낸 학습은 날짜와 정답률만 남긴다.

### E2E: 고친 단정과 이유

`홈 → 시작하기`로 개인 학습을 열던 21곳이 그 길을 잃었다(그 계정의 홈에는 히어로가 없다).
`e2e/_solve.ts`에 `openFirstPersonal`(학습 탭 → 고르기 → `정보의 홍수와 비판적 읽기`)을 두고
그 자리를 대신했다 — **단정은 그대로다.** 여는 세트가 이름으로 고정된 것이 부수 효과의 이득이다
(예전 히어로는 "카탈로그의 첫 세트"라 콘텐츠가 늘면 다른 학습이 열렸다).

| 파일·테스트 | 바꾼 것 | 왜 |
|---|---|---|
| `student-flow` 15곳 · `parent-flow` 4곳 · `a11y` 1곳 · `queue-flow` 1곳 · `recommend-flow`·`session-boundary` 헬퍼 | `시작하기` → `openFirstPersonal(page)` | 히어로 후보가 좁혀져 그 계정 홈에 `시작하기`가 없다(D-140) |
| `student-flow` `학원 과제가 남았으면 알려주고, 다 끝내면 …` | `개인 학습을 해볼까요?` 단정을 **없음**으로 뒤집고 `home-go-learn` 없음 + 실제 캡션을 더했다 | 박도윤에게 그 두 줄은 이제 없는 것이 맞다(D-141). 제목도 `… 할 수 있는 일만 말한다`로 |
| `student-flow` `학습이 하나도 없는 계정에는 …` | `home-empty-start` 클릭 → **없음 + 이유 문장** | 이용권이 없으면 그 버튼을 두지 않는다(D-141). 이 테스트는 가입이 막혀 여전히 기준 실패다(M-DB-2) |
| `student-flow` `학습 탭 학원 목록은 마감이 이른 것부터 …` | `7월 20일 마감` 날짜 문구 → **제목**으로 순서를 세우고, 낸 과제에 `마감이 지났어요`가 없음을 더했다 | seed가 상대 날짜로 바뀌어 이미 깨져 있었고(기준 실패), D-142로 네 줄의 마감 문구가 서로 같아진다 |
| `student-flow` `학원 과제는 마감이 이른 것부터 오고, 지난 마감을 …` | 계정을 정예린 → **박도윤**으로. 제목은 `남은 학원 과제가 히어로에 오고, …`. 학습 탭 행의 `마감이 지났어요`를 더했다 | seed가 정예린의 배정 4건을 모두 제출로 만들어 그 계정의 히어로에는 학원 과제가 올 수 없다(기준 실패) |
| `student-flow` `담아 둔 학습이 히어로를 차지하면 …` | 원장으로 반에 과제를 하나 배정하는 준비 단계를 앞에 넣었다(`assignLearning`) | 같은 이유 — 남은 과제가 없으면 `과제 먼저 하기`가 존재할 수 없다(기준 실패) |
| `student-flow` `진행 상황은 학원 과제와 담아 둔 학습만 센다` | 히어로 없음 · `오늘 할 일을 다 끝냈어요` · 캡션 · 담은 뒤 히어로 단정을 **더했다** | D-140·D-141을 이 화면에서 고정하는 자리 |
| `parent-flow` `칭찬을 보내면 자녀 홈 맨 위에 …` | 기준을 `today-primary` → 보이는 문장 `오늘 할 일을 다 끝냈어요`로 | 정예린에게 히어로에 올릴 학습이 없어 그 `testID`가 그려지지 않는다. 확인할 것은 자리(칭찬이 히어로 위)라 그대로 남는다 |
| `academy-flow` `배정할 때 정한 마감일이 학생 화면까지 …` | 목록 행 단정 `N월 N일 마감` → `N월 N일까지` | D-142로 행이 `dueLabel` 문장을 쓴다 |

### 검증 (2026-08-14 실측)

| 검사 | 기준선 | 이 작업 뒤 |
|---|---|---|
| `npm run typecheck` | 통과 | 통과 |
| `npm run lint` | 0 오류 / 5 경고 | 0 오류 / 5 경고 |
| `npm test` | 187/187 | 187/187 |
| `npx playwright test --project=desktop` | **157 통과 / 11 실패**(직접 측정) | **160 통과 / 8 실패** |

기준선은 이 작업 전에 직접 돌려 실패 11건의 목록을 떠 놓고 시작했다(마스터 플랜에 적혀 있던
`156 / 12`는 D-138 작업 뒤 `157 / 11`로 이미 옮겨 간 값이다). **새로 깨진 것은 0건**이고, 남은 8건은
기준선 11건에서 세 건(`student-flow:270`·`:507`·`:517`)이 빠진 집합이다.

남은 8건의 원인(고치지 않았다 — 이 결정 셋과 다른 갈래다):

- `boundary-flow:86` — 학원 연결 끊기(M-DB-8). 기존 항목.
- `parent-flow:294` · `queue-flow:224` — `현대소설 점검` 상세에서 `detail-start`를 기다린다. **정예린은
  그 과제를 이미 냈으므로** 그 화면의 행동은 `다시 풀기`(`detail-retry`)다. seed가 정예린의 배정 4건을
  모두 제출로 만든 것과 같은 뿌리다(위 두 테스트를 고친 이유와 같다).
- `student-flow:175` · `:195` — 제출 직후 `page.goBack()`을 **결과 URL을 기다리지 않고** 부른다
  (같은 흐름의 `제출 후 상세로 돌아오면 …`은 그 대기가 있어 통과한다). 테스트 쪽 경합으로 보이고
  한 줄로 고칠 수 있지만 이번 범위 밖이라 진단만 남긴다.
- `student-flow:622` — 가입이 계정을 만들지 못한다(M-DB-2). 단정은 새 사실로 고쳐 뒀다.
- `student-flow:741` — 오답노트 지문 펼치기. 기존 실패.
- `parent-flow:541` — AI 정리 토스트(A-088 계열).

### 화면 확인 (1280 · 390)

| 캡처 | 무엇을 보여 주는가 |
|---|---|
| `home-hero-nothing-promised-{1280,390}.png` | 김서준(개인 이용권, 담은 것 없음): 히어로가 카탈로그 세트를 올리지 않고 `오늘 할 일을 다 끝냈어요` + `학습 탭에서 새 학습을 골라볼 수 있어요.`(오답 복습은 말하지 않는다 — 담아 둔 오답이 0건) |
| `learn-personal-only-{1280,390}.png` | 같은 계정의 학습 탭 — 새로 고르는 길이 여기 있다 |
| `home-overdue-hero-no-entitlement-{1280,390}.png` | 박도윤: 마감 지난 학원 과제가 히어로에 오고 지난 마감이 한 줄로 분리된다 |
| `learn-due-overdue-{1280,390}.png` | 같은 계정의 학습 탭 행 — `10문항 · 마감이 지났어요`(D-142) |
| `learn-due-done-{1280,390}.png` | 정예린의 낸 과제 네 줄 — `10문항 · 8월 6일 마감 · 정답률 60%`(빨간 경고 없음) |
| `home-cleared-no-entitlement-{1280,390}.png` | 박도윤이 과제를 다 낸 뒤 — `학원에서 내준 과제물을 모두 마쳤어요.` 한 줄, 죽은 버튼 없음, 히어로 캡션은 `학원에서 과제를 내주면 여기에서 알려 줘요.` |

### 이어서 — `다 끝냈어요`의 기준도 같은 집합으로 옮겼다 (A-104 → D-143)

위에서 **A-104로 새로 적어 둔 것을 같은 자리에서 닫았다.** 히어로의 완료 판정이
`all.length === 0`이었는데 `all`에는 공개 카탈로그가 들어 있다. 그래서 **개인 이용권이 있으면
아무것도 안 해도** 그 값이 거짓이 되고, 끝낸 것이 하나도 없는 학생에게 히어로가
`오늘 할 일을 다 끝냈어요`라고 말했다(김서준).

D-140이 후보를 약속한 일로 좁혔으니 완료 판정도 같은 집합을 봐야 한다. 기준을 `goalTotal === 0`
(= 학원 과제 + 담아 둔 학습)으로 바꿨다 — 약속된 일이 애초에 없으면 `끝냈다`가 성립하지 않는다.

**실측**(390, 테스트 계정 3종):

| 계정 | 상태 | 히어로 |
|---|---|---|
| 김서준 | 개인 이용권만 · 약속된 일 없음 | `다 끝냈어요` false → `아직 시작한 학습이 없어요` |
| 박도윤 | 미제출 학원 과제 있음 | 실제 과제를 히어로에 올린다 |
| 정예린 | 학원 배정 4건 전부 제출 | `다 끝냈어요` true |

부수로 **`home-empty-start` 분기가 다시 도달 가능해졌다**(김서준 — 개인 이용권이 있으니 그 자리에
`문제 담으러 가기`가 남는다, D-141). 바로 위 항목에서 "지나갈 수 있는 경로가 없다"고 적었던 것이
이 결정으로 풀렸다.

### 남은 문제

- **A-024는 그대로다.** 추천 후보 없음은 결과 화면·오답노트의 자리이고 이번 변경은 홈만 손댔다.
  적용할 규칙은 이제 D-141이다.

---

## 2026-08-14 — 결과 화면의 문항 리뷰도 다섯 개까지다 (M9-11 → D-144)

결정 대기 M9-11을 **③(리뷰만 5줄로 접기)**으로 확정하고 구현했다. 두 목록을 합치는 ②는 고르지
않았다 — `QuestionReview`가 해설까지 든 큰 블록이라 그 안에 담기 토글을 넣으면 눈에 덜 띈다.

### 무엇을 고쳤나

`app/student/result/[id].tsx`의 `문항별로 확인해요`가 `listed`를 전부 그렸다. 다섯 개까지만
그리고 나머지는 **섹션 제목 옆 `N개 더 보기`**로 펼친다(R2 한 벌 — `secondary` + `tone="accent"`
+ `size="sm"` + `hug`, 학부모 리포트의 `report-more`와 같은 모양). 다시 누르면 `접기`다.

필터(`틀린 문항`/`전체`)를 바꿔도 펼친 상태는 되감지 않는다. 학생이 펼친 선택을 화면이 취소하지
않는다.

**담기 목록에는 상한을 두지 않았다.** 그 목록이 그 섹션의 목적이고, `오답노트 하러 가기`보다
아래에 있어 주 행동을 밀어내지 않는다. 상한을 두면 여섯 번째 오답을 담으려면 먼저 펼쳐야 한다.

### 실측 (390, `오답노트 하러 가기`의 문서 좌표)

| 상태 | 이 변경 전 | 이 변경 뒤 |
|---|---|---|
| `전체 10문항` | 2456px (2.91화면) | **1613px (1.91화면)** |
| 기본(`틀린 문항 3`, 독서 세트) | 1249px (1.48화면) | 1249px (1.48화면) — 상한이 닿지 않는다 |
| 기본(`틀린 문항 2`, 문학 세트) | 1027px (1.22화면) | 1027px (1.22화면) — 같음 |

### 솔직하게 남길 것 — A-086은 절반만 닫혔다

**이 변경은 기본 화면을 한 픽셀도 움직이지 않는다.** 오답이 다섯 개 이하면 접을 것이 없기 때문이다.
A-086이 인용한 자리(문학 세트·오답 2개)는 지금 **1027px(1.22화면)**이고, 거기 적혀 있던 1534px보다
이미 낮다 — `오답노트 하러 가기`가 화면 맨 아래에서 섹션 제목 옆으로 올라온 몫이고 이 작업의
몫이 아니다. 숫자를 새로 재서 고쳐 두었다.

그래서 A-086은 **P2 → P3으로 내리고 열어 뒀다.** 남은 것은 같은 오답을 리뷰와 담기 목록에 두 번
나열하는 것이고, 합치는 일이 M9-11 ②라 다시 사람 결정이 필요하다. 합치지 않기로 하면 닫는다.

`§8`이 말하는 `5줄`은 목록 행(약 60px)을 전제한 값인데 `QuestionReview`는 그보다 훨씬 높은
덩어리다(다섯 개만으로 1.91화면). 상한 숫자를 리뷰에 맞게 따로 정하는 것도 방법이지만, 그것은
§8을 손대는 일이라 이번 결정 범위 밖으로 두었다.

또 하나: **지금 픽스처로는 오답 6개 이상이 나오지 않는다.** 모든 세트가 `보기 1`로 풀면 오답
1~3개다(`문법 종합 24문항`도 3개). 그래서 `틀린 문항` 필터에서 상한이 걸리는 상태는 실제 학생만
만든다 — E2E는 `전체 10`으로 고정했다.

### 검증 (2026-08-14 실측)

| 검사 | 기준선 | 이 작업 뒤 |
|---|---|---|
| `npm run typecheck` | 통과 | 통과 |
| `npm run lint` | 0 오류 / 5 경고 | 0 오류 / 5 경고 |
| `npm test` | 187/187 | 187/187 |
| `npx playwright test --project=desktop` | 160 통과 / 8 실패 | **161 통과 / 8 실패** |

실패 8건은 기준선과 **같은 집합**이다(줄 번호만 새 테스트 30줄만큼 밀렸다):
`boundary-flow:86` · `parent-flow:294`·`:541` · `queue-flow:224` ·
`student-flow:205`(= 예전 175) · `:225`(= 195) · `:659`(= 629) · `:778`(= 748). **새로 깨진 것은 0건.**

새 E2E `결과의 문항 리뷰는 다섯 개까지 보여주고 나머지는 펼쳐서 본다`는 **3뷰포트 전부 통과**
(desktop · tablet · mobile).

### 화면 확인 (1280 · 390)

| 캡처 | 무엇을 보여 주는가 |
|---|---|
| `result-review-capped-{1280,390}.png` | `전체 10`에서 다섯 개만 그리고 제목 옆에 `5개 더 보기` |
| `result-review-open-{1280,390}.png` | 펼친 상태 — 같은 자리가 `접기`로 바뀐다 |

---

## 2026-08-14 — 결정 대기를 비웠다 (M9-01·02·07·08·09·10·12·13·14 → D-145~D-152)

남아 있던 결정 대기 9건을 전부 권고안대로 확정했다. 셋은 **코드가 이미 문서를 앞서 있었고**,
넷은 구현이 필요했고, 둘은 "하지 않는다"가 결정이었다.

### 문서만 뒤처져 있던 셋 — 실측으로 확인하고 닫았다

| 항목 | 무엇이 사실이었나 | 실측 |
|---|---|---|
| M9-01 백엔드 | 이미 Supabase 위에 서 있다(D-151) | 마이그레이션 34개 · `db:verify` 166개 검사 |
| M9-02 AI 경로 | 이미 서버 프록시다(M-DB-4) | `expo export` 산출물에 `openrouter.ai` 0회 · `sk-or-` 0회 · 키 실제 값 0회 · 호출은 `functions/v1/ai-proxy` |
| M9-14 개발 로그인 | D-135가 ②를 이미 했지만 **문자열 하나가 남아 있었다** | 아래 |

**M9-14는 닫으려다 결함을 하나 더 찾았다.** `EXPO_PUBLIC_ENABLE_DEV_LOGIN=0`으로 export 해서
grep하니 `test1234`는 0회인데 `@scody.test`가 **1회** 남았다 — 로그인 이메일을
`session.tsx`에서 템플릿 리터럴로 만들고 있었고, Metro에는 tree shaking이 없어 스위치를 꺼도 그
문자열이 남는다. `devAccounts.ts`의 `devLoginEmail`로 옮겨(같은 파일의 `DEV_ACCOUNTS`가 이미 쓰는
방법이다) 상수로 접히게 했다. 다시 export: **`@scody.test` 0회**(D-145).

함수 이름 `signInWithTestAccount`는 3회 남는다. 이름만으로는 들어갈 수 없어 그대로 뒀다.
경로 자체를 지우는 ①은 카카오·SMS 계약이 선행이라 M-DB-2에 남는다.

### 하지 않기로 한 둘

- **M9-07(고르기 뒤로가기 라벨)**: 현행 유지(D-152). D-039가 없앤 3버튼의 부분 복원이고
  `screen-back`을 이름으로 누르는 E2E가 6개다. 지금 어느 단계인지는 화면 첫 줄 경로가 말한다.
- **M9-13 ②(학원별 계약 단가 컬럼)**: 고르지 않았다. 확정 정책 2절의 결제 주체·요금제 구조를
  함께 손대는 일이다. ①(뷰)로 갔다.

### 구현한 넷

#### M9-12 ② — 패널 안 버튼은 오른쪽 끝이다 (D-146)

규칙과 상수는 이미 있었는데(`src/theme/styles.ts`의 `endRow.action`) 호출부가 따라오지 않아
**같은 일을 하는 버튼이 화면마다 다른 쪽에 있었다.** 성과 분석의 `reassign-open-*`은
`inset.action`으로 오른쪽인데 바로 아래 `student-reassign-open-*`은 왼쪽이었다.

버튼 5개(호출부 6곳)를 감쌌다: `analytics.tsx` 2 · `classes/[id].tsx` 2 · `classes/student/[id].tsx` 1.
`analytics.tsx`와 `classes/student/[id].tsx`의 `reassignPanel`은 문장까지 같은 쌍둥이라 함께 고쳤다 —
한쪽만 고치면 같은 패널이 두 모양이 된다.

#### M9-09 ② — 팔레트에 `notice`를 더했다 (D-147)

대리 배너 면이 본문과 라이트 1.09:1 · 다크 1.21:1이라 **면으로는 구분이 사실상 없었고** 1px
테두리가 구분을 혼자 지고 있었다(A-080). `danger`는 쓸 수 없다(오답의 색, D-071).

호박(ochre) 한 칸을 더했다. 계산값:

| | 값 | 면 vs 본문 | `ink` | `inkSecondary` |
|---|---|---|---|---|
| 라이트 | `#e6c87a` | **1.48:1** (전 1.09) | 11.26:1 | 4.59:1 |
| 다크 | `#4a3c18` | **1.70:1** (전 1.21) | 9.51:1 | 5.01:1 |

`inkSecondary`가 AA를 넘는 값에서 멈췄다 — 더 진하게(`#e3c46f`, 1.54:1) 가면 4.41:1로 떨어진다.
면을 진하게 만드는 것보다 그 위 글자가 읽히는 것이 먼저다. 테두리·아이콘은 그대로 둬서 면·선·
아이콘 셋이 함께 말한다.

#### M9-13 ① — 학원용 좌석 단가 뷰 (D-148)

`v_academy_seat_pricing`(0034)이 원장에게 좌석 세 값만 준다. 개인 요금·연 결제 비율·`updated_by`는
주지 않는다. 뷰가 직접 `is_director()`로 좁힌다 — 밑 표 정책이 운영자만 허용하므로
`security_invoker`로는 원장에게 0행이 나간다(0012의 두 번째 종류).

**검증 둘.** ①`npm run db:verify`에 6개 검사를 더했다: 원장 1행 · 선생님·학생·학부모·익명 0행 ·
뷰에 개인 요금·연 결제 컬럼 없음 → **166개 통과 / 0개 실패.** ②새 E2E: 운영자가 좌석 단가를
₩12,000 → ₩12,500으로 올리고 로그아웃 → 원장으로 로그인 → 학원 관리 화면이 ₩12,500을 말한다.

**이 테스트에 이가 있는지 확인했다**: provider의 조회를 `false ?`로 막아 되돌리면 같은 테스트가
실패한다(₩12,500 안 보임). 고친 뒤 통과. seed 좌석 단가가 `DEFAULT_PRICING`과 같은 값이라
**단가를 올리는 단계 없이는 이 결함을 잡을 수 없다** — 두 값이 같으면 화면이 상수를 말해도 맞아 보인다.

#### M9-08 ③ — 대리 보기의 열람 범위 (D-149)

D-071·D-073은 `문제가 있는 계정`만 말하고 역할을 가르지 않았다. 그런데 여는 양이 다르다 —
학부모를 열면 자녀 기록 전부(오답노트 메모 본문·별표 포함), 원장을 열면 그 학원 학생 전체의
제출과 배정 학습 메모(D-054)다. 화면은 그 사실을 한 줄도 말하지 않았다(A-079).

셋을 뒀다.

1. **`지금 열리는 범위`** — 대상 역할에서 계산해 시작 전에 문장으로 보여 준다.
   역할이 여럿이면 줄도 여럿이다(선생님 겸 학부모 계정은 두 줄).
2. **역할별 사유 유형** — 남의 기록이 함께 열리는 대상에서는 `데이터 점검`을 빼고
   **문의 번호를 필수로** 받는다. 특정 문의나 오류 없이 자녀·학원 기록까지 넓히지 않는다.
3. **감사 로그의 `열람 범위:`** — 화면이 말한 것과 **같은 문장**이다.
   판단을 `src/features/impersonation.ts` 한곳에 둔 이유가 이것이다.

대상을 학생으로 제한하는 ②는 고르지 않았다 — `학부모가 자녀 리포트를 못 본다`는 문의를 재현할
수 없게 된다. **서버가 대상 권한으로 판단하게 하는 일은 그대로 남는다**(A-048) — 지금도
`auth.uid()`는 운영자다.

E2E는 학부모 대상으로 넷을 확인한다: 범위 문장 · `데이터 점검` 없음 · 문의 번호 없으면 시작
버튼이 렌더되지 않음 · 운영 기록에 열람 범위와 문의 번호. 공용 헬퍼 `impersonate()`는 문의 번호를
늘 채우게 했다(학생 대상에서는 선택이라 흐름이 같다).

#### M9-10 — 이름을 둘로 고정했다 (D-150)

| 무엇 | 예전 | 지금 |
|---|---|---|
| 다시 푸는 화면 | `오답노트 복습` · `별표 집중 복습` · `{영역} 복습` | `카드 복습` · `별표 카드 복습` · `{영역} 카드 복습` |
| 오답노트로 가는 버튼 | `오답노트 하러 가기`(결과) · `질문하고 메모하기`(학습 탭) | `질문하고 메모하기` 하나 |
| 카드 복습의 AI 섹션 | `더 파고들기` | `질문하고 메모하기` |
| 메모 | `내 오답노트 메모` | 그대로(두 화면이 이미 같았다) |

**마스터 플랜 4절이 쓰는 `카드 복습`이 화면 어디에도 없었다.** 이제 화면에 있고 4절에도
두 이름이 적혀 있다. 덱을 고르는 줄 이름은 D-130 그대로 뒀다 — 그것은 화면 이름이 아니라 행동이다.

`DESIGN.md`에서 하나 더 찾았다: §8의 화살표 예시가 `오답노트 하러 가기` →인데 **그 버튼에는
화살표가 없다**(코드 주석이 왜 없는지까지 적어 두고 있었다). 예시를 실제 화살표 버튼으로 바꿨다.

### 검증 (2026-08-14 실측)

| 검사 | 기준선 | 이 작업 뒤 |
|---|---|---|
| `npm run typecheck` | 통과 | 통과 |
| `npm run lint` | 0 오류 / 5 경고 | 0 오류 / 5 경고 |
| `npm test` | 187/187 | 187/187 |
| `npm run db:verify` | 160개 통과 / 0 실패 | **166개 통과 / 0개 실패**(좌석 뷰 6개 추가) |
| `expo export` 문자열 | `@scody.test` 1회 | **0회** |
| `npx playwright test --project=desktop` | 161 통과 / 8 실패 (169건) | **161 통과 / 10 실패 (171건)** |

새 테스트 2건(A-098 · A-079)은 통과한다. **늘어난 실패 2건은 회귀가 아니다**:

- `parent-flow:345`(이번 주 요약) · `student-flow:827`(추가 대화까지 다시 정리하기) — **둘 다 단독
  실행에서 통과한다**(16.1s · 8.4s). 실제 OpenRouter 호출에 매달린 테스트이고, 전체 실행에서
  `ai-proxy`의 사용자별 분당 상한에 걸리는 것으로 보인다. 실패 스냅샷에도 정리 결과(`모두
  정리했어요` · `노트에 정리됐어요`)는 화면에 있고 사라진 것은 토스트뿐이다.
- 이미 기준선에 있던 `parent-flow:541`(AI 정리 토스트)이 같은 갈래다. **AI에 매달린 3건을 흔들림으로
  따로 세면 실질은 `164 / 7`이다.**
- 이 작업은 AI 경로(`openrouter.ts` · `notebook.tsx` · `report.ts`)를 한 줄도 고치지 않았다.

기준선 8건은 그대로다(`boundary-flow:86` · `parent-flow:294`·`:541` · `queue-flow:224` ·
`student-flow:205`·`:225`·`:659`·`:778`).

### 화면 확인 (1280 · 390)

| 캡처 | 무엇을 보여 주는가 |
|---|---|
| `impersonation-notice-{1280,390}.png` | 대리 배너의 `notice` 면 — 본문과 면으로 갈린다(D-147) |
| `impersonate-scope-{1280,390}.png` | 학부모 대상의 `지금 열리는 범위`와 사유 유형 두 개(D-149) |
| `academy-seat-price-{1280,390}.png` | 원장이 보는 좌석 단가 — 서버 값이다(D-148) |
| `reassign-panel-right-{1280,390}.png` | 패널 안 `다시 배정하기`가 오른쪽 끝에 선다(D-146) |

---

## 2026-08-15 — Product Review: 학생 학습 루프 (D-153~D-156 · A-105~A-116)

범위: 오늘 고친 화면들 — 홈 → 학습 탭 → 결과 → 카드 복습. `product-manager`와 `ux-auditor`를
같은 범위로 동시에 돌리고, 코드로 확정할 수 없는 항목은 브라우저로 직접 실측했다.

### 두 검토가 독립적으로 같은 Critical을 찾았다

**카드 복습이 새로고침 뒤 영구 빈 상태가 된다.** 덱을 첫 렌더에 한 번 고정하는데(카드 어긋남을
막는 장치, D-113) 그 시점에 조회가 끝나지 않으면 `deck = []`이 되고, 노트가 도착해도 다시 세우는
곳이 `restart()`뿐이다.

**실측**: 정예린(오답 8개)으로 `/student/review` 진입 → `1 / 8 카드 복습` 정상 → 새로고침 →
**3초 뒤에도 `복습할 오답이 없어요.`** 화면을 떠나는 것이 유일한 탈출구였다.

고친 방법(D-153): 화면을 둘로 갈랐다. 겉(`Review`)이 `loading`·`error`를 보고 세 갈래를 정하고,
덱(`ReviewDeck`)은 **조회가 끝난 뒤에만 마운트**된다. effect에서 덱을 다시 세우는 첫 시도는
React Compiler 린트가 막았다(`Calling setState synchronously within an effect`) — 그 오류가
오히려 더 나은 구조를 가리켰다. 조회가 끝난 뒤 마운트하면 첫 렌더의 스냅샷이 처음부터 옳다.

### PM이 찾은 두 번째 Critical — 오늘 제가 만든 D-143의 부작용

**개인 학습만 하는 학생이 공부를 할수록 홈이 `아직 시작한 학습이 없어요`라고 말한다.**
`rpc_submit_attempt`(0013·0029)가 개인 학습을 제출하면 그 학습을 `study_queue`에서 지운다.
그래서 학원 소속이 없는 학생은 `goalTotal`이 0으로 돌아간다.

**실측**: 김서준으로 한 세트를 다 풀고 제출 → 홈 → 히어로가 `아직 시작한 학습이 없어요` +
진행 상황 블록도 없음. D-143이 없앤 거짓말의 정확한 반대쪽이었다.

고친 방법(D-154): `nothingYet = goalTotal === 0 && attempts가 하나도 없을 때`.
**실측(고친 뒤)**: `오늘 할 일을 다 끝냈어요` + `학습 탭에서 새 학습을 골라볼 수 있어요.`

진행 상황의 분자·분모를 고치는 일(낸 개인 학습을 완료로 세기)은 D-034·D-140을 다시 여는 것이라
하지 않았다.

### 고친 High 2건 (둘 다 카드 복습)

- **학원 오답 메모에 `선생님이 볼 수 있어요` 고지가 없었다**(D-155). 이 화면도 메모를 저장하는데
  (`saveMemo`) 고지가 없어서, 그 글을 쓰는 화면에서 공개 범위를 듣지 못했다. 오답노트·결과 화면과
  **한 글자도 같은 문장**을 정답 줄 아래에 뒀다. 실측으로 학원 카드에서 노출을 확인했다.
- **메모 덮어쓰기가 조용했다**(D-155). 카드 복습의 대화는 카드를 넘길 때마다 비는데 저장은 `dig`
  전체를 교체한다 — 오답노트에서 여러 번 물어 만든 긴 메모가 한 문답의 요약으로 바뀌고, 라벨
  (`메모 다시 정리하기`)은 무엇이 사라지는지 말하지 않았다. 기존 메모가 있을 때만 라벨을
  `지금 대화로 메모를 새로 쓰기`로 바꾸고 `ConfirmStep`을 뒀다. 없으면 예전처럼 바로 저장한다.

### 함께 고친 것

- **결과 화면의 로딩·실패·없음 면에 `backFallback`이 없었다**(D-156). 같은 URL이 상태에 따라
  뒤로가기를 보였다 감췄다 했다 — `CLAUDE.md` 내비게이션 규칙 위반. 실측: `/student/result/없는id`에
  뒤로 버튼 1개.
- **문서와 코드가 어긋난 곳 둘**: `DESIGN.md` §14.5·§8이 폐기된 이름 `학습 고르러 가기`를 예시로
  들고 있었고(코드에는 한 곳도 없다), §14-1이 `learn-pick`을 `유일한 primary`라고 부르는데 실제로는
  D-047로 `Row`가 됐다. 둘 다 문서를 실제 구현에 맞췄다.

### 고치지 않고 남긴 것 — A-105~A-116 (마스터 플랜 6절)

| ID | 등급 | 왜 남겼나 |
|---|---|---|
| A-111 | P2 | 학원 연결을 끊은 학생에게 홈이 기다리라고 한다. 문구가 M-DB-8(끊기의 서버 표현)에 매달려 있다 |
| A-105 | P3 | `문제 담으러 가기`가 담는 화면으로 안 간다 + 완료 학생 홈에 같은 목적지 셋. `DESIGN.md` §14의 4·5번을 함께 고쳐야 한다 |
| A-106 | P3 | 이용권 없는 학생에게 학습 탭·고르기가 행동을 약속한다(A-096 계열, E2E 단정이 걸려 있다) |
| A-107 | P3 | 오답노트 → 카드 복습 전환이 없고 빈 상태 목적지가 문구와 어긋난다 |
| A-108 | P3 | 결과 화면의 `전체 10`과 `5개 더 보기`가 서로 다른 것을 센다(D-144 부작용) |
| A-109 | P3 | 카드 복습의 `다음 문제`가 입력창 아래에 있다 |
| A-110 | P3 | 학습 탭 학원 목록이 낸 과제와 남은 과제를 섞는다 |
| A-112·A-113·A-114·A-115 | P3 | 히어로의 `이어서 하기` · 과제 하나를 세 번 말하기 · 카드 넘기기/진행 보존 · 대리 보기 메모 단정 |
| A-116 | P3 | 나머지 네 화면(`notebook`·`[id]`·`solve/[id]`·`records`)의 3갈래 부재. `solve/[id]`가 먼저다 |

여러 화면을 다시 설계해야 하거나(A-105·A-107), 정책·문서를 함께 손대야 하거나(A-106·A-110),
고치는 방법이 둘 이상인 것(A-112·A-114)은 스킬 규칙대로 사용자 판단으로 남겼다.

### 검증

| 검사 | 기준선 | 이 작업 뒤 |
|---|---|---|
| `npm run typecheck` | 통과 | 통과 |
| `npm run lint` | 0 오류 / 5 경고 | 0 오류 / 5 경고 |
| `npm test` | 187/187 | 187/187 |
| `npx playwright test --project=desktop` | 161 통과 / 8 실패 (171건) | **165 통과 / 8 실패 (173건)** |

실패 8건은 기준선과 **같은 집합**(줄 번호만 새 테스트 40줄만큼 이동). 새 회귀 테스트 2건
(`개인 학습을 제출하면 홈이 시작하지 않았다고 말하지 않는다` · `카드 복습을 새로고침해도 담아 둔
오답이 사라지지 않는다`) 통과. 지난 실행에서 흔들렸던 AI 테스트 2건은 이번에 통과했다.

**화면 확인**: 카드 복습 390·820·1280 × 라이트·다크. 고지 문장이 오답노트와 같은 자리(정답 줄
아래, 메모 위)에 들어가고, 다크에서 캡션 가독과 `내 답`(danger)·`정답`(success) 테두리 구분이
유지된다. 390에서 선지 줄바꿈도 정상.

---

## 2026-08-15 — 코드 리뷰: 공개된 사이트의 유효한 구멍 하나와 정확성 8건 (D-157~D-162)

`c5fce2f..HEAD`(커밋 6개, 59파일)를 두 관점으로 리뷰했다 — 정확성(`root-cause-analyst`)과
권한·비밀(`security-engineer`). `/code-review`는 모델이 자동 호출할 수 없는 스킬이라 같은 작업을
직접 구성했다.

### Critical — `test1234`로 누구나 운영자가 될 수 있었다

`DEV_LOGIN_ENABLED`(D-135)는 **화면의 버튼만** 없앤다. 계정은 서버에 그대로 있고, Supabase의
비밀번호 grant는 anon 키만으로 부를 수 있다. 그리고:

- `test1234`가 **공개 저장소**의 다섯 곳에 있었다 — `scripts/gen-seed.ts:47` ·
  `verify-rls.ts:46` · `verify-ai.ts:40` · `.env.example:30` · `src/data/fixtures.ts:11`
- seed는 로컬이 아니라 **원격 프로젝트**에 들어간다(`scripts/run-sql.ts`)
- 그 프로젝트 URL과 anon 키는 `scody.co.kr` 번들에 정상적으로 실려 있다

즉 **로그인 화면을 거치지 않고** `POST /auth/v1/token?grant_type=password`에
`admin@scody.test` / `test1234`를 보내면 `is_admin()`이 참인 JWT가 나왔다 — 전체 `profiles`
(이름·전화·학년·지원 코드) · `audit_logs` · `pricing_policies` 읽기, 대리 보기 시작까지.

고쳤다(D-157): 난수 32자로 교체하고 DB에 적용, 다섯 곳의 리터럴을 전부 환경변수 읽기로 바꿨다.
값이 없으면 seed를 만들지 않는다.

**실측**: 옛 값 → `Invalid login credentials` · 새 값 → 토큰 발급(E2E·검증이 계속 돈다).

이 일로 M-DB-7의 전제가 깨진 것을 확인해 **P3 → P1**로 올렸다 — 공개 사이트가 seed DB를
가리키므로 `db:seed`를 돌리면 그 사이트의 데이터가 지워진다.

### High — 별표 한 번의 실패가 복습 세션을 날렸다 (D-153의 부작용)

D-153이 `loading`으로 `ReviewDeck`의 마운트를 결정했는데, `loading`은 **다시 읽을 때마다** 참이
된다(`runRead`). 쓰기가 실패하면 `patchNote`가 `reload()`를 부르므로 — 5번째 카드에서 답을 고르고
대화를 두 번 만든 학생이 별표를 눌러 실패하면 **1/8 카드, 답 안 고른 상태, 대화 0개**로 돌아갔다.
`saveMemo` 실패 경로에서는 코드 주석의 약속(`대화는 남아 다시 정리할 수 있다`)이 거짓이 됐다.

고쳤다(D-160): 게이트에 `손에 있는 데이터가 없을 때`를 함께 본다. 콘텐츠 조회도 함께 본다 —
지문이 그쪽에서 오고, 실패하면 독서·문학 카드가 지문 없이 그려졌다.

### 대리 보기 문장이 두 방향으로 틀렸다 (D-159)

- **학부모**: `오답노트 메모 본문과 별표까지`라고 적었지만 `wrongNotesOf`가 대리 중 `dig`를 값째
  지운다. 같은 화면이 13줄 위에서 `메모는 보이지 않아요`라고 말하고 있었고, 그 과장이 감사 로그의
  `열람 범위:`로 들어갔다 — D-149의 목적("화면과 기록이 갈리지 않게")과 정면으로 어긋난다.
- **학원**: `academyNotesOf`만 마스크가 없었다. 지금은 서버가 막지만 A-048이 닫히는 날 학원 화면이
  학생 메모 본문을 운영자에게 그린다. 마스크를 더해 벽을 둘로 만들고 문장을 좁혔다.
- **소속이 끝난 학원 계정**을 `academyRole !== 'teacher'`라는 이유로 원장으로 표시했다.

### 그 밖에 고친 것

| 항목 | 무엇 |
|---|---|
| D-158 | 예시 문구의 실재 seed 식별자(`doyun`·`hanbit.teacher`·`010-1000-0003`·`KJN-6EF`)를 가상 값으로. **번들 검증은 `\uXXXX` 디코드 후에 해야 한다** |
| D-161 | 요금 조회 실패를 값으로 내보낸다. 원장 화면이 기준값을 서버 값처럼 말하던 것(A-098의 나머지 절반) |
| D-162 ① | `vercel.json`에 보안 헤더 넷(클릭재킹·referrer·MIME) |
| D-162 ② | 0035: 새 뷰에서 `anon` select 회수. Supabase 기본 권한 때문에 벽이 뷰 본문 하나뿐이었다 |
| D-162 ③ | `verify-rls`의 좌석 컬럼 검사가 **실패할 수 없는 형태**였다(자기가 나열한 키를 다시 셌다). `select('*')`로 바꿨고, 익명 검사는 `0행` → `권한 없음` |
| M1 | 카드 복습의 확인 단계가 카드를 넘겨도 남아, 다시 그 카드에 오면 묻지 않은 파괴적 확인이 떴다(`resetCard`가 비우지 않았다). 포커스가 그 버튼으로 옮겨간다 |
| L1 | `LearningRow`의 `aria-label`이 자손 텍스트를 덮어 새 마감 문구가 스크린리더에 닿지 않았다 — D-142가 색 대신 글자로 말하기로 한 것이 무의미해지는 자리 |
| L2 | 대리가 거부되는 대상(자기 계정·다른 운영자)에도 `지금 열리는 범위`를 말했다 |

### 리뷰가 정상으로 확인한 것

0034 뷰의 권한 설계(`security_invoker` 미지정이 맞다 · 컬럼 최소 · `is_director()`를 스스로 붙일
수 없다 — `invite_role` enum에 `director`가 없다) · `.vercelignore`의 문법과 범위 ·
개발 로그인이 꺼진 빌드에서 상수로 접히는 것(산출물 실측) · `result/[id].tsx`의 5개 상한 계산 ·
`pricing.tsx`의 스프레드 순서 · `reasonKindsFor`가 빈 배열을 낼 수 없는 것.

### 남긴 것

A-117(운영 빌드에 개발 로그인이 켜지는 것을 빌드가 막지 않는다) · A-118(wasm 출처가 전이 의존성) ·
A-119(뷰에 `security_barrier` 없음).
