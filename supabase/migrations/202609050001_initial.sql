-- YojanaSetu: PostgreSQL / Supabase migration. Run as database owner.
create table public.users (id uuid primary key references auth.users(id) on delete cascade,email text not null,role text not null default 'user' check(role in ('user','admin')),preferences jsonb not null default '{"email":false,"inApp":true}',created_at timestamptz not null default now());
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.users where id=auth.uid() and role='admin') $$;
create function public.on_auth_user_created() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.users(id,email) values(new.id,new.email); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.on_auth_user_created();
create table public.business_profiles(user_id uuid primary key references public.users on delete cascade,payload jsonb not null default '{}',version integer not null default 0,updated_at timestamptz not null default now());
create table public.business_objectives(user_id uuid references public.users on delete cascade,objective text not null,primary key(user_id,objective));
create table public.schemes(id text primary key,payload jsonb not null,status text generated always as (payload->>'status') stored,demo boolean generated always as ((payload->>'demo')::boolean) stored,updated_at timestamptz not null default now(),check(status in ('Draft','Pending Verification','Verified','Needs Review','Expired','Archived')),check(status<>'Verified' or (not demo and nullif(payload->>'officialUrl','') is not null and nullif(payload->>'verifiedAt','') is not null and jsonb_array_length(payload->'rules')>0)));
create table public.scheme_eligibility_rules(id uuid primary key default gen_random_uuid(),scheme_id text references public.schemes on delete cascade,payload jsonb not null);
create table public.scheme_benefits(scheme_id text primary key references public.schemes on delete cascade,payload jsonb not null);
create table public.scheme_documents(scheme_id text references public.schemes on delete cascade,name text not null,primary key(scheme_id,name));
create table public.scheme_deadlines(scheme_id text primary key references public.schemes on delete cascade,deadline date);
create table public.saved_schemes(user_id uuid references public.users on delete cascade,scheme_id text references public.schemes,payload jsonb not null,primary key(user_id,scheme_id));
create table public.applications(id uuid primary key,user_id uuid references public.users on delete cascade,scheme_id text references public.schemes,payload jsonb not null,unique(user_id,scheme_id));
create table public.application_documents(id uuid primary key default gen_random_uuid(),application_id uuid references public.applications on delete cascade,user_id uuid references public.users on delete cascade,payload jsonb not null);
create table public.notifications(id uuid primary key,user_id uuid references public.users on delete cascade,payload jsonb not null);
create table public.audit_logs(id bigint generated always as identity primary key,user_id uuid references public.users,action text not null,created_at timestamptz not null default now());
create table public.analytics_events(id bigint generated always as identity primary key,user_id uuid references public.users on delete cascade,payload jsonb not null);
create table public.enquiries(id uuid primary key,user_id uuid references public.users on delete cascade,payload jsonb not null);
create table public.taxonomy(kind text primary key check(kind in ('industries','states','categories')),values jsonb not null);
create table public.notification_outbox(id uuid primary key default gen_random_uuid(),user_id uuid references public.users on delete cascade,notification_id uuid references public.notifications on delete cascade,channel text not null check(channel in ('email','sms','whatsapp')),status text not null default 'pending',attempts integer not null default 0,unique(notification_id,channel));
create index on public.applications(user_id);create index on public.notifications(user_id);create index on public.analytics_events(user_id);create index on public.enquiries(user_id);
-- RLS: no service-role key is used by the application. Authorization is enforced here.
do $$ declare t text; begin foreach t in array array['users','business_profiles','business_objectives','schemes','scheme_eligibility_rules','scheme_benefits','scheme_documents','scheme_deadlines','saved_schemes','applications','application_documents','notifications','audit_logs','analytics_events','enquiries','taxonomy','notification_outbox'] loop execute format('alter table public.%I enable row level security',t);end loop;end $$;
create policy users_read on public.users for select using(id=auth.uid() or public.is_admin());
create policy schemes_read on public.schemes for select using(status not in ('Draft','Archived') or public.is_admin());
create policy schemes_admin on public.schemes for all to authenticated using(public.is_admin()) with check(public.is_admin());
do $$ declare t text; begin foreach t in array array['scheme_eligibility_rules','scheme_benefits','scheme_documents','scheme_deadlines'] loop execute format('create policy public_read on public.%I for select using (exists(select 1 from public.schemes s where s.id=scheme_id and (s.status not in (''Draft'',''Archived'') or public.is_admin())))',t);execute format('create policy admin_write on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);end loop;end $$;
do $$ declare t text; begin foreach t in array array['business_profiles','business_objectives','saved_schemes','applications','application_documents','notifications','analytics_events','enquiries'] loop execute format('create policy owner_read on public.%I for select to authenticated using(user_id=auth.uid() or public.is_admin())',t);end loop;end $$;
create policy enquiries_insert on public.enquiries for insert to authenticated with check(user_id=auth.uid());
create policy audit_admin on public.audit_logs for select to authenticated using(public.is_admin());
create policy taxonomy_read on public.taxonomy for select using(true);
create policy taxonomy_admin on public.taxonomy for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy outbox_admin on public.notification_outbox for select to authenticated using(public.is_admin());
grant usage on schema public to anon,authenticated;
grant select on public.schemes,public.scheme_eligibility_rules,public.scheme_benefits,public.scheme_documents,public.scheme_deadlines,public.taxonomy to anon,authenticated;
grant select on all tables in schema public to authenticated;
grant insert on public.enquiries to authenticated;
grant insert,update,delete on public.taxonomy to authenticated;
-- Account writes are atomic and reject stale concurrent edits. Owner id comes only from auth.uid().
create function public.commit_user_data(p_data jsonb,p_version integer) returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();v integer;r jsonb;a jsonb; begin
 if uid is null then raise exception 'Authentication required';end if;
 if octet_length(p_data::text)>2000000 then raise exception 'Account data too large';end if;
 insert into public.business_profiles(user_id) values(uid) on conflict do nothing;
 select version into v from public.business_profiles where user_id=uid for update;
 if v<>p_version then raise exception 'Stale update';end if;
 update public.business_profiles set payload=p_data->'profile',version=v+1,updated_at=now() where user_id=uid;
 update public.users set preferences=p_data->'preferences' where id=uid;
 delete from public.business_objectives where user_id=uid;
 for r in select value from jsonb_array_elements(coalesce(p_data->'profile'->'objectives','[]')) loop insert into public.business_objectives values(uid,r#>>'{}') on conflict do nothing;end loop;
 delete from public.saved_schemes where user_id=uid;
 for r in select value from jsonb_array_elements(p_data->'saved') loop insert into public.saved_schemes values(uid,r->>'schemeId',r);end loop;
 delete from public.applications where user_id=uid;
 for a in select value from jsonb_array_elements(p_data->'applications') loop
 insert into public.applications values((a->>'id')::uuid,uid,a->>'schemeId',a);
 for r in select value from jsonb_array_elements(a->'documents') loop insert into public.application_documents(application_id,user_id,payload) values((a->>'id')::uuid,uid,r);end loop;end loop;
 -- Upsert notifications so durable delivery records survive account updates.
 for r in select value from jsonb_array_elements(p_data->'notifications') loop
 if exists(select 1 from notifications where id=(r->>'id')::uuid and user_id<>uid) then raise exception 'Notification owner mismatch';end if;
 insert into public.notifications values((r->>'id')::uuid,uid,r) on conflict(id) do update set payload=excluded.payload where notifications.user_id=uid;
 if coalesce((p_data->'preferences'->>'email')::boolean,false) then insert into public.notification_outbox(user_id,notification_id,channel) values(uid,(r->>'id')::uuid,'email') on conflict do nothing;end if;
 end loop;
 delete from public.analytics_events where user_id=uid;
 for r in select value from jsonb_array_elements(p_data->'events') loop insert into public.analytics_events(user_id,payload) values(uid,r);end loop;
 insert into public.audit_logs(user_id,action) values(uid,'account.update');
end $$;
revoke all on function public.commit_user_data(jsonb,integer) from public;grant execute on function public.commit_user_data(jsonb,integer) to authenticated;
create function public.save_scheme(p_scheme jsonb) returns void language plpgsql security definer set search_path=public as $$ declare sid text:=p_scheme->>'id';r jsonb;u uuid; n uuid;begin
 if not public.is_admin() then raise exception 'Administrator required';end if;
 insert into public.schemes(id,payload) values(sid,p_scheme) on conflict(id) do update set payload=excluded.payload,updated_at=now();
 delete from public.scheme_eligibility_rules where scheme_id=sid;
 for r in select value from jsonb_array_elements(p_scheme->'rules') loop insert into public.scheme_eligibility_rules(scheme_id,payload) values(sid,r);end loop;
 insert into public.scheme_benefits values(sid,jsonb_build_object('benefit',p_scheme->'benefit','maximumBenefit',p_scheme->'maximumBenefit','subsidyPercentage',p_scheme->'subsidyPercentage','loanSupport',p_scheme->'loanSupport','grantSupport',p_scheme->'grantSupport','reimbursement',p_scheme->'reimbursement')) on conflict(scheme_id) do update set payload=excluded.payload;
 delete from public.scheme_documents where scheme_id=sid;
 for r in select value from jsonb_array_elements(p_scheme->'documents') loop insert into public.scheme_documents values(sid,r#>>'{}');end loop;
 insert into public.scheme_deadlines values(sid,(p_scheme->>'deadline')::date) on conflict(scheme_id) do update set deadline=excluded.deadline;
 for u in select user_id from public.saved_schemes where scheme_id=sid loop n:=gen_random_uuid();insert into public.notifications values(n,u,jsonb_build_object('id',n,'title','Saved scheme updated','body',p_scheme->>'name','kind','scheme-updated','read',false,'schemeId',sid,'createdAt',now()));end loop;
 insert into public.audit_logs(user_id,action) values(auth.uid(),'scheme.update:'||sid);
end $$;
revoke all on function public.save_scheme(jsonb) from public;grant execute on function public.save_scheme(jsonb) to authenticated;
create function public.admin_analytics() returns jsonb language plpgsql security definer set search_path=public as $$ begin if not public.is_admin() then raise exception 'Administrator required';end if;return jsonb_build_object('users',(select count(*) from users),'searches',(select count(*) from analytics_events where payload->>'type'='search'),'matches',(select count(*) from analytics_events where payload->>'type'='match'),'started',(select count(*) from applications),'submitted',(select count(*) from applications where payload->'history' @> '[{"status":"Application Submitted"}]'),'industries',(select coalesce(jsonb_object_agg(k,n),'{}') from (select coalesce(payload->>'industry','Not specified') k,count(*) n from business_profiles group by 1) t),'objectives',(select coalesce(jsonb_object_agg(objective,n),'{}') from(select objective,count(*) n from business_objectives group by 1)t),'popular',(select coalesce(jsonb_object_agg(k,n),'{}') from(select payload->>'schemeId' k,count(*) n from analytics_events where payload->>'type'='view' and payload->>'schemeId' is not null group by 1)t),'saved',(select coalesce(jsonb_object_agg(scheme_id,n),'{}') from(select scheme_id,count(*) n from saved_schemes group by 1)t));end $$;
revoke all on function public.admin_analytics() from public;grant execute on function public.admin_analytics() to authenticated;
-- Private bucket. Browser uploads cannot choose another user's prefix.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('application-documents','application-documents',false,5242880,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
create policy documents_owner_read on storage.objects for select to authenticated using(bucket_id='application-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy documents_owner_insert on storage.objects for insert to authenticated with check(bucket_id='application-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy documents_owner_delete on storage.objects for delete to authenticated using(bucket_id='application-documents' and (storage.foldername(name))[1]=auth.uid()::text);
