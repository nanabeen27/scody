import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {  } from 'react-native';
import {
  AppText,
  Disclosure,
  Field,
  Icon,
  LoadFailed,
  Pager,
  Screen,
  Section,
  SegmentedControl,
  Table,
  type Column,
  type SegmentedOption,
} from '@/components';
import { normalizePhone, type Account, type Role } from '@/data';
import {
  isActiveEntitlement,
  looksLikeSupportCode,
  normalizeSupportCode,
} from '@/data/accountMeta';
import { errorMessage } from '@/lib/supabase';
import { gradeOf, listAccounts, type AdminAccount } from '@/repo/admin';
import { ROLE_LABEL } from '@/session/routing';
import { colors } from '@/theme/tokens';

const PAGE_SIZE = 20;

type RoleFilter = '전체' | Role;
type PlanFilter = '전체' | '개인' | '학원' | '없음';

/**
 * 검색창에 넣은 값의 종류.
 *
 * **왜 자동 판별인가**: 카카오로 가입한 학생은 자기 `scodyId`를 모르고, 이름은 동명이인이
 * 많다(로스터에 `김민준`이 여럿 있다). 문의를 받은 운영자는 학생이 말해 주는 값을 그대로
 * 붙여넣는다 — 그게 코드인지 번호인지 고르게 만들면 한 단계가 더 늘어난다.
 *
 * **이메일은 키로 두지 않는다.** 이 제품에 이메일 필드가 없고, 카카오 공식 문서도 이메일을
 * 동일 사용자 판단 기준으로 쓰지 말라고 한다(사용자가 바꿀 수 있다).
 */
type SearchKind = 'code' | 'userId' | 'scodyId' | 'phone' | 'name';

/** 무엇으로 찾았는지 화면에서 밝힌다. 찾히지 않을 때 왜인지 알 수 있어야 한다. */
const FOUND_BY: Record<SearchKind, string> = {
  code: '고객지원 코드로 찾았어요.',
  userId: '내부 아이디로 찾았어요.',
  scodyId: '스코디 아이디로 찾았어요.',
  phone: '전화번호로 찾았어요.',
  name: '이름으로 찾았어요.',
};

/** 판별 순서: 고객지원 코드 → 내부 아이디 → 스코디 아이디 → 전화번호 → 이름. */
function detectKind(raw: string): SearchKind {
  const q = raw.trim();
  if (looksLikeSupportCode(q)) return 'code';
  if (/^u_/i.test(q)) return 'userId';
  if (/^[A-Za-z][A-Za-z0-9._-]*$/.test(q)) return 'scodyId';
  if (q.replace(/\D/g, '').length >= 9) return 'phone';
  return 'name';
}

function matches(a: Account, kind: SearchKind, q: string): boolean {
  const raw = q.trim();
  switch (kind) {
    case 'code':
      return normalizeSupportCode(a.supportCode ?? '') === normalizeSupportCode(raw);
    case 'userId':
      return a.userId.toLowerCase().includes(raw.toLowerCase());
    case 'scodyId':
      return a.scodyId.toLowerCase().includes(raw.toLowerCase());
    case 'phone':
      return !!a.phone && normalizePhone(a.phone).includes(raw.replace(/\D/g, ''));
    case 'name':
      return a.name.includes(raw);
  }
}

/** 이용권 표기. 해지한 구독은 `없음`과 구분한다 — 결제한 적이 있는 계정이다. */
function planOf(a: Account): string {
  const active = a.entitlements.filter(isActiveEntitlement);
  if (!active.length) return a.entitlements.length ? '해지' : '없음';
  const personal = active.some((e) => e.kind === 'personal');
  const academy = active.some((e) => e.kind === 'academy');
  return personal && academy ? '개인·학원' : personal ? '개인' : '학원';
}

interface UserRow {
  userId: string;
  name: string;
  roles: string;
  grade: string;
  academy: string;
  createdAt: string;
  lastActive: string;
  plan: string;
  code: string;
}

/**
 * 계정 검색.
 *
 * 문의를 받은 운영자가 **그 사람을 특정해서 상세로 들어가는 것**이 이 화면의 목적이다.
 * 그래서 결과는 `Table`이고, 동명이인을 가르는 근거(학년·학원 소속·가입일·최근 활동)를
 * 늘 함께 보여 준다. 비밀번호는 어떤 경우에도 표시하지 않는다.
 */
export default function AdminUsers() {
  const router = useRouter();
  const [role, setRole] = useState<RoleFilter>('전체');
  const [plan, setPlan] = useState<PlanFilter>('전체');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  /*
    계정 목록은 **서버에서 읽는다.** 예전에는 fixture `ACCOUNTS`(4,186개)를 브라우저에서 훑었다.
    권한은 RLS가 정한다 — 운영자가 아니면 자기 것만 온다.

    **읽는 중 · 실패 · 없음을 셋으로 가른다**(D-136 · `DESIGN.md` §9). 예전에는 실패를
    `console.warn`으로만 삼켜서 `error` 상태가 아예 없었다 — 조회가 실패한 화면이
    `목록 (0명)` + `검색 결과가 없어요 · 필터나 검색어를 바꿔 보세요` + 개수가 전부 0인 필터 칩으로
    영구히 남았다. 문의를 받은 운영자에게 검색어를 바꾸라고 시키는데 원인은 검색어가 아니다.
  */
  const [accounts, setAccounts] = useState<readonly AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** 다시 시도. 값을 하나 올려 같은 효과를 다시 돌린다(`adminMetrics`의 `useQuery`와 같은 방법). */
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    void (async () => {
      /*
        `loading`을 다시 올리는 것은 효과 본문이 아니라 **비동기 안**에서 한다 — 효과 본문에서
        곧바로 setState하면 렌더가 연쇄한다(`adminMetrics`의 `useQuery`가 쓰는 순서와 같다).
      */
      await Promise.resolve();
      if (!alive) return;
      setLoading(true);
      try {
        const list = await listAccounts();
        if (!alive) return;
        setAccounts(list);
        setError(null);
      } catch (e) {
        /*
          **실패를 로그로만 삼키지 않고 값으로 갖는다.** 화면 문장은 서버가 준 것을 쓴다
          (`errorMessage`가 RLS·중복 키·만료 토큰을 사람 문장으로 바꿔 둔다).
        */
        if (alive) setError(errorMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  /**
   * **손에 든 목록이 있는가.** 게이트를 `loading`이 아니라 이 값으로 거는 이유는, 다시 읽는
   * 동안 이미 찾아 둔 목록이 사라지면 운영자가 방금 본 계정을 다시 찾아야 하기 때문이다(D-168).
   */
  const hasList = accounts.length > 0;
  /**
   * 화면에 띄울 실패 문장. **다시 읽는 중에는 감춘다** — 실패 문장과 `읽고 있어요`가 함께 서면
   * 지금 무슨 일이 일어나는지 알 수 없다(`DESIGN.md` §9).
   */
  const failed = loading ? null : error;
  /**
   * 개수를 말할 수 있는가.
   *
   * 읽는 중에는 세지 않고(D-133), 실패했을 때도 세지 않는다 — 못 읽은 목록으로 센 `0명`은
   * 읽는 중에 센 `0명`과 똑같이 거짓이다(`DESIGN.md` §9). 반대로 **이미 읽어 둔 목록이 있으면
   * 센다**: 다시 읽기가 실패해도 앞서 읽은 것은 여전히 사실이다.
   */
  const counted = hasList || (!loading && !error);

  const counts = useMemo(() => {
    const byRole: Record<Role, number> = { student: 0, parent: 0, academy: 0, admin: 0 };
    let personal = 0;
    let academy = 0;
    let none = 0;
    for (const a of accounts) {
      for (const r of a.roles) byRole[r] += 1;
      const p = planOf(a);
      if (p.includes('개인')) personal += 1;
      if (p.includes('학원')) academy += 1;
      if (p === '없음' || p === '해지') none += 1;
    }
    return { all: accounts.length, byRole, personal, academy, none };
  }, [accounts]);

  /*
    칩의 개수도 `counted`가 정한다. 읽는 중이거나 실패한 화면에서 `학생 0 · 학부모 0`이 나란히
    서면 계정이 없다는 뜻으로 읽힌다. **바뀌는 것은 개수뿐**이고 어떤 칸을 그리는지는 예전과
    같다 — 조회 상태에 따라 필터의 칸 수가 달라지면 같은 화면이 두 모양을 갖는다.
  */
  const roleOptions: readonly SegmentedOption<RoleFilter>[] = [
    { value: '전체', label: '전체', count: counted ? counts.all : undefined },
    { value: 'student', label: '학생', count: counted ? counts.byRole.student : undefined },
    { value: 'parent', label: '학부모', count: counted ? counts.byRole.parent : undefined },
    { value: 'academy', label: '학원', count: counted ? counts.byRole.academy : undefined },
    { value: 'admin', label: '운영자', count: counted ? counts.byRole.admin : undefined },
  ];

  /*
    라벨에 `이용권`을 붙인다. 역할 칩에도 `학원`이 있어서 두 줄이 나란히 있으면
    `학원`이 역할인지 이용권인지 읽히지 않는다.
  */
  const planOptions: readonly SegmentedOption<PlanFilter>[] = [
    { value: '전체', label: '이용권 전체' },
    { value: '개인', label: '개인 이용권', count: counted ? counts.personal : undefined },
    { value: '학원', label: '학원 이용권', count: counted ? counts.academy : undefined },
    { value: '없음', label: '이용권 없음', count: counted ? counts.none : undefined },
  ];

  const base = useMemo(() => {
    let list: readonly AdminAccount[] = accounts;
    if (role !== '전체') list = list.filter((a) => a.roles.includes(role));
    if (plan !== '전체') {
      list = list.filter((a) => {
        const p = planOf(a);
        if (plan === '없음') return p === '없음' || p === '해지';
        return p.includes(plan);
      });
    }
    return list;
  }, [role, plan, accounts]);

  /*
    검색 결과와 함께 **무엇으로 찾았는지**를 돌려준다.
    코드로 찾지 못하면 이름·아이디로 한 번 더 찾는다 — 여섯 글자 아이디가 코드 형태와
    겹칠 수 있고, 그때 결과가 0건이면 운영자는 계정이 없다고 오해한다.
  */
  const found = useMemo(() => {
    const q = query.trim();
    if (!q) return { kind: null as SearchKind | null, fellBack: false, list: base };
    const kind = detectKind(q);
    const hit = base.filter((a) => matches(a, kind, q));
    if (kind === 'code' && hit.length === 0) {
      const alt = base.filter((a) => matches(a, 'scodyId', q) || matches(a, 'name', q));
      if (alt.length) return { kind, fellBack: true, list: alt };
    }
    return { kind, fellBack: false, list: hit };
  }, [base, query]);

  const total = found.list.length;
  // 파생값(가입일·최근 활동)은 활동 기록을 만들므로 **보이는 20건에만** 계산한다.
  const rows: UserRow[] = found.list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((a) => {
    const grade = gradeOf(a);
    return {
      userId: a.userId,
      name: a.name,
      roles: a.roles.map((r) => ROLE_LABEL[r]).join('·'),
      grade: grade ? `고${grade}` : '없음',
      academy: a.academyName ?? '개인 사용자',
      createdAt: a.createdAt ?? '',
      /*
        학습하지 않는 역할에는 날짜를 적지 않는다 — 학생만 문항을 푼다. 최근 활동 자체는 항상
        노출한다(D-072). 값은 실제 활동 기록(`learning_events`)에서 온다.
      */
      lastActive: !a.roles.includes('student')
        ? '해당 없음'
        : (a.lastActiveOn ?? '기록 없음'),
      plan: planOf(a),
      code: a.supportCode ?? '—',
    };
  });

  const columns: readonly Column<UserRow>[] = [
    { key: 'name', header: '이름', cell: (r) => r.name },
    { key: 'roles', header: '역할', width: 84, cell: (r) => r.roles },
    { key: 'grade', header: '학년', width: 56, cell: (r) => r.grade },
    { key: 'academy', header: '학원 소속', cell: (r) => r.academy },
    {
      key: 'createdAt',
      header: '가입일',
      width: 88,
      align: 'right',
      priority: 2,
      cell: (r) => r.createdAt,
    },
    { key: 'lastActive', header: '최근 활동', width: 88, align: 'right', cell: (r) => r.lastActive },
    { key: 'plan', header: '이용권', width: 76, priority: 2, cell: (r) => r.plan },
    { key: 'code', header: '고객지원 코드', width: 92, priority: 3, cell: (r) => r.code },
    /*
      **이 표가 눌린다는 사실을 화면이 말한다**(D-084 ③ · `DESIGN.md` §8·§20). `rowLabel`의
      `계정 상세 열기`는 스크린리더에게만 들렸고, 보는 사람에게는 아무 표시가 없었다 —
      `Table`은 `onRowPress`가 있어도 스스로 표시를 만들지 않는다.
      학원 쪽 표 셋(`academy/classes.tsx`·`classes/students.tsx`·`academy/index.tsx`)과 같은 열이다.
      `priority`를 주지 않아 어떤 폭에서도 포기하지 않는다 — 접히면 말하려던 것이 사라진다.
      좁은 화면(컬럼 560 미만)은 쌓기로 가고, `header`가 빈 열이라 제목 줄 오른쪽에 붙는다.
    */
    {
      key: 'go',
      header: '',
      width: 24,
      cell: () => <Icon name="chevron-right" size={18} color={colors.inkTertiary} />,
    },
  ];

  return (
    <Screen
      wide
      testID="admin-users"
      title="계정"
      lead="이름·고객지원 코드·아이디·전화번호로 찾아요."
      scrollResetKey={page}
    >
      {/*
        **검색이 이 화면의 목적이다**(한 사람을 찾아 열기). 그래서 검색창이 맨 위에 온다.
        예전에는 고지 2줄 + 필터 2줄 + 캡션이 앞에 쌓여 390에서 표 머리가 약 450px 아래였다.
        필터는 접고, 출처 각주는 목록 아래로 내렸다.
      */}
      <Field
        testID="users-search"
        label="계정 검색"
        accessibilityLabel="이름, 고객지원 코드, 스코디 아이디, 전화번호로 계정 검색"
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          setPage(0);
        }}
        placeholder="예: ABC-123, 홍길동, hong, 010-0000-0000"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {found.kind ? (
        <AppText variant="caption" tone="secondary">
          {found.fellBack
            ? '고객지원 코드로는 찾지 못해 이름·아이디로 찾았어요.'
            : FOUND_BY[found.kind]}
        </AppText>
      ) : null}

      <Disclosure
        testID="users-filter-toggle"
        label={`필터 · ${roleOptions.find((o) => o.value === role)?.label ?? '전체'} · ${
          planOptions.find((o) => o.value === plan)?.label ?? '전체'
        }`}
      >
        <SegmentedControl
          testID="users-role"
          options={roleOptions}
          value={role}
          onChange={(r) => {
            setRole(r);
            setPage(0);
          }}
        />
        <SegmentedControl
          testID="users-plan"
          options={planOptions}
          value={plan}
          onChange={(p) => {
            setPlan(p);
            setPage(0);
          }}
        />
      </Disclosure>

      {/* 개수를 셀 수 없는 동안에는 제목에 숫자를 넣지 않는다 — `목록 (0명)`이 사실처럼 읽힌다. */}
      <Section title={counted ? `목록 (${total.toLocaleString('en-US')}명)` : '목록'}>
        {/*
          출처 배지를 두지 않는다 — 가입일·최근 활동·학년·고객지원 코드가 모두 서버 값이다.
          예전에는 해시로 파생한 값이라 `합성` 배지를 달았고, 그 배지가 사라진 것이 이 표의 변화다.
        */}
        {/*
          **읽는 중이라는 말은 표 위(또는 표 안 빈 자리)에 둔다.** 예전에는 이 캡션이 `Pager`
          다음, 즉 표보다 아래에 있어서 `검색 결과가 없어요`를 먼저 읽고 한참 내려가야 이유를
          만났다.

          아직 읽은 목록이 없을 때는 아래 `empty`의 첫 갈래가 말한다(표 머리 바로 아래다) —
          여기서 또 말하면 같은 문장이 화면에 두 번 선다. 이 캡션은 **이미 읽어 둔 목록을 다시
          읽는 중**에만 필요하다: 그때는 행이 남아 있어 빈 자리가 그려지지 않고(D-168),
          `다시 불러오기`를 누른 운영자에게 아무 말도 하지 않으면 눌렸는지조차 알 수 없다.
        */}
        {loading && hasList ? (
          <AppText variant="caption" tone="secondary">
            계정을 다시 읽고 있어요.
          </AppText>
        ) : null}
        {/*
          **실패 면은 한 화면에 하나다**(`DESIGN.md` §9). 인라인 `danger` 캡션 + 다시 시도할 행동
          하나이고, 기준 구현은 `app/student/index.tsx`의 `home-load-failed`다.
          이 화면의 목록·개수·필터가 모두 이 한 조회에 매달려 있어 자리마다 두지 않는다.
        */}
        {failed ? (
          <LoadFailed
            testID="users-load-failed"
            retryTestID="users-load-retry"
            what="계정"
            message={failed}
            onRetry={retry}
          />
        ) : null}
        {/*
          찾은 다음에 할 일을 표 앞에서 말한다. 예전에는 `rowLabel`만 `계정 상세 열기`라고 했다 —
          스크린리더에게만 들리는 말이었다. 검색이 이 화면의 목적이라 표 위에는 이 한 줄만 둔다
          (고지는 목록 아래에 그대로 있다). **누를 행이 있을 때만 말한다.**
        */}
        {rows.length > 0 ? (
          <AppText variant="caption" tone="secondary">
            행을 누르면 계정 상세로 가요.
          </AppText>
        ) : null}
        <Table
          testID="user"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.userId}
          rowLabel={(r) =>
            [
              `${r.name} ${r.roles} ${r.grade} ${r.academy}`,
              `가입일 ${r.createdAt}`,
              `최근 활동 ${r.lastActive}`,
              `이용권 ${r.plan}`,
              `고객지원 코드 ${r.code}`,
              '계정 상세 열기',
            ].join(', ')
          }
          onRowPress={(r) => router.push(`/admin/user/${r.userId}` as never)}
          /*
            **빈 자리를 셋으로 가른다.** 조회 중과 실패에 `검색 결과가 없어요`를 쓰면 화면이
            원인이 아닌 것을 고치라고 시킨다. 실패 갈래는 서버 문장을 다시 적지 않고
            바로 위의 실패 면 하나를 가리킨다 — 같은 실패를 두 번 말하지 않는다(§9).

            첫 갈래의 게이트가 `loading && !hasList`인 이유: `첫 조회가 끝났는가`로 걸면
            **실패한 뒤 다시 시도하는 동안** 그 갈래가 죽어 마지막 갈래로 떨어졌다 — 위에서는
            다시 읽고 있다고 하면서 표는 검색어를 바꾸라고 시켰다. 손에 든 목록이 없고 읽고
            있으면 읽는 중이다. 반대로 목록을 들고 있으면 필터가 0건이라는 뜻이라 마지막
            갈래가 맞다. 실패 갈래도 같은 이유로 `!hasList`를 함께 본다 — 목록을 들고 있는데
            다시 읽기가 실패한 화면에서 표가 빈 이유는 필터이지 실패가 아니다.
          */
          empty={
            loading && !hasList
              ? { title: '계정을 읽고 있어요' }
              : failed && !hasList
                ? { title: '계정을 읽지 못했어요', subtitle: '위에서 다시 불러올 수 있어요' }
                : { title: '검색 결과가 없어요', subtitle: '필터나 검색어를 바꿔 보세요' }
          }
        />
        {/* 개수를 셀 수 없는 동안에는 페이저도 두지 않는다 — `0명 중 0–0`이 결과처럼 읽힌다. */}
        {counted ? (
          <Pager
            testID="users-pager"
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            unit="명"
            onChange={setPage}
          />
        ) : null}
        <AppText variant="caption" tone="tertiary">
          개발·테스트 계정입니다. 반 비교용 계정은 비밀번호가 없어 로그인할 수 없어요. 최근 활동은
          실제 학습 기록에서 세고, 학생이 아닌 역할에는 `해당 없음`으로 적어요.
        </AppText>
        <AppText variant="caption" tone="tertiary">
          카카오로 가입한 계정은 이메일·전화번호가 없을 수 있어요. 고객지원 코드로 찾는 것이 가장
          빨라요.
        </AppText>
      </Section>
    </Screen>
  );
}


