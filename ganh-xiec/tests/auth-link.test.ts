import test from 'node:test';
import assert from 'node:assert/strict';
import { readAuthLink, passwordUrl } from '../lib/gx/auth-link.ts';

test('password route persists after callback fragment is consumed and preserves Pages subpath', () => {
    const target = passwordUrl('https://tri135790.github.io/GX-Website/');
    assert.equal(target, 'https://tri135790.github.io/GX-Website/?auth=password');
    assert.equal(readAuthLink(target).password, true);
    assert.equal(readAuthLink(target + '#type=invite&access_token=test').password, true);
});
test('legacy invite and recovery links open password page, ordinary sign-in does not', () => {
    assert.equal(readAuthLink('https://example.com/#type=invite').password, true);
    assert.equal(readAuthLink('https://example.com/#type=recovery').password, true);
    assert.equal(readAuthLink('https://example.com/#type=signup').password, false);
    assert.equal(readAuthLink('https://example.com/').password, false);
});
test('expired callback is recognized even if type was omitted', () => {
    const link = readAuthLink('https://example.com/#error=access_denied&error_code=otp_expired');
    assert.equal(link.password, true);
    assert.equal(link.invalid, true);
    assert.equal(link.tokenHash, null);
    assert.equal(link.otpType, null);
});
test('invite and recovery token hashes open the password page without consuming a server redirect', () => {
    const invite = readAuthLink('https://tri135790.github.io/GX-Website/?auth=password&token_hash=abc&type=invite');
    assert.equal(invite.password, true);
    assert.equal(invite.invalid, false);
    assert.equal(invite.tokenHash, 'abc');
    assert.equal(invite.otpType, 'invite');
    const recovery = readAuthLink('https://example.com/?token_hash=def&type=recovery');
    assert.equal(recovery.password, true);
    assert.equal(recovery.otpType, 'recovery');
    assert.equal(readAuthLink('https://example.com/?token_hash=xyz&type=signup').password, false);
});
test('password url adds a trailing slash and drops one-time token parameters', () => {
    assert.equal(passwordUrl('https://tri135790.github.io/GX-Website'), 'https://tri135790.github.io/GX-Website/?auth=password');
    assert.equal(passwordUrl('https://tri135790.github.io/GX-Website/?auth=password&token_hash=abc&type=invite'), 'https://tri135790.github.io/GX-Website/?auth=password');
});
