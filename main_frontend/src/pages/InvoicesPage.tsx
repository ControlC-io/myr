import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDecompte, type DocItem } from "../features/billing/useDecompte";
import { useOrg } from "../hooks/useOrg";
import Pagination from "../components/Pagination";
import PageHeader from "../components/PageHeader";

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

const InvoicesPage = () => {
  const orgId = useOrg();
  const { t } = useTranslation("common");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading, isRefetching, isError, error, refetch } = useDecompte(orgId);

  const rows: DocItem[] = Array.isArray(data) ? data : [];

  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      const matchesSearch =
        search === "" ||
        (item.number || "").toLowerCase().includes(search.toLowerCase()) ||
        (item.description || "").toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus =
        status === "" ||
        (status === "open" && item.is_open) ||
        (status === "closed" && !item.is_open);
      
      const itemDate = item.sentDate ? new Date(item.sentDate) : null;
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

  const totalAmount = useMemo(() => {
    return filteredRows.reduce((sum, item) => {
      const parsed = Number(String(item.amount).replace(",", "."));
      if (Number.isNaN(parsed)) return sum;
      return sum + parsed;
    }, 0);
  }, [filteredRows]);

  const statusOptions = [
    { label: t("billing.status.open", "Open"), value: "open" },
    { label: t("billing.status.closed", "Closed"), value: "closed" },
  ];

  if (!orgId) {
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          title={t("pages.billing.title")}
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
          extraRight={
            <div className="text-xs text-textSecondary dark:text-textSecondary-dark">
              {t("billing.summary.totalOutstanding", "Total outstanding")}:{" "}
              <span className="font-semibold text-textPrimary dark:text-textPrimary-dark">
                {formatAmount(totalAmount.toFixed(2))}
              </span>
            </div>
          }
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
            <p>{t("errors.billingLoad", "There was a problem loading your invoices")}</p>
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
            {t("pages.billing.empty", "You do not have any invoices matching your criteria")}
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
                        {t("billing.columns.issueDate", "Issue Date")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("billing.columns.invoice", "Invoice Number")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("billing.columns.dueDate", "Due Date")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("billing.columns.amount", "Initial Amount")}
                      </th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                        {t("billing.columns.status", "Status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="table-body bg-surface dark:bg-surface-dark">
                    {pagedRows.map((item) => (
                      <tr key={item.id} className="table-row">
                        <td className="table-cell-secondary">{formatDate(item.sentDate)}</td>
                        <td className="table-cell">{item.number}</td>
                        <td className="table-cell-secondary">{formatDate(item.due_date)}</td>
                        <td className="table-cell-secondary">{formatAmount(item.amount)}</td>
                        <td className="table-cell-secondary">
                          <span className={item.is_open
                            ? "badge badge-warning text-[11px]"
                            : "badge text-[11px]"
                          }>
                            {item.is_open
                              ? t("billing.status.open", "Open")
                              : t("billing.status.closed", "Closed")}
                          </span>
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

export default InvoicesPage;
