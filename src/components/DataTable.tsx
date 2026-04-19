"use client";

import React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  RowData,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { SkeletonTable } from "./Skeleton";

interface DataTableProps<TData extends RowData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  loading?: boolean;
  // Server-side pagination
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  // Client-side sort
  sorting?: SortingState;
  onSortingChange?: (s: SortingState) => void;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  // Row selection (opt-in)
  getRowId?: (row: TData) => string;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
}

export function DataTable<TData extends RowData>({
  data,
  columns,
  loading,
  total = 0,
  page = 1,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  sorting = [],
  onSortingChange,
  emptyMessage = "No data found",
  onRowClick,
  getRowId,
  selectedIds,
  onSelectedIdsChange,
}: DataTableProps<TData>) {
  const selectionEnabled = !!(getRowId && onSelectedIdsChange);
  const selectedSet = React.useMemo(() => new Set(selectedIds ?? []), [selectedIds]);

  const toggleOne = React.useCallback(
    (id: string) => {
      if (!onSelectedIdsChange) return;
      const next = new Set(selectedIds ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectedIdsChange(Array.from(next));
    },
    [selectedIds, onSelectedIdsChange],
  );

  const pageIds = React.useMemo(
    () => (getRowId ? data.map(getRowId) : []),
    [data, getRowId],
  );
  const allOnPageSelected =
    selectionEnabled && pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));
  const someOnPageSelected =
    selectionEnabled && !allOnPageSelected && pageIds.some((id) => selectedSet.has(id));

  const toggleAllOnPage = () => {
    if (!onSelectedIdsChange) return;
    const next = new Set(selectedIds ?? []);
    if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    onSelectedIdsChange(Array.from(next));
  };

  const displayColumns: ColumnDef<TData, unknown>[] = selectionEnabled
    ? [
        {
          id: "__select__",
          header: () => (
            <input
              type="checkbox"
              aria-label="Select all on page"
              ref={(el) => {
                if (el) el.indeterminate = someOnPageSelected;
              }}
              checked={allOnPageSelected}
              onChange={toggleAllOnPage}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded border-ink-600 bg-ink-800 text-primary-600 focus:ring-1 focus:ring-primary-500 focus:ring-offset-0 cursor-pointer"
            />
          ),
          cell: ({ row }) => {
            const id = getRowId!(row.original);
            return (
              <input
                type="checkbox"
                aria-label="Select row"
                checked={selectedSet.has(id)}
                onChange={() => toggleOne(id)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded border-ink-600 bg-ink-800 text-primary-600 focus:ring-1 focus:ring-primary-500 focus:ring-offset-0 cursor-pointer"
              />
            );
          },
          enableSorting: false,
        },
        ...columns,
      ]
    : columns;

  const table = useReactTable({
    data,
    columns: displayColumns,
    state: { sorting },
    onSortingChange: onSortingChange
      ? (updater) => {
          const next = typeof updater === "function" ? updater(sorting) : updater;
          onSortingChange(next);
        }
      : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: !!onSortingChange,
    pageCount: Math.ceil(total / pageSize),
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (loading) return <SkeletonTable rows={pageSize > 10 ? 8 : pageSize} cols={columns.length} />;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={canSort ? "cursor-pointer hover:text-ink-200 hover:bg-ink-700 transition-colors" : ""}
                    >
                      <div className="flex items-center gap-1.5">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="text-ink-600">
                            {sorted === "asc"  ? <ChevronUp size={12} className="text-primary-400" /> :
                             sorted === "desc" ? <ChevronDown size={12} className="text-primary-400" /> :
                                                <ChevronsUpDown size={12} />}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={displayColumns.length} className="text-center py-16 text-ink-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={onRowClick ? "cursor-pointer" : ""}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-ink-700">
          <div className="flex items-center gap-3 text-xs text-ink-400">
            <span>
              {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
            </span>
            {onPageSizeChange && (
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="bg-ink-700 border border-ink-600 rounded px-1.5 py-1 text-ink-200 text-xs focus:outline-none"
              >
                {[10, 20, 50, 100].map((s) => (
                  <option key={s} value={s}>{s} per page</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="w-7 h-7 flex items-center justify-center rounded text-ink-400 hover:text-ink-100 hover:bg-ink-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              let p: number;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return (
                <button
                  key={p}
                  onClick={() => onPageChange?.(p)}
                  className={`w-7 h-7 flex items-center justify-center rounded text-xs font-medium transition-colors ${
                    p === page
                      ? "bg-primary-700 text-white"
                      : "text-ink-400 hover:text-ink-100 hover:bg-ink-700"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="w-7 h-7 flex items-center justify-center rounded text-ink-400 hover:text-ink-100 hover:bg-ink-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
