import { Image } from 'react-native';

/**
 * 카카오 공식 심볼(말풍선).
 *
 * **자산 출처**: 카카오 개발자 사이트가 배포하는 카카오 로그인 버튼 이미지
 * (`developers.kakao.com/tool/resource/.../kakao_login_large_wide.png`, 600×90)에서 심볼 부분만
 * 잘라 배경을 투명으로 만든 것이다(`assets/kakao-symbol.png`, 36×34). 모양은 손대지 않았다.
 *
 * **쓰는 자리는 카카오 로그인 버튼 하나뿐이다.** 카카오 심볼은 상표이고, 카카오의 디자인
 * 가이드가 허용하는 용도가 `카카오 로그인`이다. 다른 기능의 아이콘으로 돌려쓰지 않는다.
 *
 * 예전에는 Feather의 `message-circle`(범용 말풍선 라인 아이콘)을 썼다 — 카카오 버튼인데
 * 카카오 것이 아닌 아이콘이라 무엇으로 들어가는지 모양이 말해 주지 않았다.
 *
 * ⚠️ **카카오 로그인은 아직 연결되지 않았다**(M-DB-2). 그 전까지 이 버튼은 연결되지 않았다는
 * 사실을 문장으로 밝힌다 — 심볼만 보고 실제 카카오 연동이 있다고 오해하지 않게.
 */
export function KakaoSymbol({ size = 18 }: { size?: number }) {
  // 원본 비율(36:34)을 지킨다. 심볼을 늘이거나 찌그러뜨리지 않는다.
  return (
    <Image
      source={require('../../assets/kakao-symbol.png')}
      style={{ width: size, height: Math.round((size * 34) / 36) }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
