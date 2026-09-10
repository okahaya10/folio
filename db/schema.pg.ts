import {
  pgTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core";

// PostgreSQL schema for the Sakura VPS migration. Mirrors db/schema.ts
// (the current D1/SQLite schema) column-for-column so lib/server.ts's
// existing SQL statements need minimal changes when the D1 client is
// swapped for a Postgres client.
export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  owner: text("owner").notNull(),
  data: text("data").notNull(),
  version: integer("version").notNull().default(0),
  status: text("status").notNull().default("active"),
  plan: text("plan").notNull().default("スタンダード"),
  created: text("created").notNull(),
});

export const members = pgTable(
  "members",
  {
    tenant: text("tenant")
      .notNull()
      .references(() => tenants.id),
    user: text("user").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenant, t.user] })],
);

export const invitations = pgTable("invitations", {
  token: text("token").primaryKey(),
  tenant: text("tenant")
    .notNull()
    .references(() => tenants.id),
  email: text("email").notNull(),
  role: text("role").notNull(),
  expires: text("expires").notNull(),
});

export const platform = pgTable("platform", {
  id: text("id").primaryKey(),
  user: text("user").notNull(),
});
