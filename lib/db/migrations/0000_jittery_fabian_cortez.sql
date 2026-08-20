CREATE TYPE "public"."account_kind" AS ENUM('spendable', 'savings');--> statement-breakpoint
CREATE TYPE "public"."category_nature" AS ENUM('essential', 'discretionary');--> statement-breakpoint
CREATE TYPE "public"."coach_mode" AS ENUM('calm', 'watchful', 'tight');--> statement-breakpoint
CREATE TYPE "public"."recurrence" AS ENUM('weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."transaction_kind" AS ENUM('IN', 'OUT');--> statement-breakpoint
CREATE TYPE "public"."transaction_source" AS ENUM('manual', 'fixed_cost');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "account_kind" DEFAULT 'spendable' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allowance_anchors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"anchored_on" date NOT NULL,
	"base_allowance" bigint NOT NULL,
	"flexible_at_anchor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allowance_anchors_user_date_unique" UNIQUE("user_id","anchored_on")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"nature" "category_nature" DEFAULT 'discretionary' NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "categories_user_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "coaching_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date_local" date NOT NULL,
	"mode" "coach_mode" NOT NULL,
	"headline" text NOT NULL,
	"rule_id" text NOT NULL,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date_local" date NOT NULL,
	"base_allowance" bigint NOT NULL,
	"carry" bigint DEFAULT 0 NOT NULL,
	"spent" bigint DEFAULT 0 NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "daily_ledger_user_date_unique" UNIQUE("user_id","date_local")
);
--> statement-breakpoint
CREATE TABLE "fixed_cost_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fixed_cost_id" uuid NOT NULL,
	"period" text NOT NULL,
	"paid_date_local" date,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fixed_cost_payments_period_unique" UNIQUE("fixed_cost_id","period")
);
--> statement-breakpoint
CREATE TABLE "fixed_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" bigint NOT NULL,
	"due_day" integer DEFAULT 1 NOT NULL,
	"recurrence" "recurrence" DEFAULT 'monthly' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"daily_living_cost" bigint DEFAULT 0 NOT NULL,
	"buffer_days" integer DEFAULT 30 NOT NULL,
	"allowance_horizon_days" integer DEFAULT 30 NOT NULL,
	"allowance_min" bigint DEFAULT 0 NOT NULL,
	"allowance_max" bigint DEFAULT 500000 NOT NULL,
	"obligation_horizon_days" integer DEFAULT 30 NOT NULL,
	"onboarded_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"kind" "transaction_kind" NOT NULL,
	"amount" bigint NOT NULL,
	"date_local" date NOT NULL,
	"description" text,
	"source" "transaction_source" DEFAULT 'manual' NOT NULL,
	"fixed_cost_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allowance_anchors" ADD CONSTRAINT "allowance_anchors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_memory" ADD CONSTRAINT "coaching_memory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_ledger" ADD CONSTRAINT "daily_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_cost_payments" ADD CONSTRAINT "fixed_cost_payments_fixed_cost_id_fixed_costs_id_fk" FOREIGN KEY ("fixed_cost_id") REFERENCES "public"."fixed_costs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_cost_payments" ADD CONSTRAINT "fixed_cost_payments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_costs" ADD CONSTRAINT "fixed_costs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fixed_cost_id_fixed_costs_id_fk" FOREIGN KEY ("fixed_cost_id") REFERENCES "public"."fixed_costs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "coaching_memory_user_date_idx" ON "coaching_memory" USING btree ("user_id","date_local");--> statement-breakpoint
CREATE INDEX "fixed_costs_user_idx" ON "fixed_costs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_user_date_idx" ON "transactions" USING btree ("user_id","date_local");--> statement-breakpoint
CREATE INDEX "transactions_account_idx" ON "transactions" USING btree ("account_id");