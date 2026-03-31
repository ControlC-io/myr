import { useNavigate } from 'react-router-dom';
import { useAuth } from '@shared/auth';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TwoFactorSetup from '../components/TwoFactorSetup';
import Counter from '../components/Counter';
import { useSupplier } from '../context/SupplierContext';
import { usePortalConfig } from '../context/PortalConfigContext';

const Dashboard = () => {
  const { t, i18n } = useTranslation('common');
  const { user, logout, loading, disable2FA, checkSession, jwtToken } = useAuth();
  const { companies, selectedSupplierId, currentRoles } = useSupplier();
  const { config: portalConfig, isLoading: portalConfigLoading } = usePortalConfig();
  const navigate = useNavigate();
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleDisable2FA = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setActionError('');
    setActionLoading(true);

    try {
      await disable2FA(disablePassword);
      setShowDisable2FA(false);
      setDisablePassword('');
      await checkSession();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to disable 2FA';
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handle2FASetupComplete = async () => {
    setShow2FASetup(false);
    await checkSession();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-textSecondary dark:text-textSecondary-dark">
          {t('dashboard.info.loading')}
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="p-4">
      <div className="max-w-5xl mx-auto">
        <div className="card rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-xl font-bold text-textPrimary dark:text-textPrimary-dark">
                {t('dashboard.info.title')}
              </h1>
              <p className="text-sm text-textSecondary dark:text-textSecondary-dark">
                {t('dashboard.info.subtitle')}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {t('auth.logout')}
            </button>
          </div>

          <div className="bg-secondary rounded-lg px-4 py-3 text-secondary-on-light dark:text-secondary-on-dark mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">
              {t('dashboard.info.greeting', {
                name: user.name || t('dashboard.info.greetingFallback'),
              })}
            </h2>
            <p className="text-sm opacity-80">{user.email}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main content (left) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="card rounded-lg p-4">
                <h3 className="font-semibold text-sm text-textPrimary dark:text-textPrimary-dark mb-3">
                  {t('dashboard.info.userCardTitle')}
                </h3>
                <dl className="space-y-1.5">
                  <div>
                    <dt className="text-xs font-medium text-textSecondary dark:text-textSecondary-dark">
                      {t('dashboard.info.userIdLabel')}
                    </dt>
                    <dd className="text-textPrimary dark:text-textPrimary-dark font-mono text-xs">{user.id}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-textSecondary dark:text-textSecondary-dark">
                      {t('dashboard.info.emailLabel')}
                    </dt>
                    <dd className="text-sm text-textPrimary dark:text-textPrimary-dark">{user.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-textSecondary dark:text-textSecondary-dark">
                      {t('dashboard.info.nameLabel')}
                    </dt>
                    <dd className="text-sm text-textPrimary dark:text-textPrimary-dark">
                      {user.name || t('dashboard.info.nameNotSet')}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Architecture state (right column) */}
            <aside className="card rounded-lg p-4 lg:sticky lg:top-4 h-fit">
              <h3 className="font-semibold text-sm text-textPrimary dark:text-textPrimary-dark mb-3">
                {t('dashboard.info.architectureCardTitle')}
              </h3>
              <div className="space-y-1 text-xs text-textSecondary dark:text-textSecondary-dark">
                <div className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('dashboard.info.architecture.nginx')}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('dashboard.info.architecture.frontend')}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('dashboard.info.architecture.backend')}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('dashboard.info.architecture.database')}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>{t('dashboard.info.architecture.auth')}</span>
                </div>
              </div>
            </aside>
          </div>

          {/* Enterprises (table) */}
          <section className="mt-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-textSecondary dark:text-white/50 shrink-0">
                {t('dashboard.info.sections.enterprises', 'Enterprises')}
              </span>
              <div className="flex-1 h-px bg-border dark:bg-white/10" />
            </div>

            <div className="card rounded-lg p-0 overflow-hidden">
              {companies.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="table-header">
                      <tr>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">
                          {t('dashboard.info.portalConfig.columns.service', 'Enterprise')}
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">
                          {t('dashboard.info.supplierIdLabel')}
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">
                          {t('dashboard.info.contactIdLabel')}
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">
                          {t('dashboard.info.companySelected')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/5">
                      {companies.map((company) => {
                        const isSelected = String(company.supplier.id) === selectedSupplierId;
                        return (
                          <tr
                            key={company.supplier.id}
                            className={`hover:bg-backgroundSecondary/50 dark:hover:bg-backgroundSecondary-dark/50 transition-colors ${isSelected ? 'bg-secondary/5 dark:bg-white/5' : ''}`}
                          >
                            <td className="px-4 py-3 text-sm font-semibold text-textPrimary dark:text-textPrimary-dark">
                              #{company.supplier.id}
                            </td>
                            <td className="px-4 py-3 text-sm font-mono text-textPrimary dark:text-textPrimary-dark">
                              {company.supplier.id}
                            </td>
                            <td className="px-4 py-3 text-sm font-mono text-textPrimary dark:text-textPrimary-dark">
                              {company.contact.id}
                            </td>
                            <td className="px-4 py-3">
                              {isSelected ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-tight bg-secondary/10 text-secondary border border-secondary/20">
                                  {t('dashboard.info.companySelected')}
                                </span>
                              ) : (
                                <span className="text-xs text-textSecondary dark:text-textSecondary-dark">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-xs text-textSecondary dark:text-textSecondary-dark">
                    {t('dashboard.info.noCompanies', 'No enterprises available.')}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Roles (table) */}
          <section className="mt-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-textSecondary dark:text-white/50 shrink-0">
                {t('dashboard.info.sections.roles', 'Roles')}
              </span>
              <div className="flex-1 h-px bg-border dark:bg-white/10" />
            </div>

            <div className="card rounded-lg p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/60 dark:border-border-dark/60">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-textPrimary dark:text-textPrimary-dark">
                    {t('dashboard.info.activeRolesLabel')}
                  </span>
                  {currentRoles.length > 0 ? currentRoles.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold tracking-tight bg-secondary/10 text-secondary border border-secondary/20"
                    >
                      {role}
                    </span>
                  )) : (
                    <span className="text-xs text-textSecondary dark:text-textSecondary-dark">—</span>
                  )}
                </div>
              </div>

              {companies.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="table-header">
                      <tr>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">
                          {t('dashboard.info.rolesByEnterpriseTitle', 'Enterprise')}
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">
                          {t('dashboard.info.rolesLabel', 'Roles')}
                        </th>
                        <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">
                          {t('dashboard.info.companySelected')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/5">
                      {companies.map((company) => {
                        const roles = company.roles.map((r) => r.contactroles.name);
                        const isSelected = String(company.supplier.id) === selectedSupplierId;
                        return (
                          <tr
                            key={company.supplier.id}
                            className={`hover:bg-backgroundSecondary/50 dark:hover:bg-backgroundSecondary-dark/50 transition-colors ${isSelected ? 'bg-secondary/5 dark:bg-white/5' : ''}`}
                          >
                            <td className="px-4 py-3 text-sm font-semibold text-textPrimary dark:text-textPrimary-dark">
                              #{company.supplier.id}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {roles.length > 0 ? roles.map((role) => (
                                  <span
                                    key={role}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-tight bg-primary/10 text-textSecondary dark:bg-white/10 dark:text-white/60 border border-primary/20"
                                  >
                                    {role}
                                  </span>
                                )) : (
                                  <span className="text-xs text-textSecondary dark:text-textSecondary-dark">—</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {isSelected ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-tight bg-secondary/10 text-secondary border border-secondary/20">
                                  {t('dashboard.info.companySelected')}
                                </span>
                              ) : (
                                <span className="text-xs text-textSecondary dark:text-textSecondary-dark">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-xs text-textSecondary dark:text-textSecondary-dark">—</p>
                </div>
              )}
            </div>
          </section>

          {/* Portal configuration */}
          <section className="mt-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-textSecondary dark:text-white/50 shrink-0">
                {t('dashboard.info.sections.portalConfiguration', 'Portal configuration')}
              </span>
              <div className="flex-1 h-px bg-border dark:bg-white/10" />
            </div>

            <div className="card rounded-lg p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="font-semibold text-sm text-textPrimary dark:text-textPrimary-dark">
                  {t('dashboard.info.portalConfig.title', 'Portal configuration')}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/20">
                  {portalConfig?.formatVersion ?? '—'}
                </span>
              </div>

            {portalConfigLoading && (
              <p className="text-xs text-textSecondary dark:text-textSecondary-dark">
                {t('placeholders.loading', 'Loading...')}
              </p>
            )}

            {!portalConfigLoading && !portalConfig && (
              <p className="text-xs text-textSecondary dark:text-textSecondary-dark">
                {t('dashboard.info.portalConfig.empty', 'No portal configuration loaded for this company.')}
              </p>
            )}

            {!portalConfigLoading && portalConfig && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="table-header">
                    <tr>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">
                        {t('dashboard.info.portalConfig.columns.service', 'Service')}
                      </th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">
                        {t('dashboard.info.portalConfig.columns.visible', 'Visible')}
                      </th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">
                        {t('dashboard.info.portalConfig.columns.active', 'Active')}
                      </th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest">
                        {t('dashboard.info.portalConfig.columns.message', 'Inactive message')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/5">
                    {Object.entries(portalConfig.services ?? {}).map(([key, svc]) => {
                      const message = i18n.language.toLowerCase().startsWith('en')
                        ? (svc.inactiveMessageEN || svc.inactiveMessage)
                        : svc.inactiveMessage;

                      return (
                        <tr key={key} className="hover:bg-backgroundSecondary/50 dark:hover:bg-backgroundSecondary-dark/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="text-sm font-bold text-textPrimary dark:text-textPrimary-dark">
                              {key}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-tight border ${
                              svc.visible
                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800'
                                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800'
                            }`}>
                              {String(svc.visible)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-tight border ${
                              svc.active
                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800'
                                : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800'
                            }`}>
                              {String(svc.active)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-textSecondary dark:text-textSecondary-dark">
                            <span className="block max-w-[520px] truncate" title={message}>
                              {message || '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </section>

          {/* Security (last) */}
          <section className="mt-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-textSecondary dark:text-white/50 shrink-0">
                {t('dashboard.security.sectionTitle')}
              </span>
              <div className="flex-1 h-px bg-border dark:bg-white/10" />
            </div>

            <div className="card rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-textPrimary dark:text-textPrimary-dark">
                    {t('dashboard.security.twoFactorLabel')}
                  </p>
                  <p className="text-xs text-textSecondary dark:text-textSecondary-dark">
                    {user.twoFactorEnabled
                      ? t('dashboard.security.twoFactorEnabledDescription')
                      : t('dashboard.security.twoFactorDisabledDescription')}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.twoFactorEnabled
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                      : 'bg-primary text-textPrimary dark:bg-surface-dark dark:text-textPrimary-dark'
                  }`}>
                    {user.twoFactorEnabled
                      ? t('dashboard.security.status.enabled')
                      : t('dashboard.security.status.disabled')}
                  </span>
                  {user.twoFactorEnabled ? (
                    <button
                      onClick={() => setShowDisable2FA(true)}
                      className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      {t('dashboard.security.buttons.disable')}
                    </button>
                  ) : (
                    <button
                      onClick={() => setShow2FASetup(true)}
                      className="px-3 py-1 text-xs bg-secondary text-secondary-on-light dark:text-secondary-on-dark rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-secondary"
                    >
                      {t('dashboard.security.buttons.enable2fa')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 bg-primary rounded-lg px-4 py-2 border border-border dark:border-border-dark text-primary-on-light dark:text-primary-on-dark">
              <p className="text-xs">
                <span className="font-semibold">{t('dashboard.security.note.label')}</span>{' '}
                {t('dashboard.security.note.text')}
              </p>
            </div>
          </section>

          {/* Advanced (very last) */}
          <details className="mt-6 card rounded-lg p-4">
            <summary className="cursor-pointer select-none text-sm font-semibold text-textPrimary dark:text-textPrimary-dark">
              {t('dashboard.info.advanced.title', 'Advanced / Debug')}
            </summary>
            <div className="mt-4 space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-textSecondary dark:text-textSecondary-dark mb-2">
                  {t('dashboard.info.advanced.counter', 'Counter test')}
                </h4>
                <Counter />
              </div>

              {jwtToken && (
                <div className="card rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm text-textPrimary dark:text-textPrimary-dark">
                      JWT (current session)
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-textSecondary dark:text-textSecondary-dark">
                        {jwtToken.length} chars
                      </span>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(jwtToken)}
                        className="px-2 py-1 rounded border border-border dark:border-border-dark text-xs text-textSecondary dark:text-textSecondary-dark hover:bg-background dark:hover:bg-background-dark transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <div className="max-h-24 overflow-auto rounded bg-background dark:bg-background-dark border border-border dark:border-border-dark">
                    <pre className="text-[10px] leading-snug p-2 font-mono break-all text-textSecondary dark:text-textSecondary-dark">
                      {jwtToken}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </details>
        </div>

        {show2FASetup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-surface dark:bg-surface-dark rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-border dark:border-border-dark">
              <TwoFactorSetup 
                onComplete={handle2FASetupComplete}
                onCancel={() => setShow2FASetup(false)}
              />
            </div>
          </div>
        )}

        {showDisable2FA && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-surface dark:bg-surface-dark rounded-lg max-w-md w-full p-6 border border-border dark:border-border-dark">
              <h2 className="text-xl font-bold text-textPrimary dark:text-textPrimary-dark mb-4">
                {t('dashboard.security.disableModal.title')}
              </h2>
              <p className="text-textSecondary dark:text-textSecondary-dark mb-6">
                {t('dashboard.security.disableModal.body')}
              </p>

              <form onSubmit={handleDisable2FA} className="space-y-4">
                <div>
                  <label htmlFor="disablePassword" className="block text-sm font-medium text-textSecondary dark:text-textSecondary-dark mb-1">
                    {t('dashboard.security.disableModal.passwordLabel')}
                  </label>
                  <input
                    id="disablePassword"
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-secondary"
                    placeholder={t('dashboard.security.disableModal.passwordPlaceholder')}
                  />
                </div>

                {actionError && (
                  <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-100 px-4 py-3 rounded-lg">
                    {actionError}
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDisable2FA(false);
                      setDisablePassword('');
                      setActionError('');
                    }}
                    className="flex-1 px-4 py-2 border border-border dark:border-border-dark rounded-lg hover:bg-background dark:hover:bg-background-dark"
                  >
                    {t('dashboard.security.disableModal.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading
                      ? t('dashboard.security.disableModal.confirmLoading')
                      : t('dashboard.security.disableModal.confirm')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
