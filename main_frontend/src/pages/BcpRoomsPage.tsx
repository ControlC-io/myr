import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/auth";
import { getJson } from "../api/client";
import { useBcpBookings } from "../features/bcp/hooks";
import type { BcpBooking } from "../features/bcp/types";
import type { CalendarEvent } from "../components/MonthCalendar";
import MonthCalendar from "../components/MonthCalendar";

type Tab = "list" | "calendar";

interface OrgsResponse {
  organizations: { id: string }[];
}

// booking_status: 1=open slot, 2=tentative, 3=scheduled, 4=confirmed, 5=holiday
const statusColors: Record<number, string> = {
  4: "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 border border-green-500/20 dark:border-green-400/30",
  3: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-500/20 dark:border-blue-400/30",
  2: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300 border border-yellow-500/20 dark:border-yellow-400/30",
};

const statusEventColors: Record<number, string> = {
  4: "bg-green-500/15 text-green-700 dark:bg-green-500/20 dark:text-green-300",
  3: "bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  2: "bg-yellow-500/15 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300",
};

function formatDate(dt: string): string {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return dt;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(dt: string): string {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function toCalendarDate(dt: string): string {
  // "2026-03-17 13:00:00" → "2026-03-17"
  return dt.split(" ")[0];
}

function getRoomLabel(b: BcpBooking): string {
  const rooms: string[] = [];
  if (b.room_bcp1) rooms.push("BCP1");
  if (b.room_bcp2) rooms.push("BCP2");
  if (b.meeting_room) rooms.push("Meeting");
  return rooms.length > 0 ? rooms.join(", ") : "—";
}

function getTypeLabel(b: BcpBooking, t: (k: string) => string): string {
  const bc = b.business_continuity === 1;
  const dr = b.disaster_recovery === 1;
  if (bc && dr) return t("pages.bcpRooms.type.both");
  if (bc) return t("pages.bcpRooms.type.bcp");
  if (dr) return t("pages.bcpRooms.type.drp");
  return "—";
}

const BcpRoomsPage = () => {
  const { t } = useTranslation("common");
  const { jwtToken, loading: authLoading, jwtLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("list");
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
        } else {
          setOrgError(err.message || "An error occurred while fetching your organization.");
        }
      }
    }
    fetchOrg();
  }, [jwtToken, authLoading, jwtLoading]);

  const { data: bookings = [], isLoading, isRefetching, isError, error, refetch } = useBcpBookings(orgId);

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => a.start_datetime.localeCompare(b.start_datetime)),
    [bookings]
  );

  const calendarEvents = useMemo<CalendarEvent[]>(() =>
    sortedBookings.map((b) => ({
      id: b.id,
      date: toCalendarDate(b.start_datetime),
      label: b.customer_name ?? `#${b.id}`,
      colorClass: statusEventColors[b.booking_status] ?? "bg-secondary/15 text-secondary",
    })),
    [sortedBookings]
  );

  if (authLoading || jwtLoading || (orgId === null && !orgError)) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-primary-dark" />
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

        {/* Title + refresh */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-textPrimary dark:text-textPrimary-dark flex-1">
            {t("pages.bcpRooms.title")}
          </h1>
          <button
            type="button"
            disabled={isRefetching}
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-pink text-white hover:bg-pink/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <svg
              className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRefetching ? t("actions.refreshing") : t("actions.refresh")}
          </button>
        </div>

        {/* Tabs */}
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
            {t("pages.bcpRooms.tabs.list")}
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
            {t("pages.bcpRooms.tabs.calendar")}
          </button>
        </div>

        {/* Error state */}
        {isError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
            <p>{t("errors.generic")}</p>
            <p className="text-xs opacity-80 mt-1">
              {error instanceof Error ? error.message : String(error)}
            </p>
            <button type="button" className="mt-2 text-xs underline" onClick={() => refetch()}>
              {t("actions.retry")}
            </button>
          </div>
        )}

        {/* Tab content */}
        {activeTab === "list" ? (
          <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark card--square-tl shadow-sm overflow-hidden">
            {isLoading && (
              <div className="py-16 text-center text-textSecondary dark:text-textSecondary-dark text-sm">
                {t("placeholders.loading")}
              </div>
            )}
            {!isLoading && !isError && sortedBookings.length === 0 && (
              <div className="py-16 text-center text-textSecondary dark:text-textSecondary-dark text-sm">
                {t("pages.bcpRooms.empty")}
              </div>
            )}
            {!isLoading && !isError && sortedBookings.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="table-header">
                    <tr>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">{t("pages.bcpRooms.columns.date")}</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">{t("pages.bcpRooms.columns.time")}</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">{t("pages.bcpRooms.columns.rooms")}</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">{t("pages.bcpRooms.columns.type")}</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">{t("pages.bcpRooms.columns.seats")}</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">{t("pages.bcpRooms.columns.status")}</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">{t("pages.bcpRooms.columns.comment")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/5">
                    {sortedBookings.map((b: BcpBooking) => (
                      <tr
                        key={b.id}
                        className="table-row"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-textPrimary dark:text-textPrimary-dark whitespace-nowrap">
                          {formatDate(b.start_datetime)}
                        </td>
                        <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark whitespace-nowrap">
                          {formatTime(b.start_datetime)} – {formatTime(b.end_datetime)}
                        </td>
                        <td className="px-6 py-4 text-sm text-textPrimary dark:text-textPrimary-dark">
                          {getRoomLabel(b)}
                        </td>
                        <td className="px-6 py-4 text-sm text-textPrimary dark:text-textPrimary-dark">
                          {getTypeLabel(b, t)}
                        </td>
                        <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark text-center">
                          {b.seating_nbr ?? "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-tight ${statusColors[b.booking_status] ?? "bg-primary/10 text-textSecondary border border-primary/20"}`}>
                            {t(`pages.bcpRooms.status.${b.booking_status}`, { defaultValue: String(b.booking_status) })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark max-w-xs truncate">
                          {b.comment ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <MonthCalendar events={calendarEvents} />
        )}

      </div>
    </div>
  );
};

export default BcpRoomsPage;
