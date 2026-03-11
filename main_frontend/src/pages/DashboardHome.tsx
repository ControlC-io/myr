import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@shared/auth';
import DashboardQuickLinks from '../components/DashboardQuickLinks';

const DashboardHome = () => {
  const { t } = useTranslation('common');
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

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
    <div className="py-4">
      <div className="page-container">
        <div className="text-center space-y-1 mb-5">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase text-secondary">
            {t('dashboard.home.welcome', { name: firstName })}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-textPrimary dark:text-white">
            {t('dashboard.home.titlePrefix')}{' '}
            <span className="text-secondary">{t('dashboard.home.titleHighlight')}</span>
          </h1>
          <p className="max-w-2xl mx-auto text-xs sm:text-sm text-textSecondary dark:text-textSecondary-dark">
            {t('dashboard.home.description')}
          </p>
        </div>

        <DashboardQuickLinks />
      </div>
    </div>
  );
};

export default DashboardHome;
