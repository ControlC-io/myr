import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@shared/auth';
import DashboardQuickLinks from '../components/DashboardQuickLinks';
import dashboardBg from '../assets/backgrounds/background.jpg';

const BG_PREF_KEY = 'dashboard-bg-enabled';

const DashboardHome = () => {
  const { t } = useTranslation('common');
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [bgEnabled, setBgEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(BG_PREF_KEY) !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  const toggleBg = () => {
    setBgEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(BG_PREF_KEY, String(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  if (loading || !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-textSecondary dark:text-textSecondary-dark">
          {t('dashboard.home.loading')}
        </div>
      </div>
    );
  }

  const firstName = (user.name?.split(' ')[0] ?? user.email?.split('@')[0] ?? '').toUpperCase();

  return (
    <div
      className="min-h-[calc(100vh-3.5rem)] bg-cover bg-center transition-all duration-500"
      style={bgEnabled ? { backgroundImage: `url(${dashboardBg})` } : undefined}
    >
      <div className="page-container py-4">
        {/* Toggle row */}
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={toggleBg}
            title={bgEnabled ? 'Disable background' : 'Enable background'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
              bgEnabled
                ? 'bg-white/15 backdrop-blur-sm border-white/30 text-white hover:bg-white/25'
                : 'bg-surface dark:bg-surface-dark border-border dark:border-border-dark text-textSecondary dark:text-textSecondary-dark hover:text-textPrimary dark:hover:text-textPrimary-dark hover:bg-background dark:hover:bg-background-dark'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M3 15l5-5 4 4 3-3 6 6" />
              <circle cx="8.5" cy="8.5" r="1.5" />
            </svg>
            <span>{bgEnabled ? 'Background on' : 'Background off'}</span>
            {/* mini toggle indicator */}
            <span className={`relative inline-flex h-3.5 w-6 rounded-full transition-colors duration-200 ${bgEnabled ? 'bg-secondary' : 'bg-border dark:bg-border-dark'}`}>
              <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${bgEnabled ? 'translate-x-3' : 'translate-x-0.5'}`} />
            </span>
          </button>
        </div>

        {/* Hero text */}
        <div className="text-center space-y-1 mb-5">
          <p className={`text-xs font-semibold tracking-[0.25em] uppercase ${bgEnabled ? 'text-secondary' : 'text-secondary'}`}>
            {t('dashboard.home.welcome', { name: firstName })}
          </p>
          <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${bgEnabled ? 'text-white' : 'text-textPrimary dark:text-white'}`}>
            {t('dashboard.home.titlePrefix')}{' '}
            <span className="text-secondary">{t('dashboard.home.titleHighlight')}</span>
          </h1>
          <p className={`max-w-2xl mx-auto text-xs sm:text-sm ${bgEnabled ? 'text-white/70' : 'text-textSecondary dark:text-textSecondary-dark'}`}>
            {t('dashboard.home.description')}
          </p>
        </div>

        <DashboardQuickLinks glassy={bgEnabled} />
      </div>
    </div>
  );
};

export default DashboardHome;
