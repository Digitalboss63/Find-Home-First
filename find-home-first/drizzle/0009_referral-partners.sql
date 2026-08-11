CREATE TABLE "referral_partner_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_name" text NOT NULL,
	"program_name" text NOT NULL,
	"partner_category" text DEFAULT 'other' NOT NULL,
	"contact_name" text,
	"role_title" text,
	"email" text,
	"phone" text,
	"service_area" text,
	"population_served" text,
	"referral_process" text,
	"source_url" text NOT NULL,
	"source_agency" text NOT NULL,
	"source_date" date NOT NULL,
	"verification_status" text DEFAULT 'official_source' NOT NULL,
	"referral_capacity_status" text DEFAULT 'needs_confirmation' NOT NULL,
	"operates_competing_housing" boolean,
	"eligibility_status" text DEFAULT 'review_needed' NOT NULL,
	"eligibility_reason" text NOT NULL,
	"outreach_status" text DEFAULT 'not_contacted' NOT NULL,
	"notes" text,
	"promoted_contact_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "referral_partner_candidates" ADD CONSTRAINT "referral_partner_candidates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_partner_candidates" ADD CONSTRAINT "referral_partner_candidates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_partner_candidates" ADD CONSTRAINT "referral_partner_candidates_promoted_contact_id_contacts_id_fk" FOREIGN KEY ("promoted_contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rpc_org_idx" ON "referral_partner_candidates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rpc_project_idx" ON "referral_partner_candidates" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "rpc_eligibility_idx" ON "referral_partner_candidates" USING btree ("eligibility_status");--> statement-breakpoint
CREATE UNIQUE INDEX "rpc_project_org_program_idx" ON "referral_partner_candidates" USING btree ("organization_id","project_id","organization_name","program_name");
