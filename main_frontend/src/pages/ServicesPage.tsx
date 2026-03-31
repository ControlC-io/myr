import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useServices, type ServiceItem } from "../features/services/useServices";
import { useOrg } from "../hooks/useOrg";
import PageHeader from "../components/PageHeader";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

const ServicesPage = () => {
  const orgId = useOrg();
  const { t } = useTranslation("common");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading, isRefetching, isError, error, refetch } = useServices(orgId);

  const rows: ServiceItem[] = data ?? [];

  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      const matchesSearch =
        search === "" ||
        (item.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (item.type ?? "").toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        status === "" ||
        (item.status ?? "").toLowerCase() === status.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, status]);

  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    rows.forEach((item) => { if (item.status) statuses.add(item.status); });
    return Array.from(statuses).map((s) => ({ label: s, value: s }));
  }, [rows]);

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

        <PageHeader
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          title={t("pages.services.title")}
          count={!isLoading ? filteredRows.length : undefined}
          search={search}
          onSearchChange={setSearch}
          status={status}
          onStatusChange={setStatus}
          statusOptions={statusOptions}
          isRefetching={isRefetching}
          onRefetch={refetch}
          disabled={!!orgError}
        />

        <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark card--square-tl shadow-sm overflow-hidden">
          {isLoading && (
            <div className="py-16 text-center text-textSecondary dark:text-textSecondary-dark text-sm">
              {t("placeholders.loading")}
            </div>
          )}

          {isError && (
            <div className="p-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
                <p>{t("errors.generic")}</p>
                <p className="text-xs opacity-80 mt-1">
                  {error instanceof Error ? error.message : String(error)}
                </p>
                <button type="button" className="mt-2 text-xs underline" onClick={() => refetch()}>
                  {t("actions.retry")}
                </button>
              </div>
            </div>
          )}

          {!isLoading && !isError && filteredRows.length === 0 && (
            <div className="py-16 text-center text-textSecondary dark:text-textSecondary-dark text-sm">
              {t("pages.services.empty")}
            </div>
          )}

          {!isLoading && !isError && filteredRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="table-header">
                  <tr>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                      {t("services.columns.name")}
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                      {t("services.columns.type")}
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                      {t("services.columns.dateStart")}
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                      {t("services.columns.dateEnd")}
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                      {t("services.columns.status")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/5">
                  {filteredRows.map((item, idx) => (
                    <tr
                      key={item.id ?? idx}
                      className="hover:bg-backgroundSecondary/50 dark:hover:bg-backgroundSecondary-dark/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-textPrimary dark:text-textPrimary-dark">
                          {item.name ?? "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark">
                        {item.type ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark whitespace-nowrap">
                        {formatDate(item.date_start)}
                      </td>
                      <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark whitespace-nowrap">
                        {formatDate(item.date_end)}
                      </td>
                      <td className="px-6 py-4">
                        {item.status ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-tight bg-primary/10 text-textSecondary dark:bg-white/10 dark:text-white/60 border border-primary/20">
                            {t(`services.status.${item.status}`, item.status)}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ServicesPage;
