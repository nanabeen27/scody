/**
 * 오래된 학습 시간 조각을 접는다(A-150).
 *
 *     npm run db:compact            # 60일보다 오래된 날을 접는다
 *     npm run db:compact -- 90      # 90일보다 오래된 날만
 *
 * `study_activity`는 append-only이고 클라이언트가 60초마다 조각을 보낸다. 읽는 것은 **일별 합**
 * 하나뿐이므로(`v_daily_learning_stats`) 오래된 날은 `(학생, 날, 종류)`마다 한 행으로 접어도
 * 화면이 말하는 값이 바뀌지 않는다. 접기 규칙과 그 근거는
 * `supabase/migrations/0048_study_activity_compaction.sql`에 있다.
 *
 * **아직 자동으로 돌지 않는다.** 이 레포에는 스케줄러가 없다 — 그래서 손으로 부르는 자리를
 * 만들어 두고, 스케줄을 붙이는 일은 마스터 플랜 남은 작업에 남긴다.
 *
 * **소유자 접속으로 부른다.** 함수의 실행 권한을 앱 역할에서 회수했다 — 지우는 함수를
 * 클라이언트에 열 이유가 없다.
 *
 * 접기 전후의 **일별 합이 같은지 이 스크립트가 확인한다.** 함수 안에도 같은 검사가 있지만
 * (다르면 예외로 되돌린다) 그쪽은 구간 총합이고 여기서는 **날짜별로** 본다 — 총합이 같아도
 * 날짜가 섞이면 잔디와 주간 비교가 달라진다.
 */
import { type Client } from 'pg';
import { ownerClient, requireEnv } from './_verify';

requireEnv();

const keepDays = Number(process.argv[2] ?? 60);
if (!Number.isFinite(keepDays) || keepDays < 0) {
  console.error('사용법: npm run db:compact -- [보관일수]');
  process.exit(1);
}

interface DaySum {
  student_id: string;
  occurred_on: string;
  total: string;
}

async function daySums(db: Client): Promise<Map<string, string>> {
  const { rows } = await db.query<DaySum>(
    `select student_id::text, occurred_on::text, sum(active_sec)::text as total
       from public.study_activity group by 1, 2 order by 1, 2`,
  );
  return new Map(rows.map((r) => [`${r.student_id}|${r.occurred_on}`, r.total]));
}

async function main() {
  const db = ownerClient();
  await db.connect();
  try {
    const before = await daySums(db);
    const rowsBefore = (
      await db.query<{ n: string }>(`select count(*)::text as n from public.study_activity`)
    ).rows[0].n;

    const { rows } = await db.query<{ freed: number }>(
      `select public.compact_study_activity($1) as freed`,
      [keepDays],
    );
    const freed = rows[0].freed;

    const after = await daySums(db);
    const rowsAfter = (
      await db.query<{ n: string }>(`select count(*)::text as n from public.study_activity`)
    ).rows[0].n;

    // 날짜별 합이 하나라도 달라지면 통계가 달라진다. 그때는 사실을 말하고 실패로 끝낸다.
    const changed: string[] = [];
    for (const [key, total] of before) {
      if (after.get(key) !== total) changed.push(`${key}: ${total} → ${after.get(key) ?? '없음'}`);
    }
    for (const key of after.keys()) {
      if (!before.has(key)) changed.push(`${key}: 없던 날이 생겼다`);
    }

    console.log(`보관 ${keepDays}일 · 행 ${rowsBefore} → ${rowsAfter}(${freed}행 접음)`);
    if (changed.length > 0) {
      console.error(`\n일별 합이 달라졌어요(${changed.length}건):`);
      for (const line of changed.slice(0, 10)) console.error(`  ${line}`);
      process.exit(1);
    }
    console.log(`일별 합 ${before.size}개가 그대로예요.`);
  } finally {
    await db.end();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
