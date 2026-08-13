import Feather from '@expo/vector-icons/Feather';
import { colors } from '@/theme/tokens';

/**
 * 아주 단순한 라인 아이콘(Feather). 단색·일관된 스트로크로 토스식 절제된 느낌.
 * 의미 있는 곳에만 쓰고 장식용 남발 금지.
 */
export type IconName =
  | 'home'
  | 'book-open'
  | 'bar-chart-2'
  | 'user'
  | 'users'
  | 'grid'
  | 'edit-3'
  | 'settings'
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-down'
  | 'arrow-up'
  | 'arrow-down'
  | 'arrow-right'
  | 'refresh-cw'
  | 'eye'
  | 'check'
  | 'check-circle'
  | 'check-square'
  | 'minus-circle'
  | 'plus'
  | 'star'
  | 'file-text'
  | 'file-plus'
  | 'credit-card'
  | 'alert-circle'
  | 'activity'
  | 'list'
  | 'smartphone'
  | 'message-circle'
  | 'bookmark'
  | 'copy'
  | 'link'
  | 'trash-2';

export function Icon({
  name,
  size = 20,
  color = colors.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Feather name={name} size={size} color={color} />;
}
