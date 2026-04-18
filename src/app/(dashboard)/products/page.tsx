"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Filter, ShoppingBag, RefreshCw } from "lucide-react";
import { productsApi, categoriesApi, formatNgn, Product, Category } from "@/lib/api";
import { DataTable } from "@/components/DataTable";
import { StatusBadge, BoolBadge } from "@/components/StatusBadge";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { format } from "date-fns";
import Link from "next/link";
import { useToast } from "@/lib/toast-context";

export default function ProductsPage() {
  const router = useRouter();
  const { error: toastError } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const sortBy = sorting[0]?.id;
      const sortOrder = sorting[0]?.desc ? "DESC" : "ASC";
      const res = await productsApi.list({
        page,
        limit: pageSize,
        search: search || undefined,
        categoryId: categoryFilter || undefined,
        sortBy: sortBy || "createdAt",
        sortOrder: sortOrder || "DESC",
      });
      setProducts(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      toastError("Failed to load products", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, categoryFilter, sorting, toastError]);

  useEffect(() => {
    categoriesApi.list().then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  const columns: ColumnDef<Product, unknown>[] = [
    {
      id: "image",
      header: "",
      cell: () => (
        <div className="w-9 h-9 rounded-md bg-ink-700 flex items-center justify-center shrink-0">
          <ShoppingBag size={14} className="text-ink-500" />
        </div>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "name",
      header: "Product",
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-semibold text-ink-100 leading-tight">{row.original.name}</p>
          <p className="text-xs text-ink-500 mt-0.5 font-mono">{row.original.slug}</p>
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      cell: ({ row }) => (
        <span className="text-xs text-ink-400">{row.original.category?.name ?? "—"}</span>
      ),
      enableSorting: false,
    },
    {
      id: "retailPrice",
      header: "Retail (NGN)",
      cell: ({ row }) => {
        const v = row.original.variants?.[0];
        return v ? (
          <span className="font-mono text-sm text-ink-200">{formatNgn(v.retailPriceNgn)}</span>
        ) : <span className="text-ink-600">—</span>;
      },
      enableSorting: false,
    },
    {
      id: "wholesalePrice",
      header: "Wholesale (NGN)",
      cell: ({ row }) => {
        const v = row.original.variants?.[0];
        return v ? (
          <span className="font-mono text-sm text-ink-400">{formatNgn(v.wholesalePriceNgn)}</span>
        ) : <span className="text-ink-600">—</span>;
      },
      enableSorting: false,
    },
    {
      id: "variants",
      header: "Variants",
      cell: ({ row }) => (
        <span className="text-xs text-ink-400">{row.original.variants?.length ?? 0}</span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => <BoolBadge value={row.original.isActive} />,
    },
    {
      accessorKey: "isFeatured",
      header: "Featured",
      cell: ({ row }) => (
        row.original.isFeatured
          ? <StatusBadge status="featured" label="Featured" />
          : <span className="text-xs text-ink-600">—</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-xs text-ink-500 whitespace-nowrap">
          {format(new Date(row.original.createdAt), "d MMM yyyy")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Products</h1>
          <p className="text-sm text-ink-500 mt-0.5">{total.toLocaleString()} products in catalogue</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadProducts} className="btn-ghost" title="Refresh">
            <RefreshCw size={15} />
          </button>
          <Link href="/products/new" className="btn-primary">
            <Plus size={15} />
            Add Product
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-card p-4 flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
            <input
              type="search"
              placeholder="Search products…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="admin-input pl-9"
            />
          </div>
          <button type="submit" className="btn-secondary px-3 py-2">
            <Search size={14} />
          </button>
        </form>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-ink-500" />
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="admin-select w-44"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {(search || categoryFilter) && (
          <button
            onClick={() => { setSearch(""); setSearchInput(""); setCategoryFilter(""); setPage(1); }}
            className="btn-ghost text-xs"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="admin-card overflow-hidden">
        <DataTable
          data={products}
          columns={columns}
          loading={loading}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          sorting={sorting}
          onSortingChange={setSorting}
          onRowClick={(row) => router.push(`/products/${row.id}`)}
          emptyMessage="No products found. Try adjusting your filters."
        />
      </div>
    </div>
  );
}
