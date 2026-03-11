import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import ServiceStatusPanel from '../components/ServiceStatusPanel';
import ThemeToggle from '../components/ThemeToggle';
import LanguagePicker from '../components/LanguagePicker';

interface LoginProps {
  initialView?: 'login' | 'register';
}

const Login = ({ initialView = 'login' }: LoginProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [statusOpen, setStatusOpen] = useState(false);
  const [view, setView] = useState<'login' | 'register'>(initialView);

  const isRegister = view === 'register';

  const handleSuccess = () => {
    navigate('/dashboard');
  };

  return (
    <div className="h-screen overflow-hidden flex bg-[#1a0a2e]">
      {/* Left panel — app light background in light mode, deep purple in dark */}
      <div className="w-[420px] lg:w-[460px] bg-background dark:bg-surface-dark flex flex-col px-8 py-6 shrink-0 overflow-y-auto transition-colors duration-300">
        {/* Header row */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-textPrimary/10 dark:bg-white/10 flex items-center justify-center text-textPrimary dark:text-white font-bold text-base shadow">
              R
            </div>
            <span className="text-textPrimary dark:text-white font-semibold text-sm tracking-wide">MyR</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguagePicker />
            {/* Force contrast: toggle must be visible on both panel backgrounds */}
            <ThemeToggle className="!bg-[#462671]/15 dark:!bg-white/15 !border-[#462671]/25 dark:!border-white/20 [&>span:last-child]:!bg-[#462671] dark:[&>span:last-child]:!bg-purple-950 [&>span>svg]:!text-white" />
          </div>
        </div>

        {/* Heading */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-textPrimary dark:text-white mb-1">
            {t(isRegister ? 'register.title' : 'login.title')}
          </h1>
          <p className="text-sm text-textPrimary/60 dark:text-white/60">
            {t(isRegister ? 'register.subtitle' : 'login.subtitle')}
          </p>
        </div>

        {/* Form */}
        <div className="flex-1">
          {isRegister
            ? <RegisterForm onSuccess={handleSuccess} />
            : <LoginForm onSuccess={handleSuccess} />
          }
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-border/50 dark:border-white/10 flex items-center justify-between text-sm text-textPrimary/60 dark:text-white/60">
          <button
            type="button"
            onClick={() => setStatusOpen(true)}
            className="hover:text-textPrimary dark:hover:text-white transition-colors"
          >
            {t('login.statusCta')}
          </button>
          {isRegister ? (
            <div>
              <span className="mr-1">{t('register.backToLogin')}</span>
              <button
                type="button"
                onClick={() => setView('login')}
                className="font-semibold text-pink-600 dark:text-pink-300 hover:text-pink-700 dark:hover:text-pink-200 transition-colors"
              >
                {t('register.signIn')}
              </button>
            </div>
          ) : (
            <div>
              <span className="mr-1">{t('login.firstVisit')}</span>
              <button
                type="button"
                onClick={() => setView('register')}
                className="font-semibold text-pink-600 dark:text-pink-300 hover:text-pink-700 dark:hover:text-pink-200 transition-colors"
              >
                {t('login.register')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right panel — always dark: near-black base with purple gradient overlay */}
      <div
        className="hidden lg:flex flex-1 flex-col items-center justify-center text-white px-12"
        style={{ backgroundColor: '#1a0a2e', backgroundImage: 'linear-gradient(to bottom, rgba(70,38,113,.55), rgba(26,10,46,.85))' }}
      >
        <div className="max-w-md text-center space-y-6">
          <div className="text-6xl">🔒</div>

          <div>
            <h2 className="text-3xl font-bold mb-3">
              {t('login.rightPanelTitle')}
            </h2>
            <p className="text-sm text-white/60 leading-relaxed">
              {t('login.rightPanelSubtitle')}
            </p>
          </div>

          <div className="inline-block px-4 py-2 rounded-full border border-white/20 bg-white/5 text-sm text-white/70">
            {t('login.poweredBy')}
          </div>

          <button
            type="button"
            onClick={() => setStatusOpen(true)}
            className="mt-2 px-6 py-2.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            {t('login.statusCta')}
          </button>
        </div>
      </div>

      {/* Status modal */}
      {statusOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setStatusOpen(false)}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-lg shadow-2xl"
            style={{ backgroundColor: '#1a0a2e', border: '1px solid rgba(70,38,113,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">
                {t('login.statusTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setStatusOpen(false)}
                className="text-white/40 hover:text-white transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>
            <ServiceStatusPanel />
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
