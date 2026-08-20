ALTER TYPE "public"."recurrence" ADD VALUE 'daily' BEFORE 'weekly';--> statement-breakpoint
ALTER TABLE "fixed_costs" ADD COLUMN "due_month" integer DEFAULT 1 NOT NULL;