ALTER TABLE "orders" ADD COLUMN "review_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "production_jobs" ADD COLUMN "estimated_minutes" integer DEFAULT 0 NOT NULL;