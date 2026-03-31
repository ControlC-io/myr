import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/auth";
import { useSupplier } from "../context/SupplierContext";
import LanguagePicker from "./LanguagePicker";
import ThemeToggle from "./ThemeToggle";
import { usePortalConfig } from "../context/PortalConfigContext";
import logoIcon from "../assets/icons/R-picto-seul-blanc.png";

type SubNavItem = {
  label: string;
  to: string;
  requiredRoles?: string[];
  portalServiceKey?: string;
};

type PrimaryNavItem = {
  label: string;
  to?: string;
  submenu?: SubNavItem[];
  requiredRoles?: string[];
  portalServiceKey?: string;
};

const primaryNavItems: PrimaryNavItem[] = [
  {
    label: "Ticketing",
    submenu: [
      { label: "Tickets", to: "/tickets" },
      { label: "Upcoming interventions", to: "/interventions" },
    ],
  },
  {
    label: "Administrative",
    submenu: [
      { label: "Invoices", to: "/facturation" },
      { label: "Payment information", to: "/payment-information" },
      { label: "Customer information", to: "/information-client" },
      { label: "SEPA Mandate", to: "/sepa" },
      { label: "BCP room reservations", to: "/reservation-salles-bcp", portalServiceKey: "BCP" },
      { label: "Your suggestions", to: "/suggestions" },
      { label: "Data Deletion", to: "/data-deletion" },
    ],
  },
  {
    label: "Sales",
    submenu: [
      { label: "Offers", to: "/offer" },
      { label: "Orders", to: "/commandes" },
    ],
  },
  { label: "Contracts", to: "/services", portalServiceKey: "Services" },
  { label: "Security", to: "/securite" },
  { label: "Resources", to: "/ressources/external-services" },
];

const Navbar = () => {
  const location = useLocation();
  const { t, i18n } = useTranslation("common");
  const { user, logout, loading } = useAuth();
  const { companies, selectedSupplierId, setSelectedSupplierId, currentRoles } = useSupplier();
  const { getServiceConfig, getLocalizedInactiveMessage } = usePortalConfig();
  const [inactiveNotice, setInactiveNotice] = useState<string | null>(null);
  const inactiveNoticeTimerRef = useRef<number | null>(null);

  // Filter nav items based on the current company's roles and portal config.
  const isVisible = (item: { requiredRoles?: string[]; portalServiceKey?: string }): boolean => {
    // Role check
    if (item.requiredRoles && item.requiredRoles.length > 0) {
      if (!item.requiredRoles.some((role) => currentRoles.includes(role))) {
        return false;
      }
    }

    // Portal config check (visibility)
    if (item.portalServiceKey) {
      const config = getServiceConfig(item.portalServiceKey);
      if (!config.visible) {
        return false;
      }
    }

    return true;
  };

  const visibleNavItems = primaryNavItems
    .filter(isVisible)
    .map((item) => ({
      ...item,
      submenu: item.submenu?.filter(isVisible),
    }));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (path: string): boolean => location.pathname === path;

  const navLinkClass = (path: string) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive(path)
        ? "bg-secondary text-secondary-on-light dark:text-secondary-on-dark"
        : "text-textSecondary dark:text-textSecondary-dark hover:text-textPrimary dark:hover:text-textPrimary-dark hover:bg-primary/10 dark:hover:bg-white/10"
    }`;

  const showInactiveNotice = (message: string) => {
    if (!message) return;
    setInactiveNotice(message);
    if (inactiveNoticeTimerRef.current) {
      window.clearTimeout(inactiveNoticeTimerRef.current);
    }
    inactiveNoticeTimerRef.current = window.setTimeout(() => {
      setInactiveNotice(null);
      inactiveNoticeTimerRef.current = null;
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (inactiveNoticeTimerRef.current) {
        window.clearTimeout(inactiveNoticeTimerRef.current);
      }
    };
  }, []);

  return (
    <header className="navbar font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-2">

          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-md text-textSecondary dark:text-textSecondary-dark hover:bg-primary/10 dark:hover:bg-white/10"
              aria-label="Menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {/* Brand */}
            <div className="flex items-center gap-2 sm:gap-6 min-w-0">
              <Link to="/dashboard" className="flex items-center space-x-2">
                <span className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shadow-sm overflow-hidden">
                  <img
                    src={logoIcon}
                    alt="MyR Panel"
                    className="w-7 h-7 object-contain"
                  />
                </span>
                <span className="text-base font-bold tracking-tight text-textPrimary dark:text-textPrimary-dark truncate max-w-[40vw] sm:max-w-none">
                  MyR
                  <span className="text-secondary hidden sm:inline"> Panel</span>
                </span>
              </Link>

              {/* Desktop nav */}
              <nav className="hidden lg:flex items-center space-x-1 text-sm font-medium">
                {visibleNavItems.map((item) => (
                  <div key={item.label} className="relative group">
                    {item.submenu ? (
                      <>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-textSecondary dark:text-textSecondary-dark hover:text-textPrimary dark:hover:text-textPrimary-dark hover:bg-secondary/10 dark:hover:bg-white/10 transition-colors"
                        >
                          <span>{item.label}</span>
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                        {/* top-full + pt-3: keep button and panel in the same hover area so the menu does not close while moving down */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 hidden group-hover:block z-40">
                          <div className="relative">
                            <div className="absolute left-1/2 -top-1 w-3 h-3 bg-surface dark:bg-surface-dark border-l border-t border-border dark:border-border-dark rounded-tl-sm rotate-45 -translate-x-1/2" />
                            <div className="relative bg-surface dark:bg-surface-dark text-textPrimary dark:text-textPrimary-dark border border-border dark:border-border-dark rounded-lg shadow-lg py-2 min-w-[220px]">
                              {item.submenu.map((subItem) => {
                                const config = subItem.portalServiceKey ? getServiceConfig(subItem.portalServiceKey) : { active: true };
                                const inactiveMessage = subItem.portalServiceKey ? getLocalizedInactiveMessage(subItem.portalServiceKey, i18n.language) : '';
                                
                                return config.active ? (
                                  <Link
                                    key={subItem.label}
                                    to={subItem.to}
                                    className="flex items-center gap-3 px-4 py-2 text-sm text-textPrimary dark:text-textPrimary-dark hover:bg-background dark:hover:bg-background-dark transition-colors"
                                  >
                                    <span className="w-2.5 h-2.5 bg-secondary rounded-sm rotate-45" />
                                    <span>{subItem.label}</span>
                                  </Link>
                                ) : (
                                  <button
                                    key={subItem.label}
                                    type="button"
                                    onClick={() => showInactiveNotice(inactiveMessage)}
                                    title={inactiveMessage}
                                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-textSecondary dark:text-textSecondary-dark opacity-60 cursor-not-allowed hover:bg-background dark:hover:bg-background-dark transition-colors"
                                  >
                                    <span className="w-2.5 h-2.5 bg-border rounded-sm rotate-45" />
                                    <span>{subItem.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (() => {
                      const config = item.portalServiceKey ? getServiceConfig(item.portalServiceKey) : { active: true };
                      const inactiveMessage = item.portalServiceKey ? getLocalizedInactiveMessage(item.portalServiceKey, i18n.language) : '';

                      return config.active ? (
                        <Link
                          to={item.to ?? "#"}
                          className={navLinkClass(item.to ?? "#")}
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => showInactiveNotice(inactiveMessage)}
                          title={inactiveMessage}
                          className="px-3 py-2 rounded-md text-sm font-medium text-textSecondary dark:text-textSecondary-dark opacity-60 cursor-not-allowed hover:bg-secondary/10 dark:hover:bg-white/10 transition-colors"
                        >
                          {item.label}
                        </button>
                      );
                    })()}
                  </div>
                ))}
              </nav>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Company selector — shown only when user has access to multiple companies */}
            {user && companies.length > 1 && (
              <select
                value={selectedSupplierId ?? ""}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="hidden lg:block text-xs rounded-md border border-border dark:border-border-dark bg-surface dark:bg-surface-dark text-textPrimary dark:text-textPrimary-dark px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-secondary"
              >
                {companies.map((c) => (
                  <option key={c.supplier.id} value={String(c.supplier.id)}>
                    {String(c.supplier.id)}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center space-x-2">
              {/* On medium widths, these live in the sidebar to avoid crowding */}
              <div className="hidden lg:block">
                <LanguagePicker />
              </div>
              {/* Theme toggle only in header on large; on smaller widths it lives in the sidebar */}
              <div className="hidden lg:block">
                <ThemeToggle />
              </div>
            </div>

            {/* Alerts bell */}
            {user && (
              <Link
                to="/messages"
                className="relative p-2 rounded-md text-textSecondary dark:text-textSecondary-dark hover:text-textPrimary dark:hover:text-textPrimary-dark hover:bg-primary/10 dark:hover:bg-white/10 transition-colors"
                aria-label="Messages"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </Link>
            )}

            {!loading && user ? (
              <div ref={profileRef} className="relative flex items-center gap-3">
                <button
                  onClick={() => setProfileOpen((o) => !o)}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-secondary text-white text-sm font-semibold hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-transparent"
                  aria-label="Profile menu"
                  aria-expanded={profileOpen}
                >
                  {(user.name ?? user.email).charAt(0).toUpperCase()}
                </button>
                {profileOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-surface dark:bg-surface-dark rounded-lg shadow-lg border border-border dark:border-border-dark z-50">
                    <div className="px-4 py-3 border-b border-border/60 dark:border-border-dark/60">
                      <p className="text-xs text-textSecondary dark:text-textSecondary-dark">
                        {t("auth.signedInAs")}
                      </p>
                      <p
                        className="mt-0.5 text-sm font-medium text-textPrimary dark:text-textPrimary-dark truncate"
                        title={user.email}
                      >
                        {user.email}
                      </p>
                    </div>
                    <div className="py-1">
                      <Link
                        to="/info"
                        onClick={() => setProfileOpen(false)}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-textSecondary dark:text-textSecondary-dark hover:bg-background dark:hover:bg-background-dark"
                      >
                        <span className="w-4 h-4 rounded-full bg-secondary/20 flex items-center justify-center text-[10px] text-secondary-on-light">
                          i
                        </span>
                        <span>{t("nav.info")}</span>
                      </Link>
                      <a
                        href="http://localhost:8080"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setProfileOpen(false)}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-textSecondary dark:text-textSecondary-dark hover:bg-background dark:hover:bg-background-dark"
                      >
                        <svg
                          className="w-4 h-4 text-textSecondary dark:text-textSecondary-dark"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                          />
                        </svg>
                        <span>{t("nav.admin")}</span>
                      </a>
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          logout();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-textSecondary dark:text-textSecondary-dark hover:bg-background dark:hover:bg-background-dark flex items-center gap-2"
                      >
                        <svg
                          className="w-4 h-4 text-textSecondary dark:text-textSecondary-dark"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        {t("auth.logout")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              !loading && (
                <div className="flex items-center space-x-2">
                  <Link
                    to="/login"
                    className="px-3 py-1.5 text-sm font-medium text-textPrimary dark:text-textPrimary-dark rounded-lg border border-border/60 dark:border-border-dark/60 hover:bg-primary/10 dark:hover:bg-white/10 transition-colors"
                  >
                    {t("auth.signIn")}
                  </Link>
                  <Link
                    to="/register"
                    className="px-3 py-1.5 text-sm font-medium text-secondary-on-light bg-secondary rounded-lg hover:opacity-90 transition-colors"
                  >
                    {t("auth.signUp")}
                  </Link>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Mobile sidebar (hamburger menu) */}
      {mobileOpen && (
        <div className="fixed inset-x-0 top-14 bottom-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />

          {/* Sidebar panel */}
          <div className="relative h-full w-72 max-w-[85vw] bg-surface dark:bg-surface-dark border-r border-border dark:border-border-dark shadow-lg flex flex-col">
            <div className="px-4 py-3 border-b border-border dark:border-border-dark space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-textPrimary dark:text-textPrimary-dark">
                  {t("nav.menu", "Menu")}
                </span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1 rounded-md text-textSecondary dark:text-textSecondary-dark hover:bg-background dark:hover:bg-background-dark"
                  aria-label="Close menu"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <LanguagePicker />
                <ThemeToggle />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Company selector — mobile */}
              {user && companies.length > 1 && (
                <select
                  value={selectedSupplierId ?? ''}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full text-xs rounded-md border border-border dark:border-border-dark bg-surface dark:bg-surface-dark text-textPrimary dark:text-textPrimary-dark px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-secondary"
                >
                  {companies.map((c) => (
                    <option key={c.supplier.id} value={String(c.supplier.id)}>
                      {String(c.supplier.id)}
                    </option>
                  ))}
                </select>
              )}

              {/* Main navigation items (mirror of header nav) */}
              <div className="space-y-2">
                {visibleNavItems.map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex w-full items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-textPrimary dark:text-textPrimary-dark">
                      <span>{item.label}</span>
                      {item.submenu && (
                        <svg
                          className="w-4 h-4 text-textSecondary dark:text-textSecondary-dark"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      )}
                    </div>
                    {item.submenu && (
                      <div className="pl-6 space-y-0.5">
                        {item.submenu.map((subItem) => {
                          const config = subItem.portalServiceKey ? getServiceConfig(subItem.portalServiceKey) : { active: true };
                          const inactiveMessage = subItem.portalServiceKey ? getLocalizedInactiveMessage(subItem.portalServiceKey, i18n.language) : '';

                          return config.active ? (
                            <Link
                              key={subItem.label}
                              to={subItem.to}
                              onClick={() => setMobileOpen(false)}
                              className="flex items-center gap-3 px-3 py-1.5 rounded-md text-sm text-textSecondary dark:text-textSecondary-dark hover:bg-background dark:hover:bg-background-dark"
                            >
                              <span className="w-2.5 h-2.5 bg-secondary rounded-sm rotate-45" />
                              <span>{subItem.label}</span>
                            </Link>
                          ) : (
                            <button
                              key={subItem.label}
                              type="button"
                              onClick={() => {
                                setMobileOpen(false);
                                showInactiveNotice(inactiveMessage);
                              }}
                              title={inactiveMessage}
                              className="flex w-full items-center gap-3 px-3 py-1.5 rounded-md text-sm text-textSecondary dark:text-textSecondary-dark opacity-60 cursor-not-allowed hover:bg-background dark:hover:bg-background-dark"
                            >
                              <span className="w-2.5 h-2.5 bg-border rounded-sm rotate-45" />
                              <span>{subItem.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {!item.submenu && item.to && (() => {
                      const config = item.portalServiceKey ? getServiceConfig(item.portalServiceKey) : { active: true };
                      const inactiveMessage = item.portalServiceKey ? getLocalizedInactiveMessage(item.portalServiceKey, i18n.language) : '';

                      return config.active ? (
                        <Link
                          to={item.to}
                          onClick={() => setMobileOpen(false)}
                          className="ml-3 px-3 py-1.5 rounded-md text-sm text-textSecondary dark:text-textSecondary-dark hover:bg-background dark:hover:bg-background-dark inline-flex"
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setMobileOpen(false);
                            showInactiveNotice(inactiveMessage);
                          }}
                          title={inactiveMessage}
                          className="ml-3 px-3 py-1.5 rounded-md text-sm text-textSecondary dark:text-textSecondary-dark opacity-60 cursor-not-allowed hover:bg-background dark:hover:bg-background-dark inline-flex"
                        >
                          {item.label}
                        </button>
                      );
                    })()}
                  </div>
                ))}
              </div>

              {/* Auth actions */}
              {!loading && !user && (
                <div className="pt-4 border-t border-border/70 dark:border-border-dark/70 space-y-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className={navLinkClass("/login")}
                  >
                    {t("auth.signIn")}
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className={navLinkClass("/register")}
                  >
                    {t("auth.signUp")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {inactiveNotice && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] px-4">
          <div className="max-w-[92vw] sm:max-w-lg bg-surface dark:bg-surface-dark border border-border dark:border-border-dark shadow-lg rounded-lg px-4 py-3 text-sm text-textPrimary dark:text-textPrimary-dark">
            {inactiveNotice}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
