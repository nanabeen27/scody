# Scody Design System

스코디의 **단일 디자인 기준**. 모든 페이지·컴포넌트는 이 문서를 따른다.
참고: VoltAgent/awesome-design-md 의 Notion·Linear·Mintlify 디자인. 복제가 아니라 아래처럼 재조합한다.

- **Notion** — 따뜻하고 차분한 중립 색, 높은 가독성, 부드러운 표면
- **Linear** — 정밀한 간격, 명확한 상태 표현, 절제된 인터페이스
- **Mintlify** — 명확한 정보 계층과 탐색 구조, 읽기 최적화
- **스코디** — 한국 고등학생 학습 서비스다운 친근함 + 상용 제품 수준의 일관성

> 대상 플랫폼: Expo + React Native Web(웹 우선). 색은 CSS 변수(`--sc-*`)로 라이트/다크 전환.

---

## 1. Product design principles

1. **정보 계층이 장식보다 우선.** 한 화면에는 하나의 주인공만.
2. **학습 흐름 우선.** 디자인은 "오늘 뭘 할지"를 3초 안에 답해야 한다.
3. **절제.** 색·그림자·라운드·아이콘은 기본을 낮추고 필요할 때만 쓴다.
4. **일관성.** 같은 의미는 항상 같은 토큰으로 표현한다.
5. **정직한 상태.** 로딩·빈·오류·성공을 숨기지 않고 조용히 보여준다.
6. **친근하지만 과하지 않게.** 사람이 쓴 짧은 한국어. 과장·전문용어 금지.

## 2. Visual direction

- 중립 쿨 그레이 배경 + 절제된 Toss 블루 단색 강조(주요 행동/선택에만).
- 텍스트 타이포그래피가 화면을 이끈다. 카드는 "구분이 필요한 곳"에만.
- 경계는 얇은 hairline, 표면 차이는 밝기로. 큰 그림자로 띄우지 않는다.
- 좌측 정렬 기본. 본문은 읽기 좋은 폭으로 제한.

## 3. Semantic color tokens

정의: `src/theme/palette.ts` (라이트/다크). 코드에서는 항상 `colors.<name>`(=`var(--sc-<name>)`)로 참조.

| 토큰 | 역할 | Light | Dark |
|---|---|---|---|
| `bg` | 페이지 배경 | `#ffffff` | `#0d1117` |
| `surface` | 카드/입력 표면 | `#ffffff` | `#0d1117` |
| `offset` | 은은한 면(지표/선택 배경) | `#f2f4f6` | `#161b22` |
| `hover` | hover/press 배경 | `#e9ecef` | `#21262d` |
| `border` | 기본 경계(hairline) | `#e5e8eb` | `#30363d` |
| `borderStrong` | 강한 경계/입력 테두리 | `#d1d6db` | `#444c56` |
| `ink` | 본문 텍스트 | `#191f28` | `#e6edf3` |
| `inkSecondary` | 보조 텍스트 | `#4e5968` | `#9198a1` |
| `inkTertiary` | 캡션·플레이스홀더 | `#8b95a1` | `#6e7681` |
| `accent` | 주요 버튼·선택·활성·링크(Toss 블루) | `#3182f6` | `#4d90fe` |
| `accentText` | accent 위 텍스트 | `#ffffff` | `#ffffff` |
| `accentSoft` | 선택 항목의 은은한 배경 | `#e8f1fe` | `#17233a` |
| `success` | 정답·완료 | `#1a7f37` | `#3fb950` |
| `danger` | 오답·오류·파괴적 행동 | `#cf222e` | `#f85149` |
| `personal` | 개인 학습 출처(점/라벨) | `#0e7490` | `#39a0a8` |
| `academy` | 학원 과제 출처(점/라벨) | `#92590b` | `#d9a441` |
| `kakao`/`kakaoText` | 카카오 버튼(브랜드 고정) | `#fee500`/`#191600` | 동일 |

규칙: **accent = Perplexity True Turquoise `#20808d`(다크 `#3aa7b1`) 단색.** 파랑/보라·그라데이션 금지. 배경은 Perplexity Paper(`#fbfaf4`)/Offblack(`#091717`), 텍스트 Offblack. 강조색은 주요 버튼·선택·활성 탭·링크에만. 출처색: 개인=Turquoise700 `#114f56`, 학원=Terra Cotta `#a84b2f`. **실제 값의 단일 소스는 `src/theme/palette.ts`** (위 표가 다르면 palette.ts가 우선).

## 4. Typography scale

- **폰트: 본문·제목 전부 Pretendard.** 무게 4종(Regular 400 · Medium 500 · SemiBold 600 · Bold 700). 정의는 `src/theme/tokens.ts`의 `typeface`, 로드는 `app/_layout.tsx`의 `useFonts`.
  - 파일은 레포에 번들한다: `assets/fonts/Pretendard-{Regular,Medium,SemiBold,Bold}.ttf` (SIL OFL 1.1, `assets/fonts/Pretendard-LICENSE.txt`). CDN·네트워크 의존 없음.
  - **Space Grotesk는 "Scody" 워드마크에만** 쓴다(`typeface.wordmark`, `src/components/Brand.tsx`). 본문·제목에 쓰지 않는다.
  - 라틴 전용 폰트를 본문에 쓰지 않는다. Inter를 쓰던 동안 한글만 시스템 폰트(맑은 고딕)로 떨어져 한 화면에 두 벌이 섞였다. Pretendard는 한글·라틴을 같은 골격으로 덮는다.
  - 폴백은 `"Apple SD Gothic Neo", "Malgun Gothic", sans-serif` — 로드 실패 시에만 보인다.
- 크기(px): `xs 12 · sm 13 · base 15 · md 16 · lg 18 · xl 22 · xxl 27 · display 34`.
- 변형(`AppText variant`): `display`(히어로 숫자/큰 제목, bold), `title`(xxl bold, 화면 제목), `heading`(xl semibold), `subheading`(md semibold, 섹션), `bodyLg`(md), `body`(base), `label`(base medium), `caption`(sm), `eyebrow`(xs semibold, 자간, 라벨 — 한글에는 쓰지 않는다).
- 제목 자간은 **-0.2 정도까지만**. 한글은 라틴보다 자간을 좁히면 금방 뭉친다.
- 한글 줄간격: 큰 제목 1.3~1.35 이상, 본문·지문 1.6~1.85. 32px 제목이면 44px, 46px 히어로면 62px.
- 한 화면에 title 1개. 아래로 subheading 섹션 구분. 캡션은 보조 정보에만.

## 5. Spacing and layout system

- 스페이싱(`spacing`): `xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 36 · xxxl 56 · huge 88`.
- 컨텐츠 폭: 본문 `contentMaxWidth 680`, 넓은 화면(학원) `wideMaxWidth 960`, 지문 읽기 `readingMaxWidth 620`.
- 좌측 정렬. 화면은 세로 스택(섹션 간 `xl`). 카드 내부 패딩 `lg~xl`.
- 데스크톱: 좌측 사이드바(`sidebarWidth 248`) + 본문. 모바일: 상단바 + 하단 탭.
- Linear식 정밀함: 같은 맥락의 간격은 항상 같은 토큰. 임의 픽셀 금지.

## 6. Border and radius rules

- radius: `sm 6 · md 8 · lg 12 · xl 18 · card 22 · pill 999`. 기본 요소는 여전히 moderate. **`xl`/`card`는 히어로 카드·플로팅 내비 등 "부드러운 표면" 전용**(실제 Toss 모바일 UI 참고). 일반 카드/버튼/입력에 16px+ 남발 금지 — 큰 라운드는 주인공 표면에만.
- 버튼·입력·작은 요소 `md(8)`, 목록 그룹 `xl(18)`, 히어로 카드 `card(22)`, 토글/점 `pill`.
- 경계는 1px `border`. 구분이 필요한 카드/입력에만. hairline은 리스트 내부 구분선.

## 7. Elevation and shadow rules

- **그림자 사용 안 함(기본).** 표면 구분은 `border` + `offset` 밝기 차이로만.
- 떠 있는 요소(드롭다운/모달, **모바일 플로팅 내비**)만 아주 옅은 그림자 1단계 허용. 그 외 금지.
- Glassmorphism·blur·발광 금지.

## 8. Buttons, inputs, cards, navigation patterns

- **Button** (`src/components/Button.tsx`): 높이 40, radius md. `primary`=accent(Toss 블루) 배경/`accentText`. `secondary`=surface+border. `ghost`=투명. `kakao`=카카오 브랜드. 라벨 medium. 한 화면의 주요 행동 1개만 primary.
- **입력**(`Field`): 라벨(캡션) 위, 높이 44~48, border `borderStrong`, focus 시 border=accent. placeholder=inkTertiary. 항상 `accessibilityLabel`.
- **카드/그룹**(`Group`+`Row`): 얇은 테두리 컨테이너에 행을 담고 행 사이 hairline. 카드를 장식으로 반복하지 않는다. 목록=Group, 지표=metric 타일.
- **네비게이션**(`RoleShell`): 데스크톱 좌측 사이드바(브랜드→메뉴→계정/테마/로그아웃), 모바일 상단바(브랜드)+**하단 플로팅 라운드 내비**(Toss식 pill: 화면 아래에서 살짝 떠 있고 콘텐츠가 그 아래로 스크롤). 선택 항목=accent 아이콘/텍스트 + `accentSoft` pill 하이라이트, 나머지=inkTertiary. 학생은 아이콘만, 학부모·학원은 아이콘+라벨.
- **행(Row)**: 최소 높이 48, 좌 타이틀/서브타이틀, 우 meta/chevron. 이동 가능한 행만 chevron.

## 9. Loading, empty, error, success states

- **로딩**: 초기 폰트/로드는 빈 게이트. 데이터 로딩은 텍스트 스켈레톤(회색 바), 스피너 남발 금지.
- **빈 상태**: Group 안 한 줄 안내 + 가능하면 다음 행동. 예: "아직 푼 학습이 없어요. 첫 학습을 시작해볼까요?"
- **오류**: 인라인 캡션 `danger` + 사람 문장. 예: "아이디 또는 비밀번호를 확인해 주세요." 파괴적 행동은 확인 단계.
- **성공/완료**: 조용한 확인. 정답=success 점+텍스트, 완료=진행률 반영. 폭죽·큰 배지 금지.

## 10. Responsive behavior

- 분기점: `mobile 0 · tablet 720 · desktop 1024`.
- 데스크톱: 사이드바 + 본문(폭 제한). 태블릿/모바일: 하단 탭 + 상단바, 본문 폭 100%.
- 터치 타깃 최소 44px. 표·긴 콘텐츠는 가로 스크롤 컨테이너.
- 3뷰포트(desktop/tablet/mobile) Playwright로 검증.

## 11. Accessibility rules

- 모든 입력에 `accessibilityLabel`. 버튼/링크/라디오/탭은 정확한 role과 이름.
- 색만으로 의미 전달 금지 — 정답/오답·출처는 항상 텍스트 병행.
- 본문 대비 충분히. 포커스 가시성 유지. 긴 글은 상대 단위·줄간격 확보.

## 12. Explicit do and don't

**Do**
- 정보 계층 먼저, 스타일 그다음.
- 강조색(Toss 블루 단색)은 링크/선택/주요 행동에만.
- 목록=Group+hairline, 지표=metric 타일, 글=기사처럼.
- 짧고 사람다운 한국어.

**Don't**
- 보라/파랑 AI 그라데이션.
- 의미 없이 반복되는 둥근 카드.
- 과도한 그림자·Glassmorphism.
- 모든 요소 중앙 정렬.
- "큰 문구 + 카드 3개"로 끝나는 SaaS 데모 구조.
- 장식용 아이콘 남발.
- 모든 버튼·카드가 같은 시각 무게.

## 13. AI-generated UI anti-patterns (피할 것)

- **좌측 컬러 보더 + 배경 틴트 callout 박스**(해설·노트·인용 등에서 왼쪽만 튀어나온 색 바 + 다른 배경). 대표적 AI 티 → 라벨 + 기사형 문단으로 대체.
- 카드마다 컬러 왼쪽 액센트 바.
- 채운 컬러 pill 배지(정답/오답).
- 거대한 컬러 숫자(정답률 44px 등).
- 파랑·보라 강조 남발.
- 히어로 큰 문구 + 동일 무게 카드 3개.
- 과한 라운드(16px+) + 큰 그림자 조합.
- 중앙 정렬된 텅 빈 화면.

## 14. Student home-specific hierarchy

로그인 후 **3초 안에** 다음이 보여야 한다. 시선 순서:

1. **오늘의 학습(주인공)** — 가장 큰 히어로. 다음에 풀 학습 1개 + "시작하기"(유일한 primary) + 남은 개수.
2. **진행률** — 얇은 막대 + `완료/전체`.
3. **학원 과제** — 학원이 부여한 과제(출처 태그 `학원 과제`).
4. **개인 학습** — 개인적으로 진행하는 학습(출처 태그 `개인 학습`) + 오답 복습.
5. **완료/남음** — 진행률·목록으로 끝낸 것과 남은 것 구분.

주인공만 크게, 나머지는 보조 무게. 카드 3개 나열 금지.

## 15. Academy assignment vs personal study distinction

- 데이터: `LearningItem.source` = `academy | personal`. UI는 항상 `SourceTag`(작은 점 + 텍스트).
- 학원 과제: 마감·배정 맥락. 학원 계정은 배정 학습과 결과만 열람(개인 학습 상세 접근 금지).
- 개인 학습: 학생/학부모 결제, 마감 없음. 공개 콘텐츠에서 파생.
- 학습 탭에서 두 출처는 **별도 섹션**으로 분리. 색만이 아니라 라벨로 구분. 두 이용권 병존 가능(내 정보에 함께 표기).

---

## 부록 A. 현재 코드 감사 — 바꿔야 할 점

- 팔레트가 **차가운 회색(GitHub #f6f8fa/#d0d7de)** → Notion식 **따뜻한 중립**(§3 값)으로 조정. 다크도 웜그레이.
- 지문 컴포넌트 컬러 왼쪽 바 + 채운 박스 제거 완료 → 기사형 유지(§13).
- `ScoreCard` 거대 숫자 → metric+막대 완료. `QuestionReview` pill → 점+텍스트 완료.
- 학생 홈 히어로 계층 적용 완료. §14의 "개인 학습" 섹션을 홈에도 노출(현재 과제·오답복습 위주).
- `Field` 높이 44~48 정렬, radius md 확인.
- 학원 상세·학부모 리포트도 metric/hairline 원칙으로 통일 점검.

---

## 부록 B. Toss 영향 & 아이콘 시스템 (리서치 정리)

### 토스스러움이란 (리서치 요약)
- **극단적 단순함·직관성**을 창립 원칙으로. 한 화면 = 한 작업.
- TDS(토스 디자인 시스템) 핵심 컴포넌트: **BottomCTA**(전폭 하단 주요 버튼), **ListRow**(아이콘+텍스트+우측 값), **Tab/Navigation**, **Asset**(아주 단순한 아이콘), **Badge/Border/Paragraph**.
- **Toss Blue 단색 강조** + 흰 배경 + 큰 굵은 타이포(숫자 강조).
- 친근한 **존댓말 마이크로카피**("~할게요/~돼요/잠깐이면 돼요"), 안심시키는 톤.
- 부드러운 마이크로 인터랙션은 **사용성 다음**. 장식보다 명료함.
- 출처: TDS 공식(developers-apps-in-toss.toss.im/design), Toss 10년 UX 진화(Medium).

### 스코디 적용 (재조합: Toss 명료함 + Linear/Notion 절제)
- **Accent = Toss Blue** `#3182f6`(라이트)/`#4d90fe`(다크). **단색만**, 그라데이션 금지. 주요 버튼·선택·활성 탭·링크에만.
- **주요 버튼**은 화면당 하나, 눈에 띄게(BottomCTA 감성). 나머지는 secondary/ghost.
- **ListRow**: 필요 시 leading 아이콘 + 타이틀/서브 + 우측 meta/chevron.
- radius는 moderate(md 8, lg 12) — 토스의 부드러움과 절제 사이. 큰 라운드(16+)·큰 그림자는 여전히 금지.

### 아이콘 시스템 (`src/components/Icon.tsx`)
- 라이브러리: **Feather**(@expo/vector-icons) — 아주 단순한 단일 스트로크 라인 아이콘. 토스 Asset의 "간단한 느낌"에 부합.
- 크기: 탭바 22, 사이드바 18, 행 chevron 18. 색: 활성=accent, 비활성=inkSecondary/inkTertiary. 단색.
- 의미 매핑: 홈 `home`, 학습/콘텐츠 `book-open`/`file-text`, 기록/리포트/분석 `bar-chart-2`, 내 정보 `user`, 자녀/반·학생 `users`, 대시보드 `grid`, 학습 배정 `edit-3`, 학원 관리 `settings`, 이동 `chevron-right`, 추가 `plus`, 정답 `check`.
- 규칙: **의미 있는 곳에만**. 장식용 아이콘 남발 금지(§13). 색만으로 의미 전달 금지 — 라벨 병행.
