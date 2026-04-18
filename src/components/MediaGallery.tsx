"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Upload,
  X,
  ArrowLeft,
  ArrowRight,
  Star,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  mediaApi,
  ProductMedia,
  MEDIA_ALLOWED_MIME,
  MEDIA_MAX_BYTES,
} from "@/lib/api";
import { useToast } from "@/lib/toast-context";

interface Props {
  productId: string;
  initialMedia: ProductMedia[];
}

interface Uploading {
  id: string;
  filename: string;
  progress: number;
}

const ALLOWED_EXT = ".jpg,.jpeg,.png";

export function MediaGallery({ productId, initialMedia }: Props) {
  const { success, error } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<ProductMedia[]>(
    [...initialMedia].sort((a, b) => a.sortOrder - b.sortOrder),
  );
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    setMedia([...initialMedia].sort((a, b) => a.sortOrder - b.sortOrder));
  }, [initialMedia]);

  const uploadOne = useCallback(
    async (file: File) => {
      const tempId = `tmp-${Math.random().toString(36).slice(2)}`;
      if (!(MEDIA_ALLOWED_MIME as readonly string[]).includes(file.type)) {
        error("Unsupported file", `${file.name} must be JPG or PNG`);
        return;
      }
      if (file.size > MEDIA_MAX_BYTES) {
        error("File too large", `${file.name} exceeds 10 MB`);
        return;
      }

      setUploading((u) => [
        ...u,
        { id: tempId, filename: file.name, progress: 0 },
      ]);

      try {
        const added = await mediaApi.uploadFile(file, productId, {
          onProgress: (pct) => {
            setUploading((u) =>
              u.map((x) => (x.id === tempId ? { ...x, progress: pct } : x)),
            );
          },
        });
        setMedia((m) =>
          [...m, added].sort((a, b) => a.sortOrder - b.sortOrder),
        );
        success("Uploaded", file.name);
      } catch (err) {
        error(
          "Upload failed",
          err instanceof Error ? err.message : "Unknown error",
        );
      } finally {
        setUploading((u) => u.filter((x) => x.id !== tempId));
      }
    },
    [productId, success, error],
  );

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const f of Array.from(files)) {
      await uploadOne(f);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function persistOrder(next: ProductMedia[]) {
    setSavingOrder(true);
    try {
      await mediaApi.reorder(
        productId,
        next.map((m) => m.id),
      );
    } catch (err) {
      error(
        "Could not save order",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSavingOrder(false);
    }
  }

  function moveItem(id: string, direction: -1 | 1) {
    const idx = media.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const swapWith = idx + direction;
    if (swapWith < 0 || swapWith >= media.length) return;
    const next = [...media];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    setMedia(next);
    void persistOrder(next);
  }

  function makePrimary(id: string) {
    const idx = media.findIndex((m) => m.id === id);
    if (idx <= 0) return;
    const next = [media[idx], ...media.filter((_, i) => i !== idx)];
    setMedia(next);
    void persistOrder(next);
  }

  async function removeItem(id: string) {
    if (!confirm("Remove this image from the gallery? This cannot be undone."))
      return;
    try {
      await mediaApi.delete(id);
      setMedia((m) => m.filter((x) => x.id !== id));
      success("Image removed");
    } catch (err) {
      error("Delete failed", err instanceof Error ? err.message : undefined);
    }
  }

  // ── drag-and-drop reordering (HTML5, no extra deps) ──

  function onDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain") || draggingId;
    setDraggingId(null);
    if (!sourceId || sourceId === targetId) return;
    const sourceIdx = media.findIndex((m) => m.id === sourceId);
    const targetIdx = media.findIndex((m) => m.id === targetId);
    if (sourceIdx < 0 || targetIdx < 0) return;
    const next = [...media];
    const [moved] = next.splice(sourceIdx, 1);
    next.splice(targetIdx, 0, moved);
    setMedia(next);
    void persistOrder(next);
  }

  return (
    <div className="admin-card p-5 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-ink-700">
        <div>
          <h3 className="text-sm font-semibold text-ink-200">Media Gallery</h3>
          <p className="text-[11px] text-ink-500 mt-0.5">
            JPG or PNG, up to 10 MB per image. Drag to reorder — the first
            image is the primary.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="btn-secondary text-xs px-3 py-1.5"
          disabled={uploading.length > 0}
        >
          <Upload size={12} />
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXT}
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Grid */}
      {media.length === 0 && uploading.length === 0 ? (
        <div className="border border-dashed border-ink-600 rounded-lg py-10 text-center">
          <AlertCircle className="mx-auto text-ink-500 mb-2" size={24} />
          <p className="text-sm text-ink-400">No images yet.</p>
          <p className="text-xs text-ink-500 mt-1">
            Click Upload to add JPG or PNG files (max 10 MB each).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {media.map((m, idx) => (
            <div
              key={m.id}
              draggable
              onDragStart={(e) => onDragStart(e, m.id)}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, m.id)}
              className={`relative group border-2 rounded-lg overflow-hidden bg-ink-900/40 aspect-square transition-all ${
                idx === 0 ? "border-primary-600" : "border-ink-700"
              } ${draggingId === m.id ? "opacity-40" : ""}`}
            >
              <Image
                src={m.url}
                alt={m.altText ?? `Image ${idx + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, 200px"
                unoptimized
              />

              {idx === 0 && (
                <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary-700 text-white text-[10px] font-semibold">
                  <Star size={10} /> Primary
                </span>
              )}

              {/* Hover controls */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                <div className="flex items-center gap-1.5">
                  <IconBtn
                    title="Move left"
                    onClick={() => moveItem(m.id, -1)}
                    disabled={idx === 0}
                  >
                    <ArrowLeft size={12} />
                  </IconBtn>
                  <IconBtn
                    title="Move right"
                    onClick={() => moveItem(m.id, 1)}
                    disabled={idx === media.length - 1}
                  >
                    <ArrowRight size={12} />
                  </IconBtn>
                  {idx !== 0 && (
                    <IconBtn
                      title="Make primary"
                      onClick={() => makePrimary(m.id)}
                    >
                      <Star size={12} />
                    </IconBtn>
                  )}
                  <IconBtn
                    title="Remove"
                    onClick={() => removeItem(m.id)}
                    danger
                  >
                    <X size={12} />
                  </IconBtn>
                </div>
                <p className="text-[10px] text-white/70 px-2 text-center truncate w-full">
                  {m.altText ?? `#${idx + 1}`}
                </p>
              </div>
            </div>
          ))}

          {/* Uploading placeholders */}
          {uploading.map((u) => (
            <div
              key={u.id}
              className="border border-ink-700 rounded-lg aspect-square flex flex-col items-center justify-center gap-2 bg-ink-900/40"
            >
              <Loader2 className="animate-spin text-primary-500" size={20} />
              <p className="text-[11px] text-ink-400 px-2 truncate max-w-full">
                {u.filename}
              </p>
              <div className="w-3/4 h-1 rounded-full bg-ink-700 overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all"
                  style={{ width: `${u.progress}%` }}
                />
              </div>
              <p className="text-[10px] text-ink-500">{u.progress}%</p>
            </div>
          ))}
        </div>
      )}

      {savingOrder && (
        <p className="text-[11px] text-ink-500 flex items-center gap-1.5">
          <Loader2 size={11} className="animate-spin" /> Saving order…
        </p>
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
        danger
          ? "bg-red-600 hover:bg-red-500 text-white"
          : "bg-ink-800 hover:bg-ink-700 text-ink-100"
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}
