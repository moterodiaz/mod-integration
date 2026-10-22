-- Permission-matrix capability check for the Banter admin UI.
--
-- WHY THIS EXISTS: a deck replace failed in prod with "new row violates row-level
-- security policy" because bucket banter-decks had SELECT/UPDATE policies on
-- storage.objects but no INSERT policy -- and supabase.storage.update(path, file,
-- {upsert:true}) needs INSERT for its create-if-missing path. Nothing declared
-- what admin/index.html actually requires, so the gap was found by a user in
-- production. This file is that declaration, made checkable.
--
-- RUN: paste into the Supabase SQL editor, or run via the Supabase MCP
-- execute_sql tool against lvnfhgsmwtwztlgmxtap. Strictly read-only -- no DDL,
-- no DML, no credential of any kind. Every row below gets a PASS/FAIL status;
-- failures sort first, so an all-clear run is a short glance at the top row.
--
-- HONEST LIMITS -- this is catalog introspection, not execution:
--   * It proves grants + policy existence + policy command + (for storage)
--     the bucket predicate. It does NOT run the policies, so it cannot prove
--     what PostgREST actually returns for a real JWT.
--   * It cannot see: edge-function logic (dispatch-workflow's verify_jwt +
--     role check, its ALLOWED workflow set), the service-role paths that
--     live in moterodiaz/mod-overhaul, Resend delivery, or a policy whose
--     role-claim expression is subtly wrong (e.g. reading user_metadata
--     instead of app_metadata -- same PASS, different, broken, behavior).
--   * admin auth is magic-link OTP, so no automated end-to-end login exists
--     to go with this -- that stays a manual check.
--   * A policy-coverage check here only proves *a* policy exists for the
--     command; it does not re-verify the policy's own admin-role predicate.
--     Code review covers that; see the honest-limits note above.

with positive_grants as (
  select * from (values
    ('grant: site_config SELECT (authenticated)', has_table_privilege('authenticated', 'public.site_config', 'SELECT')),
    ('grant: site_config UPDATE value (authenticated)', has_column_privilege('authenticated', 'public.site_config', 'value', 'UPDATE')),
    ('grant: site_config UPDATE updated_at (authenticated)', has_column_privilege('authenticated', 'public.site_config', 'updated_at', 'UPDATE')),
    ('grant: survey_responses SELECT (authenticated)', has_table_privilege('authenticated', 'public.survey_responses', 'SELECT')),
    ('grant: deck_publications SELECT (authenticated)', has_table_privilege('authenticated', 'public.deck_publications', 'SELECT')),
    ('grant: deck_publications UPDATE approved (authenticated)', has_column_privilege('authenticated', 'public.deck_publications', 'approved', 'UPDATE')),
    ('grant: deck_publications UPDATE approved_at (authenticated)', has_column_privilege('authenticated', 'public.deck_publications', 'approved_at', 'UPDATE')),
    ('grant: deck_publications UPDATE generated_at (authenticated)', has_column_privilege('authenticated', 'public.deck_publications', 'generated_at', 'UPDATE')),
    ('grant: matches SELECT (authenticated)', has_table_privilege('authenticated', 'public.matches', 'SELECT')),
    ('grant: replace_matches(jsonb) EXECUTE (authenticated)', has_function_privilege('authenticated', 'public.replace_matches(jsonb)', 'EXECUTE')),
    ('grant: storage.objects SELECT (authenticated)', has_table_privilege('authenticated', 'storage.objects', 'SELECT')),
    ('grant: storage.objects UPDATE (authenticated)', has_table_privilege('authenticated', 'storage.objects', 'UPDATE')),
    ('grant: storage.objects INSERT (authenticated)', has_table_privilege('authenticated', 'storage.objects', 'INSERT'))
  ) as t(expectation, ok)
),

-- anon key is public in js/banter.js -- these must hold regardless of RLS,
-- because grants are checked before RLS ever runs.
negative_grants as (
  select * from (values
    ('negative grant: anon SELECT survey_responses must be denied', not has_table_privilege('anon', 'public.survey_responses', 'SELECT')),
    ('negative grant: anon SELECT matches must be denied', not has_table_privilege('anon', 'public.matches', 'SELECT')),
    ('negative grant: anon SELECT deck_publications must be denied', not has_table_privilege('anon', 'public.deck_publications', 'SELECT')),
    ('negative grant: anon UPDATE site_config must be denied', not has_table_privilege('anon', 'public.site_config', 'UPDATE')),
    ('negative grant: anon EXECUTE replace_matches must be denied', not has_function_privilege('anon', 'public.replace_matches(jsonb)', 'EXECUTE'))
  ) as t(expectation, ok)
),

-- A disabled-RLS table passes a naive "policy exists" check while being wide
-- open to anyone holding a grant -- so RLS being ON is checked independently.
rls_enabled as (
  select 'rls enabled: ' || n.nspname || '.' || c.relname as expectation, c.relrowsecurity as ok
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where (n.nspname, c.relname) in (
    ('public', 'site_config'), ('public', 'survey_responses'),
    ('public', 'deck_publications'), ('public', 'matches'),
    ('storage', 'objects')
  )
),

policy_coverage as (
  select * from (values
    ('policy: site_config has a SELECT policy', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'site_config' and cmd in ('SELECT', 'ALL'))),
    ('policy: site_config has an UPDATE policy', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'site_config' and cmd in ('UPDATE', 'ALL'))),
    ('policy: survey_responses has a SELECT policy', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'survey_responses' and cmd in ('SELECT', 'ALL'))),
    ('policy: deck_publications has a SELECT policy', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'deck_publications' and cmd in ('SELECT', 'ALL'))),
    ('policy: deck_publications has an UPDATE policy', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'deck_publications' and cmd in ('UPDATE', 'ALL'))),
    ('policy: matches has a SELECT policy', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'matches' and cmd in ('SELECT', 'ALL')))
  ) as t(expectation, ok)
),

-- A deck policy that lost its bucket predicate would grant admins every
-- bucket, not just banter-decks -- that's a security regression, not a pass.
storage_policy as (
  select * from (values
    ('policy: storage.objects SELECT scoped to banter-decks', exists (
      select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd in ('SELECT', 'ALL')
      and (qual ilike '%banter-decks%' or with_check ilike '%banter-decks%'))),
    ('policy: storage.objects UPDATE scoped to banter-decks', exists (
      select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd in ('UPDATE', 'ALL')
      and (qual ilike '%banter-decks%' or with_check ilike '%banter-decks%'))),
    ('policy: storage.objects INSERT scoped to banter-decks', exists (
      select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd in ('INSERT', 'ALL')
      and (qual ilike '%banter-decks%' or with_check ilike '%banter-decks%')))
  ) as t(expectation, ok)
),

-- Decks are private; the public /decks/ page only ever sees signed URLs
-- minted by the mentor-decks edge function under the service-role key.
storage_negative as (
  select 'negative policy: anon has no storage.objects policy' as expectation,
    not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and 'anon' = any(roles)) as ok
),

-- Three failure modes that would be invisible to every check above:
-- a bypass-RLS role makes every policy decorative, a revoked schema USAGE
-- breaks everything while every table grant still reads green, and
-- PostgREST binds RPC args by NAME -- renaming the parameter keeps EXECUTE
-- intact and silently 404s admin/index.html's only write path to matches.
invisible_failure_modes as (
  select * from (values
    ('role: anon cannot bypass RLS', not (select rolbypassrls or rolsuper from pg_roles where rolname = 'anon')),
    ('role: authenticated cannot bypass RLS', not (select rolbypassrls or rolsuper from pg_roles where rolname = 'authenticated')),
    ('schema: authenticated has USAGE on public', has_schema_privilege('authenticated', 'public', 'USAGE')),
    ('schema: authenticated has USAGE on storage', has_schema_privilege('authenticated', 'storage', 'USAGE')),
    ('schema: anon has USAGE on public', has_schema_privilege('anon', 'public', 'USAGE')),
    ('rpc: replace_matches parameter still named "rows" (admin/index.html:1169 calls sb.rpc with { rows })',
      exists (select 1 from pg_proc where oid = to_regprocedure('public.replace_matches(jsonb)') and proargnames = array['rows']))
  ) as t(expectation, ok)
)

select
  case when ok then 'PASS' else 'FAIL' end as status,
  expectation
from (
  select * from positive_grants
  union all select * from negative_grants
  union all select * from rls_enabled
  union all select * from policy_coverage
  union all select * from storage_policy
  union all select * from storage_negative
  union all select * from invisible_failure_modes
) all_checks
order by ok asc, expectation;
