import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectBlueprintQuestions,validatePaperBlueprint} from '../lib/services/paper-blueprint';

test('complete requires published questions and exact configured type and topic targets',()=>{
 const blueprint={count:3,types:{SBA:2,EMQ:1},topics:{a:2,b:1}};
 const questions=[{status:'published',type:'SBA',topicId:'a'},{status:'published',type:'SBA',topicId:'a'},{status:'published',type:'EMQ',topicId:'b'}];
 assert.deepEqual(validatePaperBlueprint(blueprint,questions),{complete:true,issues:[]});
 assert.equal(validatePaperBlueprint(blueprint,[...questions.slice(0,2),{...questions[2],status:'approved'}]).complete,false);
 assert.equal(validatePaperBlueprint(blueprint,[...questions.slice(0,2),{...questions[2],type:null}]).complete,false);
 assert.equal(validatePaperBlueprint(blueprint,[...questions.slice(0,2),{...questions[2],topicId:'c'}]).complete,false);
});
test('proposal selection finds an allocation even when a greedy choice would block it',()=>{
 const blueprint={count:2,types:{SBA:1,EMQ:1},topics:{a:1,b:1}};
 const pool=[{id:'1',type:'SBA',topicId:'a'},{id:'2',type:'SBA',topicId:'b'},{id:'3',type:'EMQ',topicId:'a'}];
 assert.deepEqual(selectBlueprintQuestions(blueprint,pool)?.map(q=>q.id),['2','3']);
 assert.equal(selectBlueprintQuestions(blueprint,pool.slice(0,2)),null);
 assert.equal(selectBlueprintQuestions({count:2},pool),null);
});
test('missing, malformed and inconsistent blueprints cannot produce a complete paper',()=>{
 const question={status:'published',type:'SBA',topicId:'a'};
 for (const blueprint of [{},{count:1},{count:1,types:{SBA:1},topics:{a:2}},{count:1,types:{SBA:-1},topics:{a:1}},{count:1,types:{SBA:1.5},topics:{a:1}}]) {
  assert.equal(validatePaperBlueprint(blueprint,[question]).complete,false);
 }
 assert.equal(validatePaperBlueprint({count:1,types:{SBA:1},topics:{a:1}},[question,question]).complete,false);
});
