import type { Profile } from './types';

type Identity = { id: string; email?: string; user_metadata?: Record<string, unknown> };
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

// Metadata supplies display text only. Permissions always come from the matching profile.
export function accountDisplay(profile: Profile | null, identity: Identity): Profile | null {
    if (!profile || profile.id !== identity.id) return null;
    const metadata = identity.user_metadata ?? {};
    const email = text(identity.email) || profile.email;
    const name = (profile.onboarding_completed ? text(profile.name) : '') || text(metadata.full_name) || text(metadata.name) || text(metadata.display_name)
        || text(profile.name) || email;
    return { ...profile, name, email };
}
