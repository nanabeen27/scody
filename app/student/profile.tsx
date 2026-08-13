import { useState } from 'react';
import { View } from 'react-native';
import { ActionBar, ConfirmStep, Screen, Section, Group, Row, Button, AppText, AccountSettings } from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { spacing } from '@/theme/tokens';

const PAYER: Record<string, string> = { student: '학생 본인', parent: '학부모', academy: '학원' };

/** 내 정보: 이용권(개인·학원 병존), 학원 연결/종료, 계정. */
export default function StudentProfile() {
  const account = useCurrentAccount();
  const { academyLinked, setAcademyLinked } = useSession();
  const [confirming, setConfirming] = useState(false);
  const hasAcademy = !!account.academyName;

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
                meta={`결제 ${PAYER[e.payer]}`}
              />
            ))
          ) : (
            <Row title="보유한 이용권이 없어요" />
          )}
        </Group>
        {account.entitlements.length > 1 ? (
          <AppText variant="caption" tone="tertiary">
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
          <Row title="스코디 아이디" meta={account.scodyId} />
          <Row title="휴대폰 번호" meta="인증·복구·초대 확인용" />
        </Group>
        <AppText variant="caption" tone="tertiary">
          이 코드로는 로그인할 수 없어요.
        </AppText>
      </Section>

      <AccountSettings />
    </Screen>
  );
}
