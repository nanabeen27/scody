-- 새 표의 익명 SELECT 기본 부여를 걷어낸다.

/*
  **0035가 세운 규칙이다.** Supabase 프로젝트에는
      alter default privileges in schema public grant all on tables to anon
  이 걸려 있어서, 새로 만든 표·뷰는 `anon`이 select를 **그대로 갖는다.** 0034가 좌석 단가 표를
  만들 때 그것을 몰랐고, 0035가 실측으로 확인해 걷어냈다.

  `0037`은 `note_reviews`에 `revoke insert, update, delete, truncate ... from anon, authenticated`만
  했다. select는 남아 있다. **지금 새지는 않는다** — 정책이 `can_read_student(student_id) or
  is_admin()`이고 `auth.uid()`가 null인 익명에는 거짓이라 0행이 나간다. 그러나 그러면 학생이 자기
  말로 쓴 한 줄(`recap`)을 막는 벽이 **RLS 한 겹뿐**이다. 0035의 문장 그대로: 벽을 둘로 만든다.
*/
revoke select on public.note_reviews from anon;
