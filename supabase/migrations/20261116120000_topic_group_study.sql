-- Dated curriculum-group completion and read-time TYT study analysis.
-- Additive: no catalog, question, answer, or official result rows are changed.
begin;

create table public.topic_group_study (
  group_id uuid primary key references public.topic_groups(id) on delete restrict,
  completed_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.topic_group_study enable row level security;
revoke all on public.topic_group_study from public, anon, authenticated;
grant select, insert, update, delete on public.topic_group_study to service_role;

create or replace function public.topic_study_catalog()
returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'parent_id', s.parent_id, 'display_order', s.display_order) order by s.display_order, s.id)
      from public.subjects s where s.exam_type='TYT'
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'subject_id', g.subject_id, 'name', g.name,
        'display_order', g.display_order, 'completed_on', study.completed_on
      ) order by s.display_order, g.display_order, g.id)
      from public.topic_groups g
      join public.subjects s on s.id=g.subject_id
      left join public.topic_group_study study on study.group_id=g.id
      where s.exam_type='TYT'
    ), '[]'::jsonb),
    'exams', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'exam_date', e.exam_date) order by e.exam_date, e.id)
      from public.exams e where e.exam_type='TYT'
    ), '[]'::jsonb)
  )
$$;

create or replace function public.set_topic_group_study(target_groups uuid[], completed_on date, overwrite boolean, admin_session_hash text)
returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare requested integer; saved integer;
begin
  if not exists(select 1 from public.app_sessions where token_hash=admin_session_hash and role='admin' and expires_at>now()) then raise exception 'ADMIN_REQUIRED'; end if;
  if $2 is null or not isfinite($2) or $2 > (now() at time zone 'Europe/Istanbul')::date then raise exception 'INVALID_COMPLETION_DATE'; end if;
  if target_groups is null or cardinality(target_groups)=0 then raise exception 'EMPTY_GROUPS'; end if;
  if overwrite is null then raise exception 'INVALID_OVERWRITE'; end if;
  perform pg_advisory_xact_lock(73242341);
  if exists (
    select 1 from unnest(target_groups) requested_id
    left join public.topic_groups g on g.id=requested_id
    where g.id is null
  ) then raise exception 'GROUP_NOT_FOUND'; end if;
  select count(distinct id)::int into requested from unnest(target_groups) id;
  insert into public.topic_group_study as study (group_id, completed_on)
    select distinct id, $2 from unnest(target_groups) id where true
    on conflict (group_id) do update set completed_on=excluded.completed_on, updated_at=now()
    where $3;
  get diagnostics saved = row_count;
  return jsonb_build_object('status','saved','saved',saved,'skipped',requested-saved);
end $$;

create or replace function public.clear_topic_group_study(target_group uuid, admin_session_hash text)
returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare cleared boolean;
begin
  if not exists(select 1 from public.app_sessions where token_hash=admin_session_hash and role='admin' and expires_at>now()) then raise exception 'ADMIN_REQUIRED'; end if;
  perform pg_advisory_xact_lock(73242341);
  if not exists(select 1 from public.topic_groups where id=target_group) then raise exception 'GROUP_NOT_FOUND'; end if;
  delete from public.topic_group_study where group_id=target_group;
  cleared := found;
  return jsonb_build_object('status','cleared','group_id',target_group,'cleared',cleared);
end $$;

-- Stable SQL functions read all CTEs from one snapshot. Buckets are deliberately
-- computed here, never persisted; the order of this CASE is the product rule.
create or replace function public.tyt_study_analysis(target_exam uuid, include_questions boolean)
returns jsonb
language sql stable security invoker set search_path='' as $$
  with exam as (
    select e.id, e.exam_date, e.total_questions from public.exams e
    where e.id=target_exam and e.exam_type='TYT'
  ), classified as (
    select q.id, q.subject_id, q.question_number, q.correct_answer, q.selected_answer,
      g.id as group_id, g.name as group_name, study.completed_on,
      case
        when q.correct_answer='İPTAL' then 'cancelled'
        when g.id is null then 'unmapped'
        when study.group_id is null then 'missing_completion'
        when e.exam_date=study.completed_on then 'same_day'
        when e.exam_date<study.completed_on then 'pre_study'
        else 'post_study'
      end as bucket
    from exam e
    join public.exam_questions q on q.exam_id=e.id
    join public.topics t on t.id=q.topic_id
    left join public.topic_groups g on g.id=t.group_id
    left join public.topic_group_study study on study.group_id=g.id
  ), availability as (
    select exists(select 1 from exam) as exam_exists,
      exists(select 1 from public.topic_group_study) as has_study_records,
      -- Match the importer's complete physical-question intervals. A partial
      -- report must not look like a small but successful analysis.
      exists(select 1 from exam e where
        (select count(*) from classified)=e.total_questions
        and not exists (
          select 1 from public.subjects s
          left join classified q on q.subject_id=s.id
          where s.exam_type='TYT' and s.expected_questions>0
          group by s.id, s.expected_questions
          having count(q.id)<>s.expected_questions
            or min(q.question_number)<>case s.id when 'tyt_geometry' then 31 when 'tyt_geography' then 6 when 'tyt_philosophy' then 11 when 'tyt_religion' then 16 when 'tyt_chemistry' then 8 when 'tyt_biology' then 15 else 1 end
            or max(q.question_number)<>case s.id when 'tyt_geometry' then 40 when 'tyt_geography' then 10 when 'tyt_philosophy' then 15 when 'tyt_religion' then 20 when 'tyt_chemistry' then 14 when 'tyt_biology' then 20 else s.expected_questions end
        )
      ) as usable
  )
  select jsonb_build_object(
    'exam_id', target_exam,
    'exam_date', (select exam_date from exam),
    'has_study_records', a.has_study_records
  ) || case when not a.usable then jsonb_build_object(
    'status', 'unavailable',
    'reason', case when a.exam_exists then 'incomplete_questions' else 'exam_not_found' end,
    'counts', null, 'post_study', null
  ) else jsonb_build_object(
    'status', 'available',
    'counts', (select jsonb_build_object(
      'cancelled', count(*) filter (where bucket='cancelled'),
      'unmapped', count(*) filter (where bucket='unmapped'),
      'missing_completion', count(*) filter (where bucket='missing_completion'),
      'same_day', count(*) filter (where bucket='same_day'),
      'pre_study', count(*) filter (where bucket='pre_study'),
      'post_study', count(*) filter (where bucket='post_study')
    ) from classified),
    'post_study', (select jsonb_build_object(
      'correct', count(*) filter (where bucket='post_study' and selected_answer=correct_answer),
      'wrong', count(*) filter (where bucket='post_study' and selected_answer is not null and selected_answer<>correct_answer),
      'blank', count(*) filter (where bucket='post_study' and selected_answer is null)
    ) from classified)
  ) || case when include_questions then jsonb_build_object(
    'questions', (select jsonb_agg(jsonb_build_object(
      'id', q.id, 'bucket', q.bucket, 'group_id', q.group_id,
      'group_name', q.group_name, 'completed_on', q.completed_on
    ) order by s.display_order, q.question_number, q.id)
    from classified q join public.subjects s on s.id=q.subject_id)
  ) else '{}'::jsonb end end
  from availability a
$$;

revoke all on function
  public.topic_study_catalog(),
  public.set_topic_group_study(uuid[], date, boolean, text),
  public.clear_topic_group_study(uuid, text),
  public.tyt_study_analysis(uuid, boolean)
from public, anon, authenticated;
grant execute on function
  public.topic_study_catalog(),
  public.set_topic_group_study(uuid[], date, boolean, text),
  public.clear_topic_group_study(uuid, text),
  public.tyt_study_analysis(uuid, boolean)
to service_role;
commit;
