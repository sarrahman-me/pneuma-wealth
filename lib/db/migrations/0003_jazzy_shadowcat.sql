CREATE TYPE "public"."wish_status" AS ENUM('waiting', 'bought', 'released');--> statement-breakpoint
CREATE TABLE "wish_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" bigint NOT NULL,
	"created_on" date NOT NULL,
	"ready_on" date NOT NULL,
	"status" "wish_status" DEFAULT 'waiting' NOT NULL,
	"note" text,
	"decided_at" timestamp with time zone,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "buffer_fill_percent" integer DEFAULT 55 NOT NULL;--> statement-breakpoint
ALTER TABLE "wish_items" ADD CONSTRAINT "wish_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wish_items" ADD CONSTRAINT "wish_items_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wish_items_user_status_idx" ON "wish_items" USING btree ("user_id","status");