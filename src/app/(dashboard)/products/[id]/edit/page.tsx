"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { productsApi, CreateProductDto, Product } from "@/lib/api";
import { ProductForm, ProductFormValues } from "@/components/ProductForm";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/lib/toast-context";
import Link from "next/link";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { success, error } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await productsApi.get(id);
      setProduct(res.data);
    } catch (err) {
      error("Failed to load product", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [id, error]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(dto: CreateProductDto) {
    setSaving(true);
    try {
      await productsApi.update(id, dto);
      success("Product updated", "Changes have been saved.");
      router.push(`/products/${id}`);
    } catch (err) {
      error("Failed to update product", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton height={24} width={300} />
        <Skeleton height={14} width={180} />
        <div className="space-y-4 mt-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} height={120} />)}
        </div>
      </div>
    );
  }

  if (!product) return null;

  // Map product to form initial values
  const initialValues: ProductFormValues = {
    name: product.name,
    description: product.description,
    shortDescription: product.shortDescription,
    categoryId: product.categoryId ?? "",
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    metaTitle: product.metaTitle ?? "",
    metaDescription: product.metaDescription ?? "",
    tags: product.tags ?? [],
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      retailPriceNgn: (parseInt(v.retailPriceNgn, 10) / 100).toString(),
      retailPriceUsd: (parseInt(v.retailPriceUsd, 10) / 100).toString(),
      wholesalePriceNgn: v.wholesalePriceNgn ? (parseInt(v.wholesalePriceNgn, 10) / 100).toString() : "",
      wholesalePriceUsd: v.wholesalePriceUsd ? (parseInt(v.wholesalePriceUsd, 10) / 100).toString() : "",
      compareAtPriceNgn: v.compareAtPriceNgn ? (parseInt(v.compareAtPriceNgn, 10) / 100).toString() : "",
      compareAtPriceUsd: v.compareAtPriceUsd ? (parseInt(v.compareAtPriceUsd, 10) / 100).toString() : "",
      costPriceNgn: v.costPriceNgn ? (parseInt(v.costPriceNgn, 10) / 100).toString() : "",
      weightKg: v.weightKg?.toString() ?? "",
      isActive: v.isActive,
      trackInventory: v.trackInventory,
      barcode: v.barcode ?? "",
      options: v.options
        ? Object.entries(v.options).map(([key, value]) => ({ key, value }))
        : [],
    })),
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href={`/products/${id}`} className="btn-ghost p-2">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Edit Product</h1>
          <p className="text-sm text-ink-500 mt-0.5 truncate max-w-md">{product.name}</p>
        </div>
      </div>
      <ProductForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        loading={saving}
        submitLabel="Save Changes"
      />
    </div>
  );
}
