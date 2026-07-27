import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { spacing } from '@/theme/tokens';

/** 제목이 있는 섹션 묶음. */
export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <AppText variant="subheading">{title}</AppText> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
});
