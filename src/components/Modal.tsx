"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: React.ReactNode;
}

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

/** Height of the admin TopBar — the modal is centred in the space below it. */
const TOPBAR_HEIGHT = 64;

export function Modal({ open, onClose, title, children, size = "md", footer }: ModalProps) {
  // Portal target. Resolved on mount so SSR doesn't try to touch `document`.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    // Lock background scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // Rendered through a portal to <body>, so the modal escapes the dashboard
  // <main> (which has marginLeft + paddingTop) and any ancestor stacking
  // context. z-index sits above the TopBar (z-30) and Sidebar (z-40).
  return createPortal(
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop — covers the whole viewport, including behind the TopBar. */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Centring region. Top padding equals the TopBar height so the modal
          panel is never tucked behind the fixed header; the panel scrolls
          internally and is capped so it always fits the visible area. */}
      <div
        className="absolute inset-0 flex items-start justify-center overflow-y-auto p-4"
        style={{ paddingTop: TOPBAR_HEIGHT + 16 }}
      >
        <div
          className={`
            relative w-full ${SIZE_CLASSES[size]} bg-ink-800 border border-ink-600
            rounded-xl shadow-xl animate-scale-in flex flex-col my-auto
          `}
          style={{ maxHeight: `calc(100vh - ${TOPBAR_HEIGHT + 32}px)` }}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-ink-700 shrink-0">
            <h2 className="text-base font-semibold text-ink-100">{title}</h2>
            <button
              onClick={onClose}
              className="text-ink-500 hover:text-ink-200 transition-colors rounded-md p-1 hover:bg-ink-700"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ink-700 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
