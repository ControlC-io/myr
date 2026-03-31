import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { usePortalConfig } from '../context/PortalConfigContext';
import PageHeader from './PageHeader';

interface PortalServiceGuardProps {
  serviceKey: string;
  children: ReactNode;
}

const PortalServiceGuard = ({ serviceKey, children }: PortalServiceGuardProps) => {
  const { t, i18n } = useTranslation('common');
  const { getServiceConfig, getLocalizedInactiveMessage, isLoading } = usePortalConfig();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-primary-dark"></div>
      </div>
    );
  }

  const config = getServiceConfig(serviceKey);
  const inactiveMessage = getLocalizedInactiveMessage(serviceKey, i18n.language);

  if (!config.visible || !config.active) {
    return (
      <div className="flex-1 bg-background dark:bg-background-dark min-h-screen">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <PageHeader
            title={t(`pages.${serviceKey.toLowerCase()}.title`, serviceKey)}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />
          
          <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark card--square-tl shadow-sm p-12 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-textPrimary dark:text-textPrimary-dark">
                {t('common.serviceUnavailable', 'Service Unavailable')}
              </h2>
              <p className="text-textSecondary dark:text-textSecondary-dark">
                {inactiveMessage}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default PortalServiceGuard;
