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
  SegmentedControl,
  type SegmentedOption,
} from '@/components';
import { useCurrentAccount, useSession } from '@/session';
import {
  createInvite,
  loadInvites,
  type AcademyInvite,
  type InviteeRole,
} from '@/repo/directory';
import { useAcademyStaff } from '@/features/academy';
import { academyMonthly, usePricing, won } from '@/features/pricing';
import { useToast } from '@/features/toast';
import { inset } from '@/theme/styles';
import { colors } from '@/theme/tokens';

const TEACHER_PAGE = 12;
/** 자녀 후보를 한 번에 보여 주는 수. 나머지는 이름으로 좁힌다(반 상세의 학생 추가와 같은 규칙). */
const CHILD_PICK = 8;

const INVITE_LABEL: Record<string, string> = { student: '학생', parent: '학부모', teacher: '선생님' };

/**
 * 만들 수 있는 초대 세 종류(확정 정책 3절).
 *
 * 예전에는 `선생님`뿐이었다 — 학생·학부모 초대를 만들 길이 앱 전체에 없었는데 위 초대 목록은
 * `INVITE_LABEL`로 그 두 종류를 표시할 준비만 해 두었다. 기본값은 `teacher`로 둔다: 지금까지
 * 이 화면의 유일한 행동이었고, 원장이 가장 자주 만드는 초대다.
 */
const INVITE_KINDS: readonly SegmentedOption<InviteeRole>[] = [
  { value: 'teacher', label: '선생님' },
  { value: 'student', label: '학생' },
  { value: 'parent', label: '학부모' },
];

/** 초대를 만들기 전에 무엇이 일어나는지. 한 문장에 한 가지만 말한다. */
const INVITE_INTRO: Record<InviteeRole, string> = {
  teacher: '링크를 만들어 전달해요. 담당 반은 수락한 뒤에 정할 수 있어요.',
  student: '학생이 링크로 들어오면 소속만 추가돼요. 개인 이용권은 그대로예요.',
  parent: '연결할 자녀를 먼저 골라요. 링크를 받은 분이 그 자녀와 연결돼요.',
};

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
  const { readOnly, academy, academyStudents, accountOf } = useSession();
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
  /** 지금 만들려는 초대의 종류. */
  const [kind, setKind] = useState<InviteeRole>('teacher');
  /** 학부모 초대의 대상 학생 찾기. 반 상세의 `학생 추가`와 같은 방식이다. */
  const [childQuery, setChildQuery] = useState('');
  const [pickedChild, setPickedChild] = useState<string | null>(null);
  /**
   * 방금 만든 초대. 원장이 링크를 복사해 전달한다.
   *
   * 토큰만 들고 있던 자리다. **어떤 초대였는지 함께 들고 있는다** — 만든 뒤에 할 다음 행동이
   * 종류마다 다르고, 학부모 초대는 어느 자녀와 연결되는 링크인지 말해야 한다.
   */
  const [newInvite, setNewInvite] = useState<{
    token: string;
    invitee: InviteeRole;
    childName?: string;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return teachers;
    return teachers.filter((t) => t.name.includes(q) || t.scodyId.includes(q));
  }, [teachers, query]);
  const visibleTeachers = filtered.slice(page * TEACHER_PAGE, (page + 1) * TEACHER_PAGE);
  /**
   * 학부모 초대의 자녀 후보: **우리 학원 학생**이다. 검색을 받기 전에는 늘어놓지 않는다
   * (반 상세의 `학생 추가`와 같은 규칙).
   *
   * 원천은 `academyStudents`다 — 반에 아직 넣지 않은 학생도 나와야 한다. 자녀 연결은 반과
   * 무관한데 `v_class_roster`는 반에 든 학생만 준다. 서버도 같은 기준으로 다시 판단한다
   * (`rpc_create_invite`: `academy_members`에 재적 중인 학생만, 0036).
   */
  const childCandidates = useMemo(() => {
    const q = childQuery.trim();
    if (kind !== 'parent' || !q) return [];
    return academyStudents.filter((s) => s.name.includes(q) || s.scodyId.includes(q));
  }, [academyStudents, childQuery, kind]);
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
   * 초대 링크를 **만든다**.
   *
   * 예전에는 이름과 아이디를 받아 그 자리에서 구성원을 만들었다. 그렇게 만든 계정은 비밀번호가
   * 없어 로그인할 수 없었고, 실제 인증에서는 아예 만들 수 없다 — 계정은 초대받은 사람이 자기
   * 손으로 만든다(마스터 플랜 3절). 그래서 이 버튼은 **초대 링크를 만든다.**
   *
   * 종류는 세 가지다(3절). 학부모 초대는 **대상 학생을 함께 보낸다** — 그것이 3절의 "자녀 관계를
   * 확인하고"에 해당하는 단계이고, 그 값이 없으면 서버가 수락을 거부한다(`rpc_accept_invite`).
   */
  async function onCreate() {
    /*
      **대리 보기에서는 아무것도 쓰지 않는다**(D-071). 부르기 **전에** 돌아선다 — 예전에는
      결과를 받은 뒤에 돌아서서 쓰기를 먼저 시도했고(제공자가 안에서 거부한다) 화면에는 아무
      말도 남지 않았다. 여기서 막으면 시도 자체가 없다. 알림은 띄우지 않는다 — 대리 보기 중
      쓰기가 조용히 아무 일도 하지 않는 것이 학생 화면들과 같은 규칙이다.
    */
    if (readOnly) return;
    if (!academyId) {
      setError('학원 정보를 찾을 수 없어요.');
      return;
    }
    const child = kind === 'parent' ? pickedChild : null;
    if (kind === 'parent' && !child) {
      setError('연결할 자녀를 골라 주세요.');
      return;
    }
    /*
      선생님 초대는 provider(`useAcademyStaff().addTeacher`)를 그대로 지난다 — 기존 흐름을
      건드리지 않는다. 학생·학부모는 provider에 자리가 없어 레포 함수를 직접 부른다(이 화면은
      초대 목록도 같은 방식으로 읽는다 — `loadInvites`).

      어느 길이든 서버 함수 하나로 모인다(`rpc_create_invite`). 원장인지·우리 학원인지·대상이
      우리 학원 재적 학생인지는 그 함수가 판단하고, 여기 검사는 화면에 말할 문장을 만든다.
    */
    const result =
      kind === 'teacher'
        ? await addTeacher()
        : await createInvite({
            academyId,
            invitee: kind,
            targetStudentId: child ?? undefined,
          });
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
    setNewInvite({
      token: result.token,
      invitee: kind,
      childName: child ? accountOf(child)?.name : undefined,
    });
    // 고른 자녀는 지운다 — 같은 학생에게 두 번째 링크가 실수로 만들어지지 않게.
    setPickedChild(null);
    setChildQuery('');
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
              /*
                **대상 학생이 없는 학부모 초대는 링크를 주지 않는다.** 서버가 수락을 거부하므로
                (`rpc_accept_invite`) 전달해도 상대는 연결되지 않는다. 개발 seed와 0036 이전에
                만든 초대가 여기 온다 — 쓸 수 없는 링크를 쓸 수 있는 것처럼 두지 않는다.
              */
              const stale = i.invitee === 'parent' && !i.targetStudentId;
              // 수락했거나 기간이 지난 초대도 링크를 주지 않는다 — 눌러도 되지 않는다.
              const usable = i.status === 'pending' && !stale;
              const child = i.targetStudentId ? accountOf(i.targetStudentId) : undefined;
              return (
                <Row
                  key={i.token}
                  title={
                    child
                      ? `${INVITE_LABEL[i.invitee]} 초대 · ${child.name} 학생`
                      : `${INVITE_LABEL[i.invitee]} 초대`
                  }
                  subtitle={
                    usable
                      ? inviteUrl(i.token)
                      : stale && i.status === 'pending'
                        ? '연결할 자녀가 없는 초대예요. 새로 만들어 주세요'
                        : INVITE_DONE[i.status]
                  }
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
              subtitle="아래 초대 만들기에서 만들 수 있어요"
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

      <Section title="초대 만들기">
        {/*
          **세 종류를 한 자리에서 만든다**(확정 정책 3절). 예전에는 `선생님 초대` 하나뿐이어서
          학생·학부모 초대를 만들 길이 앱 전체에 없었다 — 그래서 자녀가 연결된 학부모는 개발
          seed로 심은 계정뿐이었고, 학부모 화면들이 시작되지 않았다.
        */}
        <SegmentedControl
          testID="invite-kind"
          options={INVITE_KINDS}
          value={kind}
          onChange={(next) => {
            setKind(next);
            setError(null);
            // 종류를 바꾸면 고른 자녀를 지운다 — 학부모가 아닌 초대에 대상이 남지 않게.
            setPickedChild(null);
            setChildQuery('');
          }}
        />
        <AppText variant="body" tone="secondary">
          {INVITE_INTRO[kind]}
        </AppText>

        {/*
          학부모 초대에만 있는 단계다. 대상 학생을 고르는 것이 3절의 "자녀 관계를 확인하고"에
          해당한다 — 이 값이 초대 행에 적히고, 수락한 계정이 그 학생과 연결된다.
          방식은 반 상세의 `학생 추가`와 같다(검색 뒤에 후보를 보여 준다).
        */}
        {kind === 'parent' ? (
          <>
            <Field
              label="자녀 이름·아이디로 찾기"
              testID="invite-child-search"
              value={childQuery}
              onChangeText={(v) => {
                setChildQuery(v);
                setPickedChild(null);
              }}
              placeholder="예: 박도윤 또는 hanbit.s0001"
            />
            {childQuery.trim() ? (
              <>
                <Group>
                  {childCandidates.length ? (
                    childCandidates.slice(0, CHILD_PICK).map((s) => {
                      const on = pickedChild === s.userId;
                      return (
                        <Row
                          key={s.userId}
                          testID={`invite-child-${s.userId}`}
                          title={s.name}
                          subtitle={s.scodyId}
                          accessibilityLabel={on ? `${s.name} 고르기 취소` : `${s.name} 고르기`}
                          onPress={() => setPickedChild(on ? null : s.userId)}
                          trailing={
                            on ? (
                              <AppText variant="label" tone="accent">
                                고름
                              </AppText>
                            ) : undefined
                          }
                        />
                      );
                    })
                  ) : (
                    <Row
                      title="찾는 학생이 없어요"
                      subtitle="이름이나 아이디를 다시 확인해 주세요"
                    />
                  )}
                </Group>
                {childCandidates.length > CHILD_PICK ? (
                  <AppText variant="caption" tone="tertiary">
                    {childCandidates.length}명 중 {CHILD_PICK}명만 보여요. 이름으로 좁혀 보세요.
                  </AppText>
                ) : null}
              </>
            ) : null}
            <AppText variant="caption" tone="tertiary">
              우리 학원 학생만 고를 수 있어요. 연결되면 그 자녀의 학습을 모두 볼 수 있어요.
            </AppText>
          </>
        ) : null}

        {error ? (
          <AppText variant="caption" style={{ color: colors.danger }}>
            {error}
          </AppText>
        ) : null}
        {newInvite ? (
          <>
            <Group>
              <Row
                testID="invite-new"
                /*
                  **어떤 종류를 만들었는지 함께 적는다.** 만든 뒤에 위 컨트롤로 다른 종류를 고르면
                  이 블록만 남아, 무엇을 만든 링크인지 알 수 없었다.
                */
                title={
                  newInvite.childName
                    ? `방금 만든 ${INVITE_LABEL[newInvite.invitee]} 초대 링크 · ${newInvite.childName} 학생`
                    : `방금 만든 ${INVITE_LABEL[newInvite.invitee]} 초대 링크`
                }
                subtitle={inviteUrl(newInvite.token)}
                trailing={
                  <Button
                    variant="secondary"
                    size="sm"
                    hug
                    label="복사"
                    onPress={() => copyInvite(newInvite.token)}
                  />
                }
              />
            </Group>
            {/*
              **만든 뒤에 무엇이 남았는지 말한다.** 예전에는 링크를 보여 주고 끝났고, 담당 반
              배정이 다른 메뉴의 다른 화면에 있다는 것도, 수락 전에는 그 화면의 후보 목록에
              나타나지 않는다는 것도 말하지 않았다(마스터 플랜 3절의 "승인한 뒤 담당 반을 배정").
            */}
            <AppText variant="caption" tone="secondary">
              {newInvite.invitee === 'teacher'
                ? '수락하면 구성원 목록에 나타나요. 그때 반 상세에서 담당으로 정할 수 있어요.'
                : newInvite.invitee === 'student'
                  ? '수락하면 학생 목록에 나타나요. 그때 반 상세에서 반에 넣을 수 있어요.'
                  : `수락하면 ${newInvite.childName ?? '고른'} 학생과 연결돼요. 그때부터 자녀 리포트를 볼 수 있어요.`}
            </AppText>
            {newInvite.invitee === 'parent' ? null : (
              /* 다른 화면으로 보내기만 하므로 전폭이 아니다 — 선생님 화면이 같은 모양을 쓴다. */
              <ActionBar>
                <Button
                  testID="invite-goto-classes"
                  hug
                  variant="secondary"
                  label="반·학생으로 가기"
                  trailing={<Icon name="arrow-right" size={16} color={colors.ink} />}
                  accessibilityLabel="반·학생으로 가기"
                  onPress={() => router.navigate('/academy/classes' as never)}
                />
              </ActionBar>
            )}
          </>
        ) : null}
        {/*
          이 화면의 목적을 끝내는 버튼이 아니다(초대·구성원·요금이 함께 있다) → `hug`(§8).
          학부모 초대는 자녀를 고른 뒤에 버튼을 둔다 — 눌러도 거부되는 버튼을 세우지 않는다
          (반 상세의 `학생 추가`와 같은 규칙).
        */}
        {kind === 'parent' && !pickedChild ? (
          <AppText variant="caption" tone="tertiary">
            자녀를 고르면 초대 링크를 만들 수 있어요.
          </AppText>
        ) : (
          <ActionBar>
            <Button
              testID="invite-create"
              hug
              label="초대 링크 만들기"
              accessibilityLabel={`${INVITE_LABEL[kind]} 초대 링크 만들기`}
              onPress={() => void onCreate()}
            />
          </ActionBar>
        )}
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
