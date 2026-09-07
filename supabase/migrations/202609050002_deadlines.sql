-- Run through a trusted daily scheduler (database owner/service role), never a browser.
create function public.queue_deadline_notifications() returns integer language plpgsql security definer set search_path=public as $$
declare rec record;n uuid;total integer:=0;begin
 for rec in select ss.user_id,s.id,s.payload->>'name' name,(s.payload->>'deadline')::date deadline,u.preferences from saved_schemes ss join schemes s on s.id=ss.scheme_id join users u on u.id=ss.user_id where s.status not in ('Archived','Expired','Draft') and nullif(s.payload->>'deadline','') is not null and (s.payload->>'deadline')::date between current_date and current_date+14 loop
 if not exists(select 1 from notifications where user_id=rec.user_id and payload->>'kind'='deadline' and payload->>'schemeId'=rec.id and payload->>'deadline'=rec.deadline::text) then
 n:=gen_random_uuid();insert into notifications values(n,rec.user_id,jsonb_build_object('id',n,'title','Scheme deadline approaching','body',rec.name||' closes on '||rec.deadline||'. Verify the official dates before applying.','kind','deadline','schemeId',rec.id,'deadline',rec.deadline,'read',false,'createdAt',now()));
 if coalesce((rec.preferences->>'email')::boolean,false) then insert into notification_outbox(user_id,notification_id,channel) values(rec.user_id,n,'email');end if;total:=total+1;end if;end loop;return total;
end $$;
revoke all on function public.queue_deadline_notifications() from public,anon,authenticated;
-- Supabase SQL editor: enable pg_cron, then schedule this after deployment:
-- select cron.schedule('yojanasetu-deadlines','0 3 * * *','select public.queue_deadline_notifications()');
