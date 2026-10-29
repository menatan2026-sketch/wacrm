CREATE TABLE "login_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"scope_type" text DEFAULT 'platform' NOT NULL,
	"scope_id" uuid,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "role_assignments_role_ck" CHECK ("role" IN ('CUSTOMER', 'ENTERPRISE_ADMIN', 'SUPPLIER_OPERATOR', 'SUPPLIER_MANAGER', 'CAD_DESIGNER', 'QUALITY_REVIEWER', 'SUPPORT_AGENT', 'ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN')),
	CONSTRAINT "role_assignments_scope_ck" CHECK ("scope_type" IN ('platform', 'supplier', 'organization'))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"surface" text NOT NULL,
	"mfa_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_hash" text,
	"user_agent" text,
	CONSTRAINT "sessions_surface_ck" CHECK ("surface" IN ('customer', 'supplier', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "supplier_invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"supplier_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'SUPPLIER_MANAGER' NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"phone" text,
	"preferred_locale" text DEFAULT 'he' NOT NULL,
	"reduced_motion" text,
	"marketing_consent_at" timestamp with time zone,
	"terms_accepted_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"mfa_secret" text,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_locale_ck" CHECK ("preferred_locale" IN ('he', 'en', 'ru')),
	CONSTRAINT "users_status_ck" CHECK ("status" IN ('active', 'disabled', 'anonymized'))
);
--> statement-breakpoint
CREATE TABLE "material_variants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"material_id" uuid NOT NULL,
	"color_code" text NOT NULL,
	"color_hex" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "material_variants_status_ck" CHECK ("status" IN ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"process_code" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"density_g_cm3" numeric(6, 3) NOT NULL,
	"max_service_temp_c" integer NOT NULL,
	"uv_resistance" integer NOT NULL,
	"moisture_resistance" integer NOT NULL,
	"flexibility" text NOT NULL,
	"strength_index" integer NOT NULL,
	"food_contact_certifiable" boolean DEFAULT false NOT NULL,
	"cost_tier" integer DEFAULT 1 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "materials_status_ck" CHECK ("status" IN ('active', 'inactive')),
	CONSTRAINT "materials_flex_ck" CHECK ("flexibility" IN ('rigid', 'slight', 'rubber'))
);
--> statement-breakpoint
CREATE TABLE "processes" (
	"code" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'inactive' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "processes_status_ck" CHECK ("status" IN ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "quality_profiles" (
	"code" text PRIMARY KEY NOT NULL,
	"process_code" text NOT NULL,
	"layer_height_mm" numeric(5, 3) NOT NULL,
	"wall_thickness_mm" numeric(5, 2) NOT NULL,
	"infill" numeric(4, 3) NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "quality_profiles_status_ck" CHECK ("status" IN ('active', 'inactive'))
);
--> statement-breakpoint
CREATE TABLE "file_objects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_user_id" uuid,
	"anon_token_hash" text,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"ext" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending_upload' NOT NULL,
	"retention_class" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploaded_at" timestamp with time zone,
	CONSTRAINT "file_objects_kind_ck" CHECK ("kind" IN ('model', 'photo', 'preview', 'qc_photo', 'label', 'invoice', 'design_revision')),
	CONSTRAINT "file_objects_status_ck" CHECK ("status" IN ('pending_upload', 'uploaded', 'rejected', 'deleted'))
);
--> statement-breakpoint
CREATE TABLE "geometry_analyses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"file_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"stages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failure_code" text,
	"units_detected" text,
	"bbox_x_mm" numeric(12, 3),
	"bbox_y_mm" numeric(12, 3),
	"bbox_z_mm" numeric(12, 3),
	"volume_mm3" numeric(16, 3),
	"surface_area_mm2" numeric(16, 3),
	"overhang_area_mm2" numeric(16, 3),
	"triangle_count" integer,
	"shells" integer,
	"is_watertight" boolean,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preview_file_id" uuid,
	"analyzer_version" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "geometry_analyses_status_ck" CHECK ("status" IN ('queued', 'running', 'succeeded', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"recipient_name" text NOT NULL,
	"phone" text NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"city" text NOT NULL,
	"postal_code" text,
	"country" text DEFAULT 'IL' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"file_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"process_code" text DEFAULT 'FDM' NOT NULL,
	"material_variant_id" uuid,
	"quality_profile_code" text,
	"units_confirmed" text,
	"scale" numeric(8, 4) DEFAULT 1 NOT NULL,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requirements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"author_id" uuid,
	"author_type" text NOT NULL,
	"visibility" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_messages_visibility_ck" CHECK ("visibility" IN ('customer', 'internal')),
	CONSTRAINT "order_messages_author_ck" CHECK ("author_type" IN ('customer', 'staff', 'system'))
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"event" text NOT NULL,
	"actor_id" uuid,
	"actor_type" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"customer_user_id" uuid NOT NULL,
	"flow" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"on_hold" boolean DEFAULT false NOT NULL,
	"hold_reason" text,
	"urgency_tier" text DEFAULT 'standard' NOT NULL,
	"currency" text DEFAULT 'ILS' NOT NULL,
	"locale" text NOT NULL,
	"request" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ship_to_address_id" uuid,
	"current_quote_id" uuid,
	"assigned_supplier_id" uuid,
	"assigned_staff_id" uuid,
	"promised_ship_date" date,
	"promised_delivery_date" date,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_status_ck" CHECK ("status" IN ('DRAFT', 'REQUIREMENTS_PENDING', 'REVIEW_REQUIRED', 'DESIGN_REQUIRED', 'DESIGN_IN_PROGRESS', 'DESIGN_APPROVAL', 'QUOTE_READY', 'PAYMENT_PENDING', 'PAID', 'ROUTING', 'SUPPLIER_ASSIGNED', 'SUPPLIER_ACCEPTED', 'PRODUCTION', 'QC_PENDING', 'QC_FAILED', 'REPRINT_REQUIRED', 'READY_FOR_SHIPMENT', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'DISPUTED')),
	CONSTRAINT "orders_flow_ck" CHECK ("flow" IN ('file', 'object', 'idea')),
	CONSTRAINT "orders_urgency_ck" CHECK ("urgency_tier" IN ('standard', 'fast', 'urgent'))
);
--> statement-breakpoint
CREATE TABLE "wizard_drafts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_user_id" uuid,
	"anon_token_hash" text,
	"flow" text NOT NULL,
	"step" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payload_version" integer DEFAULT 1 NOT NULL,
	"converted_order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "wizard_drafts_flow_ck" CHECK ("flow" IN ('file', 'object', 'idea'))
);
--> statement-breakpoint
CREATE TABLE "pricing_rule_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"process_code" text NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"rules" jsonb NOT NULL,
	"created_by" uuid,
	"activated_by" uuid,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_rule_sets_status_ck" CHECK ("status" IN ('draft', 'active', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "quote_snapshots" (
	"quote_id" uuid PRIMARY KEY NOT NULL,
	"inputs" jsonb NOT NULL,
	"lines" jsonb NOT NULL,
	"subtotal_net_minor" bigint NOT NULL,
	"tax_minor" bigint NOT NULL,
	"total_minor" bigint NOT NULL,
	"computed_total_minor" bigint NOT NULL,
	"expected_payout_minor" bigint NOT NULL,
	"expected_margin_minor" bigint NOT NULL,
	"tax_rate_bps" integer NOT NULL,
	"currency" text NOT NULL,
	"engine_version" text NOT NULL,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"mode" text NOT NULL,
	"rule_set_id" uuid,
	"override_reason" text,
	"created_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_status_ck" CHECK ("status" IN ('ready', 'accepted', 'expired', 'superseded', 'withdrawn')),
	CONSTRAINT "quotes_mode_ck" CHECK ("mode" IN ('auto', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "tax_rates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"country" text NOT NULL,
	"kind" text DEFAULT 'vat' NOT NULL,
	"rate_bps" integer NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date
);
--> statement-breakpoint
CREATE TABLE "job_offers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payout_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"responded_by" uuid,
	"decline_reason" text,
	CONSTRAINT "job_offers_status_ck" CHECK ("status" IN ('pending', 'accepted', 'declined', 'expired', 'withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "machine_materials" (
	"machine_id" uuid NOT NULL,
	"material_variant_id" uuid NOT NULL,
	CONSTRAINT "machine_materials_machine_id_material_variant_id_pk" PRIMARY KEY("machine_id","material_variant_id")
);
--> statement-breakpoint
CREATE TABLE "machines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"supplier_id" uuid NOT NULL,
	"process_code" text DEFAULT 'FDM' NOT NULL,
	"name" text NOT NULL,
	"build_x_mm" numeric(8, 1) NOT NULL,
	"build_y_mm" numeric(8, 1) NOT NULL,
	"build_z_mm" numeric(8, 1) NOT NULL,
	"daily_capacity_minutes" integer DEFAULT 1200 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machines_status_ck" CHECK ("status" IN ('active', 'maintenance', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "production_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"supplier_id" uuid,
	"status" text DEFAULT 'OFFERED' NOT NULL,
	"attempt_no" integer DEFAULT 1 NOT NULL,
	"payout_minor" bigint,
	"currency" text DEFAULT 'ILS' NOT NULL,
	"due_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"produced_at" timestamp with time zone,
	"handed_off_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_jobs_status_ck" CHECK ("status" IN ('OFFERED', 'ACCEPTED', 'IN_PRODUCTION', 'QC_PENDING', 'QC_PASSED', 'QC_FAILED', 'HANDED_OFF', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "qc_inspections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"author_id" uuid,
	"verdict" text,
	"measurements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"photo_file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"defects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qc_inspections_stage_ck" CHECK ("stage" IN ('supplier_evidence', 'platform_review')),
	CONSTRAINT "qc_inspections_verdict_ck" CHECK ("verdict" IN ('pass', 'fail', 'needs_info'))
);
--> statement-breakpoint
CREATE TABLE "reprint_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"new_job_id" uuid,
	"reason_code" text NOT NULL,
	"root_cause" text,
	"corrective_action" text,
	"cost_bearer" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routing_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"rule_set_id" uuid,
	"candidates" jsonb NOT NULL,
	"chosen_supplier_id" uuid,
	"mode" text NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routing_decisions_mode_ck" CHECK ("mode" IN ('proposal', 'auto', 'manual_confirmed', 'manual_override'))
);
--> statement-breakpoint
CREATE TABLE "routing_rule_sets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"weights" jsonb NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	CONSTRAINT "routing_rule_sets_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"tax_id" text,
	"status" text DEFAULT 'invited' NOT NULL,
	"contact_email" text NOT NULL,
	"phone" text,
	"city" text,
	"address_line" text,
	"postal_code" text,
	"region" text DEFAULT 'center' NOT NULL,
	"lead_time_days" integer DEFAULT 3 NOT NULL,
	"minimum_job_minor" bigint DEFAULT 0 NOT NULL,
	"payout_card" jsonb,
	"payout_details" jsonb,
	"payout_details_changed_at" timestamp with time zone,
	"onboarding" jsonb DEFAULT '{"company":false,"location":false,"machines":false,"payout":false,"agreement":false}'::jsonb NOT NULL,
	"agreement_accepted_at" timestamp with time zone,
	"stats" jsonb DEFAULT '{"qualityScore":0.8,"onTimeRate":0.9,"acceptanceRate":0.9,"reprintRate":0,"cancellationRate":0,"completedJobs":0}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_status_ck" CHECK ("status" IN ('invited', 'onboarding', 'active', 'paused', 'suspended'))
);
--> statement-breakpoint
CREATE TABLE "inbound_webhooks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"signature_valid" boolean NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"document_number" text NOT NULL,
	"provider" text NOT NULL,
	"net_minor" bigint NOT NULL,
	"tax_minor" bigint NOT NULL,
	"total_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_document_number_unique" UNIQUE("document_number")
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"provider_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"amount_minor" bigint NOT NULL,
	"refunded_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"checkout_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_status_ck" CHECK ("status" IN ('PENDING', 'CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "payout_ledger_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"supplier_id" uuid NOT NULL,
	"job_id" uuid,
	"statement_id" uuid,
	"kind" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'ILS' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_ledger_kind_ck" CHECK ("kind" IN ('earning', 'adjustment', 'clawback', 'payment'))
);
--> statement-breakpoint
CREATE TABLE "payout_statements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"supplier_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_minor" bigint NOT NULL,
	"currency" text DEFAULT 'ILS' NOT NULL,
	"status" text DEFAULT 'closed' NOT NULL,
	"supplier_invoice_file_id" uuid,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"reason_code" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'requested' NOT NULL,
	"requested_by" uuid,
	"approved_by" uuid,
	"provider_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "refunds_status_ck" CHECK ("status" IN ('requested', 'approved', 'completed', 'failed', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"shipment_id" uuid NOT NULL,
	"status" text NOT NULL,
	"provider_event_id" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"service_level" text DEFAULT 'standard' NOT NULL,
	"status" text DEFAULT 'LABEL_CREATED' NOT NULL,
	"carrier" text,
	"tracking_number" text,
	"tracking_url" text,
	"label_file_id" uuid,
	"cost_minor" bigint,
	"currency" text DEFAULT 'ILS' NOT NULL,
	"created_by" uuid,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_status_ck" CHECK ("status" IN ('LABEL_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION', 'RETURNED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"session_id" text,
	"user_id" uuid,
	"order_id" uuid,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"locale" text,
	"surface" text
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"actor_type" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"request_id" text
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"to_address" text NOT NULL,
	"subject" text NOT NULL,
	"text" text NOT NULL,
	"html" text NOT NULL,
	"template" text NOT NULL,
	"locale" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"rollout" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"scope" text NOT NULL,
	"actor_key" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_scope_actor_key_key_pk" PRIMARY KEY("scope","actor_key","key")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"kind" text NOT NULL,
	"channel" text NOT NULL,
	"locale" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"read_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_channel_ck" CHECK ("channel" IN ('email', 'in_app')),
	CONSTRAINT "notifications_status_ck" CHECK ("status" IN ('pending', 'sent', 'failed', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "processed_events" (
	"handler" text NOT NULL,
	"event_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processed_events_handler_event_id_pk" PRIMARY KEY("handler","event_id")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_variants" ADD CONSTRAINT "material_variants_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_process_code_processes_code_fk" FOREIGN KEY ("process_code") REFERENCES "public"."processes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_profiles" ADD CONSTRAINT "quality_profiles_process_code_processes_code_fk" FOREIGN KEY ("process_code") REFERENCES "public"."processes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_objects" ADD CONSTRAINT "file_objects_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geometry_analyses" ADD CONSTRAINT "geometry_analyses_file_id_file_objects_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geometry_analyses" ADD CONSTRAINT "geometry_analyses_preview_file_id_file_objects_id_fk" FOREIGN KEY ("preview_file_id") REFERENCES "public"."file_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_file_id_file_objects_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_messages" ADD CONSTRAINT "order_messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_ship_to_address_id_addresses_id_fk" FOREIGN KEY ("ship_to_address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wizard_drafts" ADD CONSTRAINT "wizard_drafts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_snapshots" ADD CONSTRAINT "quote_snapshots_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_rule_set_id_pricing_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."pricing_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_job_id_production_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."production_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_materials" ADD CONSTRAINT "machine_materials_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_materials" ADD CONSTRAINT "machine_materials_material_variant_id_material_variants_id_fk" FOREIGN KEY ("material_variant_id") REFERENCES "public"."material_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qc_inspections" ADD CONSTRAINT "qc_inspections_job_id_production_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."production_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reprint_requests" ADD CONSTRAINT "reprint_requests_job_id_production_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."production_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reprint_requests" ADD CONSTRAINT "reprint_requests_new_job_id_production_jobs_id_fk" FOREIGN KEY ("new_job_id") REFERENCES "public"."production_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_decisions" ADD CONSTRAINT "routing_decisions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_decisions" ADD CONSTRAINT "routing_decisions_rule_set_id_routing_rule_sets_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."routing_rule_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_ledger_entries" ADD CONSTRAINT "payout_ledger_entries_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_ledger_entries" ADD CONSTRAINT "payout_ledger_entries_job_id_production_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."production_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_ledger_entries" ADD CONSTRAINT "payout_ledger_entries_statement_id_payout_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."payout_statements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_statements" ADD CONSTRAINT "payout_statements_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_statements" ADD CONSTRAINT "payout_statements_supplier_invoice_file_id_file_objects_id_fk" FOREIGN KEY ("supplier_invoice_file_id") REFERENCES "public"."file_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_label_file_id_file_objects_id_fk" FOREIGN KEY ("label_file_id") REFERENCES "public"."file_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_codes_email_idx" ON "login_codes" USING btree (lower("email"),"created_at");--> statement-breakpoint
CREATE INDEX "role_assignments_user_idx" ON "role_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "material_variants_uq" ON "material_variants" USING btree ("material_id","color_code");--> statement-breakpoint
CREATE UNIQUE INDEX "materials_code_uq" ON "materials" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "file_objects_key_uq" ON "file_objects" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "file_objects_owner_idx" ON "file_objects" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "geometry_analyses_file_uq" ON "geometry_analyses" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_messages_order_idx" ON "order_messages" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_status_history_order_idx" ON "order_status_history" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_uq" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_user_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_attention_idx" ON "orders" USING btree ("status","status_changed_at") WHERE "orders"."on_hold" OR "orders"."status" IN ('REVIEW_REQUIRED','QC_PENDING','QC_FAILED','DISPUTED','ROUTING');--> statement-breakpoint
CREATE INDEX "wizard_drafts_owner_idx" ON "wizard_drafts" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "wizard_drafts_anon_idx" ON "wizard_drafts" USING btree ("anon_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "pricing_rule_sets_version_uq" ON "pricing_rule_sets" USING btree ("process_code","version");--> statement-breakpoint
CREATE UNIQUE INDEX "pricing_rule_sets_active_uq" ON "pricing_rule_sets" USING btree ("process_code") WHERE "pricing_rule_sets"."status" = 'active';--> statement-breakpoint
CREATE INDEX "quotes_order_idx" ON "quotes" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "job_offers_supplier_idx" ON "job_offers" USING btree ("supplier_id","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_offers_one_accept_uq" ON "job_offers" USING btree ("job_id") WHERE "job_offers"."status" = 'accepted';--> statement-breakpoint
CREATE INDEX "machines_supplier_idx" ON "machines" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "production_jobs_supplier_idx" ON "production_jobs" USING btree ("supplier_id","status","due_at");--> statement-breakpoint
CREATE INDEX "production_jobs_order_idx" ON "production_jobs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "qc_inspections_job_idx" ON "qc_inspections" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "routing_decisions_order_idx" ON "routing_decisions" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_webhooks_uq" ON "inbound_webhooks" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idem_uq" ON "payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_ref_uq" ON "payments" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payout_ledger_supplier_idx" ON "payout_ledger_entries" USING btree ("supplier_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_events_provider_uq" ON "shipment_events" USING btree ("shipment_id","provider_event_id");--> statement-breakpoint
CREATE INDEX "shipments_order_idx" ON "shipments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "analytics_events_name_idx" ON "analytics_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_resource_idx" ON "audit_events" USING btree ("resource_type","resource_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_at_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_messages_to_idx" ON "email_messages" USING btree ("to_address","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "outbox_unpublished_idx" ON "outbox_events" USING btree ("available_at") WHERE "outbox_events"."published_at" IS NULL;