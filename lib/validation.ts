import { z } from "zod";

export const incidentInput = z.object({
  title: z.string().trim().min(5).max(180), service: z.string().trim().min(2).max(80),
  environment: z.enum(["production", "staging", "development"]).default("production"),
  severity: z.enum(["SEV1", "SEV2", "SEV3"]).default("SEV2"),
  description: z.string().trim().min(10).max(20000), logs: z.string().max(30000).default(""),
});
export const eventInput = z.object({ content: z.string().trim().min(3).max(10000), kind: z.enum(["note", "attempt"]).default("note"), outcome: z.enum(["worked", "failed", "partial", "unknown"]).optional() });
export const resolutionInput = z.object({ cause: z.string().trim().min(10).max(5000), fix: z.string().trim().min(10).max(5000), verification: z.string().trim().min(10).max(5000), prevention: z.string().trim().max(3000).default(""), revision: z.number().int().positive(), amend: z.boolean().default(false) });
export const patchInput = z.object({ status: z.enum(["open", "investigating", "monitoring"]).optional(), revision: z.number().int().positive() });
export const webhookInput = incidentInput.extend({ eventId: z.string().min(1).max(150), provider: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(60) });
export const generatedInvestigation = z.object({
  evidenceStatus: z.enum(["insufficient_evidence", "supported_hypothesis"]),
  summary: z.string(),
  hypotheses: z.array(z.object({ title: z.string(), reasoning: z.string(), basis: z.enum(["current_observations", "historical_memory"]), evidenceIds: z.array(z.string()) })),
  checks: z.array(z.string()), avoid: z.array(z.string()), missing: z.array(z.string()),
});
export const reviewedInvestigation = generatedInvestigation.extend({
  hypotheses: z.array(z.object({
    title: z.string(), basis: z.enum(["current_observations", "historical_memory"]), evidenceIds: z.array(z.string()),
    observed: z.string(), memoryRelation: z.enum(["same_mechanism", "none"]), historical: z.string(), unverified: z.string(),
  })).max(1),
});

export function memoryDocument(incident: { id: string; title: string; service: string; environment: string; description: string }, resolution: { cause: string; fix: string; verification: string; prevention: string }, attempts: { content: string; outcome: string | null }[]) {
  return [`CONFIRMED INCIDENT REPORT ${incident.id}`, `Title: ${incident.title}`, `Service: ${incident.service}; environment: ${incident.environment}`, `Symptoms: ${incident.description}`, `Confirmed cause: ${resolution.cause}`, `Successful fix: ${resolution.fix}`, `Verification evidence: ${resolution.verification}`, `Proposed preventive action (not confirmed implemented): ${resolution.prevention || "Not recorded"}`, ...attempts.map(a => `Attempt (${a.outcome || "unknown"}): ${a.content}`), "Interpret failed attempts in the conditions of this incident; they are not universal prohibitions."].join("\n");
}
