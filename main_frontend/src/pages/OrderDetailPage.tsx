import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { OrderItem } from "../features/orders/useOrders";

interface LocationState {
  order?: OrderItem;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const OrderDetailPage = () => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { state } = useLocation() as { state: LocationState | null };
  const order = state?.order;

  if (!order) {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center gap-4">
        <p className="text-textSecondary dark:text-textSecondary-dark text-sm">
          {t("orders.detail.notFound")}
        </p>
        <button
          type="button"
          onClick={() => navigate("/orders")}
          className="text-secondary text-sm hover:underline"
        >
          ← {t("orders.detail.back")}
        </button>
      </div>
    );
  }

  // Compute totals
  const singleTotal = (order.articles ?? []).reduce(
    (sum, a) => sum + (a.prix_vente ?? 0) * (a.quantity ?? 1),
    0,
  );
  const monthlyTotal = (order.amount ?? []).reduce(
    (sum, a) => sum + (a.monthlyPrice ?? 0),
    0,
  );
  const annualTotal = (order.amount ?? []).reduce(
    (sum, a) => sum + (a.annualPrice ?? 0),
    0,
  );

  // Translate status code to human-readable label
  const statusLabel = order.status
    ? t(`orders.status.${order.status}`, order.status)
    : "—";

  const labelClass = "text-xs font-medium text-secondary dark:text-secondary";
  const valueClass = "text-sm font-bold text-textPrimary dark:text-textPrimary-dark";

  return (
    <div className="flex-1 bg-background dark:bg-background-dark min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">

        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate("/orders")}
          className="text-sm text-textSecondary dark:text-textSecondary-dark hover:text-secondary transition-colors"
        >
          ← {t("orders.detail.back")}
        </button>

        {/* ── Order details ──────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-textPrimary dark:text-textPrimary-dark">
            {t("orders.detail.title")}
          </h2>

          <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-3">
              {/* Left column */}
              <div className="space-y-3">
                <div>
                  <span className={labelClass}>{t("orders.detail.id")}</span>
                  <p className={valueClass}>{order.id}</p>
                </div>
                <div>
                  <span className={labelClass}>{t("orders.detail.orderTitle")}</span>
                  <p className={valueClass}>{order.title ?? "—"}</p>
                </div>
                <div>
                  <span className={labelClass}>{t("orders.detail.issueDate")}</span>
                  <p className={`text-sm ${order.date_emission ? "text-textPrimary dark:text-textPrimary-dark font-bold" : "text-textSecondary dark:text-textSecondary-dark"}`}>
                    {formatDate(order.date_emission)}
                  </p>
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-3">
                <div>
                  <span className={labelClass}>{t("orders.detail.number")}</span>
                  <p className={valueClass}>{order.command_num ?? "—"}</p>
                </div>
                <div>
                  <span className={labelClass}>{t("orders.detail.status")}</span>
                  <p className={valueClass}>{statusLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Financial summary ──────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-textPrimary dark:text-textPrimary-dark">
            {t("orders.detail.financialSummary")}
          </h2>

          <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded shadow-sm p-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className={labelClass}>{t("orders.detail.singleTotal")}</span>
                <p className={valueClass}>{formatCurrency(singleTotal)}</p>
              </div>
              <div>
                <span className={labelClass}>{t("orders.detail.monthlyTotal")}</span>
                <p className={valueClass}>{formatCurrency(monthlyTotal)}</p>
              </div>
              <div>
                <span className={labelClass}>{t("orders.detail.annualTotal")}</span>
                <p className={valueClass}>{formatCurrency(annualTotal)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Articles list ──────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-textPrimary dark:text-textPrimary-dark">
            {t("orders.detail.articlesList")}
          </h2>

          <div className="bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded shadow-sm overflow-hidden">
            {(!order.articles || order.articles.length === 0) ? (
              <div className="py-12 text-center text-textSecondary dark:text-textSecondary-dark text-sm">
                —
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border dark:border-border-dark">
                      <th className="px-6 py-4 text-xs font-bold text-textPrimary dark:text-textPrimary-dark">
                        {t("orders.detail.articleId")}
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-textPrimary dark:text-textPrimary-dark">
                        {t("orders.detail.articleCode")}
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-textPrimary dark:text-textPrimary-dark">
                        {t("orders.detail.articlePricingTerms")}
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-textPrimary dark:text-textPrimary-dark">
                        {t("orders.detail.articleQty")}
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-textPrimary dark:text-textPrimary-dark">
                        {t("orders.detail.articlePrice")}
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-textPrimary dark:text-textPrimary-dark">
                        {t("orders.detail.articleDescription")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 dark:divide-border-dark/20">
                    {order.articles.map((article) => (
                      <tr
                        key={article.article_id}
                        className="hover:bg-backgroundSecondary/30 dark:hover:bg-backgroundSecondary-dark/30 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark">
                          {article.article_id}
                        </td>
                        <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark">
                          {article.code_article || "—"}
                        </td>
                        <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark">
                          {article.mode_tarif || "—"}
                        </td>
                        <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark">
                          {article.quantity}
                        </td>
                        <td className="px-6 py-4 text-sm text-textSecondary dark:text-textSecondary-dark whitespace-nowrap">
                          {article.hide_price
                            ? "—"
                            : formatCurrency(article.prix_vente)}
                        </td>
                        <td className="px-6 py-4 text-sm text-textPrimary dark:text-textPrimary-dark">
                          {article.description_courte || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
};

export default OrderDetailPage;
