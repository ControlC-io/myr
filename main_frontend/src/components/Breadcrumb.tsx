import { Link, useLocation, useParams } from "react-router-dom";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

const BREADCRUMB_MAP: Record<string, BreadcrumbItem[]> = {
  '/info':                   [{ label: 'Dashboard', href: '/dashboard' }, { label: 'User Info' }],
  '/tickets':                [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Ticketing' }, { label: 'Tickets' }],
  '/tickets/:id':            [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Ticketing' }, { label: 'Tickets', href: '/tickets' }, { label: 'Detail' }],
  '/interventions':          [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Ticketing' }, { label: 'Interventions' }],
  '/facturation':            [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Administrative' }, { label: 'Invoices' }],
  '/payment-information':    [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Administrative' }, { label: 'Payment Information' }],
  '/information-client':     [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Administrative' }, { label: 'Customer Information' }],
  '/sepa':     [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Administrative' }, { label: 'SEPA Mandate' }],
  '/reservation-salles-bcp': [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Administrative' }, { label: 'BCP Room Reservations' }],
  '/suggestions':            [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Administrative' }, { label: 'Suggestions' }],
  '/data-deletion':          [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Administrative' }, { label: 'Data Deletion' }],
  '/offer':                 [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Sales' }, { label: 'Offers' }],
  '/offer/:id':             [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Sales' }, { label: 'Offers', href: '/offer' }, { label: 'Detail' }],
  '/commandes':              [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Sales' }, { label: 'Orders' }],
  '/commandes/:id':          [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Sales' }, { label: 'Orders', href: '/commandes' }, { label: 'Detail' }],
  '/commande-rapide':        [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Sales' }, { label: 'Quick Order' }],
  '/services':               [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Services' }],
  '/securite':               [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Security' }],
  '/ressources':             [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Resources' }],
  '/kyc':                    [{ label: 'Dashboard', href: '/dashboard' }, { label: 'KYC' }],
};

const HIDDEN_ROUTES = new Set(['/', '/dashboard', '/login', '/register', '/auth/forgot-password', '/auth/reset-password', '/auth/2fa-challenge', '/auth/email-otp']);

function matchBreadcrumb(pathname: string): BreadcrumbItem[] | null {
  // Exact match first
  if (BREADCRUMB_MAP[pathname]) return BREADCRUMB_MAP[pathname];
  // Dynamic segment match: replace last segment with ':id'
  const slashIdx = pathname.lastIndexOf('/');
  if (slashIdx > 0) {
    const pattern = pathname.slice(0, slashIdx) + '/:id';
    if (BREADCRUMB_MAP[pattern]) return BREADCRUMB_MAP[pattern];
  }
  return null;
}

const Breadcrumb = () => {
  const { pathname } = useLocation();
  useParams(); // keep router context in sync

  if (HIDDEN_ROUTES.has(pathname)) return null;

  const items = matchBreadcrumb(pathname);
  if (!items) return null;

  return (
    <nav className="border-b border-border dark:border-border-dark bg-surface dark:bg-surface-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <ol className="flex items-center text-sm text-textSecondary dark:text-textSecondary-dark">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={index} className="flex items-center">
                {index > 0 && (
                  <span className="mx-2 text-textSecondary dark:text-textSecondary-dark select-none">
                    &gt;
                  </span>
                )}
                {isLast || !item.href ? (
                  <span className={isLast ? 'text-textPrimary dark:text-textPrimary-dark font-medium' : undefined}>
                    {item.label}
                  </span>
                ) : (
                  <Link
                    to={item.href}
                    className="hover:text-secondary dark:hover:text-secondary transition-colors"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
};

export default Breadcrumb;
