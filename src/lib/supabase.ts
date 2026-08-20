import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import type { Database } from './database.types';

/**
 * Supabase 클라이언트. **앱 전체에 하나만 둔다.**
 *
 * 두 개를 만들면 인증 상태를 각자 들고 있어서 한쪽에서 로그아웃해도 다른 쪽이 살아 있는다.
 * 화면과 상태 provider는 `src/repo/*`를 거치고, 이 파일을 직접 import하지 않는다.
 *
 * ## 키
 *
 * `EXPO_PUBLIC_*`은 번들에 그대로 실린다. anon 키는 **그렇게 쓰도록 만든 공개 키**이고,
 * 실제 권한은 서버의 RLS 정책이 정한다(`supabase/migrations/0015_rls.sql`). service_role 키는
 * 클라이언트에 두지 않는다 — 그 키는 RLS를 통째로 우회한다.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * 연결 정보가 있는지.
 *
 * 없을 때 **모듈을 불러오는 것만으로 앱이 죽지 않게** 한다 — `createClient`는 빈 URL에
 * 예외를 던진다. 화면은 이 값을 보고 `설정이 필요해요`를 말할 수 있다.
 */
export function hasSupabaseConfig(): boolean {
  return !!url && !!anonKey;
}

/**
 * 세션 저장소.
 *
 * 웹은 기본값(localStorage)을 쓴다. 네이티브에는 localStorage가 없어서 AsyncStorage를 준다 —
 * 주지 않으면 앱을 닫을 때마다 로그아웃된다.
 */
const storage = Platform.OS === 'web' ? undefined : AsyncStorage;

/** 생성된 스키마 타입이 붙은 클라이언트. `src/lib/database.types.ts`는 `npm run db:types` 산출물이다. */
export type Db = SupabaseClient<Database>;

let client: Db | null = null;

/**
 * 클라이언트를 얻는다. 설정이 없으면 예외를 던진다 —
 * 부르는 쪽이 `hasSupabaseConfig()`로 먼저 확인한다.
 */
export function supabase(): Db {
  if (!client) {
    if (!url || !anonKey) {
      throw new Error(
        'Supabase 설정이 없어요. .env에 EXPO_PUBLIC_SUPABASE_URL과 EXPO_PUBLIC_SUPABASE_ANON_KEY를 넣어 주세요.',
      );
    }
    client = createClient<Database>(url, anonKey, {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: true,
        /*
          웹에서만 참이다. 카카오 OAuth를 붙이면 리다이렉트 주소의 조각(fragment)에서 세션을
          읽어야 하고, 네이티브는 그 경로가 딥링크라 라우터가 따로 다룬다.
        */
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
    });
  }
  return client;
}

/**
 * 서버가 돌려준 오류를 화면 문장으로 바꾼다.
 *
 * 상태 provider들이 `{ ok, error }`를 돌려주는 계약을 지키고 있어서(`WriteResult`), 그 자리에
 * 넣을 한국어 문장이 필요하다. **RPC가 `raise exception`으로 던진 문장은 그대로 쓴다** — 그
 * 문장들은 이미 사용자에게 보여 줄 말로 쓰여 있다(`supabase/migrations/0013_functions.sql`).
 */
export function errorMessage(error: unknown): string {
  if (!error) return '';
  const raw =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  /*
    PostgREST는 정책 위반을 `new row violates row-level security policy…`처럼 영어로 알린다.
    그 문장을 화면에 그대로 내보내지 않는다 — 학생·학부모가 읽는 자리다.
  */
  if (/row-level security/i.test(raw)) return '권한이 없어요.';
  if (/duplicate key value/i.test(raw)) return '이미 있는 값이에요.';
  if (/JWT|not authenticated|Invalid login/i.test(raw)) return '다시 로그인해 주세요.';
  /*
    로그인 칸이 이메일을 받게 되면서(D-184) `@`가 없는 입력에 GoTrue가 형식 오류를 돌려준다.
    그 문장도 영어이고, 잡지 않으면 아래 `return raw`가 그대로 화면에 내보낸다.
    **화면이 먼저 막지만**(`looksLikeEmail`) 붙여넣기·자동완성으로 새는 길이 남아 여기도 막는다.
  */
  if (/validate email|invalid email|email.*invalid|email_address_invalid/i.test(raw)) {
    return '이메일 주소를 다시 확인해 주세요.';
  }
  if (/Failed to fetch|NetworkError|network request failed/i.test(raw)) {
    return '연결이 끊겼어요. 잠시 뒤 다시 시도해 주세요.';
  }
  return raw;
}
