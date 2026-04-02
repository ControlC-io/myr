import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePortalConfig } from "../context/PortalConfigContext";
import { useSupplier } from "../context/SupplierContext";
import { useEffect, useRef, useState } from "react";
import { ROUTE_PERMISSIONS, type Role } from "../config/routePermissions";

type DashboardLinkType = "internal" | "external";

interface DashboardLink {
  id: string;
  type: DashboardLinkType;
  to: string;
  badge?: string;
  badgeVariant?: "count" | "new";
  portalServiceKey?: string;
  requiredRoles?: Role[];
}

interface Section {
  labelKey: string;
  links: DashboardLink[];
}

// ── Icons ────────────────────────────────────────────────────────────────────

const TicketIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 9a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v1.5a2.5 2.5 0 0 0 0 5V17a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1.5a2.5 2.5 0 0 0 0-5V9z" />
    <path d="M9 8v8M9 12h6" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2.5" />
    <path d="M3 10h18M8 2v4M16 2v4" />
    <path d="M8 15h.01M12 15h.01M16 15h.01" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2 4 5v6c0 4.4 3.4 8.5 8 9.9 4.6-1.4 8-5.5 8-9.9V5z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const BookIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 19V6a3 3 0 0 1 3-3h13v13H7a3 3 0 0 0-3 3zm0 0a3 3 0 0 0 3 3h13" />
    <path d="M9 7h7M9 11h5" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M9 13h6M9 17h4" />
  </svg>
);

const EuroIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 6.5A7 7 0 1 0 17 17.5" />
    <path d="M4 10h9M4 14h9" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

const KycIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <circle cx="8.5" cy="11" r="2" />
    <path d="M5.5 17c.6-1.7 1.7-2.5 3-2.5s2.4.8 3 2.5" />
    <path d="M14 9h5M14 12.5h3.5" />
  </svg>
);

const RoomIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 21V7l9-4 9 4v14" />
    <path d="M9 21v-6h6v6" />
    <rect x="10" y="9" width="4" height="4" rx="0.5" />
  </svg>
);

const ChatIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M8 10h8M8 14h5" />
  </svg>
);

const TagIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12.5 2H6a2 2 0 0 0-2 2v6.5l9.3 9.3a2 2 0 0 0 2.8 0l4.5-4.5a2 2 0 0 0 0-2.8z" />
    <circle cx="8.5" cy="8.5" r="1.5" />
  </svg>
);

const BoxIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
    <path d="M3 8l9 5 9-5M12 13v8" />
    <path d="M7.5 5.5 16.5 10.5" />
  </svg>
);

const ContractIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9z" />
    <path d="M9 2v7h10M9 13h6M9 17h4" />
    <path d="m7 17 1.5-1.5L10 17l1.5-2" />
  </svg>
);

const iconMap: Record<string, () => JSX.Element> = {
  tickets: TicketIcon,
  interventions: CalendarIcon,
  securite: ShieldIcon,
  ressources: BookIcon,
  facturation: DocumentIcon,
  sepa: EuroIcon,
  "information-client": UserIcon,
  kyc: KycIcon,
  "reservation-salles": RoomIcon,
  suggestions: ChatIcon,
  offres: TagIcon,
  commandes: BoxIcon,
  contrats: ContractIcon,
  services: ContractIcon,
};

// ── Data ─────────────────────────────────────────────────────────────────────

const sections: Section[] = [
  {
    labelKey: "dashboard.home.sections.ticketing",
    links: [
      { id: "tickets", type: "internal", to: "/tickets", requiredRoles: ROUTE_PERMISSIONS['/tickets'] },
      { id: "interventions", type: "internal", to: "/intervention", requiredRoles: ROUTE_PERMISSIONS['/intervention'] },
      { id: "securite", type: "external", to: "https://rcarre.appfarm.app/myrsecure", requiredRoles: ROUTE_PERMISSIONS['/securite'] },
      { id: "ressources", type: "internal", to: "/ressources" },
    ],
  },
  {
    labelKey: "dashboard.home.sections.administrative",
    links: [
      { id: "facturation", type: "internal", to: "/invoice", requiredRoles: ROUTE_PERMISSIONS['/invoice'] },
      { id: "sepa", type: "internal", to: "/sepa", requiredRoles: ROUTE_PERMISSIONS['/sepa'] },
      { id: "information-client", type: "internal", to: "/customer-information", requiredRoles: ROUTE_PERMISSIONS['/customer-information'] },
      { id: "kyc", type: "internal", to: "/kyc", portalServiceKey: "KYC", requiredRoles: ROUTE_PERMISSIONS['/kyc'] },
      { id: "reservation-salles", type: "internal", to: "/reservation-salles-bcp", portalServiceKey: "BCP", requiredRoles: ROUTE_PERMISSIONS['/reservation-salles-bcp'] },
      { id: "suggestions", type: "internal", to: "/suggestions" },
    ],
  },
  {
    labelKey: "dashboard.home.sections.sales",
    links: [
      { id: "offres", type: "internal", to: "/offer", badge: "New", badgeVariant: "new", requiredRoles: ROUTE_PERMISSIONS['/offer'] },
      { id: "commandes", type: "internal", to: "/orders", requiredRoles: ROUTE_PERMISSIONS['/orders'] },
      { id: "services", type: "internal", to: "/services", portalServiceKey: "Services", requiredRoles: ROUTE_PERMISSIONS['/services'] },
      { id: "commande-rapide", type: "internal", to: "/commande-rapide", portalServiceKey: "EasyOrdering", requiredRoles: ROUTE_PERMISSIONS['/commande-rapide'] },
    ],
  },
];

// ── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  link: DashboardLink;
  label: string;
  onClick: () => void;
  glassy?: boolean;
}

const DashboardCard = ({ link, label, onClick, glassy = false }: CardProps) => {
  const Icon = iconMap[link.id] ?? DocumentIcon;
  const { getServiceConfig, getLocalizedInactiveMessage } = usePortalConfig();
  const { i18n } = useTranslation("common");
  
  const config = link.portalServiceKey ? getServiceConfig(link.portalServiceKey) : { active: true };
  const inactiveMessage = link.portalServiceKey ? getLocalizedInactiveMessage(link.portalServiceKey, i18n.language) : "";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!config.active}
      title={!config.active ? inactiveMessage : undefined}
      className={`relative group flex flex-col items-center justify-center gap-2 p-3 card--square-tl
        hover:rounded-tl-xl hover:rounded-br-none
        transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-secondary/60
        w-full ${!config.active ? 'opacity-60 cursor-not-allowed' : ''} ${
        glassy
          ? 'bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/25 hover:border-white/35 hover:shadow-lg hover:shadow-black/20'
          : 'bg-white dark:bg-surface-dark border border-border dark:border-white/10 hover:bg-secondary/5 dark:hover:bg-secondary/10 hover:border-secondary/50 dark:hover:border-white/25 hover:shadow-md dark:hover:shadow-black/30'
      }`}
    >
      {/* Badge */}
      {link.badge && (
        <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
          link.badgeVariant === "new"
            ? "bg-secondary text-white"
            : "bg-pink dark:bg-pink text-white"
        }`}>
          {link.badge}
        </span>
      )}

      {/* Icon container */}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
        glassy
          ? 'bg-white/15 text-white/80 group-hover:text-white group-hover:bg-white/25'
          : 'bg-background dark:bg-black/25 text-icon-purple dark:text-white/75 group-hover:text-secondary dark:group-hover:text-white'
      }`}>
        <Icon />
      </div>

      {/* Label */}
      <span className={`text-xs sm:text-sm font-medium text-center leading-snug transition-colors ${
        glassy
          ? 'text-white/80 group-hover:text-white'
          : 'text-textPrimary dark:text-white/90 group-hover:text-secondary dark:group-hover:text-white'
      }`}>
        {label}
      </span>
    </button>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

interface DashboardQuickLinksProps {
  glassy?: boolean;
}

export const DashboardQuickLinks = ({ glassy = false }: DashboardQuickLinksProps) => {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const { getServiceConfig, getLocalizedInactiveMessage } = usePortalConfig();
  const { currentRoles } = useSupplier();
  const [inactiveNotice, setInactiveNotice] = useState<string | null>(null);
  const inactiveNoticeTimerRef = useRef<number | null>(null);

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

  const handleClick = (link: DashboardLink) => {
    if (link.portalServiceKey) {
      const config = getServiceConfig(link.portalServiceKey);
      if (!config.active) {
        showInactiveNotice(getLocalizedInactiveMessage(link.portalServiceKey, i18n.language));
        return;
      }
    }

    if (link.type === "external") {
      window.open(link.to, "_blank", "noopener,noreferrer");
    } else {
      navigate(link.to);
    }
  };

  return (
    <div className="space-y-5">
      {sections.map((section) => {
        const visibleLinks = section.links.filter(link => {
          if (link.requiredRoles?.length) {
            if (!link.requiredRoles.some((r) => currentRoles.includes(r))) return false;
          }
          if (link.portalServiceKey) {
            const config = getServiceConfig(link.portalServiceKey);
            return config.visible;
          }
          return true;
        });

        if (visibleLinks.length === 0) return null;

        return (
          <div key={section.labelKey}>
            {/* Section header */}
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-[11px] font-bold tracking-[0.18em] uppercase shrink-0 ${
                glassy ? 'text-white/50' : 'text-textSecondary dark:text-white/50'
              }`}>
                {t(section.labelKey)}
              </span>
              <div className={`flex-1 h-px ${glassy ? 'bg-white/15' : 'bg-border dark:bg-white/10'}`} />
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {visibleLinks.map((link) => (
                <DashboardCard
                  key={link.id}
                  link={link}
                  label={t(`dashboard.home.links.${link.id}`)}
                  onClick={() => handleClick(link)}
                  glassy={glassy}
                />
              ))}
            </div>
          </div>
        );
      })}

      {inactiveNotice && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] px-4">
          <div className="max-w-[92vw] sm:max-w-lg bg-surface dark:bg-surface-dark border border-border dark:border-border-dark shadow-lg rounded-lg px-4 py-3 text-sm text-textPrimary dark:text-textPrimary-dark">
            {inactiveNotice}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardQuickLinks;
