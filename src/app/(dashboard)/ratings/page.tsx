"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, RefreshCw, Search } from "lucide-react";
import { ratingsApi, OrderRatingView } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { SkeletonTable } from "@/components/Skeleton";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";

const PAGE_SIZE = 20;

/** Five stars, filled up to `value`. */
function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={
            n <= value
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-ink-600"
          }
        />
      ))}
    </span>
  );
}

function customerName(r: OrderRatingView): string {
  const first = r.user?.firstName?.trim() ?? "";
  const last = r.user?.lastName?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  return full || r.user?.email || "—";
}

export default function RatingsPage() {
  const { user } = useAuth();
  const { error } = useToast();
  const [items, setItems] = useState<OrderRatingView[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<OrderRatingView | null>(null);

  // Role gate — only super admins see ratings; the sidebar hides the link,
  // but a direct URL hit must also bounce.
  const isSuperAdmin =
    user?.role === "SUPER_ADMIN" || user?.role === "COMPANY_SUPER_ADMIN";

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const res = await ratingsApi.list({
          page: p,
          limit: PAGE_SIZE,
          search: search || undefined,
        });
        setItems(res.data.items);
        setTotal(res.data.total);
        setPages(res.data.pages);
        setPage(res.data.page);
      } catch (err) {
        error(
          "Could not load ratings",
          err instanceof Error ? err.message : "",
        );
      } finally {
        setLoading(false);
      }
    },
    [search, error],
  );

  useEffect(() => {
    if (!isSuperAdmin) return;
    void load(1);
  }, [load, isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-8 text-center">
          <h1 className="text-lg font-semibold text-white">
            Ratings — access denied
          </h1>
          <p className="text-ink-400 mt-2 text-sm">
            Only super admins can view order ratings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <Star size={20} className="text-amber-400" />
            Ratings
          </h1>
          <p className="text-ink-400 text-sm mt-1">
            {total} rating{total === 1 ? "" : "s"} — customer feedback left on
            completed orders.
          </p>
        </div>
        <button
          onClick={() => load(page)}
          className="rounded-lg bg-ink-800 hover:bg-ink-700 text-white text-sm px-3 py-2 inline-flex items-center gap-2"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
          />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSearch(searchInput.trim());
            }}
            placeholder="Order #, customer, comment…"
            className="w-72 pl-8 pr-3 py-2 bg-ink-900 border border-ink-700 rounded-lg text-sm text-white placeholder:text-ink-500"
          />
        </div>
        {search && (
          <button
            onClick={() => {
              setSearch("");
              setSearchInput("");
            }}
            className="text-xs text-ink-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-ink-700 bg-ink-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-800 text-ink-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Rating</th>
                <th className="text-left px-4 py-3">Comment</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Order</th>
                <th className="text-left px-4 py-3">Date &amp; time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-4">
                    <SkeletonTable rows={5} />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-10 text-ink-500 text-sm"
                  >
                    No ratings yet.
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setDetail(r)}
                    className="hover:bg-ink-800 cursor-pointer"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Stars value={r.stars} />
                    </td>
                    <td className="px-4 py-3 text-ink-300 max-w-xs truncate">
                      {r.comment?.trim() ? (
                        r.comment
                      ) : (
                        <span className="text-ink-600 italic">No comment</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white">
                      <div className="truncate max-w-[180px]">
                        {customerName(r)}
                      </div>
                      {r.user?.email && (
                        <div className="text-xs text-ink-500 truncate max-w-[180px]">
                          {r.user.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white font-mono text-xs">
                      {r.order?.orderNumber ?? r.orderId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-ink-300 whitespace-nowrap">
                      {format(new Date(r.createdAt), "yyyy-MM-dd HH:mm")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pager */}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-800 px-4 py-3 text-xs text-ink-400">
            <span>
              Page {page} of {pages} · {total} rating
              {total === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => load(page - 1)}
                className="px-3 py-1 rounded bg-ink-800 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= pages}
                onClick={() => load(page + 1)}
                className="px-3 py-1 rounded bg-ink-800 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={
          detail
            ? `Rating · ${detail.order?.orderNumber ?? detail.orderId.slice(0, 8)}`
            : ""
        }
        size="md"
      >
        {detail && (
          <div className="space-y-5 text-sm">
            <div>
              <p className="text-ink-500 text-xs uppercase tracking-wider mb-1">
                Rating
              </p>
              <div className="flex items-center gap-2">
                <Stars value={detail.stars} size={20} />
                <span className="text-white font-semibold">
                  {detail.stars} / 5
                </span>
              </div>
            </div>

            <div>
              <p className="text-ink-500 text-xs uppercase tracking-wider mb-1">
                Comment
              </p>
              <p className="text-ink-200 whitespace-pre-wrap">
                {detail.comment?.trim() || (
                  <span className="text-ink-600 italic">No comment</span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-ink-500 text-xs uppercase tracking-wider mb-1">
                  Customer
                </p>
                <p className="text-white">{customerName(detail)}</p>
                {detail.user?.email && (
                  <p className="text-ink-400 text-xs">{detail.user.email}</p>
                )}
              </div>
              <div>
                <p className="text-ink-500 text-xs uppercase tracking-wider mb-1">
                  Order
                </p>
                <p className="text-white font-mono text-xs">
                  {detail.order?.orderNumber ?? detail.orderId}
                </p>
                {detail.order?.status && (
                  <p className="text-ink-400 text-xs">
                    {detail.order.status} · {detail.order.channel}
                  </p>
                )}
              </div>
            </div>

            <div>
              <p className="text-ink-500 text-xs uppercase tracking-wider mb-1">
                Date &amp; time
              </p>
              <p className="text-ink-200">
                {format(new Date(detail.createdAt), "PPpp")}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
