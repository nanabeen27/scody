import { View } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Row,
  Button,
  Icon,
  AppText,
  SourceTag,
  EmptyState,
} from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { usePricing, personalMonthly, won } from '@/features/pricing';
import { useToast } from '@/features/toast';
import type { Account } from '@/data';
import { colors, spacing } from '@/theme/tokens';

/**
 * 자녀 관리: **누가 무엇으로 이용 중이고 비용을 누가 내는지**를 다룬다.
 *
 * 리포트는 리포트 탭이 맡는다(D-048) — 여기에 리포트를 또 두면 두 탭이 같은 화면이 된다.
 * 이 탭의 고유한 일은 이용권과 결제 주체다.
 */
export default function ParentChildren() {
  const account = useCurrentAccount();
  const { policy, loading, parentPays, offerToPay, cancelOffer } = usePricing();
  const { show } = useToast();
  const { readOnly, childrenOf } = useSession();
  const children = childrenOf(account.userId);
  const monthly = personalMonthly(policy, 'parent');

  /**
   * 대신 내주기로 표시한다.
   *
   * **서버가 받아 준 다음에 알린다.** 낙관적으로 먼저 알리면 표시가 저장되지 않아도 화면은
   * 됐다고 말하고, 새로고침하면 조용히 사라진다(이 화면이 고친 결함이 정확히 그것이다).
   */
  async function onOffer(childId: string) {
    const res = await offerToPay(childId);
    // 대리 보기에서는 쓰기가 거부된다(D-071·D-116). 일어나지 않은 일을 알리지 않는다.
    if (readOnly) return;
    if (res.ok) {
      show('내가 내기로 표시했어요');
      return;
    }
    show(res.error ?? '표시하지 못했어요', 'removed');
  }

  async function onCancel(childId: string) {
    const res = await cancelOffer(childId);
    if (readOnly) return;
    show(res.ok ? '표시를 취소했어요' : (res.error ?? '취소하지 못했어요'), 'removed');
  }


  return (
    <Screen testID="parent-children" title="자녀">
      {/*
        **읽는 동안 버튼을 그리지 않는다.** 표시는 서버에서 오고, 첫 조회가 끝나기 전에는
        `parentPays`가 빈 배열이다 — 그 순간 이미 표시해 둔 자녀에게도
        `내가 대신 낼게요`가 보이고, 누르면 이미 있는 표시를 다시 만드는 셈이 된다.
      */}
      {loading ? (
        <AppText variant="caption" tone="secondary">
          이용권을 불러오고 있어요.
        </AppText>
      ) : children.length === 0 ? (
        // 홈·리포트 탭과 같은 빈 상태다(D-104). 문구가 갈리지 않게 형태도 같게 둔다.
        <EmptyState
          title="아직 연결된 자녀가 없어요"
          subtitle="자녀 연결은 학원이 보낸 초대 링크로 해요."
        />
      ) : (
        children.map((child) => (
          <ChildBilling
            key={child.userId}
            child={child}
            monthly={monthly}
            offered={parentPays.includes(child.userId)}
            onOffer={() => void onOffer(child.userId)}
            onCancel={() => void onCancel(child.userId)}
          />
        ))
      )}

      {!loading && children.length > 0 ? (
        <AppText variant="caption" tone="tertiary">
          결제 연결은 아직 준비 중이에요. 지금은 내가 내겠다는 표시만 남고 실제로 청구되지 않아요.
        </AppText>
      ) : null}
    </Screen>
  );
}

/**
 * 자녀 한 명의 이용권과 결제 주체.
 * 학원 이용권과 개인 이용권은 **함께** 가질 수 있다(마스터 플랜 2절 이용권 병존) —
 * 배타적으로 그리면 학부모가 내는 개인 결제가 화면에서 사라진다.
 */
function ChildBilling({
  child,
  monthly,
  offered,
  onOffer,
  onCancel,
}: {
  child: Account;
  monthly: number;
  offered: boolean;
  onOffer: () => void;
  onCancel: () => void;
}) {
  const academy = child.entitlements.find((e) => e.kind === 'academy');
  const personal = child.entitlements.find((e) => e.kind === 'personal');
  const parentAlready = personal?.payer === 'parent';

  return (
    <Section title={child.name}>
      <Group>
        {academy ? (
          <Row
            title={child.academyName ?? '학원 이용권'}
            subtitle="학원이 비용을 내요"
            leading={<SourceTag source="academy" />}
            meta="이용 중"
          />
        ) : null}
        {personal ? (
          <Row
            testID={`billing-personal-${child.userId}`}
            title="개인 월정액"
            subtitle={parentAlready ? '내가 내고 있어요' : '자녀 본인이 내고 있어요'}
            leading={<SourceTag source="personal" />}
            meta={won(monthly)}
          />
        ) : (
          <Row
            testID={`billing-none-${child.userId}`}
            title="개인 월정액"
            subtitle="아직 이용하지 않아요"
            leading={<SourceTag source="personal" />}
            meta={won(monthly)}
          />
        )}
        {!academy && !personal ? null : null}
      </Group>

      {parentAlready ? (
        <AppText variant="caption" tone="tertiary">
          개인 학습 비용을 내가 내고 있어요.
        </AppText>
      ) : offered ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="caption" tone="accent">
            {personal ? '다음 결제부터' : '이용을 시작할 때'} 내가 내기로 표시했어요.
          </AppText>
          <Button
            testID={`billing-cancel-${child.userId}`}
            variant="ghost"
            size="sm"
            hug
            label="표시 취소"
            leading={<Icon name="minus-circle" size={15} color={colors.inkSecondary} />}
            onPress={onCancel}
          />
        </View>
      ) : (
        <Button
          testID={`billing-offer-${child.userId}`}
          variant="secondary"
          size="sm"
          tone="accent"
          hug
          label={personal ? '내가 대신 낼게요' : '내가 결제해서 시작할게요'}
          trailing={<Icon name="arrow-right" size={15} color={colors.accent} />}
          onPress={onOffer}
        />
      )}
    </Section>
  );
}
