import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Ticket, TicketIntervention } from "../features/tickets/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const EMAIL_REGEX = /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g;

function renderLineWithLinks(line: string): React.ReactNode[] {
  const parts = line.split(EMAIL_REGEX);
  return parts.map((part, i) =>
    EMAIL_REGEX.test(part) ? (
      <a
        key={i}
        href={`mailto:${part}`}
        className="text-secondary hover:underline"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function ContentRenderer({ raw }: { raw: string }) {
  const decoded = decodeHtmlEntities(raw);
  const lines = decoded.split(/\r\n|\n/);
  return (
    <div className="font-mono text-xs leading-relaxed text-textPrimary dark:text-textPrimary-dark whitespace-pre-wrap break-words">
      {lines.map((line, i) => (
        <div key={i}>{renderLineWithLinks(line) }</div>
      ))}
    </div>
  );
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} à ${hh}:${mm}`;
}

const statusColors: Record<string, string> = {
  open:        "bg-blue-500/10  text-blue-600  dark:bg-blue-500/20  dark:text-blue-300  border border-blue-500/20",
  in_progress: "bg-secondary/10 text-secondary dark:bg-secondary/20 dark:text-secondary border border-secondary/20",
  resolved:    "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 border border-green-500/20",
  closed:      "bg-primary/10   text-textSecondary dark:bg-white/10 dark:text-white/60   border border-primary/20",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoGrid({ ticket, t }: { ticket: Ticket; t: (k: string) => string }) {
  const category =
    ticket.ticketcategories && typeof ticket.ticketcategories === "object" && "name" in ticket.ticketcategories
      ? (ticket.ticketcategories as { name: string }).name
      : null;

  const techName = ticket.user_assign
    ? `${ticket.user_assign.firstname ?? ""} ${ticket.user_assign.realname ?? ""}`.trim()
    : null;

  const groupName = ticket.group_assign?.name ?? null;

  const rows: Array<[string, string | null, string, string | null]> = [
    [t("tickets.detail.category"), category, t("tickets.detail.priority"), ticket.priority_v2 ?? null],
    [t("tickets.detail.opened"), formatDateTime(ticket.date), t("tickets.detail.closed"), formatDateTime(ticket.solvedate)],
    [t("tickets.detail.technician"), techName, t("tickets.detail.group"), groupName],
  ];

  return (
    <div className="divide-y divide-border/10 dark:divide-border-dark/10">
      {rows.map(([labelA, valA, labelB, valB], idx) => (
        <div key={idx} className="grid grid-cols-2">
          <div className="px-6 py-4 border-r border-border/10 dark:border-border-dark/10">
            <p className="text-xs font-bold text-textSecondary dark:text-textSecondary-dark uppercase tracking-wide mb-1">
              {labelA}
            </p>
            <p className="text-sm text-textPrimary dark:text-textPrimary-dark">
              {valA ?? "—"}
            </p>
          </div>
          <div className="px-6 py-4">
            <p className="text-xs font-bold text-textSecondary dark:text-textSecondary-dark uppercase tracking-wide mb-1">
              {labelB}
            </p>
            <p className="text-sm text-textPrimary dark:text-textPrimary-dark">
              {valB ?? "—"}
            </p>
          </div>
        </div>
      ))}
      <div className="px-6 py-4">
        <p className="text-xs font-bold text-textSecondary dark:text-textSecondary-dark uppercase tracking-wide mb-1">
          {t("tickets.detail.project")}
        </p>
        <p className="text-sm text-textPrimary dark:text-textPrimary-dark">
          {ticket.tical_numero_prj ?? "—"}
        </p>
      </div>
    </div>
  );
}

function InterventionCard({
  intervention,
  t,
}: {
  intervention: TicketIntervention;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  const isNonBillable = intervention.non_facturable === 1 || intervention.non_facturable === true;

  return (
    <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark card--square-tl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border/10 dark:border-border-dark/10">
        <h2 className="text-base font-bold text-textPrimary dark:text-textPrimary-dark">
          {t("tickets.detail.interventionPlanning")}
        </h2>
      </div>

      <div className="divide-y divide-border/10 dark:divide-border-dark/10">
        <div className="px-5 py-4">
          <span className="text-xs font-bold text-textSecondary dark:text-textSecondary-dark uppercase tracking-wide">
            {t("tickets.detail.date")}
          </span>
          <p className="mt-1 text-sm text-textPrimary dark:text-textPrimary-dark">
            {formatDateTime(intervention.date_begin)}
          </p>
        </div>

        <div className="px-5 py-4">
          <span className="text-xs font-bold text-textSecondary dark:text-textSecondary-dark uppercase tracking-wide">
            {t("tickets.detail.hoursWorked")}
          </span>
          <p className="mt-1 text-sm text-textPrimary dark:text-textPrimary-dark">
            {intervention.preste ?? "—"}
          </p>
        </div>

        {intervention.desc_facturation && (
          <div className="px-5 py-4">
            <span className="text-xs font-bold text-textSecondary dark:text-textSecondary-dark uppercase tracking-wide">
              {t("tickets.detail.actionsTaken")}
            </span>
            <p className="mt-1 text-sm text-textPrimary dark:text-textPrimary-dark whitespace-pre-wrap break-words">
              {intervention.desc_facturation}
            </p>
          </div>
        )}

        <div className="px-5 py-4">
          <span
            className={`inline-flex items-center justify-center w-full px-3 py-2 rounded text-xs font-bold tracking-wide border ${
              isNonBillable
                ? "bg-primary/5 text-textSecondary dark:bg-white/5 dark:text-white/60 border-primary/20"
                : "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 border-green-500/20"
            }`}
          >
            {isNonBillable
              ? t("tickets.detail.nonBillable")
              : t("tickets.detail.billable")}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface LocationState {
  ticket?: Ticket;
}

const TicketDetailPage = () => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { state } = useLocation() as { state: LocationState | null };
  const ticket = state?.ticket;

  if (!ticket) {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center gap-4">
        <p className="text-textSecondary dark:text-textSecondary-dark text-sm">
          {t("tickets.detail.notFound")}
        </p>
        <button
          type="button"
          onClick={() => navigate("/tickets")}
          className="text-secondary text-sm hover:underline"
        >
          ← {t("tickets.detail.back")}
        </button>
      </div>
    );
  }

  const statusKey = (ticket.status ?? "").toLowerCase();
  const interventions: TicketIntervention[] = ticket.interventions ?? [];

  return (
    <div className="flex-1 bg-background dark:bg-background-dark min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate("/tickets")}
          className="text-sm text-textSecondary dark:text-textSecondary-dark hover:text-secondary transition-colors"
        >
          ← {t("tickets.detail.back")}
        </button>

        {/* Top section: ticket card + intervention panel */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* Left: ticket info */}
          <div className="flex-1 min-w-0 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark card--square-tl shadow-sm overflow-hidden">

            {/* Header */}
            <div className="px-6 py-5 flex flex-wrap items-start gap-3 border-b border-border/10 dark:border-border-dark/10">
              <span
                className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-tight ${
                  statusColors[statusKey] ?? "bg-primary/10 text-textSecondary border border-primary/20"
                }`}
              >
                {ticket.status ?? "Unknown"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-textPrimary dark:text-textPrimary-dark leading-snug">
                  {ticket.name}
                </p>
              </div>
              <span className="shrink-0 text-xs text-textSecondary dark:text-textSecondary-dark whitespace-nowrap">
                {t("tickets.detail.ticketNumber", { id: ticket.id })}
              </span>
            </div>

            {/* Info grid */}
            <InfoGrid ticket={ticket} t={t} />
          </div>

          {/* Right: intervention planning cards */}
          {interventions.length > 0 && (
            <div className="w-full lg:w-80 xl:w-96 shrink-0 space-y-4">
              {interventions.map((iv, idx) => (
                <InterventionCard key={idx} intervention={iv} t={t} />
              ))}
            </div>
          )}
        </div>

        {/* Bottom: initial request */}
        {ticket.content && (
          <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark card--square-tl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border/10 dark:border-border-dark/10">
              <h2 className="text-base font-bold text-textPrimary dark:text-textPrimary-dark">
                {t("tickets.detail.initialRequest")}
              </h2>
            </div>
            <div className="px-6 py-5 overflow-x-auto">
              <ContentRenderer raw={ticket.content} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default TicketDetailPage;
