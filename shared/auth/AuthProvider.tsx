import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

const JWT_STORAGE_KEY = 'myrtest_jwt_token';
const PENDING_OTP_KEY = 'pending_email_otp_user_id';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchJwtFromSession = async (): Promise<boolean> => {
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
    }
  };

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/get-session', { credentials: 'include' });
      if (res.ok) {
        const data = await safeJson<{ user?: unknown }>(res);
        if (data?.user) {
          setUser(data.user);
          const stored = localStorage.getItem(JWT_STORAGE_KEY);
          if (stored) {
            setJwtToken(stored);
          } else {
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

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await safeJson<{ message?: string; error?: string }>(res);
      const fallback =
        res.status === 502 || res.status === 503
          ? 'Login failed (backend unreachable—check if the API is running)'
          : res.status === 403
            ? 'Login failed (forbidden—check allowed origins)'
            : `Login failed (${res.status})`;
      const displayed = err?.message || err?.error || fallback;
      // #region agent log
      fetch('http://127.0.0.1:7713/ingest/4d1c7866-0c93-4eea-be66-7eaca1b46d80',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8d83fd'},body:JSON.stringify({sessionId:'8d83fd',runId:'pre-fix',hypothesisId:'H1',location:'shared/auth/AuthProvider.tsx:login',message:'Login error response',data:{status:res.status,errKeys:err?Object.keys(err):[],displayed,normalized:res.headers.get('X-Auth-Error-Normalized')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
      throw new Error(displayed);
    }

    const data = await safeJson<{ user?: User }>(res);
    if (data?.user) setUser(data.user);

    try {
      await fetchJwtToken(email, password);
    } catch {
      // Non-fatal: JWT fetch failure should not block session login
    }
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await safeJson<{ message?: string; error?: string }>(res);
      const fallback =
        res.status === 502 || res.status === 503
          ? 'Registration failed (backend unreachable—check if the API is running)'
          : res.status === 403
            ? 'Registration failed (forbidden—check allowed origins)'
            : `Registration failed (${res.status})`;
      const displayed = err?.message || err?.error || fallback;
      // #region agent log
      fetch('http://127.0.0.1:7713/ingest/4d1c7866-0c93-4eea-be66-7eaca1b46d80',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8d83fd'},body:JSON.stringify({sessionId:'8d83fd',runId:'pre-fix',hypothesisId:'H2',location:'shared/auth/AuthProvider.tsx:register',message:'Register error response',data:{status:res.status,errKeys:err?Object.keys(err):[],displayed,normalized:res.headers.get('X-Auth-Error-Normalized')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
      throw new Error(displayed);
    }

    const data = await safeJson<{ user?: User }>(res);
    if (data?.user) setUser(data.user);
  };

  const logout = async () => {
    await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' });
    setUser(null);
    setJwtToken(null);
    localStorage.removeItem(JWT_STORAGE_KEY);
  };

  const fetchJwtToken = async (email: string, password: string): Promise<boolean> => {
    const res = await fetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) throw new Error('Failed to obtain access token');

    const data = await safeJson<{ token?: string; requires2FA?: boolean; userId?: string }>(res);

    if (data?.requires2FA && data?.userId) {
      sessionStorage.setItem(PENDING_OTP_KEY, data.userId);
      return false;
    }

    if (data?.token) {
      setJwtToken(data.token);
      localStorage.setItem(JWT_STORAGE_KEY, data.token);
    }
    return true;
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

  const verify2FALogin = async (code: string, trustDevice = false): Promise<void> => {
    const response = await authClient.twoFactor.verifyTotp({ code, trustDevice });
    if (response.error) throw new Error(response.error.message || 'Invalid verification code');
    if (response.data?.user) {
      setUser(response.data.user);
    } else {
      await checkSession();
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
