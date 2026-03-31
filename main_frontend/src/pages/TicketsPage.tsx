import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { useAuth } from "@shared/auth";
import { postJson } from "../api/client";
import { useTickets } from "../features/tickets/hooks";
import { createTicket } from "../features/tickets/api";
import type { Ticket } from "../features/tickets/types";
import Pagination from "../components/Pagination";
import PageHeader from "../components/PageHeader";
import { useOrg } from "../hooks/useOrg";

const PAGE_SIZE = 10;

const statusColors: Record<string, string> = {
  open:        "bg-blue-500/10  text-blue-600  dark:bg-blue-500/20  dark:text-blue-300  border border-blue-500/20  dark:border-blue-400/30",
  in_progress: "bg-secondary/10 text-secondary dark:bg-secondary/20 dark:text-secondary border border-secondary/20 dark:border-secondary/30",
  resolved:    "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 border border-green-500/20 dark:border-green-400/30",
  closed:      "bg-primary/10   text-textSecondary dark:bg-white/10 dark:text-white/60   border border-primary/20   dark:border-white/15",
};

// ─── New Ticket Modal ──────────────────────────────────────────────────────────

interface NewTicketModalProps {
  orgId: string;
  jwtToken: string;
  userEmail: string;
  ticalContactId: number | null;
  onClose: () => void;
  onCreated: () => void;
}

const NewTicketModal = ({ orgId, jwtToken, userEmail, ticalContactId, onClose, onCreated }: NewTicketModalProps) => {
  const { t } = useTranslation("common");
  const overlayRef = useRef<HTMLDivElement>(null);

  const [title, setTitle]                       = useState("");
  const [description, setDescription]           = useState("");
  const [followupContacts, setFollowupContacts] = useState("");
  const [dragOver, setDragOver]                 = useState(false);
  const [submitting, setSubmitting]             = useState(false);
  const [error, setError]                       = useState<string | null>(null);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!ticalContactId) {
      setError(t("tickets.newTicket.errorNoContact"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createTicket(orgId, { ticalContactId, userEmail, title, description, followupContacts }, jwtToken);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message ?? t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={handleOverlayClick}
    >
      <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border dark:border-border-dark">
          <h2 className="text-lg font-bold text-textPrimary dark:text-textPrimary-dark">
            {t("tickets.newTicket.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-textSecondary dark:text-textSecondary-dark hover:bg-border/50 dark:hover:bg-border-dark/50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Subject */}
          <input
            type="text"
            className="input"
            placeholder={t("tickets.newTicket.subjectPlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />

          {/* Description */}
          <textarea
            className="input resize-none"
            rows={6}
            placeholder={t("tickets.newTicket.descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* File drop zone */}
          <div
            className={`rounded-lg border-2 border-dashed transition-colors py-6 flex flex-col items-center justify-center gap-1 cursor-pointer select-none ${
              dragOver
                ? "border-secondary bg-secondary/5"
                : "border-border dark:border-border-dark hover:border-secondary/50 hover:bg-secondary/[0.03]"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
          >
            <svg className="w-6 h-6 text-textSecondary dark:text-textSecondary-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs text-textSecondary dark:text-textSecondary-dark">
              {t("tickets.newTicket.dropZone")}
            </span>
          </div>

          {/* Followup contacts */}
          <div>
            <label className="form-label text-xs">
              {t("tickets.newTicket.personsConcerned")}
            </label>
            <input
              type="text"
              className="input"
              placeholder={t("tickets.newTicket.personsConcernedPlaceholder")}
              value={followupContacts}
              onChange={(e) => setFollowupContacts(e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-status-error dark:text-status-error-dark">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn-outlined text-xs px-5 py-2"
              disabled={submitting}
            >
              {t("actions.cancel")}
            </button>
            <button
              type="submit"
              className="btn-primary text-xs px-5 py-2 uppercase tracking-wider"
              disabled={submitting || !title.trim()}
            >
              {submitting ? t("tickets.newTicket.creating") : t("tickets.newTicket.create")}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

interface SupplierContact {
  contact: { id: string; email: string };
}
interface SupplierProxyResponse {
  data: { supplier: { data: Array<{ contacts: SupplierContact[] }> } };
}

const TicketsPage = () => {
  const { jwtToken, user } = useAuth();
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const orgId = useOrg();
  const [page, setPage] = useState(1);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [ticalContactId, setTicalContactId] = useState<number | null>(null);

  const todayISO = new Date().toISOString().split("T")[0];

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState(todayISO);
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!orgId || !jwtToken) return;

    async function fetchTicalContact() {
      try {
        const supplierResp = await postJson<Record<string, never>, SupplierProxyResponse>(
          `/orgs/${orgId}/proxy/supplier`,
          {},
          { Authorization: `Bearer ${jwtToken}` },
        );
        const contacts = supplierResp.data?.supplier?.data?.[0]?.contacts ?? [];
        const match = contacts.find(
          (c) => c.contact.email?.toLowerCase() === user?.email?.toLowerCase()
        );
        if (match) setTicalContactId(Number(match.contact.id));
      } catch {
        // Non-critical — modal will show error if ticalContactId is null when submitting
      }
    }

    fetchTicalContact();
  }, [orgId, jwtToken, user?.email]);

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

  const formatDateCell = (iso: string | null | undefined): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const exportToXlsx = () => {
    const rows = filteredTickets.map((ticket) => ({
      ID: ticket.id,
      Label: ticket.name ?? "",
      Opened: formatDateCell(ticket.date),
      Status: ticket.status ?? "",
      Solved: formatDateCell(ticket.solvedate),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 10 },
      { wch: 60 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tickets");
    XLSX.writeFile(workbook, "tickets.xlsx");
  };

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
          disabled={false}
          extraRight={
            <div className="flex items-center gap-1.5">
              {/* Export */}
              <button
                type="button"
                onClick={exportToXlsx}
                disabled={isLoading || isError || filteredTickets.length === 0}
                title={t("actions.export")}
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark text-textSecondary dark:text-textSecondary-dark hover:border-secondary/50 hover:text-secondary hover:bg-secondary/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>

              {/* New ticket */}
              <button
                type="button"
                onClick={() => setShowNewTicket(true)}
                title={t("tickets.newTicket.button")}
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-secondary dark:bg-pink text-white hover:opacity-90 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>

              {/* Refresh */}
              <button
                type="button"
                disabled={isRefetching}
                title={t("actions.refresh")}
                onClick={refetch}
                className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark text-textSecondary dark:text-textSecondary-dark hover:border-secondary/50 hover:text-secondary hover:bg-secondary/5 disabled:opacity-50 transition-colors"
              >
                <svg className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          }
        />

        {/* Tickets table section */}
        <section className="space-y-4">
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
                        className="table-row group cursor-pointer"
                        onClick={() => navigate(`/tickets/${ticket.id}`, { state: { ticket } })}
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
                          {formatDateCell(ticket.date) || "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-tight ${statusColors[ticket.status ?? ""] ?? "bg-primary/10 text-textSecondary border border-primary/20"}`}>
                            {ticket.status ?? "Unknown"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark whitespace-nowrap">
                          {formatDateCell(ticket.solvedate) || "—"}
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
        {!isError && (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            hasNextPage={tickets.length === PAGE_SIZE}
            isLoading={isLoading}
          />
        )}

      </div>

      {/* New Ticket Modal */}
      {showNewTicket && orgId && jwtToken && (
        <NewTicketModal
          orgId={orgId}
          jwtToken={jwtToken}
          userEmail={user?.email ?? ""}
          ticalContactId={ticalContactId}
          onClose={() => setShowNewTicket(false)}
          onCreated={() => { refetch(); }}
        />
      )}
    </div>
  );
};

export default TicketsPage;
