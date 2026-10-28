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
