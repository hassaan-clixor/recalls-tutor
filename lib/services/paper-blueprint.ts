import type {Database} from '../db/client';
/** Blueprint counts are explicit whole-question targets supplied by the exam team. */
export type PaperBlueprint = {
 count?: number;
 types?: Record<string, number>;
 topics?: Record<string, number>;
};
export type BlueprintQuestion = {status: string; type: string | null; topicId: string | null};
export type BlueprintValidation = {complete: boolean; issues: string[]};
export async function validateStoredPaper(db:Database,paperId:string,lock=false):Promise<BlueprintValidation> {
 const [row]=await db.query<{blueprint:PaperBlueprint}>(`SELECT e.blueprint FROM papers p JOIN exams e ON e.id=p.exam_id WHERE p.id=$1${lock?' FOR SHARE OF e':''}`,[paperId]);
 if(!row)return {complete:false,issues:['Paper not found.']};
 const items=await db.query<BlueprintQuestion>(`SELECT q.status,q.question_type AS type,COALESCE(t.parent_id,t.id)::text AS "topicId" FROM paper_questions pq JOIN questions q ON q.id=pq.question_id LEFT JOIN topics t ON t.id=q.topic_id WHERE pq.paper_id=$1 ORDER BY pq.position${lock?' FOR SHARE OF q':''}`,[paperId]);
 return validatePaperBlueprint(row.blueprint,items);
}

function targets(value: unknown, count: number): value is Record<string, number> {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
 const entries = Object.entries(value);
 return entries.length > 0 && entries.every(([key, n]) => key.trim().length > 0 && typeof n === 'number' && Number.isInteger(n) && n >= 0)
  && entries.reduce((sum, [, n]) => sum + n, 0) === count;
}
export function hasCompleteBlueprint(blueprint: PaperBlueprint | null | undefined): boolean {
 const count=blueprint?.count;
 return !!count && Number.isInteger(count) && count>0 && targets(blueprint?.types,count) && targets(blueprint?.topics,count);
}

/** Find a feasible type/topic allocation, including cases where a greedy selection fails. */
export function selectBlueprintQuestions<T extends {id:string;type:string|null;topicId:string|null}>(blueprint:PaperBlueprint, ranked:T[]):T[] | null {
 if(!hasCompleteBlueprint(blueprint))return null;
 type Edge={to:number;rev:number;cap:number};
 const graph:Edge[][]=[];
 const node=()=>{graph.push([]);return graph.length-1;};
 const add=(from:number,to:number,cap:number)=>{const edge:Edge={to,rev:graph[to].length,cap};graph[from].push(edge);graph[to].push({to:from,rev:graph[from].length-1,cap:0});return edge;};
 const source=node(),sink=node();
 const types=new Map(Object.entries(blueprint.types!).map(([key,n])=>{const v=node();add(source,v,n);return [key,v] as const;}));
 const topics=new Map(Object.entries(blueprint.topics!).map(([key,n])=>{const v=node();add(v,sink,n);return [key,v] as const;}));
 const groups=new Map<string,Map<string,T[]>>();
 for(const q of ranked){if(!q.type||!q.topicId||!types.has(q.type)||!topics.has(q.topicId))continue;let byTopic=groups.get(q.type);if(!byTopic){byTopic=new Map();groups.set(q.type,byTopic);}const list=byTopic.get(q.topicId)??[];list.push(q);byTopic.set(q.topicId,list);}
 const edges:{edge:Edge;list:T[];capacity:number}[]=[];
 for(const [type,byTopic] of groups)for(const [topic,list] of byTopic){const edge=add(types.get(type)!,topics.get(topic)!,list.length);edges.push({edge,list,capacity:list.length});}
 let flow=0;
 while(flow<blueprint.count!){
  const parent:Array<{node:number;edge:number}|null>=Array(graph.length).fill(null);const queue=[source];parent[source]={node:source,edge:-1};
  for(let i=0;i<queue.length&&!parent[sink];i++){const from=queue[i];graph[from].forEach((edge,index)=>{if(edge.cap>0&&!parent[edge.to]){parent[edge.to]={node:from,edge:index};queue.push(edge.to);}});}
  if(!parent[sink])break;
  let amount=blueprint.count!-flow;for(let v=sink;v!==source;){const p=parent[v]!;amount=Math.min(amount,graph[p.node][p.edge].cap);v=p.node;}
  for(let v=sink;v!==source;){const p=parent[v]!,edge=graph[p.node][p.edge];edge.cap-=amount;graph[v][edge.rev].cap+=amount;v=p.node;}flow+=amount;
 }
 if(flow!==blueprint.count)return null;
 const chosen=new Set(edges.flatMap(({edge,list,capacity})=>list.slice(0,capacity-edge.cap).map(q=>q.id)));
 return ranked.filter(q=>chosen.has(q.id));
}

/** Never infer an exam blueprint or question classification from incomplete data. */
export function validatePaperBlueprint(blueprint: PaperBlueprint | null | undefined, questions: BlueprintQuestion[]): BlueprintValidation {
 const issues: string[] = [];
 const count = blueprint?.count;
 if (!Number.isInteger(count) || !count || count < 1) return {complete:false,issues:['The paper question count is not configured.']};
 const published = questions.filter(q => q.status === 'published');
 if (questions.length !== published.length) issues.push('Every question must be published.');
 if (published.length !== count) issues.push(`Expected ${count} published questions; found ${published.length}.`);
 const check = (label: string, configured: unknown, field: 'type'|'topicId') => {
  if (!targets(configured, count)) {issues.push(`The ${label} targets are missing or do not add up to ${count}.`);return;}
  const actual = new Map<string,number>();
  for (const question of published) {
   const value = question[field];
   if (value) actual.set(value,(actual.get(value) ?? 0)+1);
   else issues.push(`A published question has no ${label === 'type' ? 'question type' : 'top-level topic'}.`);
  }
  for (const [key, expected] of Object.entries(configured)) {
   const found = actual.get(key) ?? 0;
   if (found !== expected) issues.push(`${label} ${key}: expected ${expected}, found ${found}.`);
   actual.delete(key);
  }
  for (const [key, found] of actual) issues.push(`${label} ${key} is not in the blueprint (${found} found).`);
 };
 check('type',blueprint?.types,'type');
 check('topic',blueprint?.topics,'topicId');
 return {complete:issues.length===0,issues:[...new Set(issues)]};
}
