"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  /** Render cell content. */
  cell: (row: T) => React.ReactNode;
  /** Opt-in column sort; uses sortValue when provided, else stringified cell is not used. */
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null | undefined;
  className?: string;
  headerClassName?: string;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Toolbar title (left). */
  title?: string;
  /** Controlled search (preferred when parent already filters). */
  search?: string;
  onSearchChange?: (value: string) => void;
  /** Uncontrolled search filter when `search` / `onSearchChange` omitted. */
  searchFilter?: (row: T, term: string) => boolean;
  searchPlaceholder?: string;
  /** Extra controls between search and title (e.g. GlassSelect filters). */
  filterSlot?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  /** Highlight a row (e.g. deep-link planId). */
  selectedRowKey?: string | null;
  /** Dedicated trailing actions column. */
  actions?: (row: T) => React.ReactNode;
  actionsHeader?: string;
  className?: string;
};

type SortState = { id: string; dir: "asc" | "desc" } | null;

function compareSort(
  a: string | number | null | undefined,
  b: string | number | null | undefined
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function DataTableSkeleton({
  columns,
  rows,
  hasActions,
}: {
  columns: number;
  rows: number;
  hasActions: boolean;
}) {
  const cols = columns + (hasActions ? 1 : 0);
  return (
    <div className="animate-pulse overflow-hidden rounded border border-neutral-400/30 bg-white">
      <div className="border-b border-neutral-400/20 bg-neutral-100 px-3 py-3">
        <div className="h-8 max-w-xs rounded bg-neutral-200/80" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-body">
          <thead className="bg-neutral-100">
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-3 py-2">
                  <div className="h-3 w-16 rounded bg-neutral-200/80" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r} className="border-t border-neutral-400/15">
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c} className="px-3 py-2.5">
                    <div className="h-4 w-full max-w-[8rem] rounded bg-neutral-100" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Enterprise DataTable — presentation only.
 * Search, filter slot, sort, sticky header, hover, pagination,
 * loading skeleton, empty state, horizontal scroll, actions column.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  title,
  search: searchControlled,
  onSearchChange,
  searchFilter,
  searchPlaceholder = "Search…",
  filterSlot,
  toolbarEnd,
  loading = false,
  emptyTitle = "No results found",
  emptyDescription,
  pageSize = 10,
  selectedRowKey = null,
  actions,
  actionsHeader = "Actions",
  className,
}: DataTableProps<T>) {
  const [searchLocal, setSearchLocal] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);

  const searchEnabled =
    searchControlled !== undefined ||
    onSearchChange !== undefined ||
    searchFilter !== undefined;

  const searchTerm =
    searchControlled !== undefined ? searchControlled : searchLocal;

  function setSearch(value: string) {
    setPage(0);
    if (onSearchChange) onSearchChange(value);
    else setSearchLocal(value);
  }

  const controlledSearch =
    searchControlled !== undefined || onSearchChange !== undefined;

  const displayRows = useMemo(() => {
    let list = rows;
    const term = searchTerm.trim().toLowerCase();
    // Uncontrolled: DataTable applies searchFilter. Controlled: parent already filtered.
    if (!controlledSearch && term && searchFilter) {
      list = list.filter((row) => searchFilter(row, term));
    }
    if (sort) {
      const col = columns.find((c) => c.id === sort.id);
      if (col?.sortable && col.sortValue) {
        const dir = sort.dir === "asc" ? 1 : -1;
        list = [...list].sort(
          (a, b) => dir * compareSort(col.sortValue!(a), col.sortValue!(b))
        );
      }
    }
    return list;
  }, [rows, searchTerm, searchFilter, controlledSearch, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(displayRows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = displayRows.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize
  );

  function toggleSort(col: DataTableColumn<T>) {
    if (!col.sortable || !col.sortValue) return;
    setPage(0);
    setSort((prev) => {
      if (!prev || prev.id !== col.id) return { id: col.id, dir: "asc" };
      if (prev.dir === "asc") return { id: col.id, dir: "desc" };
      return null;
    });
  }

  if (loading) {
    return (
      <DataTableSkeleton
        columns={columns.length}
        rows={Math.min(pageSize, 6)}
        hasActions={Boolean(actions)}
      />
    );
  }

  const showToolbar =
    title ||
    searchEnabled ||
    filterSlot ||
    toolbarEnd ||
    displayRows.length > 0;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded border border-neutral-400/30 bg-white",
        className
      )}
    >
      {showToolbar ? (
        <div className="flex flex-col gap-2 border-b border-neutral-400/20 bg-neutral-50/90 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {title ? (
              <p className="shrink-0 text-meta font-semibold uppercase tracking-wide text-neutral-700">
                {title}
                <span className="ml-1.5 font-normal normal-case text-neutral-500">
                  ({displayRows.length})
                </span>
              </p>
            ) : null}
            {filterSlot}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {searchEnabled ? (
              <label className="relative block w-full min-w-[12rem] max-w-xs sm:w-56">
                <span className="sr-only">{searchPlaceholder}</span>
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500"
                  aria-hidden
                />
                <input
                  className="glass-select w-full !pl-8"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            ) : null}
            {toolbarEnd}
          </div>
        </div>
      ) : null}

      {displayRows.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          fill
        />
      ) : (
        <>
          <div className="max-h-[min(70vh,40rem)] overflow-auto">
            <table className="w-full min-w-[40rem] text-left text-body">
              <thead className="sticky top-0 z-10 bg-neutral-100 text-meta uppercase text-neutral-700 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]">
                <tr>
                  {columns.map((col) => {
                    const active = sort?.id === col.id;
                    return (
                      <th
                        key={col.id}
                        className={cn(
                          "px-3 py-2 font-medium",
                          col.headerClassName,
                          col.sortable && col.sortValue
                            ? "cursor-pointer select-none hover:text-kengen-navy"
                            : null
                        )}
                        onClick={() => toggleSort(col)}
                        aria-sort={
                          active
                            ? sort.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : col.sortable
                              ? "none"
                              : undefined
                        }
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.header}
                          {col.sortable && col.sortValue ? (
                            active ? (
                              sort.dir === "asc" ? (
                                <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                              ) : (
                                <ChevronDown
                                  className="h-3.5 w-3.5"
                                  aria-hidden
                                />
                              )
                            ) : (
                              <ChevronsUpDown
                                className="h-3.5 w-3.5 opacity-40"
                                aria-hidden
                              />
                            )
                          ) : null}
                        </span>
                      </th>
                    );
                  })}
                  {actions ? (
                    <th className="px-3 py-2 font-medium">{actionsHeader}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const key = rowKey(row);
                  const selected = selectedRowKey != null && selectedRowKey === key;
                  return (
                    <tr
                      key={key}
                      className={cn(
                        "border-t border-neutral-400/20 transition-colors",
                        "hover:bg-kengen-blue/[0.04]",
                        selected
                          ? "bg-kengen-blue/10 ring-1 ring-inset ring-kengen-blue/25"
                          : null
                      )}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.id}
                          className={cn("px-3 py-2 align-middle", col.className)}
                        >
                          {col.cell(row)}
                        </td>
                      ))}
                      {actions ? (
                        <td className="px-3 py-2 align-middle">{actions(row)}</td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {displayRows.length > pageSize ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-400/20 bg-neutral-50/80 px-3 py-2">
              <p className="text-meta text-neutral-600">
                Showing {safePage * pageSize + 1}–
                {Math.min((safePage + 1) * pageSize, displayRows.length)} of{" "}
                {displayRows.length}
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  disabled={safePage <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <span className="px-2 text-meta tabular-nums text-neutral-700">
                  {safePage + 1} / {pageCount}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  disabled={safePage >= pageCount - 1}
                  onClick={() =>
                    setPage((p) => Math.min(pageCount - 1, p + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
