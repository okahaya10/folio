CREATE TABLE "invitations" (
	"token" text PRIMARY KEY NOT NULL,
	"tenant" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"expires" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"tenant" text NOT NULL,
	"user" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "members_tenant_user_pk" PRIMARY KEY("tenant","user")
);
--> statement-breakpoint
CREATE TABLE "platform" (
	"id" text PRIMARY KEY NOT NULL,
	"user" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner" text NOT NULL,
	"data" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"plan" text DEFAULT 'スタンダード' NOT NULL,
	"created" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_tenants_id_fk" FOREIGN KEY ("tenant") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_tenant_tenants_id_fk" FOREIGN KEY ("tenant") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;