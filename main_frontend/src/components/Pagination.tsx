import { useTranslation } from "react-i18next";

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems?: number;
  hasNextPage?: boolean;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

const Pagination = ({
  page,
  pageSize,
  totalItems,
  hasNextPage,
  onPageChange,
  isLoading,
}: PaginationProps) => {
  const { t } = useTranslation("common");

  const totalPages = totalItems ? Math.ceil(totalItems / pageSize) : undefined;
  const hasNext = hasNextPage !== undefined ? hasNextPage : (totalPages ? page < totalPages : false);
  const hasPrev = page > 1;

  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = totalItems ? Math.min(page * pageSize, totalItems) : page * pageSize;

  return (
    <div className="flex items-center justify-between gap-4 mt-4">
      <div className="text-xs text-textSecondary dark:text-textSecondary-dark">
        {totalItems !== undefined && totalItems > 0 && (
          <span>
            {t("pagination.showing", {
              from,
              to,
              total: totalItems,
              defaultValue: `Showing ${from} to ${to} of ${totalItems}`,
            })}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="px-3 py-1.5 text-xs font-semibold rounded border border-border dark:border-border-dark text-textSecondary dark:text-textSecondary-dark hover:text-textPrimary dark:hover:text-textPrimary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev || isLoading}
        >
          {t("pagination.previous", "Previous")}
        </button>
        
        <span className="text-xs font-medium text-textSecondary dark:text-textSecondary-dark">
          {totalPages 
            ? t("pagination.pageOf", { page, totalPages, defaultValue: `Page ${page} of ${totalPages}` })
            : t("pagination.page", { page, defaultValue: `Page ${page}` })}
        </span>

        <button
          type="button"
          className="px-3 py-1.5 text-xs font-semibold rounded border border-border dark:border-border-dark text-textSecondary dark:text-textSecondary-dark hover:text-textPrimary dark:hover:text-textPrimary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || isLoading}
        >
          {t("pagination.next", "Next")}
        </button>
      </div>
    </div>
  );
};

export default Pagination;
