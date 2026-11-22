import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSavedParticipants} from '../lib/gx/work-persistence.ts';
import type {Lesson} from '../lib/gx/types.ts';
const meeting={id:'m',work_kind:'meeting',employee_id:'a',support_employee_ids:['b','c']} as Lesson;
test('save verification catches old database triggers silently removing participants',()=>{
 assert.throws(()=>assertSavedParticipants([meeting],[{...meeting,support_employee_ids:[]}]),/migration 009\/010/);
 assert.throws(()=>assertSavedParticipants([meeting],[]));
 assert.doesNotThrow(()=>assertSavedParticipants([meeting],[{...meeting,support_employee_ids:['c','b']}]));
});
test('save verification catches missing or changed roles',()=>{
 const combined={...meeting,work_kind:'consultation_therapy',participant_roles:{a:'consultation',b:'therapy',c:'therapy'}} as Lesson;
 assert.throws(()=>assertSavedParticipants([combined],[{...combined,participant_roles:{}}]));
 assert.throws(()=>assertSavedParticipants([combined],[{...combined,participant_roles:{a:'therapy',b:'therapy',c:'therapy'}}]));
 assert.doesNotThrow(()=>assertSavedParticipants([combined],[combined]));
});
