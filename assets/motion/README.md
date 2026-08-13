# 모션 애셋

이 폴더는 **비어 있다.** 라이선스가 확인된 Lottie 애셋을 아직 확보하지 못했기 때문이다.
비어 있어도 앱은 정상 동작한다 — `MotionAsset`이 이름을 못 찾으면 코드로 그린 대체물
(`PendingDots`)로 떨어진다.

## 왜 비어 있는가

조사에서 **상업 서비스에 안전하게 쓸 수 있다고 검증된 범용 CC0 Lottie 라이브러리를
찾지 못했다.** 확인한 것:

| 출처 | 실제 라이선스 | 판정 |
|---|---|---|
| LottieFiles "Free" | **Lottie Simple License** — 상업 이용 가능·저작자 표시 불필요. 그러나 **CC0가 아니다**: 재배포·수정본에 같은 조건이 따라붙고(share-alike), **비침해 보증이 없다**(`WITHOUT WARRANTY … INCLUDING … NONINFRINGEMENT`) | ⚠️ 유저 업로드 플랫폼이라 남의 IP가 "Free"로 올라와 있어도 책임은 우리다 |
| IconScout "Public Domain" 카테고리 | 이름과 달리 IconScout 자체 라이선스. 재판매·재배포 금지 | ❌ CC0 아님 |
| loading.io `LD-FREE` | 원문: *"dedicated to the public domain by waiving all our right worldwide under copyright law … No attribution is required"* | ✅ 진짜 퍼블릭 도메인. **다만 로더·스피너 전용**이고 같은 사이트에 `LD-BY`(표시 필요)·`LD-PRO`(유료)가 섞여 있어 **항목마다 확인해야 한다** |

이 레포는 폰트에서 같은 판단을 한 전례가 있다 — **D-053**에서 SIL OFL 1.1의 Reserved
Font Name 조항 때문에 서브셋 패밀리 이름을 `ScodyKR`로 바꿨다. 같은 엄밀함을 유지한다.

## 애셋을 넣기 전에 — 확인 절차

애셋 하나마다 아래를 **파일로 남긴 뒤에** 커밋한다. 근거 없이 넣지 않는다.

1. **라이선스 원문 URL**과 그 원문에서 상업 이용·재배포 조건을 인용
2. **누가 언제 확인했는가**
3. **저작자 표시가 필요한가.** 필요하면 어디에 표시할지 정한다(`/legal/*`)
4. **파일 크기.** 아래 상한을 넘으면 넣지 않는다

이 절차를 마치면 `docs/SCODY_MASTER_PLAN.md`에 결정으로 기록한다.

## 상한

| 항목 | 상한 | 이유 |
|---|---|---|
| 파일 크기 | **20 kB** | 참고: 토스의 토스트 체크마크 실측 **3.0 kB**(2 레이어 순수 벡터) |
| 이미지 임베드 | **금지** | 토스의 3D 애셋은 파일의 93~95%가 base64 PNG라 116~246 kB이고 gzip도 28%밖에 안 줄어든다. 저사양 안드로이드에서 Lottie가 느려지는 대표 원인(`airbnb/lottie-android#167` — matte·mask·이미지) |
| track matte / mask | **피한다** | 같은 이유 |

## 넣는 방법

1. 위 확인 절차를 마친다
2. 파일을 이 폴더에 둔다
3. `registry.ts`에 `require`를 한 줄 더한다
4. **`.lottie`를 처음 쓴다면** `npm run motion:wasm` — `@lottiefiles/dotlottie-web`의
   WASM 렌더러(1.79 MB)를 `public/`으로 복사한다

## WASM을 왜 자체 호스팅하는가

`@lottiefiles/dotlottie-react`는 기본값으로 **런타임에 jsDelivr에서 WASM을 받아온다.**
그러면 첫 렌더가 제3자 CDN에 묶이고, 오프라인·CSP 차단 환경에서 애니메이션이 아예 안 뜬다.
이 레포는 **D-053에서 웹 폰트를 10.7 MB → 2.5 MB로 줄여 첫 진입 폴백 노출을 688 ms까지
밀어 넣은** 이력이 있다. 그 노력을 CDN 하나에 되돌려 주지 않는다.

`src/components/MotionAsset.tsx`가 첫 재생 전에 `setWasmUrl('/dotlottie-player.wasm')`을
부른다. 파일이 없으면 재생이 실패하고 대체물로 떨어진다 — 화면은 깨지지 않는다.

**바이너리는 레포에 커밋하지 않는다.** `public/`은 빌드 산출물에 그대로 복사되므로,
애셋이 하나도 없는 지금 1.79 MB를 넣으면 쓰지도 않는 파일이 배포된다.
