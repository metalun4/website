-- Topic groups, aliases, and cross-exam topic statistics.
-- Additive and idempotent. Safe when topic_groups and topics.group_id already exist.
-- Does not change existing topics.group_id values or exam question rows.
-- Do not rerun 20261028135230_tyt_pdf_import.sql.
begin;

create table if not exists public.topic_groups (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects(id),
  name text not null,
  normalized_name text not null,
  display_order smallint not null
);

do $$ begin
  alter table public.topic_groups add constraint topic_groups_name_check check (length(btrim(name)) between 1 and 300);
exception when duplicate_object or duplicate_table then null;
end $$;
do $$ begin
  alter table public.topic_groups add constraint topic_groups_check check (normalized_name = public.normalize_topic_label(name));
exception when duplicate_object or duplicate_table then null;
end $$;
do $$ begin
  alter table public.topic_groups add constraint topic_groups_display_order_check check (display_order > 0);
exception when duplicate_object or duplicate_table then null;
end $$;
do $$ begin
  alter table public.topic_groups add constraint topic_groups_subject_id_normalized_name_key unique (subject_id, normalized_name);
exception when duplicate_object or duplicate_table then null;
end $$;
do $$ begin
  alter table public.topic_groups add constraint topic_groups_id_subject_id_key unique (id, subject_id);
exception when duplicate_object or duplicate_table then null;
end $$;

alter table public.topics add column if not exists group_id uuid;
create index if not exists topics_group_idx on public.topics (group_id);
do $$ begin
  alter table public.topics add constraint topics_group_subject_fk foreign key (group_id, subject_id) references public.topic_groups (id, subject_id);
exception when duplicate_object or duplicate_table then null;
end $$;

create or replace function public.check_direct_subject() returns trigger
language plpgsql set search_path='' as $$
declare s public.subjects; e_type text;
begin
 select * into strict s from public.subjects where id=new.subject_id;
 if tg_table_name in ('exam_questions','topics','topic_groups') and s.expected_questions=0 then raise exception 'DIRECT_SUBJECT_REQUIRED'; end if;
 if tg_table_name not in ('topics','topic_groups') then
  select exam_type into strict e_type from public.exams where id=new.exam_id;
  if e_type<>s.exam_type then raise exception 'SUBJECT_EXAM_TYPE'; end if;
 end if;
 return new;
end $$;
drop trigger if exists topic_group_subject_check on public.topic_groups;
create trigger topic_group_subject_check before insert or update on public.topic_groups
for each row execute function public.check_direct_subject();

alter table public.topic_groups enable row level security;
revoke all on public.topic_groups from public, anon, authenticated;
grant select, insert, update, delete on public.topic_groups to service_role;

create table if not exists public.topic_aliases (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects(id),
  group_id uuid not null,
  alias text not null check (length(btrim(alias)) between 1 and 300 and alias !~ '[[:cntrl:]]'),
  normalized_name text not null check (normalized_name = public.normalize_topic_label(alias)),
  created_at timestamptz not null default now(),
  unique (subject_id, normalized_name),
  foreign key (group_id, subject_id) references public.topic_groups (id, subject_id)
);
create index if not exists topic_aliases_group_idx on public.topic_aliases (group_id);

create or replace function public.check_topic_alias() returns trigger
language plpgsql set search_path='' as $$
begin
  if exists (
    select 1 from public.topic_groups g
    where g.subject_id = new.subject_id and g.normalized_name = new.normalized_name
  ) then
    raise exception 'ALIAS_MATCHES_GROUP';
  end if;
  return new;
end $$;
drop trigger if exists topic_alias_check on public.topic_aliases;
create trigger topic_alias_check before insert or update on public.topic_aliases
for each row execute function public.check_topic_alias();

alter table public.topic_aliases enable row level security;
revoke all on public.topic_aliases from public, anon, authenticated;
grant select, insert, update, delete on public.topic_aliases to service_role;

insert into public.topic_groups (subject_id, name, normalized_name, display_order)
select v.subject_id, v.name, public.normalize_topic_label(v.name), v.display_order
from (values
{{GROUPS}}
) as v(subject_id, name, display_order)
on conflict (subject_id, normalized_name) do nothing;

insert into public.topic_aliases (subject_id, group_id, alias, normalized_name)
select v.subject_id, g.id, v.alias, public.normalize_topic_label(v.alias)
from (values
{{ALIASES}}
) as v(subject_id, group_name, alias)
join public.topic_groups g
  on g.subject_id = v.subject_id
 and g.normalized_name = public.normalize_topic_label(v.group_name)
on conflict (subject_id, normalized_name) do nothing;

create or replace function public.resolve_topic_group(subject text, label text)
returns uuid
language sql stable security invoker set search_path='' as $$
  select (array_agg(distinct hit))[1]
  from (
    select g.id as hit
    from public.topic_groups g
    where g.subject_id = subject and g.normalized_name = public.normalize_topic_label(label)
    union
    select a.group_id
    from public.topic_aliases a
    where a.subject_id = subject and a.normalized_name = public.normalize_topic_label(label)
  ) matches
  having count(distinct hit) = 1
$$;

create or replace function public.tyt_exam_ids(exam_limit integer)
returns uuid[]
language plpgsql stable security invoker set search_path='' as $$
begin
  if exam_limit is not null and exam_limit not in (5, 10) then raise exception 'INVALID_RANGE'; end if;
  if exam_limit is null then
    return coalesce((select array_agg(id order by exam_date, id) from public.exams where exam_type='TYT'), '{}');
  end if;
  return coalesce((
    select array_agg(id order by exam_date, id) from (
      select id, exam_date from public.exams
      where exam_type='TYT'
      order by exam_date desc, id desc
      limit exam_limit
    ) recent
  ), '{}');
end $$;

create or replace function public.tyt_topic_analysis(exam_limit integer)
returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare selected uuid[];
begin
  selected := public.tyt_exam_ids(exam_limit);
  return jsonb_build_object(
    'exam_total', (select count(*)::int from public.exams where exam_type='TYT'),
    'exams', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'exam_date', e.exam_date) order by e.exam_date, e.id)
      from public.exams e where e.id = any(selected)
    ), '[]'::jsonb),
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'parent_id', s.parent_id, 'display_order', s.display_order) order by s.display_order)
      from public.subjects s where s.exam_type='TYT'
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'subject_id', g.subject_id, 'name', g.name, 'display_order', g.display_order) order by s.display_order, g.display_order)
      from public.topic_groups g
      join public.subjects s on s.id = g.subject_id
      where s.exam_type='TYT'
    ), '[]'::jsonb),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'subject_id', t.subject_id,
        'group_id', t.group_id,
        'needs_review', t.needs_review,
        'valid', coalesce(c.valid, 0),
        'correct', coalesce(c.correct, 0),
        'wrong', coalesce(c.wrong, 0),
        'blank', coalesce(c.blank, 0),
        'cancelled', coalesce(c.cancelled, 0),
        'exam_ids', coalesce(c.exam_ids, '[]'::jsonb)
      ) order by t.subject_id, t.name)
      from public.topics t
      join public.subjects s on s.id = t.subject_id and s.exam_type='TYT'
      left join (
        select q.topic_id,
          count(*) filter (where q.correct_answer <> 'İPTAL')::int as valid,
          count(*) filter (where q.correct_answer <> 'İPTAL' and q.selected_answer = q.correct_answer)::int as correct,
          count(*) filter (where q.correct_answer <> 'İPTAL' and q.selected_answer is not null and q.selected_answer <> q.correct_answer)::int as wrong,
          count(*) filter (where q.correct_answer <> 'İPTAL' and q.selected_answer is null)::int as blank,
          count(*) filter (where q.correct_answer = 'İPTAL')::int as cancelled,
          coalesce(jsonb_agg(distinct q.exam_id) filter (where q.correct_answer <> 'İPTAL'), '[]'::jsonb) as exam_ids
        from public.exam_questions q
        where q.exam_id = any(selected)
        group by q.topic_id
      ) c on c.topic_id = t.id
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.topic_exam_breakdown(target_topic uuid, exam_limit integer)
returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare selected uuid[];
begin
  if target_topic is null then raise exception 'TOPIC_NOT_FOUND'; end if;
  selected := public.tyt_exam_ids(exam_limit);
  return jsonb_build_object(
    'topic', (
      select jsonb_build_object(
        'id', t.id, 'name', t.name, 'subject_id', t.subject_id, 'group_id', t.group_id,
        'group_name', g.name, 'needs_review', t.needs_review
      )
      from public.topics t
      left join public.topic_groups g on g.id = t.group_id
      where t.id = target_topic
    ),
    'exams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'name', e.name, 'exam_date', e.exam_date,
        'valid', c.valid, 'correct', c.correct, 'wrong', c.wrong, 'blank', c.blank, 'cancelled', c.cancelled,
        'questions', c.questions
      ) order by e.exam_date, e.id)
      from public.exams e
      join (
        select q.exam_id,
          count(*) filter (where q.correct_answer <> 'İPTAL')::int as valid,
          count(*) filter (where q.correct_answer <> 'İPTAL' and q.selected_answer = q.correct_answer)::int as correct,
          count(*) filter (where q.correct_answer <> 'İPTAL' and q.selected_answer is not null and q.selected_answer <> q.correct_answer)::int as wrong,
          count(*) filter (where q.correct_answer <> 'İPTAL' and q.selected_answer is null)::int as blank,
          count(*) filter (where q.correct_answer = 'İPTAL')::int as cancelled,
          jsonb_agg(jsonb_build_object(
            'question_number', q.question_number,
            'subject_id', q.subject_id,
            'correct_answer', q.correct_answer,
            'selected_answer', nullif(btrim(q.selected_answer::text), ''),
            'solution_url', q.solution_url
          ) order by q.question_number) as questions
        from public.exam_questions q
        where q.topic_id = target_topic and q.exam_id = any(selected)
        group by q.exam_id
      ) c on c.exam_id = e.id
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.topic_admin_catalog()
returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
  return public.tyt_topic_analysis(null) || jsonb_build_object('aliases', coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'subject_id', a.subject_id, 'group_id', a.group_id, 'alias', a.alias) order by a.subject_id, a.alias)
    from public.topic_aliases a
  ), '[]'::jsonb));
end $$;

create or replace function public.assign_topic_group(target_topic uuid, target_group uuid, admin_session_hash text)
returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare topic public.topics; destination public.topic_groups;
begin
  if not exists(select 1 from public.app_sessions where token_hash=admin_session_hash and role='admin' and expires_at>now()) then raise exception 'ADMIN_REQUIRED'; end if;
  perform pg_advisory_xact_lock(73242341);
  select * into topic from public.topics where id=target_topic;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  if target_group is null then
    update public.topics set group_id=null where id=target_topic;
    delete from public.topic_aliases where subject_id=topic.subject_id and normalized_name=topic.normalized_name;
    return jsonb_build_object('status','unassigned','topic_id',target_topic);
  end if;
  select * into destination from public.topic_groups where id=target_group;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if destination.subject_id is distinct from topic.subject_id then raise exception 'SUBJECT_MISMATCH'; end if;
  update public.topics set group_id=target_group where id=target_topic;
  if topic.normalized_name = destination.normalized_name
     or exists(select 1 from public.topic_groups g where g.subject_id=topic.subject_id and g.normalized_name=topic.normalized_name) then
    delete from public.topic_aliases where subject_id=topic.subject_id and normalized_name=topic.normalized_name;
  else
    insert into public.topic_aliases (subject_id, group_id, alias, normalized_name)
    values (topic.subject_id, target_group, topic.name, topic.normalized_name)
    on conflict (subject_id, normalized_name) do update set group_id=excluded.group_id, alias=excluded.alias;
  end if;
  return jsonb_build_object('status','assigned','topic_id',target_topic,'group_id',target_group);
end $$;

create or replace function public.save_topic_alias(target_alias uuid, target_subject text, target_group uuid, alias_text text, admin_session_hash text)
returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare destination public.topic_groups; normalized text; saved uuid; existing_topic public.topics;
begin
  if not exists(select 1 from public.app_sessions where token_hash=admin_session_hash and role='admin' and expires_at>now()) then raise exception 'ADMIN_REQUIRED'; end if;
  if alias_text is null or length(btrim(alias_text)) not between 1 and 300 or alias_text ~ '[[:cntrl:]]' then raise exception 'INVALID_ALIAS'; end if;
  perform pg_advisory_xact_lock(73242341);
  select * into destination from public.topic_groups where id=target_group;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  if destination.subject_id is distinct from target_subject then raise exception 'SUBJECT_MISMATCH'; end if;
  normalized := public.normalize_topic_label(btrim(alias_text));
  if normalized = '' then raise exception 'INVALID_ALIAS'; end if;
  if exists(select 1 from public.topic_groups g where g.subject_id=target_subject and g.normalized_name=normalized) then raise exception 'ALIAS_MATCHES_GROUP'; end if;
  select * into existing_topic from public.topics t where t.subject_id=target_subject and t.normalized_name=normalized;
  if found and existing_topic.group_id is not null and existing_topic.group_id is distinct from target_group then raise exception 'ALIAS_TOPIC_CONFLICT'; end if;
  if target_alias is null then
    insert into public.topic_aliases (subject_id, group_id, alias, normalized_name)
    values (target_subject, target_group, btrim(alias_text), normalized)
    on conflict (subject_id, normalized_name) do update set group_id=excluded.group_id, alias=excluded.alias
    returning id into saved;
  else
    update public.topic_aliases
      set subject_id=target_subject, group_id=target_group, alias=btrim(alias_text), normalized_name=normalized
      where id=target_alias
      returning id into saved;
    if saved is null then raise exception 'ALIAS_NOT_FOUND'; end if;
  end if;
  if existing_topic.id is not null and existing_topic.group_id is null then
    update public.topics set group_id=target_group where id=existing_topic.id;
  end if;
  return jsonb_build_object('status','saved','alias_id',saved);
end $$;

create or replace function public.delete_topic_alias(target_alias uuid, admin_session_hash text)
returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.app_sessions where token_hash=admin_session_hash and role='admin' and expires_at>now()) then raise exception 'ADMIN_REQUIRED'; end if;
  perform pg_advisory_xact_lock(73242341);
  delete from public.topic_aliases where id=target_alias;
  if not found then raise exception 'ALIAS_NOT_FOUND'; end if;
  return jsonb_build_object('status','deleted','alias_id',target_alias);
end $$;

create or replace function public.preview_tyt_import(payload jsonb) returns jsonb
language sql stable security invoker set search_path='' as $$
 select public.find_tyt_duplicate(payload) || jsonb_build_object(
  'topics', coalesce((
    select jsonb_agg(to_jsonb(t)-'created_at') from public.topics t where exists (
      select 1 from jsonb_to_recordset(payload->'questions') q(subject_id text, topic_label text)
      where q.subject_id=t.subject_id and public.normalize_topic_label(q.topic_label)=t.normalized_name)
  ), '[]'::jsonb),
  'unassigned_labels', coalesce((
    select jsonb_agg(distinct jsonb_build_object('subject_id', q.subject_id, 'topic_label', q.topic_label))
    from jsonb_to_recordset(payload->'questions') as q(subject_id text, topic_label text)
    left join public.topics t on t.subject_id=q.subject_id and t.normalized_name=public.normalize_topic_label(q.topic_label)
    where (t.id is not null and t.group_id is null)
       or (t.id is null and public.resolve_topic_group(q.subject_id, q.topic_label) is null)
  ), '[]'::jsonb))
$$;

create or replace function public.import_tyt_exam(payload jsonb, admin_session_hash text) returns jsonb
 language plpgsql volatile security invoker set search_path='' as $$
declare e public.exams; new_id uuid; duplicate jsonb; actual record; result_row public.exam_subject_results; ids text[]; review jsonb; unassigned jsonb;
begin
 if not exists(select 1 from public.app_sessions where token_hash=admin_session_hash and role='admin' and expires_at>now()) then raise exception 'ADMIN_REQUIRED'; end if;
 if payload->'exam'->>'exam_type' is distinct from 'TYT' or jsonb_typeof(payload->'questions') is distinct from 'array'
  or jsonb_typeof(payload->'subjects') is distinct from 'array' or jsonb_typeof(payload->'rankings') is distinct from 'array' then raise exception 'INVALID_REPORT'; end if;
 if jsonb_array_length(payload->'questions')<>120 or jsonb_array_length(payload->'subjects')<>13 or jsonb_array_length(payload->'rankings')<>4 then raise exception 'INCOMPLETE_REPORT'; end if;
 if (payload->'exam'->>'total_questions')::integer is distinct from 120 or payload->'exam'->>'source_pdf_path' is not null then raise exception 'INVALID_REPORT'; end if;
 -- Single-student imports are deliberately serialized. The lock covers duplicate
 -- detection, topic creation, and group assignment.
 perform pg_advisory_xact_lock(73242341);
 duplicate:=public.find_tyt_duplicate(payload);
 if duplicate->>'status' <> 'new' then
  select coalesce(jsonb_agg(distinct to_jsonb(t)-'created_at'),'[]'::jsonb) into review from public.topics t join public.exam_questions q on q.topic_id=t.id where q.exam_id=(duplicate->>'exam_id')::uuid and t.needs_review;
  select coalesce(jsonb_agg(distinct to_jsonb(t)-'created_at'),'[]'::jsonb) into unassigned from public.topics t join public.exam_questions q on q.topic_id=t.id where q.exam_id=(duplicate->>'exam_id')::uuid and t.group_id is null;
  return duplicate || jsonb_build_object('review_topics',review,'unassigned_topics',unassigned);
 end if;
 select * into e from jsonb_populate_record(null::public.exams,payload->'exam');
 insert into public.exams(exam_type,name,exam_date,institution_name,class_label,score,total_questions,total_correct,total_wrong,total_blank,total_net,average_net,report_generated_at,source_pdf_path)
 values(e.exam_type,e.name,e.exam_date,e.institution_name,e.class_label,e.score,e.total_questions,e.total_correct,e.total_wrong,e.total_blank,e.total_net,e.average_net,e.report_generated_at,null) returning id into new_id;
 -- Existing topics keep their printed name and group. Only a newly inserted label
 -- receives an unambiguous, subject-specific group match.
 insert into public.topics(subject_id,name,normalized_name,needs_review,group_id)
  select distinct on (subject_id,normalized_name) subject_id,label,normalized_name,label ~ '(…|\.{3})\s*$',public.resolve_topic_group(subject_id,label)
  from (select value->>'subject_id' subject_id,value->>'topic_label' label,
    public.normalize_topic_label(value->>'topic_label') normalized_name,ordinality
    from jsonb_array_elements(payload->'questions') with ordinality) labels
  order by subject_id,normalized_name,ordinality
  on conflict(subject_id,normalized_name) do nothing;
 insert into public.exam_questions(exam_id,question_number,subject_id,topic_id,correct_answer,selected_answer,solution_url)
  select new_id,q.question_number,q.subject_id,t.id,q.correct_answer,q.selected_answer,q.solution_url
  from jsonb_to_recordset(payload->'questions') as q(question_number smallint,subject_id text,topic_label text,correct_answer text,selected_answer text,solution_url text)
  join public.topics t on t.subject_id=q.subject_id and t.normalized_name=public.normalize_topic_label(q.topic_label);
 insert into public.exam_subject_results select new_id,r.subject_id,r.result_scope,r.question_count,r.correct_count,r.wrong_count,r.blank_count,r.net,r.average_net
  from jsonb_to_recordset(payload->'subjects') as r(subject_id text,result_scope text,question_count smallint,correct_count smallint,wrong_count smallint,blank_count smallint,net numeric,average_net numeric);
 insert into public.exam_rankings select new_id,r.scope,r.rank,r.participant_count
  from jsonb_to_recordset(payload->'rankings') as r(scope text,rank integer,participant_count integer);
 select count(*) n,count(*) filter(where correct_answer='İPTAL' or selected_answer=correct_answer) c,count(*) filter(where correct_answer<>'İPTAL' and selected_answer is not null and selected_answer<>correct_answer) w,count(*) filter(where correct_answer<>'İPTAL' and selected_answer is null) b
  into actual from public.exam_questions where exam_id=new_id;
 if actual.n<>120 or actual.c<>e.total_correct or actual.w<>e.total_wrong or actual.b<>e.total_blank then raise exception 'ANSWER_TOTAL_MISMATCH'; end if;
 -- Preserve the printed numbering across related subjects, and require every
 -- direct subject's complete interval. No duplicate physical questions can pass.
 if exists(select 1 from public.subjects s left join public.exam_questions q on q.subject_id=s.id and q.exam_id=new_id
  where s.exam_type='TYT' and s.expected_questions>0 group by s.id,s.expected_questions
  having count(q.id)<>s.expected_questions or min(q.question_number)<>case s.id when 'tyt_geometry' then 31 when 'tyt_geography' then 6 when 'tyt_philosophy' then 11 when 'tyt_religion' then 16 when 'tyt_chemistry' then 8 when 'tyt_biology' then 15 else 1 end
   or max(q.question_number)<>case s.id when 'tyt_geometry' then 40 when 'tyt_geography' then 10 when 'tyt_philosophy' then 15 when 'tyt_religion' then 20 when 'tyt_chemistry' then 14 when 'tyt_biology' then 20 else s.expected_questions end) then raise exception 'SUBJECT_QUESTION_MISMATCH'; end if;
 if exists(select 1 from public.exam_subject_results r join public.subjects s on s.id=r.subject_id where r.exam_id=new_id
  and ((r.result_scope='direct' and coalesce(s.expected_questions,0)=0) or (r.result_scope='aggregate' and r.subject_id not in ('tyt_social','tyt_math','tyt_science')))) then raise exception 'RESULT_SCOPE_MISMATCH'; end if;
 for result_row in select * from public.exam_subject_results where exam_id=new_id loop
  if result_row.result_scope='aggregate' then
   with recursive descendants as(select id from public.subjects where id=result_row.subject_id union select s.id from public.subjects s join descendants d on s.parent_id=d.id)
   select array_agg(id) into ids from descendants;
  else ids:=array[result_row.subject_id]; end if;
  select count(*) n,count(*) filter(where correct_answer='İPTAL' or selected_answer=correct_answer) c,count(*) filter(where correct_answer<>'İPTAL' and selected_answer is not null and selected_answer<>correct_answer) w,count(*) filter(where correct_answer<>'İPTAL' and selected_answer is null) b
   into actual from public.exam_questions where exam_id=new_id and subject_id=any(ids);
  if actual.n<>result_row.question_count or actual.c<>result_row.correct_count or actual.w<>result_row.wrong_count or actual.b<>result_row.blank_count then raise exception 'SUBJECT_RESULT_MISMATCH'; end if;
 end loop;
 select coalesce(jsonb_agg(distinct to_jsonb(t)-'created_at'),'[]'::jsonb) into review from public.topics t join public.exam_questions q on q.topic_id=t.id where q.exam_id=new_id and t.needs_review;
 select coalesce(jsonb_agg(distinct to_jsonb(t)-'created_at'),'[]'::jsonb) into unassigned from public.topics t join public.exam_questions q on q.topic_id=t.id where q.exam_id=new_id and t.group_id is null;
 return jsonb_build_object('status','imported','exam_id',new_id,'review_topics',review,'unassigned_topics',unassigned);
end $$;

revoke all on function
  public.resolve_topic_group(text, text),
  public.tyt_exam_ids(integer),
  public.tyt_topic_analysis(integer),
  public.topic_exam_breakdown(uuid, integer),
  public.topic_admin_catalog(),
  public.assign_topic_group(uuid, uuid, text),
  public.save_topic_alias(uuid, text, uuid, text, text),
  public.delete_topic_alias(uuid, text),
  public.check_topic_alias()
from public, anon, authenticated;
grant execute on function
  public.resolve_topic_group(text, text),
  public.tyt_exam_ids(integer),
  public.tyt_topic_analysis(integer),
  public.topic_exam_breakdown(uuid, integer),
  public.topic_admin_catalog(),
  public.assign_topic_group(uuid, uuid, text),
  public.save_topic_alias(uuid, text, uuid, text, text),
  public.delete_topic_alias(uuid, text)
to service_role;
commit;
