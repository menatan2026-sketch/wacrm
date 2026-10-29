// Single source of truth for text-enum values shared by the schema and the domain.
export const LOCALES = ["he", "en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export const ROLES = [
  "CUSTOMER",
  "ENTERPRISE_ADMIN",
  "SUPPLIER_OPERATOR",
  "SUPPLIER_MANAGER",
  "CAD_DESIGNER",
  "QUALITY_REVIEWER",
  "SUPPORT_AGENT",
  "ADMIN",
  "FINANCE_ADMIN",
  "SUPER_ADMIN",
] as const;
export type Role = (typeof ROLES)[number];

export const SURFACES = ["customer", "supplier", "admin"] as const;
export type Surface = (typeof SURFACES)[number];

export const ORDER_FLOWS = ["file", "object", "idea"] as const;
export type OrderFlow = (typeof ORDER_FLOWS)[number];

export const ORDER_STATUSES = [
  "DRAFT",
  "REQUIREMENTS_PENDING",
  "REVIEW_REQUIRED",
  "DESIGN_REQUIRED",
  "DESIGN_IN_PROGRESS",
  "DESIGN_APPROVAL",
  "QUOTE_READY",
  "PAYMENT_PENDING",
  "PAID",
  "ROUTING",
  "SUPPLIER_ASSIGNED",
  "SUPPLIER_ACCEPTED",
  "PRODUCTION",
  "QC_PENDING",
  "QC_FAILED",
  "REPRINT_REQUIRED",
  "READY_FOR_SHIPMENT",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "DISPUTED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const URGENCY_TIERS = ["standard", "fast", "urgent"] as const;
export type UrgencyTier = (typeof URGENCY_TIERS)[number];

export const FILE_KINDS = [
  "model",
  "photo",
  "preview",
  "qc_photo",
  "label",
  "invoice",
  "design_revision",
] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export const QUOTE_STATUSES = ["ready", "accepted", "expired", "superseded", "withdrawn"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const SUPPLIER_STATUSES = [
  "invited",
  "onboarding",
  "active",
  "paused",
  "suspended",
] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export const JOB_STATUSES = [
  "OFFERED",
  "ACCEPTED",
  "IN_PRODUCTION",
  "QC_PENDING",
  "QC_PASSED",
  "QC_FAILED",
  "HANDED_OFF",
  "CANCELLED",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const OFFER_STATUSES = ["pending", "accepted", "declined", "expired", "withdrawn"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "PENDING",
  "CAPTURED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "FAILED",
  "CANCELLED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SHIPMENT_STATUSES = [
  "LABEL_CREATED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "EXCEPTION",
  "RETURNED",
  "CANCELLED",
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const QC_VERDICTS = ["pass", "fail", "needs_info"] as const;
export type QcVerdict = (typeof QC_VERDICTS)[number];
