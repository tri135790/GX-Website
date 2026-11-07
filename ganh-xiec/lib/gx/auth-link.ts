/** Read before Supabase consumes/removes the callback fragment. */
export function readAuthLink(href: string) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const type = hash.get('type');
  const invalid = hash.has('error') || hash.has('error_code') || url.searchParams.has('error') || url.searchParams.has('error_code');
  return {
    password: url.searchParams.get('auth') === 'password' || type === 'invite' || type === 'recovery' || invalid,
    invalid,
  };
}
export function passwordUrl(base: string) {
  const url = new URL(base);
  url.hash = '';
  url.searchParams.set('auth', 'password');
  return url.href;
}
