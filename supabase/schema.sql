begin;
create table public.viewer_pins (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(label) between 1 and 100),
  pin_hash text not null unique,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.app_sessions (
  token_hash text primary key,
  role text not null check (role in ('admin', 'viewer')),
  pin_id uuid references public.viewer_pins(id) on delete cascade,
  expires_at timestamptz not null,
  check ((role = 'admin' and pin_id is null) or (role = 'viewer' and pin_id is not null))
);
create index app_sessions_expiry_idx on public.app_sessions(expires_at);

create table public.login_attempts (
  key text primary key,
  attempts integer not null,
  window_start timestamptz not null default now()
);

-- Shared, atomic rate limiting works across Vercel instances. Includes cleanup.
create function public.consume_login_attempt(bucket text, max_attempts integer)
returns boolean language plpgsql set search_path = '' as $$
declare attempt_count integer;
begin
  delete from public.login_attempts where window_start < now() - interval '15 minutes';
  delete from public.app_sessions where expires_at <= now();
  insert into public.login_attempts as current (key, attempts, window_start)
    values (bucket, 1, now())
    on conflict (key) do update set
      attempts = case when current.window_start <= now() - interval '15 minutes' then 1 else current.attempts + 1 end,
      window_start = case when current.window_start <= now() - interval '15 minutes' then now() else current.window_start end
    returning attempts into attempt_count;
  return attempt_count <= max_attempts;
end;
$$;

alter table public.viewer_pins enable row level security;
alter table public.app_sessions enable row level security;
alter table public.login_attempts enable row level security;
revoke all on public.viewer_pins,public.app_sessions,public.login_attempts from public,anon,authenticated;
grant select,insert,update,delete on public.viewer_pins,public.app_sessions,public.login_attempts to service_role;
revoke all on function public.consume_login_attempt(text,integer) from public,anon,authenticated;
grant execute on function public.consume_login_attempt(text,integer) to service_role;

create table public.exams (
 id uuid primary key default gen_random_uuid(),
 exam_type text not null check (exam_type in ('TYT','AYT')),
 name text not null check (length(btrim(name)) between 1 and 300),
 exam_date date not null,
 institution_name text,
 class_label text,
 score numeric(6,2),
 total_questions smallint not null check (total_questions > 0),
 total_correct smallint not null check (total_correct >= 0),
 total_wrong smallint not null check (total_wrong >= 0),
 total_blank smallint not null check (total_blank >= 0),
 total_net numeric(6,2) not null,
 average_net numeric(6,2),
 report_generated_at timestamp,
 source_pdf_path text,
 created_at timestamptz not null default now(),
 check (total_correct + total_wrong + total_blank = total_questions),
 check (total_net = total_correct - total_wrong::numeric / 4),
 check (average_net between -total_questions::numeric / 4 and total_questions)
);
create index exams_date_idx on public.exams(exam_type, exam_date, id);
create table public.subjects (
 id text primary key,
 name text not null,
 exam_type text not null check (exam_type in ('TYT','AYT')),
 parent_id text references public.subjects(id),
 expected_questions smallint check (expected_questions >= 0),
 display_order smallint not null,
 check (id <> parent_id)
);
insert into public.subjects(id,name,exam_type,parent_id,expected_questions,display_order) values
 ('tyt_turkish','Türkçe','TYT',null,40,1),
 ('tyt_social','Sosyal Bilimler','TYT',null,0,2),
 ('tyt_history','Tarih','TYT','tyt_social',5,3),
 ('tyt_geography','Coğrafya','TYT','tyt_social',5,4),
 ('tyt_philosophy','Felsefe','TYT','tyt_social',5,5),
 ('tyt_religion','Din Kültürü ve Ahlak Bilgisi','TYT','tyt_social',5,6),
 ('tyt_math','Matematik','TYT',null,30,7),
 ('tyt_geometry','Geometri','TYT','tyt_math',10,8),
 ('tyt_science','Fen Bilimleri','TYT',null,0,9),
 ('tyt_physics','Fizik','TYT','tyt_science',7,10),
 ('tyt_chemistry','Kimya','TYT','tyt_science',7,11),
 ('tyt_biology','Biyoloji','TYT','tyt_science',6,12);

create function public.normalize_topic_label(label text) returns text
 language sql immutable strict set search_path='' as $$
 select btrim(regexp_replace(lower(translate(normalize(label,NFKC),'Iİ','ıi')), '\s+', ' ', 'g'))
$$;
create table public.topics (
 id uuid primary key default gen_random_uuid(),
 subject_id text not null references public.subjects(id),
 name text not null check (length(btrim(name)) between 1 and 300 and name !~ '[[:cntrl:]]'),
 normalized_name text not null check (normalized_name = public.normalize_topic_label(name)),
 needs_review boolean not null default false,
 created_at timestamptz not null default now(),
 unique (subject_id, normalized_name),
 unique (id, subject_id)
);
create table public.exam_questions (
 id uuid primary key default gen_random_uuid(),
 exam_id uuid not null references public.exams(id) on delete cascade,
 question_number smallint not null check (question_number > 0),
 subject_id text not null references public.subjects(id),
 topic_id uuid not null references public.topics(id),
 correct_answer char(1) not null check (correct_answer in ('A','B','C','D','E')),
 selected_answer char(1) check (selected_answer in ('A','B','C','D','E')),
 solution_url text check (solution_url is null or (length(solution_url) <= 2048 and solution_url !~ '[[:cntrl:]]' and solution_url ~ '^https?://[^/@[:space:]]+([/?#]|$)')),
 unique (exam_id, subject_id, question_number),
 foreign key (topic_id,subject_id) references public.topics(id,subject_id)
);
create index exam_questions_topic_idx on public.exam_questions(topic_id);
create table public.exam_subject_results (
 exam_id uuid not null references public.exams(id) on delete cascade,
 subject_id text not null references public.subjects(id),
 result_scope text not null check (result_scope in ('direct','aggregate')),
 question_count smallint not null check (question_count >= 0),
 correct_count smallint not null check (correct_count >= 0),
 wrong_count smallint not null check (wrong_count >= 0),
 blank_count smallint not null check (blank_count >= 0),
 net numeric(6,2) not null,
 average_net numeric(6,2),
 primary key (exam_id,subject_id,result_scope),
 check (correct_count + wrong_count + blank_count = question_count),
 check (net = correct_count - wrong_count::numeric / 4),
 check (average_net between -question_count::numeric / 4 and question_count)
);
create table public.exam_rankings (
 exam_id uuid not null references public.exams(id) on delete cascade,
 scope text not null check (scope in ('general','institution','branch','class')),
 rank integer not null check (rank > 0),
 participant_count integer not null check (participant_count >= rank),
 primary key(exam_id,scope)
);

create function public.check_subject_parent() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (old.exam_type,old.parent_id,old.expected_questions) is distinct from (new.exam_type,new.parent_id,new.expected_questions)
  and (exists(select 1 from public.topics t where t.subject_id=old.id) or exists(select 1 from public.exam_subject_results r where r.subject_id=old.id)) then raise exception 'SUBJECT_DEFINITION_IN_USE'; end if;
 if new.parent_id is not null then
  if not exists(select 1 from public.subjects p where p.id=new.parent_id and p.exam_type=new.exam_type) then raise exception 'SUBJECT_EXAM_TYPE'; end if;
  if exists(with recursive ancestors as (
   select id,parent_id from public.subjects where id=new.parent_id
   union select s.id,s.parent_id from public.subjects s join ancestors a on s.id=a.parent_id
  ) select 1 from ancestors where id=new.id) then raise exception 'SUBJECT_CYCLE'; end if;
 end if;
 if exists(select 1 from public.subjects s where s.parent_id=new.id and s.exam_type<>new.exam_type) then raise exception 'SUBJECT_EXAM_TYPE'; end if;
 return new;
end $$;
create trigger subject_parent_check before insert or update on public.subjects for each row execute function public.check_subject_parent();
create function public.check_direct_subject() returns trigger language plpgsql set search_path='' as $$
declare s public.subjects; e_type text;
begin
 select * into strict s from public.subjects where id=new.subject_id;
 if tg_table_name in ('exam_questions','topics') and s.expected_questions=0 then raise exception 'DIRECT_SUBJECT_REQUIRED'; end if;
 if tg_table_name <> 'topics' then
  select exam_type into strict e_type from public.exams where id=new.exam_id;
  if e_type<>s.exam_type then raise exception 'SUBJECT_EXAM_TYPE'; end if;
 end if;
 return new;
end $$;
create trigger question_subject_check before insert or update on public.exam_questions for each row execute function public.check_direct_subject();
create trigger topic_subject_check before insert or update on public.topics for each row execute function public.check_direct_subject();
create trigger result_subject_check before insert or update on public.exam_subject_results for each row execute function public.check_direct_subject();

create function public.check_exam_type() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.exam_questions q join public.subjects s on s.id=q.subject_id where q.exam_id=new.id and s.exam_type<>new.exam_type)
  or exists(select 1 from public.exam_subject_results r join public.subjects s on s.id=r.subject_id where r.exam_id=new.id and s.exam_type<>new.exam_type) then raise exception 'SUBJECT_EXAM_TYPE'; end if;
 return new;
end $$;
create trigger exam_type_check before update of exam_type on public.exams for each row execute function public.check_exam_type();

-- Preview only; all decisions are repeated under the import transaction lock.
create function public.find_tyt_duplicate(payload jsonb) returns jsonb
 language plpgsql stable security invoker set search_path='' as $$
declare candidate public.exams; incoming_questions jsonb; existing_questions jsonb; incoming_results jsonb; existing_results jsonb; incoming_ranks jsonb; existing_ranks jsonb; collision_id uuid;
begin
 select jsonb_agg(jsonb_build_array(q.subject_id,q.question_number,q.correct_answer,q.selected_answer,public.normalize_topic_label(q.topic_label)) order by q.subject_id,q.question_number)
 into incoming_questions from jsonb_to_recordset(payload->'questions') as q(subject_id text,question_number integer,correct_answer text,selected_answer text,topic_label text);
 select jsonb_agg(r order by r->>'subject_id',r->>'result_scope') into incoming_results from jsonb_array_elements(payload->'subjects') r;
 select jsonb_agg(r order by r->>'scope') into incoming_ranks from jsonb_array_elements(payload->'rankings') r;
 for candidate in select * from public.exams where exam_type='TYT' and exam_date=(payload->'exam'->>'exam_date')::date loop
  select jsonb_agg(jsonb_build_array(q.subject_id,q.question_number,q.correct_answer,q.selected_answer,t.normalized_name) order by q.subject_id,q.question_number)
  into existing_questions from public.exam_questions q join public.topics t on t.id=q.topic_id where q.exam_id=candidate.id;
  select jsonb_agg(to_jsonb(r)-'exam_id' order by r.subject_id,r.result_scope) into existing_results from public.exam_subject_results r where r.exam_id=candidate.id;
  select jsonb_agg(to_jsonb(r)-'exam_id' order by r.scope) into existing_ranks from public.exam_rankings r where r.exam_id=candidate.id;
  if (to_jsonb(candidate)-'id'-'created_at'-'report_generated_at')=((payload->'exam')-'report_generated_at')
   and existing_questions=incoming_questions and existing_results=incoming_results and existing_ranks=incoming_ranks then
   return jsonb_build_object('status','duplicate','exam_id',candidate.id);
  end if;
  if public.normalize_topic_label(candidate.name)=public.normalize_topic_label(payload->'exam'->>'name') or existing_questions=incoming_questions then collision_id:=candidate.id; end if;
 end loop;
 return jsonb_build_object('status',case when collision_id is null then 'new' else 'collision' end,'exam_id',collision_id);
end $$;

create function public.preview_tyt_import(payload jsonb) returns jsonb
 language sql stable security invoker set search_path='' as $$
 select public.find_tyt_duplicate(payload) || jsonb_build_object('topics',coalesce((
  select jsonb_agg(to_jsonb(t)-'created_at') from public.topics t where exists (
   select 1 from jsonb_to_recordset(payload->'questions') q(subject_id text,topic_label text)
   where q.subject_id=t.subject_id and public.normalize_topic_label(q.topic_label)=t.normalized_name)
 ),'[]'::jsonb))
$$;

create function public.import_tyt_exam(payload jsonb, admin_session_hash text) returns jsonb
 language plpgsql volatile security invoker set search_path='' as $$
declare e public.exams; new_id uuid; duplicate jsonb; actual record; result_row public.exam_subject_results; ids text[]; review jsonb;
begin
 if not exists(select 1 from public.app_sessions where token_hash=admin_session_hash and role='admin' and expires_at>now()) then raise exception 'ADMIN_REQUIRED'; end if;
 if payload->'exam'->>'exam_type' is distinct from 'TYT' or jsonb_typeof(payload->'questions') is distinct from 'array'
  or jsonb_typeof(payload->'subjects') is distinct from 'array' or jsonb_typeof(payload->'rankings') is distinct from 'array' then raise exception 'INVALID_REPORT'; end if;
 if jsonb_array_length(payload->'questions')<>120 or jsonb_array_length(payload->'subjects')<>13 or jsonb_array_length(payload->'rankings')<>4 then raise exception 'INCOMPLETE_REPORT'; end if;
 if (payload->'exam'->>'total_questions')::integer is distinct from 120 or payload->'exam'->>'source_pdf_path' is not null then raise exception 'INVALID_REPORT'; end if;
 -- Single-student imports are deliberately serialized. The lock covers duplicate
 -- detection and topic creation, including concurrent requests on other instances.
 perform pg_advisory_xact_lock(73242341);
 duplicate:=public.find_tyt_duplicate(payload);
 if duplicate->>'status' <> 'new' then
  select coalesce(jsonb_agg(distinct to_jsonb(t)-'created_at'),'[]'::jsonb) into review from public.topics t join public.exam_questions q on q.topic_id=t.id where q.exam_id=(duplicate->>'exam_id')::uuid and t.needs_review;
  return duplicate || jsonb_build_object('review_topics',review);
 end if;
 select * into e from jsonb_populate_record(null::public.exams,payload->'exam');
 insert into public.exams(exam_type,name,exam_date,institution_name,class_label,score,total_questions,total_correct,total_wrong,total_blank,total_net,average_net,report_generated_at,source_pdf_path)
 values(e.exam_type,e.name,e.exam_date,e.institution_name,e.class_label,e.score,e.total_questions,e.total_correct,e.total_wrong,e.total_blank,e.total_net,e.average_net,e.report_generated_at,null) returning id into new_id;
 -- Insert each distinct printed label once. Existing topics are read, not
 -- needlessly UPDATEd for every repeated question (avoids dead row versions).
 insert into public.topics(subject_id,name,normalized_name,needs_review)
  select distinct on (subject_id,normalized_name) subject_id,label,normalized_name,label ~ '(…|\.{3})\s*$'
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
 select count(*) n,count(*) filter(where selected_answer=correct_answer) c,count(*) filter(where selected_answer is not null and selected_answer<>correct_answer) w,count(*) filter(where selected_answer is null) b
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
  select count(*) n,count(*) filter(where selected_answer=correct_answer) c,count(*) filter(where selected_answer is not null and selected_answer<>correct_answer) w,count(*) filter(where selected_answer is null) b
   into actual from public.exam_questions where exam_id=new_id and subject_id=any(ids);
  if actual.n<>result_row.question_count or actual.c<>result_row.correct_count or actual.w<>result_row.wrong_count or actual.b<>result_row.blank_count then raise exception 'SUBJECT_RESULT_MISMATCH'; end if;
 end loop;
 select coalesce(jsonb_agg(distinct to_jsonb(t)-'created_at'),'[]'::jsonb) into review from public.topics t join public.exam_questions q on q.topic_id=t.id where q.exam_id=new_id and t.needs_review;
 return jsonb_build_object('status','imported','exam_id',new_id,'review_topics',review);
end $$;

alter table public.exams enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_subject_results enable row level security;
alter table public.exam_rankings enable row level security;
revoke all on public.exams,public.subjects,public.topics,public.exam_questions,public.exam_subject_results,public.exam_rankings from public,anon,authenticated;
grant select,insert,update,delete on public.exams,public.subjects,public.topics,public.exam_questions,public.exam_subject_results,public.exam_rankings to service_role;
revoke all on function public.normalize_topic_label(text),public.check_subject_parent(),public.check_direct_subject(),public.check_exam_type(),public.find_tyt_duplicate(jsonb),public.preview_tyt_import(jsonb),public.import_tyt_exam(jsonb,text) from public,anon,authenticated;
grant execute on function public.normalize_topic_label(text),public.find_tyt_duplicate(jsonb),public.preview_tyt_import(jsonb),public.import_tyt_exam(jsonb,text) to service_role;
commit;

-- Explicit cancellation markers receive credit in the supported report layout.
-- Missing/unreadable answer keys are still rejected by the parser.
begin;
alter table public.exam_questions drop constraint exam_questions_correct_answer_check;
alter table public.exam_questions alter column correct_answer type text;
alter table public.exam_questions add constraint exam_questions_correct_answer_check check (correct_answer in ('A','B','C','D','E','İPTAL'));
create or replace function public.import_tyt_exam(payload jsonb, admin_session_hash text) returns jsonb
 language plpgsql volatile security invoker set search_path='' as $$
declare e public.exams; new_id uuid; duplicate jsonb; actual record; result_row public.exam_subject_results; ids text[]; review jsonb;
begin
 if not exists(select 1 from public.app_sessions where token_hash=admin_session_hash and role='admin' and expires_at>now()) then raise exception 'ADMIN_REQUIRED'; end if;
 if payload->'exam'->>'exam_type' is distinct from 'TYT' or jsonb_typeof(payload->'questions') is distinct from 'array'
  or jsonb_typeof(payload->'subjects') is distinct from 'array' or jsonb_typeof(payload->'rankings') is distinct from 'array' then raise exception 'INVALID_REPORT'; end if;
 if jsonb_array_length(payload->'questions')<>120 or jsonb_array_length(payload->'subjects')<>13 or jsonb_array_length(payload->'rankings')<>4 then raise exception 'INCOMPLETE_REPORT'; end if;
 if (payload->'exam'->>'total_questions')::integer is distinct from 120 or payload->'exam'->>'source_pdf_path' is not null then raise exception 'INVALID_REPORT'; end if;
 -- Single-student imports are deliberately serialized. The lock covers duplicate
 -- detection and topic creation, including concurrent requests on other instances.
 perform pg_advisory_xact_lock(73242341);
 duplicate:=public.find_tyt_duplicate(payload);
 if duplicate->>'status' <> 'new' then
  select coalesce(jsonb_agg(distinct to_jsonb(t)-'created_at'),'[]'::jsonb) into review from public.topics t join public.exam_questions q on q.topic_id=t.id where q.exam_id=(duplicate->>'exam_id')::uuid and t.needs_review;
  return duplicate || jsonb_build_object('review_topics',review);
 end if;
 select * into e from jsonb_populate_record(null::public.exams,payload->'exam');
 insert into public.exams(exam_type,name,exam_date,institution_name,class_label,score,total_questions,total_correct,total_wrong,total_blank,total_net,average_net,report_generated_at,source_pdf_path)
 values(e.exam_type,e.name,e.exam_date,e.institution_name,e.class_label,e.score,e.total_questions,e.total_correct,e.total_wrong,e.total_blank,e.total_net,e.average_net,e.report_generated_at,null) returning id into new_id;
 -- Insert each distinct printed label once. Existing topics are read, not
 -- needlessly UPDATEd for every repeated question (avoids dead row versions).
 insert into public.topics(subject_id,name,normalized_name,needs_review)
  select distinct on (subject_id,normalized_name) subject_id,label,normalized_name,label ~ '(…|\.{3})\s*$'
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
 return jsonb_build_object('status','imported','exam_id',new_id,'review_topics',review);
end $$;
commit;
