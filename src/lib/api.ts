const API_BASE = "http://localhost:3001/api/v1";

// ── Types ────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
  correlationId?: string;
}

// ── Product types ────────────────────────────────────────────

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  retailPriceNgn: string;
  retailPriceUsd: string;
  wholesalePriceNgn: string;
  wholesalePriceUsd: string;
  compareAtPriceNgn?: string;
  compareAtPriceUsd?: string;
  costPriceNgn?: string;
  weightKg?: number;
  isActive: boolean;
  trackInventory: boolean;
  options?: Record<string, string>;
  barcode?: string;
}

export interface ProductMedia {
  id: string;
  url: string;
  altText?: string;
  sortOrder: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  isActive: boolean;
  isFeatured: boolean;
  categoryId: string | null;
  category: { id: string; name: string; slug: string } | null;
  attributes: Record<string, unknown> | null;
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  variants: ProductVariant[];
  media: ProductMedia[];
  createdAt: string;
  updatedAt: string;
  /** Soft-delete timestamp. Present only when the product has been archived. */
  deletedAt?: string | null;
}

export interface CreateProductDto {
  name: string;
  description: string;
  shortDescription: string;
  categoryId?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  attributes?: Record<string, unknown>;
  metaTitle?: string;
  metaDescription?: string;
  tags?: string[];
  variants: Array<{
    sku: string;
    name: string;
    retailPriceNgn: number;
    retailPriceUsd: number;
    wholesalePriceNgn?: number;
    wholesalePriceUsd?: number;
    compareAtPriceNgn?: number;
    compareAtPriceUsd?: number;
    costPriceNgn?: number;
    weightKg?: number;
    isActive?: boolean;
    trackInventory?: boolean;
    options?: Record<string, string>;
    barcode?: string;
  }>;
}

export interface UpdateProductDto extends Partial<Omit<CreateProductDto, "variants">> {
  variants?: CreateProductDto["variants"];
}

// ── Category types ───────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  alias?: string;
  description?: string;
  imageUrl?: string;
  sortOrder: number;
  isActive: boolean;
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
  children?: Category[];
  metaTitle?: string;
  metaDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryDto {
  name: string;
  alias?: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
  parentId?: string;
  metaTitle?: string;
  metaDescription?: string;
}

// ── Order types ──────────────────────────────────────────────

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export interface OrderItem {
  id: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  options?: Record<string, string>;
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode?: string;
  country: string;
  phone?: string;
}

export interface StatusHistoryEntry {
  fromStatus: string | null;
  toStatus: string;
  reason?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  channel: string;
  currency: string;
  subtotal: string;
  discountTotal: string;
  shippingTotal: string;
  taxTotal: string;
  grandTotal: string;
  shippingAddress: ShippingAddress;
  items: OrderItem[];
  statusHistory: StatusHistoryEntry[];
  userId?: string;
  user?: { id: string; email: string; firstName: string; lastName: string } | null;
  createdAt: string;
  updatedAt: string;
}

// ── Inventory types ──────────────────────────────────────────

export type MovementKind =
  | "RECEIPT"
  | "SALE"
  | "RESERVATION"
  | "RELEASE"
  | "RETURN"
  | "ADJUSTMENT"
  | "TRANSFER_OUT"
  | "TRANSFER_IN";

export interface StockLevel {
  variantId: string;
  warehouseCode: string;
  onHand: number;
  reserved: number;
  lastMovementAt: string;
}

export interface StockMovement {
  id: string;
  variantId: string;
  kind: MovementKind;
  quantity: number;
  warehouseCode: string;
  referenceId?: string;
  referenceType?: string;
  reason?: string;
  createdAt: string;
}

export interface CreateMovementDto {
  variantId: string;
  kind: MovementKind;
  quantity: number;
  warehouseCode?: string;
  referenceId?: string;
  referenceType?: string;
  reason?: string;
}

// ── Account types ────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  countryCode?: string;
  role: string;
  createdAt: string;
}

// ── API client factory ───────────────────────────────────────

type TokenGetter = () => string | null;
type RefreshFn = () => Promise<boolean>;

let _getToken: TokenGetter = () => null;
let _refresh: RefreshFn = async () => false;
let _onUnauthorized: (() => void) | null = null;

export function configureApi(
  getToken: TokenGetter,
  refresh: RefreshFn,
  onUnauthorized: () => void
) {
  _getToken = getToken;
  _refresh = refresh;
  _onUnauthorized = onUnauthorized;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const token = _getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const ok = await _refresh();
    if (ok) return request<T>(path, options, false);
    _onUnauthorized?.();
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    let errBody: ApiError;
    try { errBody = await res.json(); } catch { errBody = { statusCode: res.status, message: res.statusText, error: "Unknown" }; }
    const msg = Array.isArray(errBody.message) ? errBody.message.join(", ") : errBody.message;
    throw new Error(msg || `Request failed: ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const json = await res.json();
  return json as T;
}

// ── Products API ─────────────────────────────────────────────

export const productsApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    isActive?: boolean;
    isFeatured?: boolean;
    sortBy?: string;
    sortOrder?: string;
    withDeleted?: boolean;
    deletedOnly?: boolean;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.search) q.set("search", params.search);
    if (params?.categoryId) q.set("categoryId", params.categoryId);
    if (params?.isActive !== undefined) q.set("isActive", String(params.isActive));
    if (params?.isFeatured !== undefined) q.set("isFeatured", String(params.isFeatured));
    if (params?.sortBy) q.set("sortBy", params.sortBy);
    if (params?.sortOrder) q.set("sortOrder", params.sortOrder);
    if (params?.withDeleted) q.set("withDeleted", "true");
    if (params?.deletedOnly) q.set("deletedOnly", "true");
    const qs = q.toString();
    return request<ApiResponse<PaginatedResponse<Product>>>(`/products${qs ? `?${qs}` : ""}`);
  },

  get: (id: string, opts?: { withDeleted?: boolean }) => {
    const qs = opts?.withDeleted ? "?withDeleted=true" : "";
    return request<ApiResponse<Product>>(`/products/${id}${qs}`);
  },

  create: (dto: CreateProductDto) =>
    request<ApiResponse<Product>>("/products", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  update: (id: string, dto: UpdateProductDto) =>
    request<ApiResponse<Product>>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(dto),
    }),

  bulkUpdate: (dto: {
    ids: string[];
    isActive?: boolean;
    isFeatured?: boolean;
    categoryId?: string;
  }) =>
    request<ApiResponse<{ updated: number }>>("/products/bulk", {
      method: "PATCH",
      body: JSON.stringify(dto),
    }),

  delete: (id: string) =>
    request<void>(`/products/${id}`, { method: "DELETE" }),

  restore: (id: string) =>
    request<ApiResponse<Product>>(`/products/${id}/restore`, { method: "PATCH" }),
};

// ── Media API ────────────────────────────────────────────────

export interface PresignResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
  maxBytes: number;
}

export const MEDIA_ALLOWED_MIME = ["image/jpeg", "image/png"] as const;
export type MediaMime = (typeof MEDIA_ALLOWED_MIME)[number];
export const MEDIA_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const mediaApi = {
  presign: (dto: { filename: string; contentType: MediaMime; size: number; productId?: string }) =>
    request<ApiResponse<PresignResult>>("/media/presign", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  confirm: (dto: { productId: string; key: string; altText?: string; sortOrder?: number }) =>
    request<ApiResponse<ProductMedia>>("/media/confirm", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  reorder: (productId: string, orderedIds: string[]) =>
    request<ApiResponse<ProductMedia[]>>(`/media/product/${productId}/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ orderedIds }),
    }),

  delete: (mediaId: string) =>
    request<void>(`/media/${mediaId}`, { method: "DELETE" }),

  /**
   * End-to-end helper: validate, presign, PUT to S3, confirm.
   * Throws if the file is invalid or any step fails. Callers can show
   * progress by watching the onProgress callback.
   */
  async uploadFile(
    file: File,
    productId: string,
    opts: { altText?: string; onProgress?: (pct: number) => void } = {},
  ): Promise<ProductMedia> {
    if (!(MEDIA_ALLOWED_MIME as readonly string[]).includes(file.type)) {
      throw new Error("Only JPG and PNG images are supported");
    }
    if (file.size > MEDIA_MAX_BYTES) {
      throw new Error("File is larger than 10 MB");
    }

    const presign = await this.presign({
      filename: file.name,
      contentType: file.type as MediaMime,
      size: file.size,
      productId,
    });

    // XHR so we can report progress
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", presign.data.uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && opts.onProgress) {
          opts.onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      };
      xhr.onerror = () => reject(new Error("Upload failed (network error)"));
      xhr.send(file);
    });

    const confirmed = await this.confirm({
      productId,
      key: presign.data.key,
      altText: opts.altText,
    });
    return confirmed.data;
  },
};

// ── Categories API ───────────────────────────────────────────

export const categoriesApi = {
  list: () =>
    request<ApiResponse<Category[]>>("/categories"),

  tree: () =>
    request<ApiResponse<Category[]>>("/categories/tree"),

  get: (id: string) =>
    request<ApiResponse<Category>>(`/categories/${id}`),

  create: (dto: CreateCategoryDto) =>
    request<ApiResponse<Category>>("/categories", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  update: (id: string, dto: Partial<CreateCategoryDto>) =>
    request<ApiResponse<Category>>(`/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(dto),
    }),

  move: (id: string, dto: { parentId?: string | null; sortOrder?: number }) =>
    request<ApiResponse<Category>>(`/categories/${id}/move`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    }),

  delete: (id: string) =>
    request<void>(`/categories/${id}`, { method: "DELETE" }),
};

// ── Orders API ───────────────────────────────────────────────

export const ordersApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    userId?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.status) q.set("status", params.status);
    if (params?.userId) q.set("userId", params.userId);
    const qs = q.toString();
    return request<ApiResponse<PaginatedResponse<Order>>>(`/orders${qs ? `?${qs}` : ""}`);
  },

  get: (id: string) =>
    request<ApiResponse<Order>>(`/orders/${id}`),

  getByNumber: (orderNumber: string) =>
    request<ApiResponse<Order>>(`/orders/number/${orderNumber}`),

  updateStatus: (id: string, status: string, reason?: string) =>
    request<ApiResponse<Order>>(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    }),
};

// ── Inventory API ────────────────────────────────────────────

export const inventoryApi = {
  getLevel: (variantId: string, warehouse = "DEFAULT") =>
    request<ApiResponse<StockLevel>>(
      `/inventory/levels/${variantId}?warehouse=${warehouse}`
    ),

  getMovements: (variantId: string, limit = 50) =>
    request<ApiResponse<StockMovement[]>>(
      `/inventory/movements/${variantId}?limit=${limit}`
    ),

  createMovement: (dto: CreateMovementDto) =>
    request<ApiResponse<StockMovement>>("/inventory/movements", {
      method: "POST",
      body: JSON.stringify(dto),
    }),
};

// ── Staff types ───────────────────────────────────────────────

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone?: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
  isActive: boolean;
}

// ── Staff API ─────────────────────────────────────────────────

export const staffApi = {
  list: (params?: { page?: number; limit?: number; search?: string; role?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.search) q.set("search", params.search);
    if (params?.role) q.set("role", params.role);
    const qs = q.toString();
    return request<ApiResponse<PaginatedResponse<StaffMember>>>(`/staff${qs ? `?${qs}` : ""}`);
  },

  get: (id: string) =>
    request<ApiResponse<StaffMember>>(`/staff/${id}`),

  create: (dto: { firstName: string; lastName: string; email: string; role: string }) =>
    request<ApiResponse<StaffMember>>("/staff", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  updateRole: (id: string, role: string) =>
    request<ApiResponse<StaffMember>>(`/staff/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  deactivate: (id: string) =>
    request<void>(`/staff/${id}`, { method: "DELETE" }),

  reactivate: (id: string) =>
    request<ApiResponse<StaffMember>>(`/staff/${id}/reactivate`, { method: "PATCH" }),
};

// ── Auth API (admin) ──────────────────────────────────────────

export const authApi = {
  forgotPassword: (email: string) =>
    request<void>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    request<void>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    }),

  verifyEmail: (token: string) =>
    request<void>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  resendVerification: (email: string) =>
    request<void>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  logoutAll: () =>
    request<void>("/auth/logout-all", { method: "POST" }),

  get2faStatus: () =>
    request<ApiResponse<{ enabled: boolean }>>("/auth/2fa/status"),

  initiate2fa: () =>
    request<ApiResponse<{ qrCodeDataUrl: string; secret: string }>>("/auth/2fa/setup", {
      method: "POST",
    }),

  confirm2fa: (totpCode: string) =>
    request<ApiResponse<{ backupCodes: string[] }>>("/auth/2fa/confirm", {
      method: "POST",
      body: JSON.stringify({ totpCode }),
    }),

  disable2fa: (currentPassword: string, totpCode?: string) =>
    request<void>("/auth/2fa", {
      method: "DELETE",
      body: JSON.stringify({ currentPassword, totpCode }),
    }),
};

// ── Account API ──────────────────────────────────────────────

export const accountApi = {
  profile: () =>
    request<ApiResponse<UserProfile>>("/account/profile"),

  updateProfile: (dto: { firstName?: string; lastName?: string; phone?: string; countryCode?: string }) =>
    request<ApiResponse<UserProfile>>("/account/profile", {
      method: "PUT",
      body: JSON.stringify(dto),
    }),

  changePassword: (dto: { currentPassword: string; newPassword: string }) =>
    request<void>("/account/password", {
      method: "POST",
      body: JSON.stringify(dto),
    }),
};

// ── Helpers ──────────────────────────────────────────────────

/** Convert minor units (kobo/cents) string → display string */
export function formatNgn(minorUnits: string | number): string {
  const n = typeof minorUnits === "string" ? parseInt(minorUnits, 10) : minorUnits;
  if (isNaN(n)) return "—";
  return `₦${(n / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

export function formatUsd(minorUnits: string | number): string {
  const n = typeof minorUnits === "string" ? parseInt(minorUnits, 10) : minorUnits;
  if (isNaN(n)) return "—";
  return `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

/** Order status → next valid statuses */
export const ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED", "REFUNDED"],
  PROCESSING: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["COMPLETED", "REFUNDED"],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Pending Payment",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};
