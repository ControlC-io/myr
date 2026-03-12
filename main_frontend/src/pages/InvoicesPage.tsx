import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/auth";
import { getJson } from "../api/client";
import { useDecompte, type DocItem } from "../features/billing/useDecompte";

interface OrgsResponse {
  organizations: { id: string }[];
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
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
  const { jwtToken, loading: authLoading, jwtLoading } = useAuth();
  const { t } = useTranslation("common");
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

  const { data, isLoading, isError, error, refetch } = useDecompte(orgId);

  const rows: DocItem[] = Array.isArray(data) ? data : [];

  const totalAmount = useMemo(() => {
    return rows.reduce((sum, item) => {
      const parsed = Number(String(item.amount).replace(",", "."));
      if (Number.isNaN(parsed)) return sum;
      return sum + parsed;
    }, 0);
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
              {t("pages.billing.title")}
            </h1>
            <p className="mt-1 text-sm text-textSecondary dark:text-textSecondary-dark">
              {t("pages.billing.subtitle", "Overview of your open invoices and account balance")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              className="btn-primary inline-flex items-center px-3 py-2 text-sm font-medium"
              onClick={() => refetch()}
            >
              {t("actions.refresh", "Refresh")}
            </button>
            <div className="text-xs text-textSecondary dark:text-textSecondary-dark">
              {t("billing.summary.totalOutstanding", "Total outstanding")}:{" "}
              <span className="font-semibold text-textPrimary dark:text-textPrimary-dark">
                {formatAmount(totalAmount.toFixed(2))}
              </span>
            </div>
          </div>
        </div>

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

        {!orgError && !isLoading && !isError && rows.length === 0 && (
          <div className="py-10 text-center text-sec text-sm">
            {t("pages.billing.empty", "You do not have any open invoices for this account")}
          </div>
        )}

        {!orgError && !isLoading && !isError && rows.length > 0 && (
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
                  {rows.map((item) => (
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
        )}
      </div>
    </div>
  );
};

export default InvoicesPage;
