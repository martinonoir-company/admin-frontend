"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Edit2, Trash2, Loader2, Tag, RefreshCw } from "lucide-react";
import { categoriesApi, Category, CreateCategoryDto } from "@/lib/api";
import { BoolBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { SkeletonTable } from "@/components/Skeleton";
import { useToast } from "@/lib/toast-context";
import { format } from "date-fns";

function CategoryForm({
  initial,
  onSubmit,
  loading,
  onCancel,
  categories,
}: {
  initial?: Partial<CreateCategoryDto & { id: string }>;
  onSubmit: (dto: CreateCategoryDto) => Promise<void>;
  loading: boolean;
  onCancel: () => void;
  categories: Category[];
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder?.toString() ?? "0");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [parentId, setParentId] = useState(initial?.parentId ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (isNaN(Number(sortOrder))) errs.sortOrder = "Must be a number";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      sortOrder: Number(sortOrder),
      isActive,
      parentId: parentId || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="admin-label">Name *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="admin-input" placeholder="e.g. Bags" />
        {errors.name && <p className="text-xs text-danger mt-1">{errors.name}</p>}
      </div>
      <div>
        <label className="admin-label">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="admin-input resize-none" rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="admin-label">Sort Order</label>
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="admin-input" />
          {errors.sortOrder && <p className="text-xs text-danger mt-1">{errors.sortOrder}</p>}
        </div>
        <div>
          <label className="admin-label">Parent Category</label>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="admin-select">
            <option value="">None (top-level)</option>
            {categories.filter((c) => c.id !== initial?.id).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded accent-primary-600" />
        <span className="text-sm text-ink-300">Active</span>
      </label>
      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary px-4">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary px-5">
          {loading ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save"}
        </button>
      </div>
    </form>
  );
}

export default function CategoriesPage() {
  const { success, error } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await categoriesApi.list();
      setCategories(res.data);
    } catch (err) {
      error("Failed to load categories", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditTarget(null); setModalOpen(true); }
  function openEdit(cat: Category) { setEditTarget(cat); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditTarget(null); }

  async function handleSave(dto: CreateCategoryDto) {
    setSaving(true);
    try {
      if (editTarget) {
        await categoriesApi.update(editTarget.id, dto);
        success("Category updated");
      } else {
        await categoriesApi.create(dto);
        success("Category created");
      }
      closeModal();
      load();
    } catch (err) {
      error("Failed to save category", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Deactivate "${cat.name}"?`)) return;
    setDeletingId(cat.id);
    try {
      await categoriesApi.delete(cat.id);
      success("Category deactivated");
      load();
    } catch (err) {
      error("Failed to delete category", err instanceof Error ? err.message : undefined);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Categories</h1>
          <p className="text-sm text-ink-500 mt-0.5">{categories.length} categories</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost" title="Refresh"><RefreshCw size={15} /></button>
          <button onClick={openCreate} className="btn-primary"><Plus size={15} /> New Category</button>
        </div>
      </div>

      {/* Table */}
      <div className="admin-card overflow-hidden">
        {loading ? (
          <div className="p-4"><SkeletonTable rows={5} cols={5} /></div>
        ) : categories.length === 0 ? (
          <div className="py-20 text-center">
            <Tag size={36} className="text-ink-700 mx-auto mb-3" />
            <p className="text-ink-500 text-sm">No categories yet</p>
            <button onClick={openCreate} className="btn-primary mt-4">Create first category</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Parent</th>
                  <th>Sort Order</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((cat) => (
                  <tr key={cat.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-md bg-ink-700 flex items-center justify-center shrink-0">
                          <Tag size={13} className="text-ink-500" />
                        </div>
                        <span className="font-medium text-ink-200">{cat.name}</span>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-ink-500">{cat.slug}</td>
                    <td className="text-xs text-ink-400">{cat.parent?.name ?? <span className="text-ink-600">—</span>}</td>
                    <td className="text-xs text-ink-400 font-mono">{cat.sortOrder}</td>
                    <td><BoolBadge value={cat.isActive} /></td>
                    <td className="text-xs text-ink-500 whitespace-nowrap">
                      {format(new Date(cat.createdAt), "d MMM yyyy")}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(cat)} className="btn-ghost p-1.5" title="Edit">
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(cat)}
                          disabled={deletingId === cat.id}
                          className="btn-ghost p-1.5 text-ink-500 hover:text-danger"
                          title="Delete"
                        >
                          {deletingId === cat.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editTarget ? `Edit: ${editTarget.name}` : "New Category"}
      >
        <CategoryForm
          initial={editTarget ? { ...editTarget, parentId: editTarget.parentId ?? undefined } : undefined}
          onSubmit={handleSave}
          loading={saving}
          onCancel={closeModal}
          categories={categories}
        />
      </Modal>
    </div>
  );
}
