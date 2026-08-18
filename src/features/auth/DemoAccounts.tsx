import { StyleSheet, View } from 'react-native';
import { AppText, Button, Group, Icon, Row } from '@/components';
import { DEV_ACCOUNTS } from '@/session/devAccounts';
import { ROLE_LABEL } from '@/session/routing';
import { colors, spacing } from '@/theme/tokens';

/**
 * 개발용 계정 목록. 펼쳐서 한 줄을 누르면 그 계정으로 들어간다.
 *
 * **호출부는 `DEV_LOGIN_ENABLED`로 감싸서 부른다**(D-135). 이 컴포넌트 안에서 그 스위치를 보지
 * 않는 이유는 상수 접기다 — 호출부가 `DEV_LOGIN_ENABLED ? <DemoAccounts …/> : null`로 두면
 * 꺼진 빌드에서 이 파일과 `DEV_ACCOUNTS`가 번들에서 통째로 빠진다. 안에서 검사하면 계정 목록이
 * 운영 번들에 남는다(D-165가 `staffEmail`에서 정확히 그 실수를 했다).
 *
 * 소개 페이지와 로그인 화면이 이 블록을 각자 갖고 있었고, 한쪽이 맨 `Pressable` + 캡션으로
 * 낡아 누름 영역이 20px이 됐다(D-166). 같은 목록을 두 벌 두면 그 드리프트가 다시 생긴다.
 *
 * **펼침 상태는 호출부가 갖는다.** 로그인 화면의 오류 문구(`휴대폰 인증은 아직 연결되지
 * 않았어요…`)가 `테스트 계정 보기` 링크로 **이 패널을 열어 주기** 때문이다 — 상태를 안에
 * 숨기면 그 링크가 가리킬 방법이 없다.
 */
export function DemoAccounts({
  testID,
  open,
  onOpenChange,
  onEnter,
}: {
  testID: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnter: (scodyId: string) => void;
}) {
  const show = open;
  return (
    <View style={styles.box}>
      {/*
        글자에 `onPress`만 붙이면 스크린리더에는 그냥 글로 읽히고 누를 영역도 20px이다.
        프로토타입 진입에 실제로 쓰는 컨트롤이라 버튼으로 둔다.
      */}
      <Button
        testID={testID}
        variant="ghost"
        size="sm"
        hug
        leading={
          <Icon
            name={show ? 'chevron-down' : 'chevron-right'}
            size={15}
            color={colors.inkSecondary}
          />
        }
        label={show ? '테스트 계정 숨기기' : '테스트 계정 보기'}
        onPress={() => onOpenChange(!show)}
      />
      {show ? (
        <>
          <AppText variant="caption" tone="secondary">
            개발용 계정이에요. 실제 사용자 데이터가 아니에요.
          </AppText>
          <Group>
            {/* 로그인 전에는 DB에서 아무것도 읽을 수 없어 목록이 클라이언트에 있다. */}
            {DEV_ACCOUNTS.map((a) => (
              <Row
                key={a.scodyId}
                title={`${a.name} · ${a.roles.map((r) => ROLE_LABEL[r]).join('/')}`}
                subtitle={a.note}
                onPress={() => onEnter(a.scodyId)}
                showChevron
              />
            ))}
          </Group>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md, alignItems: 'flex-start' },
});
