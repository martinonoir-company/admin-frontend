"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { Plus, Edit2, Trash2, Loader2, Tag, RefreshCw, Upload, X } from "lucide-react";
import {
  categoriesApi,
  mediaApi,
  Category,
  CreateCategoryDto,
  MEDIA_ALLOWED_MIME,
  MEDIA_MAX_BYTES,
} from "@/lib/api";
import { BoolBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { SkeletonTable } from "@/components/Skeleton";
import { useToast } from "@/lib/toast-context";
import { format } from "date-fns";

/** What the form hands back: the DTO plus, if the user picked one, a File to upload. */
export interface CategoryFormResult {
  dto: CreateCategoryDto;
  /** A newly-picked file to upload after the category is saved. */
  imageFile: File | null;
  /** true when the user cleared an existing image. */
  imageCleared: boolean;
}

function CategoryForm({
  initial,
  onSubmit,
  loading,
  onCancel,
  categories,
}: {
  initial?: Partial<CreateCategoryDto & { id: string }>;
  onSubmit: (result: CategoryFormResult) => Promise<void>;
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

  // Image state: an existing URL (edit mode), a newly-picked file + its
  // object-URL preview, or nothing.
  const [existingImageUrl, setExistingImageUrl] = useState(initial?.imageUrl ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke the object URL when the preview changes or the form unmounts so
  // we don't leak blob: URLs.
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);
    if (!(MEDIA_ALLOWED_MIME as readonly string[]).includes(file.type)) {
      setImageError("Only JPG and PNG images are supported");
      return;
    }
    if (file.size > MEDIA_MAX_BYTES) {
      setImageError("Image must be 10 MB or smaller");
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl("");
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const shownImage = imagePreview ?? existingImageUrl;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (isNaN(Number(sortOrder))) errs.sortOrder = "Must be a number";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    await onSubmit({
      dto: {
        name: name.trim(),
        description: description.trim() || undefined,
        sortOrder: Number(sortOrder),
        isActive,
        parentId: parentId || undefined,
      },
      imageFile,
      // The user removed an existing image and didn't pick a replacement.
      imageCleared: !imageFile && !existingImageUrl && !!initial?.imageUrl,
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

      {/* Category image */}
      <div>
        <label className="admin-label">Category Image</label>
        {shownImage ? (
          <div className="relative w-full h-40 rounded-lg overflow-hidden border border-ink-700 bg-ink-800">
            <Image src={shownImage} alt="Category" fill className="object-cover" sizes="400px" unoptimized />
            <button
              type="button"
              onClick={clearImage}
              className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-ink-900/80 text-ink-200 hover:text-danger hover:bg-ink-900 transition-colors"
              title="Remove image"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-40 rounded-lg border border-dashed border-ink-600 bg-ink-800/50 flex flex-col items-center justify-center gap-2 text-ink-500 hover:text-ink-300 hover:border-ink-500 transition-colors"
          >
            <Upload size={22} />
            <span className="text-xs font-medium">Click to upload — JPG or PNG, max 10 MB</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          onChange={handlePickFile}
          className="hidden"
        />
        {shownImage && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 text-xs text-primary-400 hover:text-primary-300 font-medium"
          >
            Replace image
          </button>
        )}
        {imageError && <p className="text-xs text-danger mt-1">{imageError}</p>}
        <p className="text-[11px] text-ink-600 mt-1">
          Shown on the storefront landing page&apos;s &ldquo;Shop by Category&rdquo; section.
        </p>
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

  async function handleSave(result: CategoryFormResult) {
    setSaving(true);
    try {
      const { dto, imageFile, imageCleared } = result;

      // Step 1 — create or update the category so we have a category id.
      let category: Category;
      if (editTarget) {
        const patch: Partial<CreateCategoryDto> = { ...dto };
        if (imageCleared) patch.imageUrl = "";
        const res = await categoriesApi.update(editTarget.id, patch);
        category = res.data;
      } else {
        const res = await categoriesApi.create(dto);
        category = res.data;
      }

      // Step 2 — if the user picked a new file, upload it now that the
      // category id exists, then save the resulting URL onto the category.
      // The category itself is already persisted, so an upload failure
      // surfaces as a clear message rather than silently losing the row.
      if (imageFile) {
        try {
          const url = await mediaApi.uploadCategoryImage(imageFile, category.id);
          await categoriesApi.update(category.id, { imageUrl: url });
        } catch (uploadErr) {
          error(
            "Category saved, but the image upload failed",
            uploadErr instanceof Error ? uploadErr.message : undefined,
          );
          closeModal();
          load();
          return;
        }
      }

      success(editTarget ? "Category updated" : "Category created");
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
                        <div className="w-8 h-8 rounded-md bg-ink-700 flex items-center justify-center shrink-0 overflow-hidden relative">
                          {cat.imageUrl ? (
                            <Image
                              src={cat.imageUrl}
                              alt={cat.name}
                              fill
                              className="object-cover"
                              sizes="32px"
                              unoptimized
                            />
                          ) : (
                            <Tag size={13} className="text-ink-500" />
                          )}
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
