import { AuthShell } from '@/components/auth/auth-shell';
import { SignUpForm } from '@/components/auth/forms';
import { googleEnabled } from '@/lib/auth/providers';
import { demoNoEmail } from '@/lib/auth/demo';
// Read at request time, so turning Google sign-in on or off needs no rebuild.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create your account' };
export default function SignUpPage() { return <AuthShell title="Make room for progress." description="Create your Recalls Tutor account. Your preparation, in one place."><SignUpForm google={googleEnabled()} demo={demoNoEmail()} /></AuthShell>; }
