"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, X } from "lucide-react";
import { categoriesApi, Category, CreateProductDto } from "@/lib/api";

interface VariantForm {
  id?: string;
  sku: string;
  name: string;
  retailPriceNgn: string;
  retailPriceUsd: string;
  wholesalePriceNgn: string;
  wholesalePriceUsd: string;
  compareAtPriceNgn: string;
  compareAtPriceUsd: string;
  costPriceNgn: string;
  weightKg: string;
  isActive: boolean;
  trackInventory: boolean;
  barcode: string;
  options: { key: string; value: string }[];
}

const emptyVariant = (): VariantForm => ({
  sku: "",
  name: "",
  retailPriceNgn: "",
  retailPriceUsd: "",
  wholesalePriceNgn: "",
  wholesalePriceUsd: "",
  compareAtPriceNgn: "",
  compareAtPriceUsd: "",
  costPriceNgn: "",
  weightKg: "",
  isActive: true,
  trackInventory: true,
  barcode: "",
  options: [],
});

export interface ProductFormValues {
  name: string;
  description: string;
  shortDescription: string;
  categoryId: string;
  isActive: boolean;
  isFeatured: boolean;
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  variants: VariantForm[];
}

interface ProductFormProps {
  initialValues?: Partial<ProductFormValues>;
  onSubmit: (values: CreateProductDto) => Promise<void>;
  submitLabel?: string;
  loading?: boolean;
}

export function ProductForm({ initialValues, onSubmit, submitLabel = "Save Product", loading }: ProductFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [values, setValues] = useState<ProductFormValues>({
    name: initialValues?.name ?? "",
    description: initialValues?.description ?? "",
    shortDescription: initialValues?.shortDescription ?? "",
    categoryId: initialValues?.categoryId ?? "",
    isActive: initialValues?.isActive ?? true,
    isFeatured: initialValues?.isFeatured ?? false,
    metaTitle: initialValues?.metaTitle ?? "",
    metaDescription: initialValues?.metaDescription ?? "",
    tags: initialValues?.tags ?? [],
    variants: initialValues?.variants ?? [emptyVariant()],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    categoriesApi.list().then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  function set<K extends keyof ProductFormValues>(key: K, val: ProductFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  }

  function setVariant(index: number, key: keyof VariantForm, val: unknown) {
    setValues((v) => {
      const variants = [...v.variants];
      variants[index] = { ...variants[index], [key]: val };
      return { ...v, variants };
    });
  }

  function addVariant() {
    setValues((v) => ({ ...v, variants: [...v.variants, emptyVariant()] }));
  }

  function removeVariant(i: number) {
    setValues((v) => ({ ...v, variants: v.variants.filter((_, idx) => idx !== i) }));
  }

  function addOption(vi: number) {
    setVariant(vi, "options", [...values.variants[vi].options, { key: "", value: "" }]);
  }

  function setOption(vi: number, oi: number, field: "key" | "value", val: string) {
    const opts = [...values.variants[vi].options];
    opts[oi] = { ...opts[oi], [field]: val };
    setVariant(vi, "options", opts);
  }

  function removeOption(vi: number, oi: number) {
    setVariant(vi, "options", values.variants[vi].options.filter((_, idx) => idx !== oi));
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !values.tags.includes(t)) set("tags", [...values.tags, t]);
    setTagInput("");
  }

  function removeTag(t: string) {
    set("tags", values.tags.filter((x) => x !== t));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = "Product name is required";
    if (!values.description.trim()) e.description = "Description is required";
    if (!values.shortDescription.trim()) e.shortDescription = "Short description is required";
    if (values.variants.length === 0) e.variants = "At least one variant is required";
    values.variants.forEach((v, i) => {
      if (!v.sku.trim()) e[`variant_${i}_sku`] = "SKU required";
      if (!v.name.trim()) e[`variant_${i}_name`] = "Variant name required";
      if (!v.retailPriceNgn || isNaN(Number(v.retailPriceNgn)) || Number(v.retailPriceNgn) <= 0)
        e[`variant_${i}_retailPriceNgn`] = "Valid retail NGN price required";
      if (!v.retailPriceUsd || isNaN(Number(v.retailPriceUsd)) || Number(v.retailPriceUsd) <= 0)
        e[`variant_${i}_retailPriceUsd`] = "Valid retail USD price required";
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const dto: CreateProductDto = {
      name: values.name.trim(),
      description: values.description.trim(),
      shortDescription: values.shortDescription.trim(),
      categoryId: values.categoryId || undefined,
      isActive: values.isActive,
      isFeatured: values.isFeatured,
      metaTitle: values.metaTitle || undefined,
      metaDescription: values.metaDescription || undefined,
      tags: values.tags,
      variants: values.variants.map((v) => ({
        sku: v.sku.trim(),
        name: v.name.trim(),
        retailPriceNgn: Math.round(Number(v.retailPriceNgn) * 100),
        retailPriceUsd: Math.round(Number(v.retailPriceUsd) * 100),
        wholesalePriceNgn: v.wholesalePriceNgn ? Math.round(Number(v.wholesalePriceNgn) * 100) : undefined,
        wholesalePriceUsd: v.wholesalePriceUsd ? Math.round(Number(v.wholesalePriceUsd) * 100) : undefined,
        compareAtPriceNgn: v.compareAtPriceNgn ? Math.round(Number(v.compareAtPriceNgn) * 100) : undefined,
        compareAtPriceUsd: v.compareAtPriceUsd ? Math.round(Number(v.compareAtPriceUsd) * 100) : undefined,
        costPriceNgn: v.costPriceNgn ? Math.round(Number(v.costPriceNgn) * 100) : undefined,
        weightKg: v.weightKg ? Number(v.weightKg) : undefined,
        isActive: v.isActive,
        trackInventory: v.trackInventory,
        barcode: v.barcode || undefined,
        options: v.options.length
          ? Object.fromEntries(v.options.filter((o) => o.key).map((o) => [o.key, o.value]))
          : undefined,
      })),
    };
    await onSubmit(dto);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Basic info */}
      <div className="admin-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-ink-200 pb-2 border-b border-ink-700">Product Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="admin-label">Product Name *</label>
            <input
              type="text"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              className="admin-input"
              placeholder="e.g. Heritage Leather Tote"
            />
            {errors.name && <p className="text-xs text-danger mt-1">{errors.name}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="admin-label">Short Description *</label>
            <input
              type="text"
              value={values.shortDescription}
              onChange={(e) => set("shortDescription", e.target.value)}
              className="admin-input"
              placeholder="One-line product summary"
            />
            {errors.shortDescription && <p className="text-xs text-danger mt-1">{errors.shortDescription}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="admin-label">Description *</label>
            <textarea
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              className="admin-input resize-none"
              rows={5}
              placeholder="Full product description…"
            />
            {errors.description && <p className="text-xs text-danger mt-1">{errors.description}</p>}
          </div>

          <div>
            <label className="admin-label">Category</label>
            <select
              value={values.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              className="admin-select"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-6 pt-5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={values.isActive}
                onChange={(e) => set("isActive", e.target.checked)}
                className="w-4 h-4 rounded accent-primary-600"
              />
              <span className="text-sm text-ink-300">Active</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={values.isFeatured}
                onChange={(e) => set("isFeatured", e.target.checked)}
                className="w-4 h-4 rounded accent-primary-600"
              />
              <span className="text-sm text-ink-300">Featured</span>
            </label>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="admin-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-ink-200 pb-2 border-b border-ink-700">Tags</h3>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            className="admin-input flex-1"
            placeholder="Add tag and press Enter"
          />
          <button type="button" onClick={addTag} className="btn-secondary px-3 py-2">
            <Plus size={14} />
          </button>
        </div>
        {values.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {values.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-ink-700 border border-ink-600 rounded-full text-xs text-ink-300">
                {t}
                <button type="button" onClick={() => removeTag(t)} className="text-ink-500 hover:text-ink-200">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Variants */}
      <div className="admin-card p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-ink-700">
          <h3 className="text-sm font-semibold text-ink-200">Variants *</h3>
          <button type="button" onClick={addVariant} className="btn-secondary text-xs px-3 py-1.5">
            <Plus size={12} /> Add Variant
          </button>
        </div>
        {errors.variants && <p className="text-xs text-danger">{errors.variants}</p>}

        {values.variants.map((v, i) => (
          <div key={i} className="border border-ink-600 rounded-lg p-4 space-y-3 bg-ink-900/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Variant {i + 1}</p>
              {values.variants.length > 1 && (
                <button type="button" onClick={() => removeVariant(i)} className="btn-danger text-xs px-2 py-1">
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="admin-label">Variant Name *</label>
                <input type="text" value={v.name} onChange={(e) => setVariant(i, "name", e.target.value)}
                  className="admin-input" placeholder="e.g. Classic Black" />
                {errors[`variant_${i}_name`] && <p className="text-xs text-danger mt-1">{errors[`variant_${i}_name`]}</p>}
              </div>
              <div>
                <label className="admin-label">SKU *</label>
                <input type="text" value={v.sku} onChange={(e) => setVariant(i, "sku", e.target.value)}
                  className="admin-input font-mono" placeholder="MN-BAG-001" />
                {errors[`variant_${i}_sku`] && <p className="text-xs text-danger mt-1">{errors[`variant_${i}_sku`]}</p>}
              </div>
              <div>
                <label className="admin-label">Retail Price NGN (₦) *</label>
                <input type="number" min="0" step="0.01" value={v.retailPriceNgn}
                  onChange={(e) => setVariant(i, "retailPriceNgn", e.target.value)}
                  className="admin-input font-mono" placeholder="185000" />
                {errors[`variant_${i}_retailPriceNgn`] && <p className="text-xs text-danger mt-1">{errors[`variant_${i}_retailPriceNgn`]}</p>}
              </div>
              <div>
                <label className="admin-label">Retail Price USD ($) *</label>
                <input type="number" min="0" step="0.01" value={v.retailPriceUsd}
                  onChange={(e) => setVariant(i, "retailPriceUsd", e.target.value)}
                  className="admin-input font-mono" placeholder="120" />
                {errors[`variant_${i}_retailPriceUsd`] && <p className="text-xs text-danger mt-1">{errors[`variant_${i}_retailPriceUsd`]}</p>}
              </div>
              <div>
                <label className="admin-label">Wholesale NGN (₦)</label>
                <input type="number" min="0" step="0.01" value={v.wholesalePriceNgn}
                  onChange={(e) => setVariant(i, "wholesalePriceNgn", e.target.value)}
                  className="admin-input font-mono" placeholder="Defaults to retail" />
              </div>
              <div>
                <label className="admin-label">Wholesale USD ($)</label>
                <input type="number" min="0" step="0.01" value={v.wholesalePriceUsd}
                  onChange={(e) => setVariant(i, "wholesalePriceUsd", e.target.value)}
                  className="admin-input font-mono" placeholder="Defaults to retail" />
              </div>
              <div>
                <label className="admin-label">Compare-at NGN</label>
                <input type="number" min="0" step="0.01" value={v.compareAtPriceNgn}
                  onChange={(e) => setVariant(i, "compareAtPriceNgn", e.target.value)}
                  className="admin-input font-mono" placeholder="Optional" />
              </div>
              <div>
                <label className="admin-label">Cost Price NGN</label>
                <input type="number" min="0" step="0.01" value={v.costPriceNgn}
                  onChange={(e) => setVariant(i, "costPriceNgn", e.target.value)}
                  className="admin-input font-mono" placeholder="Optional" />
              </div>
              <div>
                <label className="admin-label">Weight (kg)</label>
                <input type="number" min="0" step="0.01" value={v.weightKg}
                  onChange={(e) => setVariant(i, "weightKg", e.target.value)}
                  className="admin-input" placeholder="0.8" />
              </div>
              <div>
                <label className="admin-label">Barcode</label>
                <input type="text" value={v.barcode}
                  onChange={(e) => setVariant(i, "barcode", e.target.value)}
                  className="admin-input font-mono" placeholder="Optional" />
              </div>
            </div>

            <div className="flex items-center gap-5 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={v.isActive}
                  onChange={(e) => setVariant(i, "isActive", e.target.checked)}
                  className="w-4 h-4 rounded accent-primary-600" />
                <span className="text-xs text-ink-300">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={v.trackInventory}
                  onChange={(e) => setVariant(i, "trackInventory", e.target.checked)}
                  className="w-4 h-4 rounded accent-primary-600" />
                <span className="text-xs text-ink-300">Track Inventory</span>
              </label>
            </div>

            {/* Options */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Options</p>
                <button type="button" onClick={() => addOption(i)} className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
                  + Add option
                </button>
              </div>
              {v.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2 mb-2">
                  <input type="text" value={opt.key}
                    onChange={(e) => setOption(i, oi, "key", e.target.value)}
                    className="admin-input flex-1" placeholder="e.g. Color" />
                  <input type="text" value={opt.value}
                    onChange={(e) => setOption(i, oi, "value", e.target.value)}
                    className="admin-input flex-1" placeholder="e.g. Black" />
                  <button type="button" onClick={() => removeOption(i, oi)} className="text-ink-500 hover:text-danger transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* SEO */}
      <div className="admin-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-ink-200 pb-2 border-b border-ink-700">SEO (optional)</h3>
        <div>
          <label className="admin-label">Meta Title</label>
          <input type="text" value={values.metaTitle} onChange={(e) => set("metaTitle", e.target.value)}
            className="admin-input" />
        </div>
        <div>
          <label className="admin-label">Meta Description</label>
          <textarea value={values.metaDescription} onChange={(e) => set("metaDescription", e.target.value)}
            className="admin-input resize-none" rows={2} />
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary px-6 py-2.5">
          {loading ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : submitLabel}
        </button>
      </div>
    </form>
  );
}
