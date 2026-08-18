import { useState } from 'react';
import { View } from 'react-native';
import { ActionBar, ConfirmStep, Screen, Section, Group, Row, Button, AppText, AccountSettings } from '@/components';
import { maskPhone } from '@/data';
import { useCurrentAccount, useSession } from '@/session';
import { spacing } from '@/theme/tokens';

const PAYER: Record<string, string> = { student: '학생 본인', parent: '학부모', academy: '학원' };

/** 내 정보: 이용권(개인·학원 병존), 학원 연결/종료, 계정. */
export default function StudentProfile() {
  const account = useCurrentAccount();
  const { academyLinked, setAcademyLinked } = useSession();
  const [confirming, setConfirming] = useState(false);
  const hasAcademy = !!account.academyName;
  // 운영자 계정 상세와 같은 규칙으로 가린 번호. 없으면 `undefined`고 화면이 사실을 적는다.
  const phone = account.phone ? maskPhone(account.phone) : undefined;

  return (
    <Screen testID="student-profile" title="내 정보">
      <Section title="이용권">
        <Group>
          {account.entitlements.length > 0 ? (
            account.entitlements.map((e) => (
              <Row
                key={e.kind}
                title={e.label}
                subtitle={e.kind === 'personal' ? '개인 맞춤 학습' : '학원 지정 학습'}
                /* 누가 결제하는지는 읽고 판단하는 값이라 `meta`가 아니라 `trailing`이다(§20). */
                trailing={<AppText variant="label">{`결제 ${PAYER[e.payer]}`}</AppText>}
              />
            ))
          ) : (
            <Row title="보유한 이용권이 없어요" />
          )}
        </Group>
        {account.entitlements.length > 1 ? (
          <AppText variant="caption" tone="secondary">
            개인 이용권과 학원 이용권을 함께 가지고 있어요. 학습 출처는 항상 구분돼요.
          </AppText>
        ) : null}
      </Section>

      <Section title="연결된 학원">
        {hasAcademy && academyLinked ? (
          <>
            {/*
              **행동은 그 대상 안에 둔다.** 예전에는 카드 아래 행동줄에 따로 있어서 무엇에
              대한 연결 끊기인지 카드와 떨어져 보였다. 학원 이름 바로 옆이 그 자리다.
            */}
            <Group>
              <Row
                title={account.academyName!}
                subtitle="학원 지정 학습을 받고 있어요"
                trailing={
                  confirming ? undefined : (
                    <Button
                      testID="academy-unlink"
                      variant="secondary"
                      size="sm"
                      hug
                      label="연결 끊기"
                      accessibilityLabel="학원 연결 끊기"
                      onPress={() => setConfirming(true)}
                    />
                  )
                }
              />
            </Group>
            {confirming ? (
              <ConfirmStep
                message="학원 학습은 더 이상 오지 않지만, 지금까지의 학습 기록은 그대로 남아요."
                confirmLabel="연결 끊기"
                confirmTestID="academy-unlink-confirm"
                confirmIcon="minus-circle"
                destructive
                onCancel={() => setConfirming(false)}
                onConfirm={() => {
                  setAcademyLinked(false);
                  setConfirming(false);
                }}
              />
            ) : null}
          </>
        ) : hasAcademy && !academyLinked ? (
          <>
            <Group>
              <View style={{ padding: spacing.lg, gap: spacing.xs }}>
                <AppText variant="label">학원 연결이 끝났어요</AppText>
                <AppText variant="caption" tone="secondary">
                  학습 기록은 그대로 남아 있어요. 언제든 다시 연결할 수 있어요.
                </AppText>
              </View>
            </Group>
            <ActionBar>
              <Button
                testID="academy-relink"
                variant="secondary"
                label="다시 연결하기"
                onPress={() => setAcademyLinked(true)}
              />
            </ActionBar>
          </>
        ) : (
          <Group>
            <Row title="연결된 학원이 없어요" />
          </Group>
        )}
      </Section>

      <Section title="계정">
        <Group>
          <Row
            title="고객지원 코드"
            subtitle="문의할 때 이 코드를 알려 주세요"
            trailing={<AppText variant="label">{account.supportCode ?? '—'}</AppText>}
          />
          <Row
            title="스코디 아이디"
            trailing={<AppText variant="label">{account.scodyId}</AppText>}
          />
          {/*
            **값 자리에는 번호를 두고, 용도는 부제로 내린다.** 예전에는 값 자리에
            `인증·복구·초대 확인용`이 들어 있어서 이 줄만 위의 두 줄과 규칙이 달랐고, 내 번호가
            무엇으로 등록돼 있는지 확인할 길이 없었다. 마스킹은 운영자 계정 상세와 **같은 함수**를
            써서 두 화면이 갈리지 않게 한다(`maskPhone`).

            **바꾸는 행동은 두지 않는다.** 번호를 바꾸려면 새 번호로 인증을 받아야 하는데 실제
            인증이 아직 없다(M-DB-2) — 지금 버튼을 두면 확인할 수 없는 번호로 갈아 끼우게 된다.
          */}
          <Row
            title="휴대폰 번호"
            subtitle="인증·복구·초대 확인에 써요"
            trailing={
              /* 번호가 없을 때는 값이 아니라 사실을 적는 자리라 `secondary`로 낮춘다. */
              <AppText variant="label" tone={phone ? 'default' : 'secondary'}>
                {phone ?? '등록된 번호가 없어요'}
              </AppText>
            }
          />
        </Group>
        <AppText variant="caption" tone="secondary">
          이 코드로는 로그인할 수 없어요.
        </AppText>
      </Section>

      <AccountSettings />
    </Screen>
  );
}
