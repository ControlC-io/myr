import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/auth";
import { getJson } from "../api/client";
import { useTickets } from "../features/tickets/hooks";
import type { Ticket } from "../features/tickets/types";

const PAGE_SIZE = 10;

interface OrgsResponse {
  organizations: { id: string }[];
}

const statusColors: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600 border border-blue-500/20",
  in_progress: "bg-secondary/10 text-secondary border border-secondary/20",
  resolved: "bg-green-500/10 text-green-600 border border-green-500/20",
  closed: "bg-primary/10 text-textSecondary border border-primary/20",
};

const TicketsPage = () => {
  const { jwtToken, loading: authLoading, jwtLoading } = useAuth();
  const { t } = useTranslation("common");
  const [page, setPage] = useState(1);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrg() {
      if (authLoading || jwtLoading) return;

      if (!jwtToken) {
        setOrgError("No JWT token available. Please log out and log in again.");
        return;
      }

      try {
        setOrgError(null);
        const { organizations } = await getJson<OrgsResponse>("/orgs/mine", undefined, {
          Authorization: `Bearer ${jwtToken}`,
        });

        if (organizations.length === 0) {
          setOrgError("No organization found for the current user.");
          return;
        }

        setOrgId(organizations[0].id);
      } catch (err: any) {
        const status =
          typeof err === "object" && err && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;

        if (status === 401) {
          setOrgError("Your session is not authorized. Please sign in again.");
        } else if (status === 403) {
          setOrgError("Organization access denied for this account.");
        } else if (status === 502) {
          setOrgError("Unable to reach the external data service. Please contact your administrator.");
        } else {
          setOrgError(err.message || "An error occurred while fetching your organization.");
        }
      }
    }

    fetchOrg();
  }, [jwtToken, authLoading, jwtLoading]);

  const { data, isLoading, isError, error, refetch } = useTickets({
    orgId: orgId ?? "",
    paginLimit: PAGE_SIZE,
    paginPage: page,
    orderByDesc: "date",
  });

  const tickets: Ticket[] = data?.data ?? [];

  if (authLoading || jwtLoading || (orgId === null && !orgError)) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-primary-dark"></div>
      </div>
    );
  }

  if (orgError) {
    return (
      <div className="flex-1 p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          {orgError}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background dark:bg-background-dark min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* Header */}
        <header className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold text-textPrimary dark:text-textPrimary-dark">
              {t("pages.tickets.title")}
            </h1>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-pink text-white hover:bg-pink/90 transition-colors shrink-0"
              onClick={() => refetch()}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t("actions.refresh", "Refresh")}
            </button>
          </div>
        </header>

        {/* Tickets table section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="p-1 rounded bg-pink/20 text-pink">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
            <h2 className="text-lg font-bold text-textPrimary dark:text-textPrimary-dark">
              {t("pages.tickets.title")}
            </h2>
            {!isLoading && tickets.length > 0 && (
              <span className="h-5 w-5 rounded-full bg-pink text-white text-[10px] font-bold flex items-center justify-center">
                {tickets.length}
              </span>
            )}
          </div>

          <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark card--square-tl shadow-sm overflow-hidden">
            {isLoading && (
              <div className="py-16 text-center text-textSecondary dark:text-textSecondary-dark text-sm">
                {t("placeholders.loading")}
              </div>
            )}

            {isError && (
              <div className="p-6">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
                  <p>{t("errors.generic", "There was a problem loading tickets")}</p>
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

            {!isLoading && !isError && tickets.length === 0 && (
              <div className="py-16 text-center text-textSecondary dark:text-textSecondary-dark text-sm">
                {t("pages.tickets.empty", "You do not have any tickets yet")}
              </div>
            )}

            {!isLoading && !isError && tickets.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="table-header">
                    <tr>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("tickets.columns.id", "ID")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("tickets.columns.label", "Label")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("tickets.columns.opened", "Opened")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("tickets.columns.status", "Status")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("tickets.columns.solved", "Solved")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/5">
                    {tickets.map((ticket: Ticket) => (
                      <tr
                        key={ticket.id}
                        className="hover:bg-backgroundSecondary/50 dark:hover:bg-backgroundSecondary-dark/50 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-textPrimary dark:text-textPrimary-dark group-hover:text-pink transition-colors">
                            #{ticket.id}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-textPrimary dark:text-textPrimary-dark">
                            {ticket.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark whitespace-nowrap">
                          {ticket.date ? new Date(ticket.date).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-tight ${statusColors[ticket.status ?? ""] ?? "bg-primary/10 text-textSecondary border border-primary/20"}`}>
                            {ticket.status ?? "Unknown"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark whitespace-nowrap">
                          {ticket.solvedate ? new Date(ticket.solvedate).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Pagination */}
        {!isError && !orgError && (
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-semibold rounded border border-border dark:border-border-dark text-textSecondary dark:text-textSecondary-dark hover:text-textPrimary dark:hover:text-textPrimary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              onClick={() => setPage((c) => Math.max(1, c - 1))}
              disabled={page === 1 || isLoading}
            >
              {t("pagination.previous", "Previous")}
            </button>
            <span className="text-xs font-medium text-textSecondary dark:text-textSecondary-dark">
              {t("pagination.page", { page })}
            </span>
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-semibold rounded border border-border dark:border-border-dark text-textSecondary dark:text-textSecondary-dark hover:text-textPrimary dark:hover:text-textPrimary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              onClick={() => setPage((c) => c + 1)}
              disabled={isLoading || tickets.length < PAGE_SIZE}
            >
              {t("pagination.next", "Next")}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default TicketsPage;
