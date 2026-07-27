import { useMemo, useState } from 'react';
import {
  Screen,
  Section,
  Group,
  Row,
  Field,
  Chips,
  Pager,
  AppText,
  StatTiles,
  type ChipOption,
  type Stat,
} from '@/components';
import { ACCOUNTS, ACADEMY_CLASSES, type Account, type Role } from '@/data';
import { ROLE_LABEL } from '@/session/routing';

const PAGE_SIZE = 20;

type RoleFilter = '전체' | Role | '유료';

/**
 * 계정 목록. 3천 명 규모에서도 찾을 수 있어야 한다.
 * 역할·이용권으로 좁히고 이름·아이디로 검색한 뒤 페이지로 넘긴다.
 * 비밀번호는 어떤 경우에도 보여 주지 않는다.
 */
export default function AdminUsers() {
  const [role, setRole] = useState<RoleFilter>('전체');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const academyByStudent = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of ACADEMY_CLASSES) {
      for (const id of c.studentIds) map[id] = c.academyName;
    }
    return map;
  }, []);

  const counts = useMemo(
    () => ({
      all: ACCOUNTS.length,
      student: ACCOUNTS.filter((a) => a.roles.includes('student')).length,
      parent: ACCOUNTS.filter((a) => a.roles.includes('parent')).length,
      academy: ACCOUNTS.filter((a) => a.roles.includes('academy')).length,
      admin: ACCOUNTS.filter((a) => a.roles.includes('admin')).length,
      paid: ACCOUNTS.filter((a) => a.entitlements.length > 0).length,
      multi: ACCOUNTS.filter((a) => a.roles.length > 1).length,
    }),
    [],
  );

  const options: readonly ChipOption<RoleFilter>[] = [
    { value: '전체', label: '전체', count: counts.all },
    { value: 'student', label: '학생', count: counts.student },
    { value: 'parent', label: '학부모', count: counts.parent },
    { value: 'academy', label: '학원', count: counts.academy },
    { value: 'admin', label: '운영자', count: counts.admin },
    { value: '유료', label: '이용권 보유', count: counts.paid },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list: readonly Account[] = ACCOUNTS;
    if (role === '유료') list = list.filter((a) => a.entitlements.length > 0);
    else if (role !== '전체') list = list.filter((a) => a.roles.includes(role));
    if (q) {
      list = list.filter(
        (a) => a.name.toLowerCase().includes(q) || a.scodyId.toLowerCase().includes(q),
      );
    }
    return list;
  }, [role, query]);

  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const stats: Stat[] = [
    {
      label: '검색 결과',
      value: `${filtered.length.toLocaleString('en-US')}명`,
      hint: '필터 적용 후',
    },
    { label: '전체 계정', value: `${counts.all.toLocaleString('en-US')}명`, hint: '테스트 데이터' },
    {
      label: '이용권 보유',
      value: `${counts.paid.toLocaleString('en-US')}명`,
      hint: '개인 또는 학원',
    },
    { label: '다역할 계정', value: `${counts.multi}명`, hint: '공간 전환 사용' },
  ];

  return (
    <Screen
      wide
      testID="admin-users"
      backFallback="/admin"
      eyebrow="총괄관리자"
      title="계정"
      lead="역할로 좁히고 이름이나 아이디로 찾아요."
    >
      <AppText variant="caption" tone="tertiary">
        프로토타입 테스트 계정입니다. 로스터 계정은 비밀번호가 없어 로그인할 수 없어요.
      </AppText>

      <StatTiles testID="users-kpi" stats={stats} />

      <Chips
        testID="users-role"
        options={options}
        value={role}
        onChange={(r) => {
          setRole(r);
          setPage(0);
        }}
      />
      <Field
        testID="users-search"
        label="이름·스코디 아이디 검색"
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          setPage(0);
        }}
        placeholder="예: 박도윤, doyun"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Section title={`목록 (${filtered.length.toLocaleString('en-US')}명)`}>
        <Group>
          {pageItems.length ? (
            pageItems.map((a) => {
              const roles = a.roles.map((r) => ROLE_LABEL[r]).join('/');
              const academy = a.academyName ?? academyByStudent[a.userId];
              const plan = a.entitlements.length
                ? a.entitlements
                    .map((e) =>
                      e.kind === 'personal'
                        ? `개인(${e.payer === 'parent' ? '학부모' : '학생'})`
                        : '학원',
                    )
                    .join(', ')
                : '이용권 없음';
              return (
                <Row
                  key={a.userId}
                  testID={`user-row-${a.userId}`}
                  title={`${a.name} · ${roles}`}
                  subtitle={`${a.scodyId}${academy ? ` · ${academy}` : ''}`}
                  meta={plan}
                />
              );
            })
          ) : (
            <Row title="검색 결과가 없어요" subtitle="역할이나 검색어를 바꿔 보세요" />
          )}
        </Group>
        <Pager
          testID="users-pager"
          total={filtered.length}
          page={page}
          pageSize={PAGE_SIZE}
          unit="명"
          onChange={setPage}
        />
      </Section>
    </Screen>
  );
}
