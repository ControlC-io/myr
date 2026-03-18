import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/auth";
import { getJson } from "../api/client";
import { useOffers, type OfferItem } from "../features/offers/useOffers";
import Pagination from "../components/Pagination";
import PageHeader from "../components/PageHeader";

interface OrgsResponse {
  organizations: { id: string }[];
}

const PAGE_SIZE = 10;

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

const OffresPage = () => {
  const { jwtToken, loading: authLoading, jwtLoading } = useAuth();
  const { t } = useTranslation("common");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
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
        const { organizations } = await getJson<OrgsResponse>(
          "/orgs/mine",
          undefined,
          { Authorization: `Bearer ${jwtToken}` },
        );

        if (organizations.length === 0) {
          setOrgError("No organization found for the current user.");
          return;
        }

        setOrgId(organizations[0].id);
      } catch (err: unknown) {
        const errStatus =
          typeof err === "object" && err && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;

        if (errStatus === 401) {
          setOrgError("Your session is not authorized. Please sign in again.");
        } else if (errStatus === 403) {
          setOrgError("Organization access denied for this account.");
        } else if (errStatus === 502) {
          setOrgError(
            "Unable to reach the external data service. Please contact your administrator.",
          );
        } else {
          setOrgError(
            err instanceof Error
              ? err.message
              : "An error occurred while fetching your organization.",
          );
        }
      }
    }

    fetchOrg();
  }, [jwtToken, authLoading, jwtLoading]);

  const { data, isLoading, isRefetching, isError, error, refetch } =
    useOffers(orgId);

  const rows: OfferItem[] = Array.isArray(data) ? data : [];

  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      const matchesSearch =
        search === "" ||
        (item.reference || "").toLowerCase().includes(search.toLowerCase()) ||
        (item.description || "").toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        status === "" ||
        (item.status || "").toLowerCase() === status.toLowerCase();

      const itemDate = item.date ? new Date(item.date) : null;
      let matchesDateFrom = true;
      if (dateFrom && itemDate) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        matchesDateFrom = itemDate >= fromDate;
      }

      let matchesDateTo = true;
      if (dateTo && itemDate) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        matchesDateTo = itemDate <= toDate;
      }

      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [rows, search, status, dateFrom, dateTo]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  useEffect(() => {
    setPage(1);
  }, [search, status, dateFrom, dateTo]);

  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    rows.forEach((item) => {
      if (item.status) statuses.add(item.status);
    });
    return Array.from(statuses).map((s) => ({ label: s, value: s }));
  }, [rows]);

  if (authLoading || jwtLoading || (orgId === null && !orgError)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark:bg-background-dark">
        <p className="text-sec text-sm">{t("placeholders.loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background dark:bg-background-dark min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <PageHeader
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          }
          title={t("pages.offers.title")}
          count={!isLoading ? filteredRows.length : undefined}
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

        {orgError && (
          <div className="alert-error">
            <p>{orgError}</p>
          </div>
        )}

        {!orgError && isLoading && (
          <div className="py-10 text-center text-sec text-sm">
            {t("placeholders.loading")}
          </div>
        )}

        {!orgError && isError && (
          <div className="alert-error space-y-2">
            <p>{t("errors.generic", "There was a problem loading data")}</p>
            <p className="text-xs opacity-80 text-sec">
              {error instanceof Error ? error.message : String(error)}
            </p>
            <button
              type="button"
              className="mt-1 pag-btn"
              onClick={() => refetch()}
            >
              {t("actions.retry", "Try again")}
            </button>
          </div>
        )}

        {!orgError && !isLoading && !isError && filteredRows.length === 0 && (
          <div className="py-10 text-center text-sec text-sm">
            {t("pages.offers.empty", "You do not have any offers matching your criteria")}
          </div>
        )}

        {!orgError && !isLoading && !isError && filteredRows.length > 0 && (
          <>
            <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark card--square-tl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="table-header">
                    <tr>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("offers.columns.reference", "Reference")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("offers.columns.description", "Description")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("offers.columns.date", "Date")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("offers.columns.status", "Status")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("offers.columns.amount", "Amount")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="table-body bg-surface dark:bg-surface-dark">
                    {pagedRows.map((item) => (
                      <tr key={item.id} className="table-row">
                        <td className="table-cell">{item.reference ?? "—"}</td>
                        <td className="table-cell-secondary">{item.description ?? "—"}</td>
                        <td className="table-cell-secondary">{formatDate(item.date)}</td>
                        <td className="table-cell-secondary">
                          {item.status ? (
                            <span className="badge text-[11px]">{item.status}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="table-cell-secondary">{item.amount ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={filteredRows.length}
              onPageChange={setPage}
              isLoading={isLoading}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default OffresPage;
