import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentDefinitions } from '../lib/gx/assessment-definitions.ts';
import { assessmentDue, scoreAssessment, type Assessment } from '../lib/gx/student-profile.ts';

test('ATEC and Stress section counts, choice direction and exact bounds',()=>{
 assert.deepEqual(assessmentDefinitions.atec.map(s=>s.questions.length),[14,20,18,25]);
 assert.deepEqual(assessmentDefinitions.stress.map(s=>s.questions.length),[7,16,4,3]);
 for(const kind of ['atec','stress'] as const){
  const sections=assessmentDefinitions[kind];
  const choices=(max:boolean)=>sections.flatMap(s=>s.questions.map(()=>s.options.findIndex(o=>o.value===(max?Math.max:Math.min)(...s.options.map(o=>o.value)))));
  assert.deepEqual(scoreAssessment(kind,choices(true)),{scores:sections.map(s=>s.max),total:kind==='atec'?179:150});
  assert.equal(scoreAssessment(kind,choices(false)).total,kind==='atec'?0:30);
  assert.throws(()=>scoreAssessment(kind,[]));
  const bad=choices(false);bad[0]=-1;assert.throws(()=>scoreAssessment(kind,bad));bad[0]=0.5;assert.throws(()=>scoreAssessment(kind,bad));bad[0]=99;assert.throws(()=>scoreAssessment(kind,bad));
 }
 assert.deepEqual(assessmentDefinitions.atec.map(s=>s.options.map(o=>o.value)),[[2,1,0],[0,1,2],[2,1,0],[0,1,2,3]]);
 assert.deepEqual(assessmentDefinitions.stress[0].options.map(o=>o.label),['Không đúng','Ít đúng','Thỉnh thoảng','Thường xuyên','Rất đúng']);
});
const attempt=(kind:'atec'|'stress',parent_id:string,submitted_at:string)=>({kind,parent_id,submitted_at} as Assessment);
test('first deadline, exact 56 day boundary and individual parent Stress clocks',()=>{
 const start='2026-01-01',first=Date.parse(start+'T00:00:00+07:00');
 assert.equal(assessmentDue('atec',start,[],undefined,first-1).overdue,false);
 assert.equal(assessmentDue('atec',start,[],undefined,first).overdue,true);
 assert.equal(assessmentDue('atec','',[]).due,null);
 const history=[attempt('atec','p1','2026-03-01T05:00:00Z'),attempt('stress','p1','2026-04-01T05:00:00Z'),attempt('stress','p2','2026-05-01T05:00:00Z')];
 const deadline=Date.parse(history[0].submitted_at)+56*86400000;
 assert.equal(assessmentDue('atec',start,history,'p2',deadline-1).overdue,false);
 assert.equal(assessmentDue('atec',start,history,'p2',deadline).overdue,true);
 assert.equal(assessmentDue('stress',start,history,'p1').latest?.parent_id,'p1');
 assert.equal(assessmentDue('stress',start,history,'p2').latest?.parent_id,'p2');
 assert.equal(assessmentDue('stress',start,history,'p3').due,first);
 history.push(attempt('atec','p2','2026-03-10T05:00:00Z'));
 assert.equal(assessmentDue('atec',start,history).due,Date.parse('2026-03-10T05:00:00Z')+56*86400000);
});

test('version 1 form content remains identical to verified supplied sources',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(assessmentDefinitions)).digest('hex'),'e05dab121dfa838a849b87eb96b87d19e452116a76715d7b205d59dd872e3891');
});
