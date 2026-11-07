/** Read before Supabase consumes or removes the callback fragment. */
export type OtpLinkType = 'invite' | 'recovery';

export function readAuthLink(href: string) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const type = url.searchParams.get('type') || hash.get('type');
  const otpType: OtpLinkType | null = type === 'invite' || type === 'recovery' ? type : null;
  const tokenHash = url.searchParams.get('token_hash') || hash.get('token_hash');
  const invalid = hash.has('error') || hash.has('error_code') || url.searchParams.has('error') || url.searchParams.has('error_code');
  return {
    password: url.searchParams.get('auth') === 'password' || otpType !== null || invalid,
    invalid,
    tokenHash: otpType && tokenHash ? tokenHash : null,
    otpType: otpType && tokenHash ? otpType : null,
  };
}

/** Canonical password page. A trailing slash avoids a host redirect that drops the URL fragment. */
export function passwordUrl(base: string) {
  const url = new URL(base);
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  url.hash = '';
  url.searchParams.delete('token_hash');
  url.searchParams.delete('type');
  url.searchParams.set('auth', 'password');
  return url.href;
}
