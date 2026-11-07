import { env } from "cloudflare:workers";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { incidents, events, investigations, memoryJobs } from "../db/schema";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { AppError, Hindsight } from "./hindsight";
import { eventInput, generatedInvestigation, incidentInput, memoryDocument, patchInput, resolutionInput, webhookInput } from "./validation";
import type { Incident, MemoryFact, Resolution } from "./types";
import { redact } from "./privacy";
import { investigateIncident } from "./investigation";

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const db = getDb;
const memory = () => new Hindsight(env);
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function body(request: Request) {
  if (Number(request.headers.get("content-length")) > 100000) throw new AppError("Request is too large. Keep reports under 100 KB.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("A JSON request body is required.");
  let total = 0; const chunks: Uint8Array[] = [];
  while (true) { const part = await reader.read(); if (part.done) break; total += part.value.length; if (total > 100000) { await reader.cancel(); throw new AppError("Request is too large. Keep reports under 100 KB.", 413); } chunks.push(part.value); }
  const bytes = new Uint8Array(total); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AppError("Enter valid JSON."); }
}
async function actor(request: Request) {
  const user = await getChatGPTUser();
  if (user) return user.displayName;
  const hostname = new URL(request.url).hostname;
  if (process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1", "[::1]"].includes(hostname)) return "Local workspace";
  throw new AppError("Sign in to access this workspace.", 401);
}
async function getIncident(id: string) {
  const row = await db().select().from(incidents).where(eq(incidents.id, id)).get();
  if (!row) throw new AppError("This incident could not be found.", 404);
  return row as Incident;
}
async function detail(id: string) {
  const incident = await getIncident(id);
  const [timeline, analyses, jobs] = await Promise.all([
    db().select().from(events).where(eq(events.incidentId, id)).orderBy(desc(events.createdAt)).all(),
    db().select().from(investigations).where(eq(investigations.incidentId, id)).orderBy(desc(investigations.createdAt)).all(),
    db().select({ id: memoryJobs.id, incidentId: memoryJobs.incidentId, revision: memoryJobs.revision, documentId: memoryJobs.documentId, status: memoryJobs.status, attempts: memoryJobs.attempts, lastError: memoryJobs.lastError, updatedAt: memoryJobs.updatedAt }).from(memoryJobs).where(eq(memoryJobs.incidentId, id)).orderBy(desc(memoryJobs.createdAt)).all(),
  ]);
  return { incident, events: timeline, investigations: analyses, jobs };
}
async function createIncident(input: z.infer<typeof incidentInput>, author: string, sourceKey?: string) {
  const id = uid(); const timestamp = now();
  await db().batch([
    db().insert(incidents).values({ ...input, description: redact(input.description), logs: redact(input.logs), id, owner: author, status: "open", revision: 1, sourceKey, createdAt: timestamp, updatedAt: timestamp }),
    db().insert(events).values({ id: uid(), incidentId: id, kind: "created", content: sourceKey ? "Incident received from webhook." : "Incident opened.", author, createdAt: timestamp }),
  ]);
  return id;
}
export async function syncMemoryJob(id: string) {
  const job = await db().select().from(memoryJobs).where(eq(memoryJobs.id, id)).get();
  if (!job) throw new AppError("Memory sync job not found.", 404);
  if (job.status === "synced" || job.status === "superseded") return job;
  const latest = await db().select().from(memoryJobs).where(eq(memoryJobs.incidentId, job.incidentId)).orderBy(desc(memoryJobs.revision)).get();
  if (latest && latest.revision > job.revision) { await db().update(memoryJobs).set({ status: "superseded", updatedAt: now() }).where(eq(memoryJobs.id, id)); return { ...job, status: "superseded" }; }
  const stale = new Date(Date.now() - 180000).toISOString();
  await db().update(memoryJobs).set({ status: "failed", lastError: "Previous sync was interrupted. Retry to continue." }).where(and(eq(memoryJobs.incidentId, job.incidentId), eq(memoryJobs.status, "syncing"), sql`${memoryJobs.updatedAt} < ${stale}`));
  const claimed = await db().update(memoryJobs).set({ status: "syncing", updatedAt: now(), attempts: sql`${memoryJobs.attempts} + 1`, lastError: null }).where(and(eq(memoryJobs.id, id), sql`${memoryJobs.status} IN ('pending', 'failed')`, sql`NOT EXISTS (SELECT 1 FROM memory_jobs active WHERE active.incident_id = ${job.incidentId} AND active.status = 'syncing')`)).returning().get();
  if (!claimed) throw new AppError("A memory sync is already in progress for this incident. Please try again shortly.", 409);
  try {
    const incident = await getIncident(job.incidentId);
    await memory().retain(job.documentId, job.content, { incident_id: job.incidentId, service: incident.service, environment: incident.environment, revision: String(job.revision) });
    await db().update(memoryJobs).set({ status: "synced", updatedAt: now(), lastError: null }).where(eq(memoryJobs.id, id));
    return { ...claimed, status: "synced", lastError: null };
  } catch (error) {
    const message = error instanceof AppError ? error.message : "Memory sync failed. Your resolution remains saved. Retry the sync.";
    await db().update(memoryJobs).set({ status: "failed", lastError: message, updatedAt: now() }).where(eq(memoryJobs.id, id));
    throw new AppError(message, 502);
  }
}

export async function handleApi(request: Request, path: string[]) {
  try {
    const method = request.method; const route = path.join("/");
    if (route === "webhooks/incidents" && method === "POST") {
      const secret = env.WEBHOOK_SECRET;
      if (!secret) throw new AppError("Webhook intake is not configured.", 503);
      const provided = request.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
      const hash = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
      const [a,b] = await Promise.all([hash(provided),hash(secret)]); let difference = 0; for(let i=0;i<a.length;i++) difference |= a[i]^b[i];
      if (difference !== 0) throw new AppError("Invalid webhook credentials.", 401);
      const input = webhookInput.parse(await body(request)); const key = `${input.provider}:${input.eventId}`;
      const existing = await db().select({ id: incidents.id }).from(incidents).where(eq(incidents.sourceKey, key)).get();
      if (existing) return json({ id: existing.id, duplicate: true });
      try { return json({ id: await createIncident(input, input.provider, key), duplicate: false }, 201); }
      catch(error) { const duplicate = await db().select({id:incidents.id}).from(incidents).where(eq(incidents.sourceKey,key)).get(); if(duplicate) return json({id:duplicate.id,duplicate:true}); throw error; }
    }
    const author = await actor(request);
    if (["POST", "PATCH", "DELETE"].includes(method)) {
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(request.url).origin) throw new AppError("Cross-origin writes are not allowed.", 403);
    }
    if (route === "connections/status" && method === "GET") {
      const keys = ["HINDSIGHT_BASE_URL", "HINDSIGHT_API_KEY", "HINDSIGHT_BANK_ID"] as const;
      const missing = keys.filter(k => !env[k]);
      return json({ configured: !missing.length, bankId: env.HINDSIGHT_BANK_ID || null, endpoint: env.HINDSIGHT_BASE_URL || null, webhookConfigured: !!env.WEBHOOK_SECRET, missing });
    }
    if (route === "connections/test" && method === "POST") return json(await memory().test());
    if (route === "memory-sync" && method === "GET") return json({ jobs: await db().select({ id:memoryJobs.id, incidentId:memoryJobs.incidentId, revision:memoryJobs.revision, documentId:memoryJobs.documentId, status:memoryJobs.status, attempts:memoryJobs.attempts, lastError:memoryJobs.lastError, updatedAt:memoryJobs.updatedAt }).from(memoryJobs).orderBy(desc(memoryJobs.updatedAt)).limit(500).all() });
    if (route === "incidents" && method === "GET") return json({ incidents: await db().select().from(incidents).orderBy(desc(incidents.updatedAt)).limit(500).all() });
    if (route === "incidents" && method === "POST") return json({ id: await createIncident(incidentInput.parse(await body(request)), author) }, 201);
    if (route === "imports" && method === "POST") {
      const input = z.object({ title: z.string().trim().min(5).max(180), service: z.string().trim().min(2).max(80), report: z.string().trim().min(20).max(20000) }).parse(await body(request));
      return json({ id: await createIncident({ title: input.title, service: input.service, description: input.report, logs: "", severity: "SEV3", environment: "production" }, author) }, 201);
    }
    if (route === "memories" && method === "GET") {
      const q = (new URL(request.url).searchParams.get("q") || "").trim();
      if (q.length > 1000) throw new AppError("Search must be under 1,000 characters.");
      const facts = q ? await memory().recall(q) : ((await memory().request(`${memory().bankPath}/memories/list?limit=50`)).items || []);
      return json({ facts });
    }
    if (path[0] === "memory-sync" && path[2] === "retry" && method === "POST") return json({ job: await syncMemoryJob(path[1]) });
    if (path[0] === "incidents" && path[1]) {
      const id = path[1]; const incident = await getIncident(id);
      if (path.length === 2 && method === "GET") return json(await detail(id));
      if (path.length === 2 && method === "PATCH") {
        const input = patchInput.parse(await body(request));
        if (!input.status) throw new AppError("Choose a status.");
        if (incident.status === "resolved") throw new AppError("This incident is resolved. Create a new incident for a recurrence.", 409);
        const changed = await db().update(incidents).set({ status: input.status, revision: sql`${incidents.revision} + 1`, updatedAt: now() }).where(and(eq(incidents.id,id),eq(incidents.revision,input.revision))).returning().get();
        if (!changed) throw new AppError("This incident changed in another session. Refresh and retry.", 409);
        return json({ incident: changed });
      }
      if (path[2] === "events" && method === "POST") {
        const input = eventInput.parse(await body(request));
        if (incident.status === "resolved") throw new AppError("This incident is already resolved.", 409);
        const timestamp = now();
        const result = await db().batch([
          db().update(incidents).set({ revision: sql`${incidents.revision} + 1`, updatedAt: timestamp }).where(and(eq(incidents.id,id),eq(incidents.revision,incident.revision))),
          db().insert(events).select(sql`SELECT ${uid()}, ${id}, ${input.kind}, ${redact(input.content)}, ${input.outcome || null}, ${author}, ${timestamp} WHERE changes() = 1`),
        ]);
        if (!result[0].meta.changes) throw new AppError("This incident changed. Refresh and retry.",409);
        return json({ saved: true }, 201);
      }
      if (path[2] === "resolve" && method === "POST") {
        const input = resolutionInput.parse(await body(request));
        if (incident.revision !== input.revision) throw new AppError("This incident changed. Refresh before resolving.", 409);
        if (incident.status === "resolved" && !input.amend) throw new AppError("This incident is already resolved. Use an explicit amendment to correct the outcome.", 409);
        const resolution: Resolution = { cause: redact(input.cause), fix: redact(input.fix), verification: redact(input.verification), prevention: redact(input.prevention) };
        const attempts = await db().select().from(events).where(and(eq(events.incidentId,id),eq(events.kind,"attempt"))).all();
        const revision = incident.revision + 1; const timestamp = now(); const jobId = uid();
        // The conditional inserts depend on SQLite changes(), so a lost revision race
        // cannot create a resolution event or orphan sync job.
        const result = await db().batch([
          db().update(incidents).set({ status: "resolved", resolution, revision, resolvedAt: timestamp, updatedAt: timestamp }).where(and(eq(incidents.id,id),eq(incidents.revision,input.revision))),
          db().insert(memoryJobs).select(sql`SELECT ${jobId}, ${id}, ${revision}, ${`incident-${id}`}, ${memoryDocument(incident,resolution,attempts)}, 'pending', 0, NULL, ${timestamp}, ${timestamp} WHERE changes() = 1`),
          db().insert(events).select(sql`SELECT ${uid()}, ${id}, 'resolved', ${resolution.fix}, 'worked', ${author}, ${timestamp} WHERE changes() = 1`),
        ]);
        if (!result[0].meta.changes) throw new AppError("This incident changed. Refresh and retry.",409);
        return json({ saved: true, jobId }, 201);
      }
      if (path[2] === "investigate" && method === "POST") {
        const data = await detail(id); const start = Date.now();
        const existing = data.investigations.find(a => a.revision === incident.revision && a.result && typeof a.result === "object" && "provider" in a.result && a.result.provider === "Hindsight Reflect · evidence reviewed");
        if (existing) return json({ investigation: existing, cached: true });
        const { result, structured, facts, basedOn } = await investigateIncident(memory(), incident, data.events);
        const investigation = { id: uid(), incidentId:id, revision:incident.revision, createdAt:now(), result:{ text:result.text, structured, basedOn, facts, provider:"Hindsight Reflect · evidence reviewed", durationMs:Date.now()-start } };
        await db().insert(investigations).values(investigation);
        if (incident.status === "open") await db().update(incidents).set({status:"investigating",updatedAt:now()}).where(and(eq(incidents.id,id),eq(incidents.revision,incident.revision)));
        return json({ investigation });
      }
    }
    throw new AppError("This endpoint does not exist.",404);
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: error.issues.map(i=>`${i.path.join(".")}: ${i.message}`).join("; ") },400);
    if (error instanceof AppError) return json({ error:error.message },error.status);
    console.error("Recall request failed", error instanceof Error ? error.name : "UnknownError");
    return json({error:"The request could not be completed. Please refresh and retry."},500);
  }
}
