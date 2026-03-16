import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { authClient } from './authClient';
import type { User, TwoFactorSetupData, AuthContextType } from './types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Parse response body as JSON without throwing on empty or invalid body. */
async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Extract error message from auth API error response for throwing. */
async function getAuthErrorMessage(
  res: Response,
  getFallback: (status: number) => string
): Promise<string> {
  const err = await safeJson<{ message?: string; error?: string }>(res);
  return err?.message || err?.error || getFallback(res.status);
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

const JWT_STORAGE_KEY = 'myrtest_jwt_token';
const PENDING_OTP_KEY = 'pending_email_otp_user_id';

function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

/** Returns ms until the token expires, or 0 if already expired / unparseable. */
function msUntilJwtExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (typeof payload.exp !== 'number') return 0;
    return Math.max(0, payload.exp * 1000 - Date.now());
  } catch {
    return 0;
  }
}

// Refresh the JWT 2 minutes before it expires to avoid mid-request failures.
const JWT_REFRESH_BUFFER_MS = 2 * 60 * 1000;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [jwtLoading, setJwtLoading] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchJwtFromSession = async (): Promise<boolean> => {
    setJwtLoading(true);
    try {
      const res = await fetch('/api/auth/jwt-from-session', { credentials: 'include' });
      if (!res.ok) return false;
      const data = await safeJson<{ token: string }>(res);
      if (data?.token) {
        setJwtToken(data.token);
        localStorage.setItem(JWT_STORAGE_KEY, data.token);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setJwtLoading(false);
    }
  };

  /**
   * Syncs auth state with the server session.
   *
   * @param commitSync - Pass `true` when navigating immediately after this call
   *   (e.g. after 2FA/OTP verification). Wraps the state update in flushSync so
   *   the user is committed before the caller calls navigate(), avoiding the
   *   React 18 concurrent-mode race condition.
   *   Do NOT pass `true` from inside a useEffect or React lifecycle — only from
   *   user-initiated event handlers.
   */
  const checkSession = async (commitSync = false) => {
    try {
      const res = await fetch('/api/auth/get-session', { credentials: 'include' });
      const data = await safeJson<{ user?: unknown }>(res);
      if (res.ok) {
        if (data?.user) {
          const stored = localStorage.getItem(JWT_STORAGE_KEY);
          const storedIsValid = stored !== null && !isJwtExpired(stored);
          const applyUser = () => {
            setUser(data.user as User);
            if (storedIsValid) setJwtToken(stored);
          };
          if (commitSync) {
            flushSync(applyUser);
          } else {
            applyUser();
          }
          if (!storedIsValid) {
            if (stored) localStorage.removeItem(JWT_STORAGE_KEY);
            await fetchJwtFromSession();
          }
        } else {
          setUser(null);
          setJwtToken(null);
        }
      } else {
        setUser(null);
        setJwtToken(null);
      }
    } catch (error) {
      console.error('Session check failed:', error);
      setUser(null);
      setJwtToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  // Schedule a silent JWT refresh before the token expires.
  useEffect(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    if (!jwtToken || !user) return;

    const delay = msUntilJwtExpiry(jwtToken) - JWT_REFRESH_BUFFER_MS;
    if (delay <= 0) {
      // Already within the buffer window — refresh immediately.
      fetchJwtFromSession();
      return;
    }

    refreshTimerRef.current = setTimeout(() => {
      fetchJwtFromSession();
    }, delay);

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [jwtToken, user]);

  const fetchJwtToken = async (email: string, password: string): Promise<boolean> => {
    setJwtLoading(true);
    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        // Fallback: try to recover JWT from the established session cookie.
        const fromSession = await fetchJwtFromSession();
        if (!fromSession) {
          throw new Error('Failed to obtain access token');
        }
        return true;
      }

      const data = await safeJson<{ token?: string; requires2FA?: boolean; userId?: string }>(res);

      if (data?.requires2FA && data?.userId) {
        sessionStorage.setItem(PENDING_OTP_KEY, data.userId);
        return false;
      }

      if (data?.token) {
        setJwtToken(data.token);
        localStorage.setItem(JWT_STORAGE_KEY, data.token);
        return true;
      }

      // If the token endpoint succeeded but did not return a token, fall back to the session.
      const fromSession = await fetchJwtFromSession();
      if (!fromSession) {
        throw new Error('No access token returned from auth server');
      }
      return true;
    } finally {
      setJwtLoading(false);
    }
  };

  /**
   * Signs in with email/password.
   *
   * Uses flushSync so the user state update is committed to the DOM before the
   * caller navigates away — this prevents the React 18 concurrent-mode race
   * condition where Dashboard renders with user=null and immediately redirects
   * back to /login.
   *
   * Returns flags when additional steps are required:
   *   twoFactorRedirect — TOTP 2FA challenge needed (navigate to /auth/2fa-challenge)
   *   emailOtpRequired  — Email OTP needed (navigate to /auth/email-otp)
   */
  const login = async (
    email: string,
    password: string
  ): Promise<{ twoFactorRedirect?: true; emailOtpRequired?: true }> => {
    const res = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    if (!res.ok) {
      const msg = await getAuthErrorMessage(res, (status) =>
        status === 502 || status === 503
          ? 'Login failed (backend unreachable—check if the API is running)'
          : status === 403
            ? 'Login failed (forbidden—check allowed origins)'
            : `Login failed (${status})`
      );
      throw new Error(msg);
    }

    const data = await safeJson<{ user?: User; twoFactorRedirect?: boolean }>(res);

    if (data?.twoFactorRedirect) {
      return { twoFactorRedirect: true };
    }

    if (data?.user) {
      try {
        const gotToken = await fetchJwtToken(email, password);
        if (!gotToken) {
          // Email OTP pending — do not expose user in state until OTP is verified.
          return { emailOtpRequired: true };
        }
      } catch {
        // JWT fetch failed — proceed as authenticated; JWT can be refreshed later.
      }

      // flushSync ensures the state update is committed before the caller
      // calls navigate(), preventing the React 18 concurrent-mode race condition
      // where Dashboard renders with user=null and redirects back to /login.
      flushSync(() => {
        setUser(data.user as User);
      });
    }

    return {};
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
      credentials: 'include',
    });

    if (!res.ok) {
      const msg = await getAuthErrorMessage(res, (status) =>
        status === 502 || status === 503
          ? 'Registration failed (backend unreachable—check if the API is running)'
          : status === 403
            ? 'Registration failed (forbidden—check allowed origins)'
            : `Registration failed (${status})`
      );
      throw new Error(msg);
    }

    const data = await safeJson<{ user?: User }>(res);
    if (data?.user) setUser(data.user);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
    } finally {
      setUser(null);
      setJwtToken(null);
      localStorage.removeItem(JWT_STORAGE_KEY);
    }
  };

  const verifyEmailOtp = async (userId: string, code: string): Promise<void> => {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, code }),
    });

    if (!res.ok) {
      const err = await safeJson<{ error?: string }>(res);
      throw new Error(err?.error || 'Invalid verification code');
    }

    const data = await safeJson<{ token: string }>(res);
    if (data?.token) {
      setJwtToken(data.token);
      localStorage.setItem(JWT_STORAGE_KEY, data.token);
      sessionStorage.removeItem(PENDING_OTP_KEY);
    }
  };

  const enable2FA = async (password: string): Promise<TwoFactorSetupData> => {
    const response = await authClient.twoFactor.enable({ password });
    if (response.error) throw new Error(response.error.message || 'Failed to enable 2FA');
    if (!response.data) throw new Error('No data returned from enable 2FA');
    return { totpURI: response.data.totpURI, backupCodes: response.data.backupCodes };
  };

  const verify2FASetup = async (code: string): Promise<void> => {
    const response = await authClient.twoFactor.verifyTotp({ code });
    if (response.error) throw new Error(response.error.message || 'Invalid verification code');
    await checkSession();
  };

  const disable2FA = async (password: string): Promise<void> => {
    const response = await authClient.twoFactor.disable({ password });
    if (response.error) throw new Error(response.error.message || 'Failed to disable 2FA');
    await checkSession();
  };

  /**
   * Verifies a TOTP code during the 2FA login challenge.
   * Uses flushSync so user state is committed before the caller calls navigate().
   */
  const verify2FALogin = async (code: string, trustDevice = false): Promise<void> => {
    const response = await authClient.twoFactor.verifyTotp({ code, trustDevice });
    if (response.error) throw new Error(response.error.message || 'Invalid verification code');
    if (response.data?.user) {
      flushSync(() => {
        setUser(response.data!.user as User);
      });
    } else {
      // Fallback: server didn't return user in response body — fetch session with flushSync.
      await checkSession(true);
    }
  };

  const getTotpUri = async (password: string): Promise<string> => {
    const response = await authClient.twoFactor.getTotpUri({ password });
    if (response.error) throw new Error(response.error.message || 'Failed to get TOTP URI');
    if (!response.data?.totpURI) throw new Error('No TOTP URI returned');
    return response.data.totpURI;
  };

  return (
    <AuthContext.Provider value={{
      user,
      jwtToken,
      loading,
      jwtLoading,
      login,
      register,
      logout,
      checkSession,
      enable2FA,
      verify2FASetup,
      disable2FA,
      verify2FALogin,
      getTotpUri,
      fetchJwtToken,
      verifyEmailOtp,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
