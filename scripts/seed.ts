import { writeFile } from 'node:fs/promises';
import { seedSchemes } from '../database/seed';
import { industries, states, objectives } from '../lib/validation';
const quote = (v: unknown) =>
  "'" + JSON.stringify(v).replaceAll("'", "''") + "'::jsonb";
let sql =
  '-- Clearly labelled illustrative records; no official scheme claims.\n';
for (const s of seedSchemes) {
  sql += `insert into public.schemes(id,payload) values ('${s.id}',${quote(s)}) on conflict(id) do nothing;\n`;
  for (const r of s.rules)
    sql += `insert into public.scheme_eligibility_rules(scheme_id,payload) values ('${s.id}',${quote(r)});\n`;
  sql += `insert into public.scheme_benefits values ('${s.id}',${quote({ benefit: s.benefit, maximumBenefit: s.maximumBenefit })}) on conflict do nothing;\n`;
  for (const d of s.documents)
    sql += `insert into public.scheme_documents values ('${s.id}','${d.replaceAll("'", "''")}') on conflict do nothing;\n`;
  sql += `insert into public.scheme_deadlines values ('${s.id}',${s.deadline ? "'" + s.deadline + "'" : 'null'}) on conflict do nothing;\n`;
}
for (const [k, v] of Object.entries({
  industries,
  states,
  categories: objectives,
}))
  sql += `insert into public.taxonomy values ('${k}',${quote(v)}) on conflict do nothing;\n`;
await writeFile('supabase/seed.sql', sql);
