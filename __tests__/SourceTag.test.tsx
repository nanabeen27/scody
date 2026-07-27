import { render, screen } from '@testing-library/react-native';
import { SourceTag } from '@/components';

describe('SourceTag', () => {
  it('개인 학습 라벨을 텍스트로 노출한다', async () => {
    await render(<SourceTag source="personal" />);
    expect(screen.getByText('개인 학습')).toBeTruthy();
  });
  it('학원 과제 라벨을 텍스트로 노출한다', async () => {
    await render(<SourceTag source="academy" />);
    expect(screen.getByText('학원 과제')).toBeTruthy();
  });
});
