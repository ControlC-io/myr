import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useInterventions } from "../features/interventions/hooks";
import { useOrg } from "../hooks/useOrg";
import MonthCalendar from "../components/MonthCalendar";
import type { CalendarEvent } from "../components/MonthCalendar";
import type { InterventionItem } from "../features/interventions/types";
import type { Ticket } from "../features/tickets/types";
import Pagination from "../components/Pagination";

const PAGE_SIZE = 10;

type Tab = "list" | "calendar";

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hh}:${mm}`;
}

function toCalendarDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  // dateStr is like "2026-04-23 20:15:00" — take the date part
  return dateStr.split(" ")[0] ?? "";
}

function toTime(dateStr: string | null | undefined): string | undefined {
  if (!dateStr) return undefined;
  const timePart = dateStr.split(" ")[1];
  if (!timePart) return undefined;
  // return HH:MM only
  return timePart.slice(0, 5);
}

function toTicket(item: InterventionItem): Ticket {
  return {
    id: item.id_tracking,
    name: item.desc_facturation ?? `#${item.id_tracking}`,
    interventions: [{
      date_begin: item.date_begin,
      desc_facturation: item.desc_facturation,
      preste: String(item.preste ?? ""),
      non_facturable: item.non_facturable,
    }],
  };
}

function toCalendarEvents(items: InterventionItem[], onNavigate: (item: InterventionItem) => void): CalendarEvent[] {
  return items.map((item) => ({
    id: item.id,
    date: toCalendarDate(item.date_begin),
    label: item.desc_facturation?.slice(0, 60) ?? `#${item.id}`,
    time: toTime(item.date_begin),
    onClick: () => onNavigate(item),
  }));
}

const InterventionsPage = () => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const orgId = useOrg();
  const [activeTab, setActiveTab] = useState<Tab>("list");
  const [page, setPage] = useState(1);

  const handleNavigate = (item: InterventionItem) => {
    navigate(`/tickets/${item.id_tracking}`, { state: { ticket: toTicket(item) } });
  };

  const today = new Date().toISOString().split("T")[0];

  const { data, isLoading, isError, error, refetch } = useInterventions({
    orgId: orgId ?? "",
    dateBegin: `>${today}`,
    paginPage: page,
    pageSize: PAGE_SIZE,
  });

  const total = data?.intervention?.total ?? null;
  const items: InterventionItem[] = data?.intervention?.data ?? [];

  if (!orgId) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-primary-dark"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background dark:bg-background-dark min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        <h1 className="text-2xl font-bold text-textPrimary dark:text-textPrimary-dark">
          {t("pages.interventions.title")}
          {total !== null && (
            <span className="ml-3 text-base font-medium text-textSecondary dark:text-textSecondary-dark">
              ({total})
            </span>
          )}
        </h1>

        <div className="flex gap-8 border-b border-border/20 dark:border-border-dark/20 justify-center">
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`pb-3 text-sm font-bold tracking-wide transition-colors ${
              activeTab === "list"
                ? "text-pink border-b-2 border-pink"
                : "text-textSecondary dark:text-textSecondary-dark hover:text-textPrimary dark:hover:text-textPrimary-dark"
            }`}
          >
            {t("pages.interventions.tabs.list")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("calendar")}
            className={`pb-3 text-sm font-bold tracking-wide transition-colors ${
              activeTab === "calendar"
                ? "text-pink border-b-2 border-pink"
                : "text-textSecondary dark:text-textSecondary-dark hover:text-textPrimary dark:hover:text-textPrimary-dark"
            }`}
          >
            {t("pages.interventions.tabs.calendar")}
          </button>
        </div>

        {activeTab === "list" ? (
          <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark card--square-tl shadow-sm overflow-hidden">
            {isLoading && (
              <div className="py-16 text-center text-textSecondary dark:text-textSecondary-dark text-sm">
                {t("placeholders.loading")}
              </div>
            )}

            {isError && (
              <div className="p-6">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
                  <p>{t("errors.generic", "There was a problem loading interventions")}</p>
                  <p className="text-xs opacity-80 mt-1">
                    {error instanceof Error ? error.message : String(error)}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-xs underline"
                    onClick={() => refetch()}
                  >
                    {t("actions.retry", "Try again")}
                  </button>
                </div>
              </div>
            )}

            {!isLoading && !isError && items.length === 0 && (
              <div className="py-16 text-center text-textSecondary dark:text-textSecondary-dark text-sm">
                {t("pages.interventions.empty")}
              </div>
            )}

            {!isLoading && !isError && items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="table-header">
                    <tr>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap">
                        {t("tickets.detail.date")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("tickets.detail.actionsTaken")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/5">
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="table-row group cursor-pointer"
                        onClick={() => handleNavigate(item)}
                      >
                        <td className="px-6 py-4 text-sm text-textPrimary dark:text-textPrimary-dark whitespace-nowrap group-hover:text-pink transition-colors">
                          {formatDateTime(item.date_begin)}
                        </td>
                        <td className="px-6 py-4 text-sm text-textPrimary dark:text-textPrimary-dark">
                          {item.desc_facturation ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <MonthCalendar events={toCalendarEvents(items, handleNavigate)} />
        )}

        {activeTab === "list" && !isError && total !== null && total > PAGE_SIZE && (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={total}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        )}

      </div>
    </div>
  );
};

export default InterventionsPage;
