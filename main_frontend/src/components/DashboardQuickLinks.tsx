import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

type DashboardLinkType = "internal" | "external";

interface DashboardLink {
  id: string;
  type: DashboardLinkType;
  to: string;
  badge?: string;
  badgeVariant?: "count" | "new";
}

interface Section {
  labelKey: string;
  links: DashboardLink[];
}

// ── Icons ────────────────────────────────────────────────────────────────────

const TicketIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 8.5C5.38 8.5 6.5 7.38 6.5 6 6.5 4.62 5.38 3.5 4 3.5H3.5v17H4c1.38 0 2.5-1.12 2.5-2.5S5.38 15.5 4 15.5" />
    <path d="M20 8.5C18.62 8.5 17.5 7.38 17.5 6 17.5 4.62 18.62 3.5 20 3.5h.5v17H20c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5" />
    <path d="M8.5 6h7M8.5 12h7M8.5 18h7" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M8 3v4M16 3v4M4 10h16" />
    <circle cx="12" cy="15" r="1.3" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3.5 6 5.7v6.6c0 3.2 2.4 5.8 6 7.2 3.6-1.4 6-4 6-7.2V5.7z" />
    <path d="M9.5 12.5 11 14l3.5-3.5" />
  </svg>
);

const BookIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6.5 4.5h8.5A2.5 2.5 0 0 1 17.5 7v12H8A2.5 2.5 0 0 0 5.5 16.5V7A2.5 2.5 0 0 1 8 4.5z" />
    <path d="M7.5 8h6M7.5 11h4" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 3.5h6.5L20 9v11.5H8z" />
    <path d="M14.5 3.5V9H20M10.5 13h5M10.5 16h3.5" />
  </svg>
);

const EuroIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="7.5" />
    <path d="M9 10h4.5M9 14h4" />
    <path d="M11.5 8.3A3.6 3.6 0 0 1 14 9.5M11.5 15.7A3.6 3.6 0 0 0 14 14.5" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="9" r="3.2" />
    <path d="M6.5 18.5C7.7 16.6 9.7 15.5 12 15.5s4.3 1.1 5.5 3" />
    <circle cx="12" cy="12" r="7.5" />
  </svg>
);

const KycIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="6" width="16" height="12" rx="2" />
    <circle cx="9" cy="11" r="1.5" />
    <path d="M6.5 15c.5-1.2 1.5-2 2.5-2s2 .8 2.5 2M13 10h3M13 13h2.5" />
  </svg>
);

const RoomIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="5" width="14" height="14" rx="2" />
    <path d="M10 19V9h4v10" />
    <circle cx="14.5" cy="13" r="0.9" />
  </svg>
);

const ChatIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 5.5h15A1.5 1.5 0 0 1 21 7v9a1.5 1.5 0 0 1-1.5 1.5H8l-3.5 3V7A1.5 1.5 0 0 1 4.5 5.5z" />
    <path d="M8 10h8M8 13.5h5" />
  </svg>
);

const TagIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 11.5 11.5 4.5l7 7-7 7-7-7z" />
    <circle cx="10.1" cy="9.9" r="1.1" />
  </svg>
);

const BoxIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 8.5 12 4.5l7.5 4v7l-7.5 4-7.5-4zM4.5 8.5 12 12.5l7.5-4M12 12.5v7.5" />
  </svg>
);

const ContractIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 3.5h7.5L20 8v12.5H8zM15.5 3.5V8H20M10 11h5M10 14h3.5M9 18.5 11 16l2 1.5 2-2.5" />
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
};

// ── Data ─────────────────────────────────────────────────────────────────────

const sections: Section[] = [
  {
    labelKey: "dashboard.home.sections.ticketing",
    links: [
      { id: "tickets", type: "internal", to: "/tickets" },
      { id: "interventions", type: "internal", to: "/interventions" },
      { id: "securite", type: "internal", to: "/securite" },
      { id: "ressources", type: "internal", to: "/ressources" },
    ],
  },
  {
    labelKey: "dashboard.home.sections.administrative",
    links: [
      { id: "facturation", type: "internal", to: "/facturation" },
      { id: "sepa", type: "internal", to: "/domiciliation-sepa" },
      { id: "information-client", type: "internal", to: "/information-client" },
      { id: "kyc", type: "internal", to: "/kyc" },
      { id: "reservation-salles", type: "internal", to: "/reservation-salles-bcp" },
      { id: "suggestions", type: "internal", to: "/suggestions" },
    ],
  },
  {
    labelKey: "dashboard.home.sections.sales",
    links: [
      { id: "offres", type: "internal", to: "/offres", badge: "New", badgeVariant: "new" },
      { id: "commandes", type: "internal", to: "/commandes" },
      { id: "contrats", type: "internal", to: "/contrats" },
    ],
  },
];

// ── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  link: DashboardLink;
  label: string;
  onClick: () => void;
}

const DashboardCard = ({ link, label, onClick }: CardProps) => {
  const Icon = iconMap[link.id] ?? DocumentIcon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative group flex flex-col items-center justify-center gap-2 p-3 rounded-xl
        bg-white dark:bg-surface-dark
        border border-border dark:border-white/10
        hover:border-secondary/50 dark:hover:border-white/25
        hover:shadow-md dark:hover:shadow-black/30
        transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-secondary/60
        w-full"
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
      <div className="w-9 h-9 rounded-lg flex items-center justify-center
        bg-background dark:bg-black/25
        text-icon-purple dark:text-white/75
        group-hover:text-secondary dark:group-hover:text-white
        transition-colors">
        <Icon />
      </div>

      {/* Label */}
      <span className="text-xs sm:text-sm font-medium text-center leading-snug
        text-textPrimary dark:text-white/90
        group-hover:text-secondary dark:group-hover:text-white
        transition-colors">
        {label}
      </span>
    </button>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export const DashboardQuickLinks = () => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  const handleClick = (link: DashboardLink) => {
    if (link.type === "external") {
      window.open(link.to, "_blank", "noopener,noreferrer");
    } else {
      navigate(link.to);
    }
  };

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <div key={section.labelKey}>
          {/* Section header */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-textSecondary dark:text-white/50 shrink-0">
              {t(section.labelKey)}
            </span>
            <div className="flex-1 h-px bg-border dark:bg-white/10" />
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {section.links.map((link) => (
              <DashboardCard
                key={link.id}
                link={link}
                label={t(`dashboard.home.links.${link.id}`)}
                onClick={() => handleClick(link)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DashboardQuickLinks;
