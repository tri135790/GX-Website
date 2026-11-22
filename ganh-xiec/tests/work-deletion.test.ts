import test from 'node:test';
import assert from 'node:assert/strict';
import {workDeleteSnapshot} from '../lib/gx/work-deletion.ts';
import type {Lesson} from '../lib/gx/types.ts';
test('meeting series deletion spans technical owners and preserves completed work',()=>{
 const anchor={id:'a',version:1,work_kind:'meeting',series_id:'series',employee_id:'e1',starts_at:'2026-11-02T08:00:00+07:00',status:'scheduled',actual_minutes:0} as Lesson;
 const next={...anchor,id:'b',employee_id:'e2',starts_at:'2026-11-09T08:00:00+07:00'};
 const completed={...next,id:'c',status:'completed',actual_minutes:60} as Lesson;
 assert.deepEqual(workDeleteSnapshot([anchor,next,completed],anchor,'future'),[{id:'a',version:1,deletable:true},{id:'b',version:1,deletable:true},{id:'c',version:1,deletable:false}]);
 assert.equal(workDeleteSnapshot([anchor,next],{...anchor,work_kind:'report'},'future').length,1);
});
