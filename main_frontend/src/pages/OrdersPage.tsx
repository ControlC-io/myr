import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/auth";
import { getJson } from "../api/client";
import { useOrders, type OrderItem } from "../features/orders/useOrders";
import Pagination from "../components/Pagination";
import TableFilters from "../components/TableFilters";

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

function formatAmount(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = Number(String(value).replace(",", "."));
  if (Number.isNaN(parsed)) return String(value);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed);
}

const OrdersPage = () => {
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
        const { organizations } = await getJson<OrgsResponse>("/orgs/mine", undefined, {
          Authorization: `Bearer ${jwtToken}`,
        });

        if (organizations.length === 0) {
          setOrgError("No organization found for the current user.");
          return;
        }

        setOrgId(organizations[0].id);
      } catch (err: unknown) {
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
          setOrgError(
            err instanceof Error ? err.message : "An error occurred while fetching your organization.",
          );
        }
      }
    }

    fetchOrg();
  }, [jwtToken, authLoading, jwtLoading]);

  const { data, isLoading, isError, error, refetch } = useOrders(orgId);

  const rows: OrderItem[] = Array.isArray(data) ? data : [];

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

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, status, dateFrom, dateTo]);

  // Extract unique statuses for the dropdown
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
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-textPrimary dark:text-textPrimary-dark">
              {t("pages.orders.title")}
            </h1>
            <p className="mt-1 text-sm text-textSecondary dark:text-textSecondary-dark">
              {t("pages.orders.subtitle", "Overview of your orders")}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary inline-flex items-center px-3 py-2 text-sm font-medium"
            onClick={() => refetch()}
          >
            {t("actions.refresh", "Refresh")}
          </button>
        </div>

        {orgError && (
          <div className="alert-error">
            <p>{orgError}</p>
          </div>
        )}

        {!orgError && (
          <TableFilters
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            statusOptions={statusOptions}
            dateFrom={dateFrom}
            onDateFromChange={setDateFrom}
            dateTo={dateTo}
            onDateToChange={setDateTo}
          />
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
            {t("pages.orders.empty", "You do not have any orders matching your criteria")}
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
                        {t("orders.columns.reference", "Reference")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("orders.columns.description", "Description")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("orders.columns.date", "Order Date")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("orders.columns.deliveryDate", "Delivery Date")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("orders.columns.amount", "Amount")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("orders.columns.status", "Status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="table-body bg-surface dark:bg-surface-dark">
                    {pagedRows.map((item) => (
                      <tr key={item.id} className="table-row">
                        <td className="table-cell">{item.reference ?? "—"}</td>
                        <td className="table-cell-secondary">{item.description ?? "—"}</td>
                        <td className="table-cell-secondary">{formatDate(item.date)}</td>
                        <td className="table-cell-secondary">{formatDate(item.delivery_date)}</td>
                        <td className="table-cell-secondary">{formatAmount(item.amount)}</td>
                        <td className="table-cell-secondary">
                          {item.status ? (
                            <span className="badge text-[11px]">{item.status}</span>
                          ) : (
                            "—"
                          )}
                        </td>
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

export default OrdersPage;
