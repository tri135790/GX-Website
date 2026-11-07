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
    assert.deepEqual(readAuthLink('https://example.com/#error=access_denied&error_code=otp_expired'), { password: true, invalid: true });
});
