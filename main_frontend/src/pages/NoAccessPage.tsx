import { useTranslation } from 'react-i18next';
import { useAuth } from '@shared/auth';

const NoAccessPage = () => {
  const { t } = useTranslation('common');
  const { logout } = useAuth();

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-textPrimary dark:text-textPrimary-dark">
            {t('noAccess.title')}
          </h1>
          <p className="text-sm text-textSecondary dark:text-textSecondary-dark">
            {t('noAccess.description')}
          </p>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-white hover:opacity-90 transition-opacity"
        >
          {t('auth.logout')}
        </button>
      </div>
    </div>
  );
};

export default NoAccessPage;
