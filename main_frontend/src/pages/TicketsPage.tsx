import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/auth";
import { getJson } from "../api/client";
import { useTickets } from "../features/tickets/hooks";
import type { Ticket } from "../features/tickets/types";
import Pagination from "../components/Pagination";
import PageHeader from "../components/PageHeader";

const PAGE_SIZE = 10;

interface OrgsResponse {
  organizations: { id: string }[];
}

const statusColors: Record<string, string> = {
  open:        "bg-blue-500/10  text-blue-600  dark:bg-blue-500/20  dark:text-blue-300  border border-blue-500/20  dark:border-blue-400/30",
  in_progress: "bg-secondary/10 text-secondary dark:bg-secondary/20 dark:text-secondary border border-secondary/20 dark:border-secondary/30",
  resolved:    "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 border border-green-500/20 dark:border-green-400/30",
  closed:      "bg-primary/10   text-textSecondary dark:bg-white/10 dark:text-white/60   border border-primary/20   dark:border-white/15",
};

const TicketsPage = () => {
  const { jwtToken, loading: authLoading, jwtLoading } = useAuth();
  const { t } = useTranslation("common");
  const [page, setPage] = useState(1);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);

  const todayISO = new Date().toISOString().split("T")[0];

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState(todayISO);
  const [dateTo, setDateTo] = useState("");

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

  const { data, isLoading, isRefetching, isError, error, refetch } = useTickets({
    orgId: orgId ?? "",
    paginLimit: PAGE_SIZE,
    paginPage: page,
    orderByDesc: "date",
  });

  const tickets: Ticket[] = data?.data ?? [];

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesSearch =
        search === "" ||
        (ticket.name || "").toLowerCase().includes(search.toLowerCase()) ||
        String(ticket.id).includes(search);
      
      const matchesStatus =
        status === "" ||
        (ticket.status || "").toLowerCase() === status.toLowerCase();
      
      const ticketDate = ticket.date ? new Date(ticket.date) : null;
      let matchesDateFrom = true;
      if (dateFrom && ticketDate) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        matchesDateFrom = ticketDate >= fromDate;
      }
      
      let matchesDateTo = true;
      if (dateTo && ticketDate) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        matchesDateTo = ticketDate <= toDate;
      }

      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [tickets, search, status, dateFrom, dateTo]);

  const statusOptions = [
    { label: "Open", value: "open" },
    { label: "In Progress", value: "in_progress" },
    { label: "Resolved", value: "resolved" },
    { label: "Closed", value: "closed" },
  ];

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
        <PageHeader
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
          title={t("pages.tickets.title")}
          count={!isLoading ? filteredTickets.length : undefined}
          search={search}
          onSearchChange={setSearch}
          status={status}
          onStatusChange={setStatus}
          statusOptions={statusOptions}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          isRefetching={isRefetching}
          onRefetch={refetch}
          disabled={!!orgError}
        />

        {/* Tickets table section */}
        <section className="space-y-4">
          <div className="hidden">{/* section header removed - merged into page header above */}</div>

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

            {!isLoading && !isError && filteredTickets.length === 0 && (
              <div className="py-16 text-center text-textSecondary dark:text-textSecondary-dark text-sm">
                {t("pages.tickets.empty", "No tickets match your criteria")}
              </div>
            )}

            {!isLoading && !isError && filteredTickets.length > 0 && (
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
                    {filteredTickets.map((ticket: Ticket) => (
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
                          {ticket.date ? (() => {
                            const d = new Date(ticket.date);
                            if (Number.isNaN(d.getTime())) return ticket.date;
                            const day = String(d.getDate()).padStart(2, "0");
                            const month = String(d.getMonth() + 1).padStart(2, "0");
                            const year = d.getFullYear();
                            return `${day}/${month}/${year}`;
                          })() : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-tight ${statusColors[ticket.status ?? ""] ?? "bg-primary/10 text-textSecondary border border-primary/20"}`}>
                            {ticket.status ?? "Unknown"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark whitespace-nowrap">
                          {ticket.solvedate ? (() => {
                            const d = new Date(ticket.solvedate);
                            if (Number.isNaN(d.getTime())) return ticket.solvedate;
                            const day = String(d.getDate()).padStart(2, "0");
                            const month = String(d.getMonth() + 1).padStart(2, "0");
                            const year = d.getFullYear();
                            return `${day}/${month}/${year}`;
                          })() : "—"}
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
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            hasNextPage={tickets.length === PAGE_SIZE}
            isLoading={isLoading}
          />
        )}

      </div>
    </div>
  );
};

export default TicketsPage;
