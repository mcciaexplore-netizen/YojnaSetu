// Supabase Edge Function. Invoke from a trusted scheduler with NOTIFICATION_JOB_SECRET.
// Secrets are configured on the Edge Function only, never NEXT_PUBLIC_* variables.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
Deno.serve(async(request:Request)=>{
 const secret=Deno.env.get('NOTIFICATION_JOB_SECRET');
 if(!secret||request.headers.get('Authorization')!==`Bearer ${secret}`)return new Response('Unauthorized',{status:401});
 const key=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('NOTIFICATION_FROM_EMAIL');
 if(!key||!from)return new Response('Email delivery is not configured.',{status:503});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {data:jobs,error}=await db.from('notification_outbox').select('id,user_id,notification_id,attempts').eq('channel','email').eq('status','pending').lt('attempts',5).limit(50);
 if(error)return new Response('Queue unavailable',{status:503});
 let sent=0;
 for(const job of jobs??[]){
 const [{data:user},{data:notification}]=await Promise.all([db.from('users').select('email,preferences').eq('id',job.user_id).single(),db.from('notifications').select('payload').eq('id',job.notification_id).eq('user_id',job.user_id).single()]);
 if(!user?.preferences?.email||!notification){await db.from('notification_outbox').update({status:'cancelled'}).eq('id',job.id);continue}
 try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':job.id},body:JSON.stringify({from,to:user.email,subject:notification.payload.title,text:notification.payload.body+'\n\nYojanaSetu: relevance is not a guarantee of approval.'})});
 await db.from('notification_outbox').update({attempts:job.attempts+1,status:response.ok?'sent':job.attempts>=4?'failed':'pending'}).eq('id',job.id);if(response.ok)sent++;
 }catch{await db.from('notification_outbox').update({attempts:job.attempts+1,status:job.attempts>=4?'failed':'pending'}).eq('id',job.id)}
 }return Response.json({sent});
});
