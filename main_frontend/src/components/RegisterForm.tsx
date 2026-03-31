import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@shared/auth';

interface RegisterFormProps {
  onSuccess?: () => void;
}

const RegisterForm = ({ onSuccess }: RegisterFormProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { t } = useTranslation('common');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('register.form.errorMismatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('register.form.errorWeak'));
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password);
      onSuccess?.();
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error(err);
      if (err instanceof Error && err.message === 'USER_NOT_REGISTERED') {
        setError(t('register.form.errorNotRegistered'));
      } else {
        setError(t('register.form.errorFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-border dark:border-white/20 bg-surface/5 dark:bg-white/10 text-textPrimary dark:text-white placeholder:text-textPrimary/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-secondary';
  const labelClass = 'block text-sm font-medium text-textPrimary/80 dark:text-textPrimary/80 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="name" className={labelClass}>
          {t('register.form.nameLabel')}
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputClass}
          placeholder={t('register.form.namePlaceholder')}
        />
      </div>

      <div>
        <label htmlFor="reg-email" className={labelClass}>
          {t('register.form.emailLabel')}
        </label>
        <input
          id="reg-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClass}
          placeholder={t('register.form.emailPlaceholder')}
        />
      </div>

      <div>
        <label htmlFor="reg-password" className={labelClass}>
          {t('register.form.passwordLabel')}
        </label>
        <input
          id="reg-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className={inputClass}
          placeholder={t('register.form.passwordPlaceholder')}
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className={labelClass}>
          {t('register.form.confirmPasswordLabel')}
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          className={inputClass}
          placeholder={t('register.form.confirmPasswordPlaceholder')}
        />
      </div>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-lg bg-secondary hover:bg-secondary/90 text-white font-bold text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-secondary disabled:opacity-60"
      >
        {loading ? t('register.form.submitLoading') : t('register.form.submit')}
      </button>
    </form>
  );
};

export default RegisterForm;
