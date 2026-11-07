import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const incidents = sqliteTable("incidents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  service: text("service").notNull(),
  environment: text("environment").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull(),
  description: text("description").notNull(),
  logs: text("logs").notNull(),
  owner: text("owner").notNull(),
  revision: integer("revision").notNull().default(1),
  resolution: text("resolution", { mode: "json" }),
  sourceKey: text("source_key"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  resolvedAt: text("resolved_at"),
}, (t) => [index("incidents_updated_idx").on(t.updatedAt), uniqueIndex("incidents_source_idx").on(t.sourceKey)]);

export const events = sqliteTable("events", {
  id: text("id").primaryKey(), incidentId: text("incident_id").notNull().references(() => incidents.id),
  kind: text("kind").notNull(), content: text("content").notNull(),
  outcome: text("outcome"), author: text("author").notNull(), createdAt: text("created_at").notNull(),
}, (t) => [index("events_incident_idx").on(t.incidentId)]);

export const investigations = sqliteTable("investigations", {
  id: text("id").primaryKey(), incidentId: text("incident_id").notNull().references(() => incidents.id),
  revision: integer("revision").notNull(), result: text("result", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [index("investigations_incident_idx").on(t.incidentId)]);

export const memoryJobs = sqliteTable("memory_jobs", {
  id: text("id").primaryKey(), incidentId: text("incident_id").notNull().references(() => incidents.id),
  revision: integer("revision").notNull(), documentId: text("document_id").notNull(),
  content: text("content").notNull(), status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0), lastError: text("last_error"),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (t) => [uniqueIndex("jobs_revision_idx").on(t.incidentId, t.revision)]);
