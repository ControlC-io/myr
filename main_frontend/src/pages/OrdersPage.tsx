import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useOrders, type OrderItem } from "../features/orders/useOrders";
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

function totalAmount(order: OrderItem): string {
  if (!order.articles || order.articles.length === 0) return "—";
  const total = order.articles.reduce((sum, a) => sum + (a.prix_vente ?? 0) * (a.quantity ?? 1), 0);
  if (total === 0) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(total);
}

const OrdersPage = () => {
  const orgId = useOrg();
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading, isRefetching, isError, error, refetch } = useOrders(orgId);

  const orders: OrderItem[] = data ?? [];

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        search === "" ||
        (order.command_num ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (order.title ?? "").toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        status === "" ||
        (order.status ?? "").toLowerCase() === status.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, status]);

  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    orders.forEach((o) => { if (o.status) statuses.add(o.status); });
    return Array.from(statuses).map((s) => ({ label: s, value: s }));
  }, [orders]);

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
          }
          title={t("pages.orders.title")}
          count={!isLoading ? filteredOrders.length : undefined}
          search={search}
          onSearchChange={setSearch}
          status={status}
          onStatusChange={setStatus}
          statusOptions={statusOptions}
          isRefetching={isRefetching}
          onRefetch={refetch}
          disabled={false}
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

          {!isLoading && !isError && filteredOrders.length === 0 && (
            <div className="py-16 text-center text-textSecondary dark:text-textSecondary-dark text-sm">
              {t("pages.orders.empty")}
            </div>
          )}

          {!isLoading && !isError && filteredOrders.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="table-header">
                  <tr>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                      {t("orders.columns.reference")}
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                      {t("orders.columns.description")}
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                      {t("orders.columns.date")}
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                      {t("orders.columns.amount")}
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest">
                      {t("orders.columns.status")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/5">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-backgroundSecondary/50 dark:hover:bg-backgroundSecondary-dark/50 transition-colors group cursor-pointer"
                      onClick={() => navigate(`/commandes/${order.id}`, { state: { order } })}
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-textPrimary dark:text-textPrimary-dark group-hover:text-pink transition-colors">
                          {order.command_num ?? `#${order.id}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-textPrimary dark:text-textPrimary-dark">
                          {order.title ?? "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark whitespace-nowrap">
                        {formatDate(order.date_emission)}
                      </td>
                      <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark whitespace-nowrap">
                        {totalAmount(order)}
                      </td>
                      <td className="px-6 py-4">
                        {order.status ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-tight bg-primary/10 text-textSecondary dark:bg-white/10 dark:text-white/60 border border-primary/20">
                            {t(`orders.status.${order.status}`, order.status)}
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

export default OrdersPage;
