import { createAuthClient } from 'better-auth/client';
import { twoFactorClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? `${window.location.origin}/api/auth` : '/api/auth',
  plugins: [
    twoFactorClient(),
  ],
});
