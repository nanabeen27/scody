import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  Screen,
  Section,
  Group,
  Row,
  AppText,
  AccountSettings,
  Button,
  Field,
} from '@/components';
import { useCurrentAccount } from '@/session';
import { getClassesForAccount, INVITES } from '@/data';
import { useAcademyStaff } from '@/features/academy';
import { colors, spacing } from '@/theme/tokens';

const TEACHER_PAGE = 12;

const INVITE_LABEL: Record<string, string> = { student: '학생', parent: '학부모', teacher: '선생님' };

/** 학원 관리: 원장은 초대·요금제, 선생님은 담당 반 안내(권한 분기). */
export default function AcademyManage() {
  const account = useCurrentAccount();
  const isDirector = account.academyRole === 'director';
  const { teachers, addTeacher, removeTeacher } = useAcademyStaff();
  const classes = getClassesForAccount(account);
  const seatCount = new Set(classes.flatMap((c) => c.studentIds)).size;

  const [query, setQuery] = useState('');
  const [showAllTeachers, setShowAllTeachers] = useState(false);
  const [newName, setNewName] = useState('');
  const [newId, setNewId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return teachers;
    return teachers.filter((t) => t.name.includes(q) || t.scodyId.includes(q));
  }, [teachers, query]);
  const visibleTeachers = showAllTeachers ? filtered : filtered.slice(0, TEACHER_PAGE);

  function onAdd() {
    const result = addTeacher({ name: newName, scodyId: newId });
    if (!result.ok) {
      setError(result.error ?? '선생님을 추가하지 못했어요.');
      setAdded(null);
      return;
    }
    setError(null);
    setAdded(newName.trim());
    setNewName('');
    setNewId('');
  }

  if (!isDirector) {
    return (
      <Screen wide testID="academy-manage" title="학원 관리">
        <Group>
          <View style={{ padding: spacing.lg, gap: spacing.xs }}>
            <AppText variant="label">담당 반 관리에 집중해 주세요</AppText>
            <AppText variant="caption" tone="secondary">
              선생님 초대와 요금제 관리는 원장이 담당해요.
            </AppText>
          </View>
        </Group>
        <AccountSettings />
      </Screen>
    );
  }

  return (
    <Screen wide testID="academy-manage" title="학원 관리">
      <Section title="초대">
        <Group>
          {INVITES.filter((i) => i.academyName === account.academyName).map((i) => (
            <Row
              key={i.token}
              title={`${INVITE_LABEL[i.invitee]} 초대`}
              subtitle={`링크 /join?invite=${i.token}`}
              meta="복사"
            />
          ))}
        </Group>
      </Section>

      <Section title={`선생님 ${teachers.length}명`}>
        <Field
          label="이름·아이디로 찾기"
          testID="teacher-search"
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setShowAllTeachers(false);
          }}
          placeholder="예: 김민준 또는 hanbit.t01"
        />
        <Group>
          {visibleTeachers.map((t) => {
            const isSelf = t.userId === account.userId;
            const removing = confirmRemove === t.userId;
            return (
              <Row
                key={t.userId}
                title={t.name}
                subtitle={t.scodyId}
                meta={isSelf ? '원장(나)' : removing ? '정말 제외할까요?' : '선생님'}
                trailing={
                  isSelf ? undefined : removing ? (
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <Button
                        testID={`teacher-remove-confirm-${t.scodyId}`}
                        variant="ghost"
                        label="제외"
                        onPress={() => {
                          removeTeacher(t.userId);
                          setConfirmRemove(null);
                        }}
                      />
                      <Button variant="ghost" label="취소" onPress={() => setConfirmRemove(null)} />
                    </View>
                  ) : (
                    <Button
                      testID={`teacher-remove-${t.scodyId}`}
                      variant="ghost"
                      label="제외하기"
                      onPress={() => setConfirmRemove(t.userId)}
                    />
                  )
                }
              />
            );
          })}
        </Group>
        {filtered.length === 0 ? (
          <AppText variant="caption" tone="secondary">
            찾는 선생님이 없어요.
          </AppText>
        ) : null}
        {!showAllTeachers && filtered.length > TEACHER_PAGE ? (
          <Button
            testID="teacher-more"
            variant="ghost"
            label={`${filtered.length - TEACHER_PAGE}명 더 보기`}
            onPress={() => setShowAllTeachers(true)}
          />
        ) : null}
      </Section>

      <Section title="선생님 추가">
        <Field label="이름" testID="teacher-new-name" value={newName} onChangeText={setNewName} placeholder="예: 김선생" />
        <Field
          label="스코디 아이디"
          testID="teacher-new-id"
          value={newId}
          onChangeText={setNewId}
          placeholder="예: hanbit.newteacher"
        />
        {error ? (
          <AppText variant="caption" style={{ color: colors.danger }}>
            {error}
          </AppText>
        ) : null}
        {added ? (
          <AppText variant="caption" tone="accent">
            {added} 선생님을 추가했어요. 초대 링크를 보내면 본인 계정으로 로그인할 수 있어요.
          </AppText>
        ) : null}
        <Button testID="teacher-add" label="선생님 추가하기" onPress={onAdd} />
      </Section>

      <Section title="요금제와 이용 인원">
        <Group>
          <Row title="요금제" meta="학원 표준" />
          <Row title="반" meta={`${classes.length}개`} />
          <Row title="이용 인원" meta={`학생 ${seatCount}명`} />
        </Group>
      </Section>

      <AccountSettings />
    </Screen>
  );
}
