import type {Database} from '../../db/client';
import type {CooldownStore,RateLimitStore} from './fallback';
export function databaseCooldowns(db:Database):CooldownStore {
 return {
  async isCooling(model){return (await db.query('SELECT 1 FROM llm_model_cooldowns WHERE model_name=$1 AND unavailable_until>now()',[model])).length>0;},
  async markUnavailable(model,seconds){await db.query(`INSERT INTO llm_model_cooldowns(model_name,unavailable_until) VALUES($1,now()+make_interval(secs=>$2)) ON CONFLICT(model_name) DO UPDATE SET unavailable_until=GREATEST(llm_model_cooldowns.unavailable_until,EXCLUDED.unavailable_until),updated_at=now()`,[model,seconds]);}
 };
}
export function databaseRateLimits(db:Database,limits:Map<string,number>):RateLimitStore {
 return {async acquire(model){
  const limit=limits.get(model);if(limit===undefined)return true;
  const rows=await db.query(`INSERT INTO llm_model_rate_limits(model_name,window_started_at,request_count) VALUES($1,now(),1)
   ON CONFLICT(model_name) DO UPDATE SET window_started_at=CASE WHEN llm_model_rate_limits.window_started_at<=now()-interval '1 minute' THEN now() ELSE llm_model_rate_limits.window_started_at END,
   request_count=CASE WHEN llm_model_rate_limits.window_started_at<=now()-interval '1 minute' THEN 1 ELSE llm_model_rate_limits.request_count+1 END
   WHERE llm_model_rate_limits.window_started_at<=now()-interval '1 minute' OR llm_model_rate_limits.request_count<$2 RETURNING model_name`,[model,limit]);
  return rows.length>0;
 }};
}
