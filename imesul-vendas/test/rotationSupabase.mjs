// Explicitly approved test project only. No migrations, DDL, HTTP or Meta calls.
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
const url = new URL(process.env.DATABASE_URL || 'http://missing');
assert.equal(url.hostname, 'aws-0-sa-east-1.pooler.supabase.com');
assert.equal(url.port, '6543');
assert(decodeURIComponent(url.username).endsWith('.bqsccrptfvzkhzeslbzl'));
assert.equal(process.env.CONFIRM_ROTATION_TEST, 'imesul-vendas-test');
const db = new pg.Pool({ connectionString: url.href, max: 3, connectionTimeoutMillis: 5000, ssl: { rejectUnauthorized: false } });
const prefix = `rrsup-${Date.now()}`;
const results = [];
const original = (await db.query("SELECT id,active FROM sales_sellers WHERE unit='campo-grande' ORDER BY id")).rows;
const cursor = (await db.query("SELECT last_seller_id FROM commercial_seller_rotation_state WHERE unit='campo-grande'")).rows[0];
assert(cursor, 'Apply only migration 006 before running');
const deadlocks = Number((await db.query('SELECT deadlocks FROM pg_stat_database WHERE datname=current_database()')).rows[0].deadlocks);
const baseline = Number((await db.query('SELECT count(*) FROM sales_leads')).rows[0].count);
let sellers = [];
let round = 0;
const own = `${prefix}%`;
const removeLeads = () => db.query('DELETE FROM sales_leads WHERE visitor_id LIKE $1', [own]);
const reset = async n => {
  await removeLeads();
  await db.query('UPDATE sales_sellers SET active = (id = ANY($1::bigint[])) WHERE id = ANY($2::bigint[])', [sellers.slice(0,n), sellers]);
  await db.query("UPDATE commercial_seller_rotation_state SET last_seller_id=NULL WHERE unit='campo-grande'");
};
const burst = async (instances, count, { sameKey, fault } = {}) => {
  round++;
  const children = [];
  try {
    const ready = [];
    for (let i=0;i<instances;i++) {
      const child = fork(new URL('./helpers/rotation-worker.mjs',import.meta.url), [], {
        execArgv:['--no-warnings','--loader',new URL('./helpers/rotation-loader.mjs',import.meta.url).href],
        stdio:['ignore','ignore','ignore','ipc'],
        env:{...process.env,DATABASE_URL:url.href,DATABASE_POOL_MAX:'3',ROTATION_TEST_FAULT:fault || ''}
      });
      children.push(child);
      ready.push(new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('worker startup timeout')),30000);
        child.once('message',()=>{clearTimeout(timer);resolve();});
        child.once('error',reject);
      }));
    }
    await Promise.all(ready);
    return (await Promise.all(children.map((child,i)=>new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('worker execution timeout')),60000);
      child.once('message',m=>{clearTimeout(timer);resolve(m.results || [{ok:false,reason:m.error}]);});
      child.once('exit',code=>{if(code===73){clearTimeout(timer);resolve([{interrupted:true}]);}});
      child.send({count,prefix:`${prefix}-${round}-${i}`,sameKey:sameKey ? `${prefix}-same-key` : undefined});
    })))).flat();
  } finally { children.forEach(c=>c.kill()); }
};
const snapshot = async () => {
  const rows=(await db.query('SELECT seller_id,count(*)::int AS n FROM sales_leads WHERE visitor_id LIKE $1 GROUP BY seller_id ORDER BY seller_id',[own])).rows;
  const [stats]=(await db.query(`SELECT count(*)::int AS total,count(DISTINCT idempotency_key)::int AS keys,
    count(DISTINCT lead_code)::int AS codes FROM sales_leads WHERE visitor_id LIKE $1`,[own])).rows;
  return { ...stats, nulls:rows.filter(r=>!r.seller_id).reduce((a,r)=>a+r.n,0), distribution:rows.map(r=>r.n),
    cursor:(await db.query("SELECT last_seller_id FROM commercial_seller_rotation_state WHERE unit='campo-grande'")).rows[0].last_seller_id };
};
const record = (name, passed, details) => {const item={name,passed,...details};results.push(item);console.log(JSON.stringify(item));};
const sequence = async (n,count) => {
  await reset(n);
  const response=await burst(1,count);
  const s=await snapshot();
  record(`${n} sellers / ${count} requests`,response.every(r=>r.ok)&&s.total===count&&s.nulls===0&&s.keys===count&&s.distribution.length===n&&Math.max(...s.distribution)-Math.min(...s.distribution)<=1,s);
};
try {
  console.log(JSON.stringify({project:'imesul-vendas-test',pooler:url.hostname,port:url.port,currentUser:(await db.query('SELECT current_user')).rows[0].current_user,prefix}));
  await db.query("UPDATE sales_sellers SET active=FALSE WHERE unit='campo-grande' AND active=TRUE");
  sellers=(await db.query(`INSERT INTO sales_sellers(name,whatsapp,unit) VALUES
    ($1,'5567900000001','campo-grande'),($2,'5567900000002','campo-grande'),($3,'5567900000003','campo-grande') RETURNING id`,[`${prefix}-1`,`${prefix}-2`,`${prefix}-3`])).rows.map(r=>r.id);
  for(const n of [1,2,3]) await sequence(n, n===2?101:100);
  await reset(3);
  const ids=[];
  ids.push((await burst(1,1))[0].seller?.id);
  await db.query('UPDATE sales_sellers SET active=FALSE WHERE id=$1',[sellers[1]]);
  ids.push((await burst(1,1))[0].seller?.id);
  await db.query('UPDATE sales_sellers SET active=FALSE WHERE id=$1',[sellers[2]]);
  ids.push((await burst(1,1))[0].seller?.id);
  await db.query('UPDATE sales_sellers SET active=TRUE WHERE id=$1',[sellers[1]]);
  ids.push((await burst(1,1))[0].seller?.id);
  record('disable / inactive last / reactivate',JSON.stringify(ids)===JSON.stringify([sellers[0],sellers[2],sellers[0],sellers[1]]),{ids});
  await db.query('UPDATE sales_sellers SET active=FALSE WHERE id=ANY($1::bigint[])',[sellers]);
  const before=await snapshot(); const none=await burst(1,1);
  record('no active seller',none[0].code==='NO_ACTIVE_SELLER'&&JSON.stringify(before)===JSON.stringify(await snapshot()),{});
  await reset(2);
  const rollback=await burst(1,1,{fault:'before-commit'});
  const rolled=await snapshot();
  record('rollback lead and cursor',!rollback[0].ok&&rolled.total===0&&rolled.cursor===null,rolled);
  await reset(2);
  const crashed=await burst(1,1,{fault:'after-commit'});
  const [pending]=(await db.query(`SELECT count(*)::int AS n FROM sales_leads WHERE visitor_id LIKE $1 AND rotation_creation_audit IS NOT NULL`,[own])).rows;
  const [preEvents]=(await db.query('SELECT count(*)::int AS n FROM sales_lead_events WHERE lead_id IN (SELECT id FROM sales_leads WHERE visitor_id LIKE $1)',[own])).rows;
  await burst(1,1);
  const [post]=(await db.query(`SELECT count(*)::int AS events,count(DISTINCT (lead_id,event_type))::int AS distinct_events FROM sales_lead_events WHERE lead_id IN (SELECT id FROM sales_leads WHERE visitor_id LIKE $1)`,[own])).rows;
  const [remaining]=(await db.query('SELECT count(*)::int AS n FROM sales_leads WHERE visitor_id LIKE $1 AND rotation_creation_audit IS NOT NULL',[own])).rows;
  record('process killed after COMMIT / audit recovered by new process',crashed[0].interrupted&&pending.n===1&&preEvents.n===0&&post.events===4&&post.distinct_events===4&&remaining.n===0,{pendingBefore:pending.n,eventsBefore:preEvents.n,...post,pendingAfter:remaining.n});
  await reset(2);
  const same=await burst(4,25,{sameKey:true});
  const dedup=await snapshot();
  const next=(await burst(1,1))[0];
  record('100 identical keys / cursor advances once',same.every(r=>r.ok)&&dedup.total===1&&dedup.cursor===sellers[0]&&next.seller?.id===sellers[1],{...dedup,ok:same.filter(r=>r.ok).length});
  for(const instances of [2,4]) for(let repetition=1;repetition<=5;repetition++){
    await reset(2);
    const started=Date.now();const response=await burst(instances,100);const s=await snapshot();
    const ok=response.filter(r=>r.ok).length;
    record(`${instances} instances x 100 / round ${repetition}`,ok===instances*100&&s.total===instances*100&&s.nulls===0&&s.keys===s.total&&s.codes===s.total&&s.distribution.length===2&&Math.max(...s.distribution)-Math.min(...s.distribution)<=1,{...s,ok,failed:response.length-ok,elapsedMs:Date.now()-started});
  }
  const finalDeadlocks=Number((await db.query('SELECT deadlocks FROM pg_stat_database WHERE datname=current_database()')).rows[0].deadlocks);
  record('deadlocks delta',finalDeadlocks===deadlocks,{delta:finalDeadlocks-deadlocks});
} finally {
  await removeLeads();
  await db.query('DELETE FROM sales_sellers WHERE id=ANY($1::bigint[])',[sellers]);
  for(const seller of original) await db.query('UPDATE sales_sellers SET active=$2 WHERE id=$1',[seller.id,seller.active]);
  await db.query("UPDATE commercial_seller_rotation_state SET last_seller_id=$1 WHERE unit='campo-grande'",[cursor.last_seller_id]);
  record('preexisting lead count preserved',Number((await db.query('SELECT count(*) FROM sales_leads')).rows[0].count)===baseline,{baseline});
  const report=path.join(tmpdir(),`${prefix}.json`);await writeFile(report,JSON.stringify(results,null,2));console.log(`Report: ${report}`);
  await db.end();
}
if(results.some(r=>!r.passed)) process.exitCode=1;
