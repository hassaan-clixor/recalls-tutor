import {test} from 'node:test';
import assert from 'node:assert/strict';
import {jobWarning} from '../lib/services/ai-studio';
test('a capped or partly invalid AI answer is flagged instead of looking complete',()=>{
 assert.equal(jobWarning(5,0),null);
 assert.match(jobWarning(12,0)!,/maximum of 12 drafts/);
 assert.match(jobWarning(3,1)!,/1 draft failed validation and was discarded/);
 assert.match(jobWarning(12,2)!,/maximum of 12.*2 drafts failed validation and were discarded/);
});
