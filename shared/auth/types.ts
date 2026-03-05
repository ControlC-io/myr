export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  twoFactorEnabled?: boolean;
}

export interface TwoFactorSetupData {
  totpURI: string;
  backupCodes: string[];
}

export interface AuthContextType {
  user: User | null;
  jwtToken: string | null;
  loading: boolean;
  /** Indicates whether a JWT is currently being fetched or synced from the session. */
  jwtLoading: boolean;
  /** Signs in with email/password. Returns flags when extra steps are required. */
  login: (email: string, password: string) => Promise<{ twoFactorRedirect?: true; emailOtpRequired?: true }>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  enable2FA: (password: string) => Promise<TwoFactorSetupData>;
  verify2FASetup: (code: string) => Promise<void>;
  disable2FA: (password: string) => Promise<void>;
  verify2FALogin: (code: string, trustDevice?: boolean) => Promise<void>;
  getTotpUri: (password: string) => Promise<string>;
  /** Calls /api/auth/token. Returns true if JWT was stored, false if email 2FA is required. */
  fetchJwtToken: (email: string, password: string) => Promise<boolean>;
  /** Submits the email OTP code and stores the resulting JWT. */
  verifyEmailOtp: (userId: string, code: string) => Promise<void>;
}
