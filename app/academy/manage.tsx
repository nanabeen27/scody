import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Platform, View } from 'react-native';
import {
  ConfirmStep,
  Screen,
  Section,
  Group,
  Row,
  AppText,
  AccountSettings,
  Button,
  Field,
  Icon,
  Pager,
  ActionBar,
} from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import { loadInvites, type AcademyInvite } from '@/repo/directory';
import { useAcademyStaff } from '@/features/academy';
import { academyMonthly, usePricing, won } from '@/features/pricing';
import { useToast } from '@/features/toast';
import { inset } from '@/theme/styles';
import { colors } from '@/theme/tokens';

const TEACHER_PAGE = 12;

const INVITE_LABEL: Record<string, string> = { student: '학생', parent: '학부모', teacher: '선생님' };

/** 더 쓸 수 없는 초대가 왜 그런지. 링크 자리에 이 문장이 들어간다. */
const INVITE_DONE: Record<string, string> = {
  accepted: '이미 사용한 초대예요',
  expired: '기간이 지나 쓸 수 없어요',
};

/**
 * 초대 링크는 붙여 넣으면 열리는 절대 주소여야 한다.
 * 웹은 지금 보고 있는 주소를 그대로 쓰고, 주소를 알 수 없는 네이티브는
 * `src/features/openrouter.ts`와 같은 기본 주소를 쓴다.
 */
const FALLBACK_ORIGIN = 'https://scody.app';

function inviteUrl(token: string): string {
  const origin =
    typeof window !== 'undefined' && window.location ? window.location.origin : FALLBACK_ORIGIN;
  return `${origin}/join?invite=${token}`;
}

/** 학원 관리: 원장은 초대·요금·구성원, 선생님은 담당 반으로 가는 길(권한 분기). */
export default function AcademyManage() {
  const router = useRouter();
  const account = useCurrentAccount();
  const { readOnly, academy } = useSession();
  const isDirector = account.academyRole === 'director';
  const { teachers, addTeacher, removeTeacher, classesFor } = useAcademyStaff();
  const { policy, error: pricingError } = usePricing();
  const { show } = useToast();
  const classes = classesFor(account);
  const seatCount = new Set(classes.flatMap((c) => c.studentIds)).size;

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  /** 방금 만든 초대 토큰. 원장이 링크를 복사해 선생님에게 전달한다. */
  const [newInvite, setNewInvite] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return teachers;
    return teachers.filter((t) => t.name.includes(q) || t.scodyId.includes(q));
  }, [teachers, query]);
  const visibleTeachers = filtered.slice(page * TEACHER_PAGE, (page + 1) * TEACHER_PAGE);
  const directorCount = useMemo(
    () => teachers.filter((t) => t.academyRole === 'director').length,
    [teachers],
  );
  /*
    초대 목록은 **서버에서 읽는다.**

    예전에는 `INVITES` fixture 3개를 보여 줬다. 그 토큰은 한빛학원에만 붙어 있어서 다른 학원
    원장은 아무것도 볼 수 없었고, 아래 `초대 링크 만들기`가 실제로 만든 초대(`invites` 표에
    들어간다)는 목록에 나타나지 않았다.
  */
  const academyId = academy?.id;
  const [invites, setInvites] = useState<readonly AcademyInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  /** 다시 읽기 신호. 초대를 만든 뒤 값을 올리면 아래 효과가 한 번 더 돈다. */
  const [inviteNonce, setInviteNonce] = useState(0);

  /*
    초대는 원장 화면에만 있다 — 선생님 화면에서는 쓰지 않는 값을 읽지 않는다.
    모든 setState가 비동기 콜백 안에 있다. 효과 본문에서 곧바로 부르면 렌더가 한 번 더 돈다.
  */
  useEffect(() => {
    if (!isDirector || !academyId) return;
    let alive = true;
    void (async () => {
      try {
        const list = await loadInvites(academyId);
        if (!alive) return;
        setInvites(list);
        setInvitesError(null);
      } catch (e) {
        // 못 읽었을 때 빈 목록을 사실처럼 그리지 않는다 — 없는 것과 모르는 것은 다르다.
        console.warn('초대를 읽지 못했어요:', e);
        if (alive) setInvitesError('초대를 불러오지 못했어요');
      } finally {
        if (alive) setInvitesLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [academyId, isDirector, inviteNonce]);

  /**
   * 선생님을 **초대한다**.
   *
   * 예전에는 이름과 아이디를 받아 그 자리에서 구성원을 만들었다. 그렇게 만든 계정은 비밀번호가
   * 없어 로그인할 수 없었고, 실제 인증에서는 아예 만들 수 없다 — 계정은 초대받은 사람이 자기
   * 손으로 만든다(마스터 플랜 3절). 그래서 이 버튼은 **초대 링크를 만든다.**
   */
  async function onAdd() {
    /*
      **대리 보기에서는 아무것도 쓰지 않는다**(D-071). 부르기 **전에** 돌아선다 — 예전에는
      결과를 받은 뒤에 돌아서서 쓰기를 먼저 시도했고(제공자가 안에서 거부한다) 화면에는 아무
      말도 남지 않았다. 여기서 막으면 시도 자체가 없다. 알림은 띄우지 않는다 — 대리 보기 중
      쓰기가 조용히 아무 일도 하지 않는 것이 학생 화면들과 같은 규칙이다.
    */
    if (readOnly) return;
    const result = await addTeacher();
    if (!result.ok || !result.token) {
      setError(result.error ?? '초대 링크를 만들지 못했어요.');
      /*
        **지난번에 만든 링크를 실패 옆에 남기지 않는다.** 그대로 두면 `방금 만든 초대 링크`
        블록과 빨간 실패 문장이 한 화면에 함께 서서, 방금 무슨 일이 일어났는지 알 수 없다.
      */
      setNewInvite(null);
      return;
    }
    setError(null);
    setNewInvite(result.token);
    show('초대 링크를 만들었어요');
    // 위 목록에도 방금 만든 초대가 나타나야 한다 — 만든 사실이 한 곳에만 있으면 새로고침에 사라진다.
    setInviteNonce((n) => n + 1);
  }

  /**
   * 선생님을 학원에서 제외한다.
   *
   * **서버가 제외를 받아 준 다음에 알린다.** 예전에는 결과를 보지 않고 곧바로
   * `제외했어요`라고 말했는데, RLS가 거부하면 그 선생님이 목록에 그대로 남아 있었다 —
   * 되돌릴 수 없는 일이라고 알린 뒤 아무 일도 일어나지 않은 것이다.
   * 대리 보기에서는 제외를 시도하지 않는다(D-071 — `onAdd`와 같은 순서). 일어나지 않은 일을
   * 알리지 않는다.
   */
  async function onRemoveTeacher(userId: string, name: string) {
    if (readOnly) return;
    const res = await removeTeacher(userId);
    if (!res.ok) {
      show(res.error ?? '제외하지 못했어요', 'removed');
      return;
    }
    // 추가는 알리는데 제외는 조용했다. 되돌릴 수 없는 일이라 더 알려야 한다.
    show(`${name} 선생님을 제외했어요`, 'removed');
  }

  function copyInvite(token: string) {
    const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (!clip) {
      show('링크를 복사하지 못했어요', 'removed');
      return;
    }
    clip.writeText(inviteUrl(token)).then(
      () => show('초대 링크를 복사했어요'),
      () => show('링크를 복사하지 못했어요', 'removed'),
    );
  }

  if (!isDirector) {
    return (
      <Screen
        wide
        testID="academy-manage"
        title="학원 관리"
        lead={
          classes.length
            ? `담당 반 ${classes.length}개를 맡고 있어요.`
            : '아직 담당하는 반이 없어요.'
        }
      >
        <AppText variant="caption" tone="secondary">
          초대와 요금제는 원장님이 관리해요.
        </AppText>
        {/*
          이 화면에 선생님이 할 일은 없다고 방금 말했고, 다음은 담당 반에서 이어진다 —
          그래서 `arrow-right`다. `chevron-right`는 페이지 이동 표시라 버튼 안에 두지 않는다(§8).
          다른 화면으로 보내기만 하므로 전폭이 아니다 — `hug`을 받은 `ActionBar`가
          줄의 오른쪽 끝에 세운다(규칙 ③).
        */}
        <ActionBar>
          <Button
            testID="manage-goto-classes"
            hug
            label="담당 반 보러 가기"
            trailing={<Icon name="arrow-right" size={16} color={colors.accentText} />}
            accessibilityLabel="담당 반 보러 가기"
            onPress={() => router.navigate('/academy/classes' as never)}
          />
        </ActionBar>
        <AccountSettings />
      </Screen>
    );
  }

  const monthly = academyMonthly(policy, seatCount);
  const discounted = seatCount >= policy.seatDiscountFrom;

  return (
    <Screen wide testID="academy-manage" title="학원 관리" scrollResetKey={page}>
      <Section title="초대">
        <Group>
          {invitesError ? (
            <Row title={invitesError} subtitle="잠시 뒤에 다시 열어 주세요" />
          ) : invitesLoading ? (
            <Row title="초대를 불러오고 있어요" />
          ) : invites.length ? (
            invites.map((i) => {
              // 수락했거나 기간이 지난 초대는 링크를 주지 않는다 — 눌러도 되지 않는다.
              const usable = i.status === 'pending';
              return (
                <Row
                  key={i.token}
                  title={`${INVITE_LABEL[i.invitee]} 초대`}
                  subtitle={usable ? inviteUrl(i.token) : INVITE_DONE[i.status]}
                  trailing={
                    // 네이티브에는 클립보드 의존성이 없다. 그 화면에서는 링크 전문만 보여 준다.
                    usable && Platform.OS === 'web' ? (
                      <Button
                        testID={`invite-copy-${i.token}`}
                        variant="secondary"
                        size="sm"
                        leading={<Icon name="copy" size={15} color={colors.ink} />}
                        label="링크 복사"
                        accessibilityLabel={`${INVITE_LABEL[i.invitee]} 초대 링크 복사`}
                        onPress={() => copyInvite(i.token)}
                      />
                    ) : undefined
                  }
                />
              );
            })
          ) : (
            <Row
              title="아직 만들어 둔 초대 링크가 없어요"
              subtitle="아래 선생님 초대에서 만들 수 있어요"
            />
          )}
        </Group>
      </Section>

      <Section title={`구성원 ${teachers.length}명`}>
        <AppText variant="caption" tone="secondary">
          원장 {directorCount}명 · 선생님 {teachers.length - directorCount}명
        </AppText>
        <Field
          label="이름·아이디로 찾기"
          testID="teacher-search"
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setPage(0);
          }}
          placeholder="예: 김민준 또는 hanbit.t01"
        />
        <Group>
          {visibleTeachers.length ? (
            visibleTeachers.map((t) => {
              const isSelf = t.userId === account.userId;
              const isDirectorRow = t.academyRole === 'director';
              const removing = confirmRemove === t.userId;
              return (
                <View key={t.userId}>
                  <Row
                    title={t.name}
                    subtitle={t.scodyId}
                    meta={isSelf ? '원장(나)' : isDirectorRow ? '원장' : '선생님'}
                    trailing={
                      isSelf || removing ? undefined : (
                        <Button
                          testID={`teacher-remove-${t.scodyId}`}
                          variant="secondary"
                          leading={
                            <Icon name="minus-circle" size={16} color={colors.inkSecondary} />
                          }
                          label="제외하기"
                          accessibilityLabel={`${t.name} 선생님 제외하기`}
                          onPress={() => setConfirmRemove(t.userId)}
                        />
                      )
                    }
                  />
                  {/* 확인 문구는 행 아래에 붙어야 어느 행을 제외하는지 읽힌다(`inset.panel`). */}
                  {removing ? (
                    <View style={inset.panel}>
                      <ConfirmStep
                        message="정말 제외할까요? 제외하면 담당 반이 미배정으로 바뀌어요."
                        confirmLabel="제외하기"
                        confirmTestID={`teacher-remove-confirm-${t.scodyId}`}
                        confirmAccessibilityLabel={`${t.name} 선생님 제외하기`}
                        confirmIcon="minus-circle"
                        destructive
                        onCancel={() => setConfirmRemove(null)}
                        onConfirm={() => {
                          setConfirmRemove(null);
                          void onRemoveTeacher(t.userId, t.name);
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <Row title="찾는 선생님이 없어요" subtitle="이름이나 아이디를 다시 확인해 주세요" />
          )}
        </Group>
        {filtered.length > TEACHER_PAGE ? (
          <Pager
            testID="teacher-pager"
            total={filtered.length}
            page={page}
            pageSize={TEACHER_PAGE}
            unit="명"
            onChange={setPage}
          />
        ) : null}
      </Section>

      <Section title="선생님 초대">
        <AppText variant="body" tone="secondary">
          초대 링크를 만들어 전달해요. 선생님이 링크로 들어와 계정을 만들면 우리 학원 소속이 돼요.
        </AppText>
        {error ? (
          <AppText variant="caption" style={{ color: colors.danger }}>
            {error}
          </AppText>
        ) : null}
        {newInvite ? (
          <Group>
            <Row
              testID="teacher-invite-new"
              title="방금 만든 초대 링크"
              subtitle={inviteUrl(newInvite)}
              trailing={
                <Button
                  variant="secondary"
                  size="sm"
                  hug
                  label="복사"
                  onPress={() => copyInvite(newInvite)}
                />
              }
            />
          </Group>
        ) : null}
        {/* 이 화면의 목적을 끝내는 버튼이 아니다(초대·구성원·요금이 함께 있다) → `hug`(§8). */}
        <ActionBar>
          <Button
            testID="teacher-add"
            hug
            label="초대 링크 만들기"
            onPress={() => void onAdd()}
          />
        </ActionBar>
      </Section>

      <Section title="요금과 이용 인원">
        <Group>
          <Row
            title="반"
            trailing={
              <AppText variant="label">{classes.length.toLocaleString('en-US')}개</AppText>
            }
          />
          <Row
            title="학생 좌석"
            subtitle="반에 등록된 학생 수예요"
            trailing={<AppText variant="label">{seatCount.toLocaleString('en-US')}명</AppText>}
          />
          <Row
            title="좌석 단가"
            subtitle="학생 한 명의 한 달 요금이에요"
            trailing={<AppText variant="label">{won(policy.academySeat)}</AppText>}
          />
          <Row
            title="규모 할인"
            subtitle={`좌석이 ${policy.seatDiscountFrom}명 이상이면 적용해요`}
            trailing={
              <AppText variant="label">
                {discounted ? `${policy.seatDiscountPct}%` : '해당 없어요'}
              </AppText>
            }
          />
          <Row
            title="한 달 예상 금액"
            trailing={<AppText variant="label">{won(monthly)}</AppText>}
          />
        </Group>
        {/*
          **조회가 실패했으면 그 사실을 말한다.** 실패하면 정책이 코드 기준값에 남는데, 그것을
          아무 말 없이 그리면 운영자가 올린 단가와 다른 금액을 **서버 값처럼** 말한다(D-148의 나머지).
        */}
        {pricingError ? (
          <AppText variant="caption" tone="danger">
            좌석 단가를 불러오지 못했어요. 아래 금액은 기준값이에요. {pricingError}
          </AppText>
        ) : null}
        <AppText variant="caption" tone="tertiary">
          추정값이고 실제 청구는 연결되지 않았어요. 이용 인원은 지금 반에 속한 학생 수예요.
        </AppText>
      </Section>

      <AccountSettings />
    </Screen>
  );
}
