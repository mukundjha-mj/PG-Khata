import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Client-side pagination helper for tables.
 * Keeps the page in range when the underlying row count changes (filters, refetch).
 */
export function usePagination<T>(rows: T[], pageSize = 10) {
  const [page, setPage] = React.useState(1);
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  React.useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const start = (Math.min(page, pageCount) - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return {
    page: Math.min(page, pageCount),
    pageCount,
    pageSize,
    total,
    pageRows,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
    setPage,
  };
}

type Props = {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
  className?: string;
};

export function DataPagination({
  page,
  pageCount,
  from,
  to,
  total,
  onPageChange,
  label = "rows",
  className,
}: Props) {
  if (total === 0) return null;

  return (
    <nav
      aria-label={`Pagination for ${label}`}
      className={cn(
        "mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Showing {from}-{to} of {total} {label}
      </p>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 sm:flex-none"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <span className="shrink-0 px-1 text-xs text-muted-foreground">
          Page {page} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 sm:flex-none"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
