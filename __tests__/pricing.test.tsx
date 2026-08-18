import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Pressable } from 'react-native';
import { AppText } from '@/components';
import {
  DEFAULT_PRICING,
  PricingProvider,
  usePricing,
  type PricingPolicy,
  type WriteResult,
} from '@/features/pricing';

/**
 * 요금 정책 쓰기 게이트.
 *
 * **이 파일이 지키는 것 하나**: 조회가 끝나기 전에는 값을 바꿀 수 없다. 쓰기는 항목 하나가
 * 아니라 정책 **한 벌 전체**를 새 행으로 쌓으므로(`pricing_policies`는 이력이고 update 정책이
 * 없다), 읽지 못한 값 위에서 한 항목을 올리면 **나머지 여섯 개가 기준값으로 되돌아간 행**이
 * 남는다. 그 변경은 감사 로그에도 `기준값 → 기준값±step`으로 남아 **실제 이전 값이 기록되지
 * 않는다** — 접속기록이 거짓이 된다(D-065).
 *
 * 조회를 붙잡아 두고 그 창에서 `bump`를 부른다. 화면 게이트(`app/admin/billing.tsx`가
 * `loaded`일 때만 `Stepper`를 그린다)와 별개로 상태 함수 자체가 거절해야 한다 —
 * 권한·경계를 화면 숨김만으로 판단하지 않는다(CLAUDE.md).
 */

/** 조회를 원하는 순간에 끝낸다. 그동안 provider는 `loaded`가 아니다. */
let mockResolveRead: ((policy: PricingPolicy) => void) | null = null;
let mockRejectRead: ((reason: Error) => void) | null = null;
const mockSaved: PricingPolicy[] = [];

jest.mock('@/repo/pricing', () => ({
  loadCurrentPricing: () =>
    new Promise((resolve, reject) => {
      mockResolveRead = resolve;
      mockRejectRead = reject;
    }),
  loadPublicPricing: () => Promise.resolve(null),
  loadAcademySeatPricing: () => Promise.resolve(null),
  loadPaymentOffers: () => Promise.resolve([]),
  savePricingPolicy: (next: PricingPolicy): Promise<WriteResult> => {
    mockSaved.push(next);
    return Promise.resolve({ ok: true });
  },
  offerPaymentFor: () => Promise.resolve({ ok: true }),
  cancelPaymentOffer: () => Promise.resolve({ ok: true }),
}));

/** 로그인한 운영자 하나. `PricingProvider`가 세션에서 읽는 것은 이 셋뿐이다. */
jest.mock('@/session', () => ({
  useSession: () => ({
    account: { userId: 'u_admin', roles: ['admin'], name: '스코디 관리자' },
    readOnly: false,
  }),
}));

/** 서버에서 온 정책. 기준값과 모든 항목이 다르다 — 기준값으로 덮이면 눈에 보인다. */
const SERVER_POLICY: PricingPolicy = {
  studentPaid: 21000,
  parentPaid: 31000,
  academySeat: 13500,
  seatDiscountPct: 20,
  seatDiscountFrom: 40,
  annualDiscountPct: 25,
  annualSharePct: 35,
};

let lastResult: WriteResult | null = null;

function Probe() {
  const { policy, loading, loaded, error, bump } = usePricing();
  return (
    <>
      <AppText testID="state">
        {`${loading ? '읽는 중' : '끝'} · ${loaded ? '읽었음' : '못 읽음'} · ${error ?? '오류 없음'}`}
      </AppText>
      <AppText testID="seat">{String(policy.academySeat)}</AppText>
      <Pressable
        testID="bump"
        onPress={() => {
          void bump('academySeat', 1).then((res) => {
            lastResult = res;
          });
        }}
      />
    </>
  );
}

async function mount() {
  lastResult = null;
  mockSaved.length = 0;
  mockResolveRead = null;
  mockRejectRead = null;
  await render(
    <PricingProvider>
      <Probe />
    </PricingProvider>,
  );
  // 효과가 조회를 시작할 때까지 기다린다 — 그 뒤가 결함이 살던 창이다.
  await waitFor(() => expect(mockResolveRead).not.toBeNull());
}

describe('요금 정책 쓰기 게이트', () => {
  it('조회가 끝나기 전에 bump를 부르면 거절한다 — 기준값이 정책을 덮지 않는다', async () => {
    await mount();
    expect(screen.getByTestId('state')).toHaveTextContent('읽는 중 · 못 읽음 · 오류 없음');

    await fireEvent.press(screen.getByTestId('bump'));

    await waitFor(() => expect(lastResult).not.toBeNull());
    expect(lastResult).toEqual({ ok: false, error: '요금 정책을 아직 읽지 못했어요.' });
    // 새 정책 행이 쌓이지 않았다. 이력은 되돌릴 수 없으므로 이것이 핵심 단정이다.
    expect(mockSaved).toHaveLength(0);
    // 화면 값도 그대로다 — 기준값을 서버 값처럼 말하지 않는다.
    expect(screen.getByTestId('seat')).toHaveTextContent(String(DEFAULT_PRICING.academySeat));
  });

  it('조회가 끝난 뒤에는 서버에서 읽은 값 위에서 한 칸 올린다', async () => {
    await mount();
    mockResolveRead?.(SERVER_POLICY);
    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('끝 · 읽었음 · 오류 없음'),
    );
    expect(screen.getByTestId('seat')).toHaveTextContent('13500');

    await fireEvent.press(screen.getByTestId('bump'));

    await waitFor(() => expect(mockSaved).toHaveLength(1));
    expect(lastResult).toEqual({ ok: true });
    /*
      **한 항목만 올라가고 나머지 여섯은 서버 값 그대로다.** 게이트를 되돌리면 조회 전 호출에서
      이 단정이 기준값으로 깨진다.
    */
    expect(mockSaved[0]).toEqual({ ...SERVER_POLICY, academySeat: 14000 });
  });

  it('조회가 실패해도 거절한다 — 가진 값이 서버 값인지 알 수 없다', async () => {
    await mount();
    mockRejectRead?.(new Error('네트워크 연결을 확인해 주세요.'));
    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent(
        '끝 · 못 읽음 · 네트워크 연결을 확인해 주세요.',
      ),
    );

    await fireEvent.press(screen.getByTestId('bump'));

    await waitFor(() => expect(lastResult).not.toBeNull());
    expect(lastResult).toEqual({ ok: false, error: '요금 정책을 아직 읽지 못했어요.' });
    expect(mockSaved).toHaveLength(0);
  });
});
