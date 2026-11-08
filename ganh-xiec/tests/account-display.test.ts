import test from 'node:test';
import assert from 'node:assert/strict';
import { accountDisplay } from '../lib/gx/account-display.ts';

const profile = { id: 'second-admin', version: 1, name: 'Thanh Trí', email: 'old@example.com', role: 'admin' as const, active: true, employee_id: null, parent_id: null };
test('shows the signed-in identity name and email while preserving database permissions', () => {
    const result = accountDisplay(profile, { id: profile.id, email: 'tri135790NK@gmail.com', user_metadata: { full_name: 'Tên tài khoản thứ hai', role: 'parents' } });
    assert.equal(result?.name, 'Tên tài khoản thứ hai');
    assert.equal(result?.email, 'tri135790NK@gmail.com');
    assert.equal(result?.role, 'admin');
    assert.equal(profile.name, 'Thanh Trí');
});
test('does not display a profile belonging to another identity', () => {
    assert.equal(accountDisplay(profile, { id: 'another-admin' }), null);
});
test('keeps the name explicitly entered during onboarding over the provider name', () => {
    assert.equal(accountDisplay({ ...profile, name: 'Tên tự chọn', onboarding_completed: true }, { id: profile.id, user_metadata: { full_name: 'Tên Google cũ' } })?.name, 'Tên tự chọn');
});
test('supports provider name variants and falls back for email/password users', () => {
    assert.equal(accountDisplay(profile, { id: profile.id, user_metadata: { full_name: ' ', name: 'Tên Google' } })?.name, 'Tên Google');
    assert.equal(accountDisplay(profile, { id: profile.id })?.name, profile.name);
    assert.equal(accountDisplay({ ...profile, name: '' }, { id: profile.id, email: 'member@example.com' })?.name, 'member@example.com');
});
