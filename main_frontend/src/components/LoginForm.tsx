import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@shared/auth';

interface LoginFormProps {
  onSuccess?: () => void;
}

const LoginForm = ({ onSuccess }: LoginFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorMode, setTwoFactorMode] = useState(false);
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, verify2FALogin } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!twoFactorMode) {
        const result = await login(email, password);

        if (result.twoFactorRedirect) {
          sessionStorage.setItem('pending_2fa_email', email);
          setTwoFactorMode(true);
          setError('');
          return;
        }

        if (result.emailOtpRequired) {
          navigate('/auth/email-otp');
          return;
        }

        onSuccess?.();
        return;
      }

      if (code.trim().length !== 6) {
        setError(t('login.form.errorCode'));
        return;
      }

      await verify2FALogin(code, trustDevice);
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      if (message.match(/two-factor|2FA|TOTP/i)) {
        sessionStorage.setItem('pending_2fa_email', email);
        setTwoFactorMode(true);
      } else {
        // Always present a generic error to avoid leaking authentication details.
        // The concrete error is still visible in logs for diagnostics.
        // eslint-disable-next-line no-console
        console.error(err);
        setError(t('login.form.errorInvalid'));
        setCode('');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-textPrimary/80 dark:text-textPrimary/80 mb-1">
          {t('login.form.emailLabel')}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={twoFactorMode}
          className="w-full px-3 py-2 rounded-lg border border-border dark:border-white/20 bg-surface/5 dark:bg-white/10 text-textPrimary dark:text-white placeholder:text-textPrimary/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50"
          placeholder={t('login.form.emailPlaceholder')}
        />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-textPrimary/80 dark:text-textPrimary/80 mb-1">
          {t('login.form.passwordLabel')}
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          disabled={twoFactorMode}
          className="w-full px-3 py-2 rounded-lg border border-border dark:border-white/20 bg-surface/5 dark:bg-white/10 text-textPrimary dark:text-white placeholder:text-textPrimary/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-50"
          placeholder="••••••••"
        />
      </div>

      {/* 2FA section — always visible */}
      <div className="pt-1 space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-semibold tracking-widest text-textPrimary/40 dark:text-white/40 uppercase">
          <span className="flex-1 h-px bg-border dark:bg-white/20" />
          <span>{t('login.form.twoFactorDivider')}</span>
          <span className="flex-1 h-px bg-border dark:bg-white/20" />
        </div>

        <div>
          <label htmlFor="code" className="block text-sm font-medium text-textPrimary/80 dark:text-textPrimary/80 mb-1">
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
          <div className="flex items-center gap-2">
            <span>📱</span>
            <span>{t('login.form.phoneTip')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>✉️</span>
            <span>
              {t('login.form.emailTip')}{' '}
              <button
                type="button"
                onClick={() => navigate('/auth/2fa-challenge')}
                className="underline text-textPrimary/70 dark:text-white/70 hover:text-textPrimary dark:hover:text-white transition-colors"
              >
                {t('login.form.emailTipLink')}
              </button>
            </span>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-textPrimary/50 dark:text-white/50 cursor-pointer">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-border dark:border-white/20 text-secondary focus:ring-secondary bg-surface/5 dark:bg-white/5"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
          />
          <span>{t('login.form.trustDevice')}</span>
        </label>
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
          : twoFactorMode
            ? t('login.form.submitVerify')
            : t('login.form.submitLogin')}
      </button>

      {/* Forgot / reset */}
      <p className="text-center text-xs text-textPrimary/50 dark:text-white/50">
        {t('login.form.forgotHint')}
      </p>
      <button
        type="button"
        onClick={() => navigate('/auth/forgot-password')}
        className="w-full py-2.5 rounded-lg border border-border/30 dark:border-white/30 text-textPrimary/70 dark:text-white/70 text-xs font-semibold tracking-widest hover:bg-textPrimary/5 dark:hover:bg-white/10"
      >
        {t('login.form.resetButton')}
      </button>
    </form>
  );
};

export default LoginForm;
