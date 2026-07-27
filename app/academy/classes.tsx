import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Screen, Group, Row, AppText, Button, Field } from '@/components';
import { useCurrentAccount } from '@/session';
import { getClassesForAccount } from '@/data';
import { spacing } from '@/theme/tokens';

const PAGE = 12;

/** 반·학생: 담당(원장은 전체) 반 목록. 반이 많은 학원을 위해 검색과 더보기를 둔다. */
export default function AcademyClasses() {
  const router = useRouter();
  const account = useCurrentAccount();
  const classes = getClassesForAccount(account);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return classes;
    return classes.filter((c) => c.name.includes(q));
  }, [classes, query]);
  const visible = showAll ? filtered : filtered.slice(0, PAGE);
  const studentCount = useMemo(() => new Set(classes.flatMap((c) => c.studentIds)).size, [classes]);

  return (
    <Screen wide testID="academy-classes" title="반·학생">
      {classes.length === 0 ? (
        <Group>
          <View style={{ padding: spacing.lg }}>
            <AppText tone="secondary">담당하는 반이 없어요.</AppText>
          </View>
        </Group>
      ) : (
        <>
          <AppText variant="caption" tone="secondary">
            반 {classes.length}개 · 학생 {studentCount}명
          </AppText>
          {classes.length > PAGE ? (
            <Field
              label="반 이름으로 찾기"
              testID="class-search"
              value={query}
              onChangeText={(v) => {
                setQuery(v);
                setShowAll(false);
              }}
              placeholder="예: 고2"
            />
          ) : null}
          <Group>
            {visible.map((c) => (
              <Row
                key={c.id}
                title={c.name}
                subtitle={`학생 ${c.studentIds.length}명`}
                showChevron
                onPress={() => router.push(`/academy/class/${c.id}` as never)}
              />
            ))}
          </Group>
          {filtered.length === 0 ? (
            <AppText variant="caption" tone="secondary">
              찾는 반이 없어요.
            </AppText>
          ) : null}
          {!showAll && filtered.length > PAGE ? (
            <Button
              testID="class-more"
              variant="ghost"
              label={`반 ${filtered.length - PAGE}개 더 보기`}
              onPress={() => setShowAll(true)}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}
