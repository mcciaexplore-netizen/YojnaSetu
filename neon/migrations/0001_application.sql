-- This schema belongs only to YojanaSetu. Neon Auth manages neon_auth separately.
-- DATABASE_URL is a trusted server credential. No database credential goes to a browser.
create schema if not exists yojanasetu;
revoke all on schema yojanasetu from public;
alter default privileges in schema yojanasetu revoke all on tables from public;
alter default privileges in schema yojanasetu revoke all on sequences from public;
alter default privileges in schema yojanasetu revoke execute on functions from public;

create table yojanasetu.users (
  id text primary key check (length(id) between 1 and 200),
  email text not null check (length(email) between 3 and 254),
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);
create table yojanasetu.user_data (
  user_id text primary key references yojanasetu.users(id) on delete cascade,
  payload jsonb not null default '{"profile":{},"preferences":{"email":false,"inApp":true},"events":[]}',
  version integer not null default 0,
  updated_at timestamptz not null default now()
);
create table yojanasetu.schemes (
  id text primary key,
  payload jsonb not null,
  status text generated always as (payload->>'status') stored not null,
  updated_at timestamptz not null default now(),
  check ((id = payload->>'id') is true),
  check (status in ('Draft','Pending Verification','Verified','Needs Review','Expired','Archived')),
  check (status <> 'Verified' or (
    payload->>'demo' = 'false' and nullif(payload->>'officialUrl','') is not null
    and nullif(payload->>'verifiedAt','') is not null and jsonb_array_length(payload->'rules') > 0
  ) is true)
);
create table yojanasetu.saved_schemes (
  user_id text references yojanasetu.users(id) on delete cascade,
  scheme_id text references yojanasetu.schemes(id),
  payload jsonb not null,
  primary key (user_id,scheme_id)
);
create table yojanasetu.applications (
  id text primary key,
  user_id text not null references yojanasetu.users(id) on delete cascade,
  scheme_id text not null references yojanasetu.schemes(id),
  payload jsonb not null,
  unique (user_id,scheme_id)
);
create table yojanasetu.notifications (
  id text primary key,
  user_id text not null references yojanasetu.users(id) on delete cascade,
  payload jsonb not null
);
create table yojanasetu.enquiries (
  id text primary key,
  user_id text not null references yojanasetu.users(id) on delete cascade,
  payload jsonb not null
);
create table yojanasetu.taxonomy (
  kind text primary key check (kind in ('industries','states','categories')),
  values jsonb not null check (jsonb_typeof(values)='array')
);
-- Files intentionally have no cascading application FK: account saves replace application rows.
-- Application association is checked on upload, account commit, and every download.
create table yojanasetu.private_files (
  id text primary key,
  user_id text not null references yojanasetu.users(id) on delete cascade,
  application_id text not null,
  name text not null check (length(name) between 1 and 255),
  mime text not null check (mime in ('application/pdf','image/png','image/jpeg')),
  bytes bytea not null check (octet_length(bytes) between 1 and 5242880),
  created_at timestamptz not null default now()
);
create table yojanasetu.audit_logs (
  id bigint generated always as identity primary key,
  user_id text references yojanasetu.users(id) on delete set null,
  action text not null,
  created_at timestamptz not null default now()
);
create index on yojanasetu.applications(user_id);
create index on yojanasetu.notifications(user_id);
create index on yojanasetu.enquiries(user_id);
create index on yojanasetu.private_files(user_id,application_id);
create index on yojanasetu.saved_schemes(scheme_id);
-- No RLS policies grant direct client access. The server schema owner performs verified requests.
do $$ declare t text; begin
  foreach t in array array['users','user_data','schemes','saved_schemes','applications','notifications','enquiries','taxonomy','private_files','audit_logs'] loop
    execute format('alter table yojanasetu.%I enable row level security',t);
  end loop;
end $$;
revoke all on all tables in schema yojanasetu from public;
revoke all on all sequences in schema yojanasetu from public;

create function yojanasetu.require_user(p_user_id text) returns void
language plpgsql set search_path=pg_catalog,yojanasetu as $$ begin
  if p_user_id is null or not exists(select 1 from yojanasetu.users where id=p_user_id) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
end $$;
create function yojanasetu.require_admin(p_user_id text) returns void
language plpgsql set search_path=pg_catalog,yojanasetu as $$ begin
  if p_user_id is null or not exists(select 1 from yojanasetu.users where id=p_user_id and role='admin') then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
end $$;

create function yojanasetu.commit_user_data(p_user_id text,p_data jsonb,p_version integer) returns void
language plpgsql set search_path=pg_catalog,yojanasetu as $$
declare current_version integer; item jsonb; doc jsonb; begin
  perform yojanasetu.require_user(p_user_id);
  if octet_length(p_data::text)>2000000 or jsonb_typeof(p_data)<>'object'
    or jsonb_typeof(p_data->'profile') is distinct from 'object'
    or jsonb_typeof(p_data->'preferences') is distinct from 'object'
    or jsonb_typeof(p_data->'events') is distinct from 'array'
    or jsonb_typeof(p_data->'saved') is distinct from 'array'
    or jsonb_typeof(p_data->'applications') is distinct from 'array'
    or jsonb_typeof(p_data->'notifications') is distinct from 'array' then
    raise exception 'Invalid account data' using errcode='22023';
  end if;
  insert into yojanasetu.user_data(user_id) values(p_user_id) on conflict do nothing;
  select version into current_version from yojanasetu.user_data where user_id=p_user_id for update;
  if p_version is null or current_version<>p_version then
    raise exception 'Stale update' using errcode='40001';
  end if;
  -- Validate cross-account IDs before any replacement. Unique keys also protect concurrent claims.
  for item in select value from jsonb_array_elements(p_data->'applications') loop
    if nullif(item->>'id','') is null or jsonb_typeof(item->'documents') is distinct from 'array' then
      raise exception 'Invalid application' using errcode='22023';
    end if;
    if exists(select 1 from yojanasetu.applications where id=item->>'id' and user_id<>p_user_id) then
      raise exception 'Application owner mismatch' using errcode='42501';
    end if;
    for doc in select value from jsonb_array_elements(item->'documents') loop
      if nullif(doc->>'fileId','') is not null and not exists(
        select 1 from yojanasetu.private_files where id=doc->>'fileId' and user_id=p_user_id and application_id=item->>'id'
      ) then raise exception 'Document owner mismatch' using errcode='42501'; end if;
    end loop;
  end loop;
  for item in select value from jsonb_array_elements(p_data->'notifications') loop
    if nullif(item->>'id','') is null then raise exception 'Invalid notification' using errcode='22023'; end if;
    if exists(select 1 from yojanasetu.notifications where id=item->>'id' and user_id<>p_user_id) then
      raise exception 'Notification owner mismatch' using errcode='42501';
    end if;
  end loop;
  delete from yojanasetu.saved_schemes where user_id=p_user_id;
  for item in select value from jsonb_array_elements(p_data->'saved') loop
    insert into yojanasetu.saved_schemes values(p_user_id,item->>'schemeId',item);
  end loop;
  delete from yojanasetu.applications where user_id=p_user_id;
  for item in select value from jsonb_array_elements(p_data->'applications') loop
    insert into yojanasetu.applications values(item->>'id',p_user_id,item->>'schemeId',item);
  end loop;
  for item in select value from jsonb_array_elements(p_data->'notifications') loop
    insert into yojanasetu.notifications values(item->>'id',p_user_id,item)
      on conflict(id) do update set payload=excluded.payload where notifications.user_id=p_user_id;
    if not found then raise exception 'Notification owner mismatch' using errcode='42501'; end if;
  end loop;
  update yojanasetu.user_data set payload=jsonb_build_object('profile',p_data->'profile','preferences',p_data->'preferences','events',p_data->'events'),
    version=version+1,updated_at=now() where user_id=p_user_id;
  insert into yojanasetu.audit_logs(user_id,action) values(p_user_id,'account.update');
end $$;
create function yojanasetu.read_user_data(p_user_id text) returns jsonb
language plpgsql stable set search_path=pg_catalog,yojanasetu as $$
declare result jsonb; begin
  perform yojanasetu.require_user(p_user_id);
  select jsonb_build_object(
    'version',coalesce(d.version,0),
    'data',jsonb_build_object(
      'profile',coalesce(d.payload->'profile','{}'::jsonb),
      'preferences',coalesce(d.payload->'preferences','{"email":false,"inApp":true}'::jsonb),
      'events',coalesce(d.payload->'events','[]'::jsonb),
      'saved',coalesce((select jsonb_agg(s.payload order by s.scheme_id) from yojanasetu.saved_schemes s where s.user_id=p_user_id),'[]'::jsonb),
      'applications',coalesce((select jsonb_agg(a.payload order by a.payload->>'updatedAt',a.id) from yojanasetu.applications a where a.user_id=p_user_id),'[]'::jsonb),
      'notifications',coalesce((select jsonb_agg(n.payload order by n.payload->>'createdAt',n.id) from yojanasetu.notifications n where n.user_id=p_user_id),'[]'::jsonb)
    )
  ) into result from yojanasetu.users u left join yojanasetu.user_data d on d.user_id=u.id where u.id=p_user_id;
  return result;
end $$;

create function yojanasetu.save_scheme(p_user_id text,p_scheme jsonb) returns void
language plpgsql set search_path=pg_catalog,yojanasetu as $$
declare recipient text; notification_id text; begin
  perform yojanasetu.require_admin(p_user_id);
  insert into yojanasetu.schemes(id,payload) values(p_scheme->>'id',p_scheme)
    on conflict(id) do update set payload=excluded.payload,updated_at=now();
  -- Lock in a consistent order. Increment versions so a stale account save cannot erase this update.
  for recipient in select distinct user_id from yojanasetu.saved_schemes where scheme_id=p_scheme->>'id' order by user_id loop
    insert into yojanasetu.user_data(user_id) values(recipient) on conflict do nothing;
    perform 1 from yojanasetu.user_data where user_id=recipient for update;
    notification_id:=gen_random_uuid()::text;
    insert into yojanasetu.notifications(id,user_id,payload) values(notification_id,recipient,jsonb_build_object(
      'id',notification_id,'title','Saved scheme updated','body',p_scheme->>'name',
      'kind','scheme-updated','read',false,'schemeId',p_scheme->>'id','createdAt',now()
    ));
    update yojanasetu.user_data set version=version+1,updated_at=now() where user_id=recipient;
  end loop;
  insert into yojanasetu.audit_logs(user_id,action) values(p_user_id,'scheme.update:'||(p_scheme->>'id'));
end $$;

create function yojanasetu.save_taxonomy(p_user_id text,p_kind text,p_values jsonb) returns void
language plpgsql set search_path=pg_catalog,yojanasetu as $$ begin
  perform yojanasetu.require_admin(p_user_id);
  insert into yojanasetu.taxonomy(kind,values) values(p_kind,p_values)
    on conflict(kind) do update set values=excluded.values;
  insert into yojanasetu.audit_logs(user_id,action) values(p_user_id,'taxonomy.update:'||p_kind);
end $$;

create function yojanasetu.admin_snapshot(p_user_id text) returns jsonb
language plpgsql stable set search_path=pg_catalog,yojanasetu as $$ begin
  perform yojanasetu.require_admin(p_user_id);
  return jsonb_build_object(
    'users',coalesce((select jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role) order by created_at,id) from yojanasetu.users),'[]'::jsonb),
    'enquiries',coalesce((select jsonb_agg(payload order by payload->>'createdAt',id) from yojanasetu.enquiries),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(yojanasetu.read_user_data(id)->'data') from yojanasetu.users),'[]'::jsonb)
  );
end $$;

create function yojanasetu.save_private_file(p_user_id text,p_application_id text,p_file_id text,p_mime text,p_name text,p_base64 text) returns void
language plpgsql set search_path=pg_catalog,yojanasetu as $$ begin
  perform yojanasetu.require_user(p_user_id);
  if not exists(select 1 from yojanasetu.applications where id=p_application_id and user_id=p_user_id) then
    raise exception 'Application document was not found' using errcode='42501';
  end if;
  insert into yojanasetu.private_files(id,user_id,application_id,mime,name,bytes)
    values(p_file_id,p_user_id,p_application_id,p_mime,p_name,decode(p_base64,'base64'));
end $$;
-- Functions are invoker-rights and private. Only the trusted schema owner runs them.
revoke all on all functions in schema yojanasetu from public;