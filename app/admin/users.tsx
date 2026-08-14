import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Disclosure,
  Screen,
  Section,
  Field,
  SegmentedControl,
  Pager,
  AppText,
  Table,
  type SegmentedOption,
  type Column,
} from '@/components';
import { normalizePhone, type Account, type Role } from '@/data';
import {
  isActiveEntitlement,
  looksLikeSupportCode,
  normalizeSupportCode,
} from '@/data/accountMeta';
import { gradeOf, listAccounts, type AdminAccount } from '@/repo/admin';
import { ROLE_LABEL } from '@/session/routing';

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
  */
  const [accounts, setAccounts] = useState<readonly AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const list = await listAccounts();
        if (alive) setAccounts(list);
      } catch (e) {
        console.warn('계정 목록을 읽지 못했어요:', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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

  const roleOptions: readonly SegmentedOption<RoleFilter>[] = [
    { value: '전체', label: '전체', count: counts.all },
    { value: 'student', label: '학생', count: counts.byRole.student },
    { value: 'parent', label: '학부모', count: counts.byRole.parent },
    { value: 'academy', label: '학원', count: counts.byRole.academy },
    { value: 'admin', label: '운영자', count: counts.byRole.admin },
  ];

  /*
    라벨에 `이용권`을 붙인다. 역할 칩에도 `학원`이 있어서 두 줄이 나란히 있으면
    `학원`이 역할인지 이용권인지 읽히지 않는다.
  */
  const planOptions: readonly SegmentedOption<PlanFilter>[] = [
    { value: '전체', label: '이용권 전체' },
    { value: '개인', label: '개인 이용권', count: counts.personal },
    { value: '학원', label: '학원 이용권', count: counts.academy },
    { value: '없음', label: '이용권 없음', count: counts.none },
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

      <Section title={`목록 (${total.toLocaleString('en-US')}명)`}>
        {/*
          출처 배지를 두지 않는다 — 가입일·최근 활동·학년·고객지원 코드가 모두 서버 값이다.
          예전에는 해시로 파생한 값이라 `합성` 배지를 달았고, 그 배지가 사라진 것이 이 표의 변화다.
        */}
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
          empty={{ title: '검색 결과가 없어요', subtitle: '필터나 검색어를 바꿔 보세요' }}
        />
        <Pager
          testID="users-pager"
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          unit="명"
          onChange={setPage}
        />
        {loading ? (
          <AppText variant="caption" tone="secondary">
            계정을 불러오고 있어요.
          </AppText>
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


