"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { productsApi, CreateProductDto } from "@/lib/api";
import { ProductForm } from "@/components/ProductForm";
import { useToast } from "@/lib/toast-context";
import Link from "next/link";

export default function NewProductPage() {
  const router = useRouter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(dto: CreateProductDto) {
    setLoading(true);
    try {
      const res = await productsApi.create(dto);
      success("Product created", `"${res.data.name}" has been added to the catalogue.`);
      router.push(`/products/${res.data.id}`);
    } catch (err) {
      error("Failed to create product", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/products" className="btn-ghost p-2">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-ink-100">New Product</h1>
          <p className="text-sm text-ink-500 mt-0.5">Add a new product to the Martinonoir catalogue</p>
        </div>
      </div>
      <ProductForm onSubmit={handleSubmit} loading={loading} submitLabel="Create Product" />
    </div>
  );
}
