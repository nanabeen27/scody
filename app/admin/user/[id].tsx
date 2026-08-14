import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Row,
  Field,
  SegmentedControl,
  Button,
  Icon,
  AppText,
  Sparkline,
  sparkLabel,
  type SegmentedOption,
  ActionBar,
} from '@/components';
import type { Account, Entitlement } from '@/data';
import { isActiveEntitlement } from '@/data/accountMeta';
import {
  classNamesOf,
  gradeOf,
  listAccounts,
  weeklyActivity,
  type AdminAccount,
  type WeeklyActivity,
} from '@/repo/admin';
import { useAudit, auditTime, type AuditEntry } from '@/features/audit';
import {
  impersonationScope,
  reasonKindsFor,
  scopeForLog,
  ticketRequiredFor,
  type ReasonKind,
} from '@/features/impersonation';
import { listAuditLogsFor } from '@/repo/ops';
import { IMPERSONATION_MINUTES, useCurrentAccount, useSession } from '@/session';
import { ROLE_LABEL, homeHrefFor } from '@/session/routing';
import { colors, spacing } from '@/theme/tokens';

/** 활동을 보여 주는 기간(주). 계절성이 한 번은 보이는 최소 폭이다. */
const WEEKS = 12;

const PAYER: Record<Entitlement['payer'], string> = {
  student: '학생 본인',
  parent: '학부모',
  academy: '학원',
};

const ACADEMY_ROLE: Record<string, string> = { director: '원장', teacher: '선생님' };

/**
 * 사유 유형 칩. **대상 역할에 따라 다르다**(D-149) — 자녀·학원 기록이 함께 열리는 대상에서는
 * `데이터 점검`이 없고 문의 번호가 필수다. 판단은 `src/features/impersonation.ts` 한곳에 있다.
 */
function reasonOptions(target: Account): readonly SegmentedOption<ReasonKind | ''>[] {
  return reasonKindsFor(target).map((k) => ({ value: k, label: k }));
}

/** 마스킹한 전화번호. 목록에는 두지 않고 상세에서만 가운데를 가려 보여 준다. */
function maskPhone(phone: string): string {
  const parts = phone.split('-');
  if (parts.length === 3) return `${parts[0]}-****-${parts[2]}`;
  const d = phone.replace(/\D/g, '');
  if (d.length < 7) return '****';
  return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
}

/** 값은 `trailing`의 `label`로 둔다. `Row.meta`는 화면에서 가장 흐린 글자라 값에 쓰지 않는다. */
function Val({ children }: { children: string }) {
  return <AppText variant="label">{children}</AppText>;
}

/**
 * 계정 한 개.
 *
 * 문의를 받은 운영자가 **대리 보기를 하기 전에 계정을 이해하는 곳**이다. 그래서 요약 →
 * 학습 활동 → 대리 보기 → 열어 본 기록 순서로 두고, 대리 보기 버튼은 primary가 아니다.
 * 활동 기록은 합성이라 `SourceBadge`로 밝힌다.
 */
export default function AdminUserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = String(id ?? '');
  const router = useRouter();
  const operator = useCurrentAccount();
  const { startImpersonation } = useSession();
  const { log } = useAudit();

  const [kind, setKind] = useState<ReasonKind | ''>('');
  const [why, setWhy] = useState('');
  const [ticket, setTicket] = useState('');
  const [error, setError] = useState<string | null>(null);

  /*
    계정과 활동을 **서버에서 읽는다.** 예전에는 fixture 조회 + 해시로 합성한 활동 기록이었다.
    `listAccounts`는 운영자 범위 전체를 주므로 여기서 한 명만 고른다 — 계정 하나만 읽는 질의를
    따로 두면 목록과 상세가 다른 값을 말할 자리가 생긴다.
  */
  const [account, setAccount] = useState<AdminAccount | undefined>(undefined);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [activity, setActivity] = useState<WeeklyActivity | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * 이 계정을 열어 본 기록(시작·종료).
   *
   * **서버에서 좁힌다.** 동명이인이 있으므로 이름이 아니라 `subject_id`로 맞추고, 최근 목록에서
   * 걸러 내지 않는다 — 감사 로그는 계속 자라서 상한을 넘긴 뒤에는 목록에 없는 기록이 생기고,
   * 그때 이 섹션이 조용히 적게 말한다(설명 문자열을 파싱하지 않는 이유는 `AuditEntry.subjectId`
   * 주석에).
   */
  const [opened, setOpened] = useState<AuditEntry[]>([]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [list, names, audit] = await Promise.all([
          listAccounts(),
          classNamesOf(userId),
          listAuditLogsFor(userId),
        ]);
        if (!alive) return;
        const found = list.find((a) => a.userId === userId);
        setAccount(found);
        setClassNames(names);
        setOpened(audit.filter((e) => e.action === '대리 보기'));
        /*
          **학생이 아니면 활동을 읽지 않는다.** 학습 기록은 학생만 가진다 — 원장·학부모 계정에
          주별 활동일 그래프가 붙으면 그 사람이 국어 문항을 풀었다는 뜻이 된다.
        */
        if (found?.roles.includes('student')) {
          setActivity(await weeklyActivity(userId, WEEKS));
        }
      } catch (e) {
        console.warn('계정을 읽지 못했어요:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  /*
    **읽는 동안 `없어요`라고 말하지 않는다.** 조회가 끝나기 전에는 `account`가 없으므로, 기다리지
    않으면 존재하는 계정에도 `계정을 찾을 수 없어요`가 한 번 스쳐 간다.
  */
  if (loading) {
    return (
      <Screen testID="admin-user" backFallback="/admin/users" title="계정을 불러오고 있어요">
        <AppText variant="body" tone="secondary">
          잠깐만 기다려 주세요.
        </AppText>
      </Screen>
    );
  }

  if (!account) {
    return (
      <Screen testID="admin-user" backFallback="/admin/users" title="계정을 찾을 수 없어요">
        <Group>
          <Row
            title="목록에서 다시 골라 주세요"
            subtitle="주소가 잘못됐거나 지워진 계정이에요"
            onPress={() => router.replace('/admin/users' as never)}
            showChevron
          />
        </Group>
      </Screen>
    );
  }

  const grade = gradeOf(account, classNames[0]);
  const academy = account.academyName;
  const phone = account.phone
    ? maskPhone(account.phone)
    : account.kakaoLinked
      ? '(카카오 로그인)'
      : '(없음)';
  const isStudent = account.roles.includes('student');
  const isSelf = account.userId === operator.userId;
  /**
   * 운영자 계정은 대상이 될 수 없다(`startImpersonation`이 거부한다). 거부되는 폼을 그려 두지
   * 않는다 — 지금은 운영자가 한 명이라 자기 계정과 겹치지만, 두 번째가 생기면 이 분기가 쓰인다.
   */
  const isAdminTarget = account.roles.includes('admin');
  const blocked = isSelf || isAdminTarget;
  /**
   * 이 대리 보기가 여는 것(D-149). 시작 전에 화면에 그대로 두고, 같은 문장을 감사 로그에 남긴다.
   * 남의 기록까지 열리는 대상(학부모·학원)에는 문의 번호를 받아야 시작할 수 있다.
   */
  const scope = impersonationScope(account);
  const needsTicket = ticketRequiredFor(account);
  const canStart =
    !blocked &&
    kind !== '' &&
    why.trim().length > 0 &&
    (!needsTicket || ticket.trim().length > 0);

  async function start() {
    if (!account || kind === '') return;
    const detailText = why.trim();
    const reason = `${kind}: ${detailText}`;
    const ticketNo = ticket.trim();
    // 서버에 대리 보기 기록을 남기고 대상 기준 스냅샷을 읽는다 — 그래서 비동기다.
    const res = await startImpersonation({
      target: account,
      reason,
      ticket: ticketNo || undefined,
    });
    if (!res.ok) {
      setError(res.error ?? '대리 보기를 시작할 수 없어요.');
      return;
    }
    setError(null);
    /*
      **기록을 서버에 남긴 뒤에 화면을 옮긴다.** 먼저 옮기면 이 화면이 사라지면서 요청이
      취소될 수 있고, 시작 기록이 없는 대리 보기가 생긴다(접속기록의 근거가 사라진다).
    */
    await log({
      actor: operator.name,
      // 대리 보기는 그 자체가 하나의 분류다. `계정`으로 남기면 `대리 보기` 칩이 영구히 0건이 된다.
      action: '대리 보기',
      subjectId: account.userId,
      /*
        **열람 범위를 함께 남긴다**(D-149). 사유만 남기면 그 열람이 자녀·학원 기록까지 열었다는
        사실이 기록에 없다 — 나중에 접속기록을 볼 때 무엇이 열렸는지 역할에서 다시 유추해야 했다.
      */
      detail: `대리 보기 시작 · ${account.name}(${account.userId}) · ${reason}${
        ticketNo ? ` · 문의 ${ticketNo}` : ''
      } · 열람 범위: ${scopeForLog(account)}`,
    });
    router.replace(homeHrefFor(account) as never);
  }

  return (
    /*
      표가 없는 화면이라 `wide`(960)를 쓰지 않는다. 전부 `Group`+`Row`인데 폭이 960이면 행 제목과
      `trailing` 값이 960px 떨어져 위아래로 훑기가 오히려 어렵고, `Field` 두 개도 960px 폭
      입력이 된다(D-050의 "한 대상의 소수 지표는 Group+Row"와 짝).
    */
    <Screen
      testID="admin-user"
      backFallback="/admin/users"
      title={account.name}
      lead="계정을 확인하고, 필요하면 사유를 남기고 대리 보기를 해요."
    >
      <Section title="요약">
        <Group>
          <Row
            title="고객지원 코드"
            subtitle="사용자가 문의할 때 말하는 값이에요"
            trailing={<Val>{account.supportCode ?? '—'}</Val>}
          />
          <Row title="내부 아이디" trailing={<Val>{account.userId}</Val>} />
          <Row
            title="역할"
            trailing={
              <Val>
                {`${account.roles.map((r) => ROLE_LABEL[r]).join('·')}${
                  account.academyRole ? ` (${ACADEMY_ROLE[account.academyRole]})` : ''
                }`}
              </Val>
            }
          />
          <Row title="학년" trailing={<Val>{grade ? `고${grade}` : '해당 없음'}</Val>} />
          <Row
            title="학원 소속"
            subtitle={classNames[0] ? `반 ${classNames[0]}` : undefined}
            trailing={<Val>{academy ?? '개인 사용자'}</Val>}
          />
          {account.entitlements.length ? (
            account.entitlements.map((e, i) => (
              <Row
                key={`${e.kind}-${i}`}
                title={`이용권 · ${e.kind === 'personal' ? '개인' : '학원'}`}
                subtitle={`결제 ${PAYER[e.payer]} · 시작 ${(e.startedAt ?? account.createdAt ?? '—')}`}
                trailing={<Val>{isActiveEntitlement(e) ? '이용 중' : '해지'}</Val>}
              />
            ))
          ) : (
            <Row title="이용권" trailing={<Val>없음</Val>} />
          )}
          <Row title="가입일" trailing={<Val>{account.createdAt ?? '—'}</Val>} />
          <Row
            title="최근 활동"
            trailing={
              <Val>
                {!account.roles.includes('student')
                  ? '해당 없음'
                  : (account.lastActiveOn ?? '기록 없음')}
              </Val>
            }
          />
          <Row
            title="카카오 연결"
            trailing={<Val>{account.kakaoLinked ? '연결됨' : '연결 안 됨'}</Val>}
          />
          <Row
            title="전화번호"
            subtitle="인증·복구·알림용이에요. 학부모 번호일 수 있어요"
            trailing={<Val>{phone}</Val>}
          />
        </Group>
        {!account.phone && !account.kakaoLinked ? (
          <AppText variant="caption" tone="tertiary">
            로그인 수단이 없는 로스터 테스트 계정이에요.
          </AppText>
        ) : null}
      </Section>

      {/*
        활동은 `learning_events`에서 센 실제 기록이라 출처 배지를 두지 않는다. 예전에는 계정 id를
        해시로 돌려 만든 값이어서 `합성` 배지를 달았다.
      */}
      <Section title="학습 활동">
        {activity ? (
          <View style={{ gap: spacing.sm }}>
            <AppText variant="caption" tone="secondary">
              주별 활동일 수 · 최근 {WEEKS}주
            </AppText>
            <Sparkline
              values={activity.days}
              label={sparkLabel('주별 활동일 수', activity.days, '일')}
              width={240}
              height={40}
              testID="user-activity-spark"
            />
            <Group>
              <Row
                title={`최근 ${WEEKS}주 활동한 날`}
                trailing={<Val>{`${activity.dayTotal}일`}</Val>}
              />
              <Row title="그중 학습을 끝낸 날" trailing={<Val>{`${activity.doneTotal}일`}</Val>} />
            </Group>
            <AppText variant="caption" tone="tertiary">
              활동한 날은 문항 1개 이상 답을 저장한 날이에요. 실제 학습 기록에서 세요.
            </AppText>
          </View>
        ) : (
          <AppText variant="caption" tone="secondary" testID="user-activity-none">
            이 역할은 학습 기록이 없어요.
          </AppText>
        )}
      </Section>

      <Section title="대리 보기">
        <AppText variant="caption" tone="secondary">
          읽기 전용이에요. 학습 기록·결제·개인정보를 바꿀 수 없어요.
        </AppText>
        <AppText variant="caption" tone="secondary">
          오답노트에 AI와 정리한 메모는 보이지 않아요. 문항과 별표만 보여요.
        </AppText>
        {isStudent ? (
          <AppText variant="caption" tone="secondary">
            학생 계정이에요. 꼭 필요한 만큼만 보고 바로 끝내 주세요.
          </AppText>
        ) : null}
        <AppText variant="caption" tone="tertiary">
          {IMPERSONATION_MINUTES}분이 지나면 자동으로 끝나요. 사유와 열람 범위는 운영 기록에
          남아요.
        </AppText>

        {blocked ? (
          <AppText variant="caption" tone="secondary">
            {isSelf
              ? '내 계정이라 대리 보기를 할 수 없어요.'
              : '총괄관리자 계정은 대리 보기를 할 수 없어요.'}
          </AppText>
        ) : (
          <>
        {/*
          **무엇이 열리는지 시작 전에 말한다**(D-149). 학부모·원장 계정은 대리하는 순간 남의
          기록까지 열리는데, 예전에는 화면이 그 사실을 한 줄도 말하지 않았다(A-079).
          여기 적힌 문장이 감사 로그에 남는 문장과 같다(`impersonationScope`).
        */}
        <View testID="impersonate-scope" style={{ gap: spacing.xs }}>
          <AppText variant="caption" tone="secondary">
            지금 열리는 범위
          </AppText>
          {scope.map((line) => (
            <AppText key={line}>· {line}</AppText>
          ))}
        </View>
            {/* 라벨과 칩은 `Field`의 라벨-입력 간격과 같게 붙인다. */}
            <View style={{ gap: spacing.xs }}>
              <AppText variant="caption" tone="secondary">
                사유 유형
              </AppText>
              <SegmentedControl
                testID="impersonate-kind"
                options={reasonOptions(account)}
                value={kind}
                onChange={(k) => setKind(k)}
              />
            </View>
            <Field
              testID="impersonate-why"
              label="무엇을 확인하나요"
              accessibilityLabel="대리 보기 사유"
              value={why}
              onChangeText={setWhy}
              placeholder="예: 홈에 학원 과제가 보이지 않는다는 문의"
            />
            <Field
              testID="impersonate-ticket"
              label={needsTicket ? '문의 번호' : '문의 번호 (선택)'}
              accessibilityLabel="문의 번호"
              value={ticket}
              onChangeText={setTicket}
              placeholder="예: 2026-0731-12"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {canStart ? (
              <ActionBar>
                <Button
                  testID="impersonate-start"
                  variant="secondary"
                  leading={<Icon name="eye" size={15} color={colors.ink} />}
                  label="대리 보기 시작하기"
                  accessibilityLabel={`${account.name} 님 계정으로 대리 보기 시작하기`}
                  onPress={() => void start()}
                />
              </ActionBar>
            ) : (
              <AppText variant="caption" tone="tertiary">
                {needsTicket
                  ? '사유 유형을 고르고, 무엇을 확인하는지와 문의 번호를 적으면 시작할 수 있어요.'
                  : '사유 유형을 고르고 무엇을 확인하는지 적으면 시작할 수 있어요.'}
              </AppText>
            )}
            {error ? (
              <AppText variant="caption" style={{ color: colors.danger }}>
                {error}
              </AppText>
            ) : null}
          </>
        )}
      </Section>

      <Section title="이 계정을 누가 열어 봤나">
        <Group>
          {opened.length ? (
            opened.map((e) => (
              // 시각은 판단에 쓰는 값이라 `meta`(inkTertiary, 대비 3.23:1)에 두지 않는다.
              // 학부모 리포트가 정답률에 쓴 방식대로 subtitle 맨 앞으로 올린다(DESIGN 19절).
              <Row
                key={e.id}
                testID={`user-audit-${e.id}`}
                title={e.detail}
                subtitle={`${auditTime(e.atISO)} · ${e.actor}`}
              />
            ))
          ) : (
            <Row title="아직 열어 본 기록이 없어요" subtitle="대리 보기를 시작하면 여기에 남아요" />
          )}
        </Group>
        <AppText variant="caption" tone="tertiary">
          기록은 서버에 남고 고치거나 지울 수 없어요. 보관 기간 정책은 아직 정하지 않았어요.
        </AppText>
      </Section>
    </Screen>
  );
}
