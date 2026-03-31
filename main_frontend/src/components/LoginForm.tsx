import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@shared/auth';

interface LoginFormProps {
  onSuccess?: () => void;
  onForgotPassword?: () => void;
}

const PENDING_2FA_EMAIL_KEY = 'pending_2fa_email';

const LoginForm = ({ onSuccess, onForgotPassword }: LoginFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);

  // true after password-login returns twoFactorRedirect (TOTP 2FA required)
  const [twoFactorMode, setTwoFactorMode] = useState(false);
  // true after the user clicks "request it here" and a passwordless code is sent
  const [passwordlessOtpSent, setPasswordlessOtpSent] = useState(false);

  const { login, verify2FALogin, sendLoginOtp, signInWithEmailOtp } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  // Send a passwordless OTP to the email currently in the email field
  const handleRequestEmailOtp = async () => {
    if (!email.trim()) {
      setError(t('login.form.emailRequired'));
      return;
    }
    setError('');
    setOtpSending(true);
    try {
      await sendLoginOtp(email.trim());
      setCode('');
      setPasswordlessOtpSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setOtpSending(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Passwordless path: user requested a code by email
      if (passwordlessOtpSent) {
        if (code.trim().length !== 6) { setError(t('login.form.errorCode')); return; }
        await signInWithEmailOtp(email.trim(), code.trim());
        onSuccess?.();
        return;
      }

      // 2FA TOTP path: user already logged in with password, needs 2FA code
      if (twoFactorMode) {
        if (code.trim().length !== 6) { setError(t('login.form.errorCode')); return; }
        await verify2FALogin(code, false);
        onSuccess?.();
        return;
      }

      // Normal email + password login
      const result = await login(email, password);

      if (result.twoFactorRedirect) {
        sessionStorage.setItem(PENDING_2FA_EMAIL_KEY, email);
        setCode('');
        setTwoFactorMode(true);
        return;
      }

      if (result.emailOtpRequired) {
        navigate('/auth/email-otp');
        return;
      }

      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      if (message.match(/two-factor|2FA|TOTP/i)) {
        sessionStorage.setItem(PENDING_2FA_EMAIL_KEY, email);
        setCode('');
        setTwoFactorMode(true);
      } else {
        // eslint-disable-next-line no-console
        console.error(err);
        setError(twoFactorMode || passwordlessOtpSent ? message : t('login.form.errorInvalid'));
        setCode('');
      }
    } finally {
      setLoading(false);
    }
  };

  const isVerifyMode = twoFactorMode || passwordlessOtpSent;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-textPrimary/80 dark:text-white/80 mb-1">
          {t('login.form.emailLabel')}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required={!isVerifyMode}
          disabled={isVerifyMode}
          className="w-full px-3 py-2 rounded-lg border border-border dark:border-white/20 bg-surface/5 dark:bg-white/10 text-textPrimary dark:text-white placeholder:text-textPrimary/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50"
          placeholder={t('login.form.emailPlaceholder')}
        />
      </div>

      {/* Password — hidden once passwordless OTP was sent */}
      {!passwordlessOtpSent && (
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-textPrimary/80 dark:text-white/80 mb-1">
            {t('login.form.passwordLabel')}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!twoFactorMode}
            minLength={8}
            disabled={twoFactorMode}
            className="w-full px-3 py-2 rounded-lg border border-border dark:border-white/20 bg-surface/5 dark:bg-white/10 text-textPrimary dark:text-white placeholder:text-textPrimary/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50"
            placeholder="••••••••"
          />
        </div>
      )}

      {/* 2FA / code section — always visible */}
      <div className="pt-1 space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-semibold tracking-widest text-textPrimary/40 dark:text-white/40 uppercase">
          <span className="flex-1 h-px bg-border dark:bg-white/20" />
          <span>{t('login.form.twoFactorDivider')}</span>
          <span className="flex-1 h-px bg-border dark:bg-white/20" />
        </div>

        <div>
          <label htmlFor="code" className="block text-sm font-medium text-textPrimary/80 dark:text-white/80 mb-1">
            {t('login.form.codeLabel')}
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full px-3 py-2 rounded-lg border border-border dark:border-white/20 bg-surface/5 dark:bg-white/10 text-textPrimary dark:text-white placeholder:text-textPrimary/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-secondary text-center text-2xl tracking-[0.5em]"
            placeholder="000000"
          />
        </div>

        <div className="space-y-1 text-xs text-textPrimary/50 dark:text-white/50">
          {!passwordlessOtpSent && (
            <div className="flex items-center gap-2">
              <span>📱</span>
              <span>{t('login.form.phoneTip')}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span>✉️</span>
            {passwordlessOtpSent ? (
              <span className="text-green-600 dark:text-green-400">
                {t('login.form.emailOtpSent')}{' '}
                <button
                  type="button"
                  disabled={otpSending}
                  onClick={handleRequestEmailOtp}
                  className="underline hover:text-green-700 dark:hover:text-green-300 disabled:opacity-50"
                >
                  {otpSending ? t('login.form.emailTipSending') : t('login.form.passwordlessRetry')}
                </button>
              </span>
            ) : (
              <span>
                {t('login.form.emailTip')}{' '}
                <button
                  type="button"
                  disabled={otpSending}
                  onClick={handleRequestEmailOtp}
                  className="underline text-textPrimary/70 dark:text-white/70 hover:text-textPrimary dark:hover:text-white transition-colors disabled:opacity-40"
                >
                  {otpSending ? t('login.form.emailTipSending') : t('login.form.emailTipLink')}
                </button>
              </span>
            )}
          </div>
        </div>

        {passwordlessOtpSent && (
          <button
            type="button"
            onClick={() => { setPasswordlessOtpSent(false); setCode(''); setError(''); }}
            className="text-xs text-textPrimary/50 dark:text-white/50 hover:text-textPrimary dark:hover:text-white transition-colors"
          >
            ← {t('login.form.passwordlessBack')}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-lg bg-secondary hover:bg-secondary/90 text-white font-bold text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-60"
      >
        {loading
          ? t('login.form.submitLoading')
          : isVerifyMode
            ? t('login.form.submitVerify')
            : t('login.form.submitLogin')}
      </button>

      {/* Forgot / reset */}
      <p className="text-center text-xs text-textPrimary/50 dark:text-white/50">
        {t('login.form.forgotHint')}
      </p>
      <button
        type="button"
        onClick={onForgotPassword}
        className="w-full py-2.5 rounded-lg border border-border/30 dark:border-white/30 text-textPrimary/70 dark:text-white/70 text-xs font-semibold tracking-widest hover:bg-textPrimary/5 dark:hover:bg-white/10"
      >
        {t('login.form.resetButton')}
      </button>
    </form>
  );
};

export default LoginForm;
