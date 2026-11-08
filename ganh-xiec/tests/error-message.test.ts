import {test} from 'node:test';
import assert from 'node:assert/strict';
import {errorMessage} from '../lib/gx/errors.ts';

test('PostgREST missing-function error points at migration 003',()=>{
  const message = errorMessage({code:'PGRST202',message:'Could not find the function public.complete_my_profile(p_name) in the schema cache',details:'no matches'});
  assert.match(message,/migration 003_profile_onboarding\.sql/);
});

test('plain PostgrestError keeps the server message',()=>{
  assert.equal(errorMessage({code:'42501',message:'Tài khoản chưa được cấp quyền hoặc đã bị khóa.'}),'Tài khoản chưa được cấp quyền hoặc đã bị khóa.');
});

test('unknown values fall back and Error instances win',()=>{
  assert.equal(errorMessage(null,'Không lưu được hồ sơ. Vui lòng thử lại.'),'Không lưu được hồ sơ. Vui lòng thử lại.');
  assert.equal(errorMessage(new Error('Mạng không ổn định.')),'Mạng không ổn định.');
});
