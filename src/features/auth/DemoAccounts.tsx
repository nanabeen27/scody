import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Group, Icon, LiveRegion, Row } from '@/components';
import { useAuthReveal } from '@/features/auth/AuthShell';
import { DEV_ACCOUNTS } from '@/session/devAccounts';
import { ROLE_LABEL } from '@/session/routing';
import { colors, spacing } from '@/theme/tokens';

/**
 * 개발용 테스트 계정 패널. 지금은 `app/login.tsx`의 `below` 자리에서만 쓴다.
 *
 * ## 호출부가 스위치를 들고 있다
 *
 * **`DEV_LOGIN_ENABLED ? <DemoAccounts … /> : null`로 감싸야 한다**(D-135). 이 파일 안에서
 * 스위치를 보면 꺼진 빌드에서도 모듈이 그려질 수 있는 자리로 남는다 — 상수 접기가 깨지는 방향은
 * D-165가 한 번 실측했다(수명이 다른 것을 한 모듈에 두면 한쪽이 다른 쪽을 살려 둔다).
 *
 * 여기 있는 것은 **구성**뿐이고 계정 목록은 `src/session/devAccounts.ts`가 정한다(꺼지면 `[]`).
 *
 * ## 왜 화면에서 떼어 냈나
 *
 * 로그인 화면이 이 패널을 인라인으로 들고 있어서, 오류 문구가 가리키는 링크와 패널 토글이 **같은
 * 라벨 `테스트 계정 보기`로 한 화면에 둘** 있었다(실측). 링크는 `setShowDemo(true)`라 두 번째부터
 * 눌러도 아무 일이 없었고, 패널은 그때 이미 `테스트 계정 숨기기`라고 적혀 있었다 — 두 라벨이 서로
 * 모순됐다. 펼침 상태는 이 컴포넌트 하나만 갖는다.
 */
export function DemoAccounts({ onEnter }: { onEnter: (scodyId: string) => void }) {
  const accounts = DEV_ACCOUNTS;
  const [open, setOpen] = useState(false);
  const { revealBelow } = useAuthReveal();
  /**
   * 펼친 직후 한 번만 스크롤한다. `onLayout`은 창 크기가 바뀔 때도 오는데, 그때 화면이
   * 저절로 움직이면 읽던 자리를 잃는다.
   */
  const pendingReveal = useRef(false);

  // 목록이 비어 있으면 펼칠 것이 없다 — `테스트 계정 0개`를 여는 버튼을 두지 않는다(D-141).
  if (accounts.length === 0) return null;

  return (
    <View style={styles.box}>
      {/*
        글자에 `onPress`만 붙이면 스크린리더에는 그냥 글로 읽히고 누를 영역도 20px이다.
        프로토타입 진입에 실제로 쓰는 컨트롤이라 버튼으로 둔다.

        **접힌 라벨이 개수를 말한다.** 눌러야 알 수 있던 것을 누르기 전에 알려 준다 —
        무엇이 열리는지 모르면 펴 볼 이유도 알 수 없다(`Disclosure`의 규칙과 같다).
        `aria-expanded`도 함께 넘긴다: 예전에는 넘기지 않아 보조기술이 펼침 상태를 몰랐다.
      */}
      <Button
        testID="login-demo-toggle"
        variant="ghost"
        size="sm"
        hug
        aria-expanded={open}
        leading={
          <Icon
            name={open ? 'chevron-down' : 'chevron-right'}
            size={15}
            color={colors.inkSecondary}
          />
        }
        label={open ? '테스트 계정 숨기기' : `테스트 계정 ${accounts.length}개 보기`}
        /* 앞 아이콘이 읽히는 이름에 섞이지 않게 이름을 고정한다(§8). */
        accessibilityLabel={open ? '테스트 계정 숨기기' : `테스트 계정 ${accounts.length}개 보기`}
        onPress={() => {
          const next = !open;
          setOpen(next);
          pendingReveal.current = next;
        }}
      />
      {/*
        보이지 않는 알림. 목록이 화면 아래에서 열리므로 화면을 못 보는 사용자에게는
        라벨이 바뀐 것 말고는 단서가 없다. 자리는 늘 렌더되고 문구만 바뀐다(`LiveRegion`).
      */}
      <LiveRegion message={open ? `테스트 계정 ${accounts.length}개를 아래에 펼쳤어요.` : ''} />
      {open ? (
        <View
          style={styles.list}
          /*
            **펼친 자리를 화면 안으로 끌어온다.** 이 패널은 인증 패널 밖 아래에 있어서, 토글이
            화면 아래쪽에 있으면 펼쳐진 목록이 뷰포트 밖에서 열린다 — 실측: 라벨은 바뀌고
            목록도 렌더되는데 화면에는 아무 변화가 없어 "눌러도 아무 일이 없다"로 읽혔다.
            스크롤 컨테이너는 `AuthShell`이 들고 있다.
          */
          onLayout={() => {
            if (!pendingReveal.current) return;
            pendingReveal.current = false;
            revealBelow();
          }}
        >
          <AppText variant="caption" tone="tertiary">
            개발용 계정이에요. 실제 사용자 데이터가 아니에요.
          </AppText>
          <Group>
            {accounts.map((a) => (
              <Row
                key={a.scodyId}
                title={`${a.name} · ${a.roles.map((r) => ROLE_LABEL[r]).join('/')}`}
                subtitle={a.note}
                onPress={() => onEnter(a.scodyId)}
                showChevron
              />
            ))}
          </Group>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md, alignItems: 'flex-start' },
  /* 목록은 컬럼 폭을 그대로 쓴다 — 토글만 내용 폭이다(`box`의 `flex-start`를 되돌린다). */
  list: { alignSelf: 'stretch', gap: spacing.md },
});
