import type { MemoryFact } from "./types";

export class AppError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type MemoryConfig = { HINDSIGHT_BASE_URL?: string; HINDSIGHT_API_KEY?: string; HINDSIGHT_BANK_ID?: string };

export class Hindsight {
  constructor(private config: MemoryConfig, private transport: typeof fetch = fetch) {}
  get bankPath() { return `/v1/default/banks/${encodeURIComponent(this.config.HINDSIGHT_BANK_ID || "")}`; }
  async request(path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
    if (!this.config.HINDSIGHT_BASE_URL || !this.config.HINDSIGHT_BANK_ID || !this.config.HINDSIGHT_API_KEY) throw new AppError("Hindsight is not configured. Add the connection URL, API key and bank ID in the server environment.", 503);
    const base = this.config.HINDSIGHT_BASE_URL.replace(/\/$/, "");
    let response: Response;
    try {
      response = await this.transport(`${base}${path}`, { method, headers: { "Authorization": `Bearer ${this.config.HINDSIGHT_API_KEY}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(110000) });
    } catch { throw new AppError("Hindsight could not be reached or timed out. Your incident data is preserved. Please retry.", 502); }
    if (!response.ok) throw new AppError(response.status === 401 || response.status === 403 ? "Hindsight rejected the API credentials. Check the API key and bank permissions." : response.status === 402 ? "Hindsight credits are exhausted. Add credits in Hindsight Cloud Billing, then retry. Your incident data is preserved." : response.status === 429 ? "Hindsight is rate-limited or has insufficient credits. Check the account and retry." : `Hindsight returned HTTP ${response.status}. Check the bank ID and connection settings, then retry.`, 502);
    try { return await response.json() as Record<string, unknown>; } catch { throw new AppError("Hindsight returned an unreadable response. Please retry.", 502); }
  }
  async test() { await this.request(`${this.bankPath}/memories/list?limit=1`); return { connected: true, checkedAt: new Date().toISOString() }; }
  async retain(documentId: string, content: string, metadata: Record<string, string>) {
    const data = await this.request(`${this.bankPath}/memories`, { items: [{ content, document_id: documentId, metadata, tags: ["recall-incident", `service:${metadata.service}`] }], async: false });
    if (data.success !== true || data.async === true) throw new AppError("Hindsight has not confirmed completed memory processing. Retry the memory sync.", 502);
    return data;
  }
  async recall(query: string) {
    const data = await this.request(`${this.bankPath}/memories/recall`, { query, budget: "mid", max_tokens: 4096 });
    return (Array.isArray(data.results) ? data.results : []) as MemoryFact[];
  }
  async reflect(query: string, options: { evidenceIds?: string[]; review?: boolean } = {}) {
    const data = await this.request(`${this.bankPath}/reflect`, {
      query, budget: "mid", max_tokens: 2200, include: { facts: {} },
      response_schema: { type: "object", properties: {
        evidenceStatus: { type: "string", enum: ["insufficient_evidence", "supported_hypothesis"], description: "supported_hypothesis when one technical failure is supported, even if its deeper cause is unknown; insufficient_evidence only when no technical failure can be identified. Must agree with hypotheses." },
        summary: { type: "string", description: "At most 55 words describing observed technical failure or explicitly insufficient evidence. No unobserved explanation." },
        hypotheses: { type: "array", maxItems: 1, items: { type: "object", properties: {
          title: { type: "string", description: "Name the observed technical failure, not an unverified deeper cause. At most 12 words." },
          ...(options.review ? {
            observed: { type: "string", description: "Only the technical observations supplied in the current incident. Do not explain why unobserved mechanisms failed." },
            memoryRelation: { type: "string", enum: ["same_mechanism", "none"], description: "same_mechanism when historical facts describe the same observed technical failure signature; the deeper cause need not yet be proven in the current incident. Similar symptoms alone are insufficient. Legitimate busy queries are not leaks; progressing overloaded consumers are not poison-record retries. Otherwise none." },
            historical: { type: "string", description: "If same_mechanism, describe the shared historical failure signature, keeping its deeper historical cause separate from the current unknowns, and retain exact supporting fact or source IDs. If none, return an empty string and evidenceIds=[]." },
            unverified: { type: "string", description: "The unknown deeper cause. Do not presuppose broken automation, configuration defects, or missing infrastructure." },
          } : { reasoning: { type: "string", description: "Separate Observed, Historical match (or none), and Unverified. Do not assert historical causes as current facts." } }),
          basis: { type: "string", enum: ["current_observations", "historical_memory"], description: "Use current_observations when logs or metrics indicate the failure directly, including measured capacity/throughput shortfall." },
          evidenceIds: { type: "array", ...(options.evidenceIds?.length === 0 ? { maxItems: 0 } : {}), items: { type: "string", ...(options.evidenceIds?.length ? { enum: options.evidenceIds } : {}) }, description: "Exact returned memory fact UUIDs or source document IDs supporting the same technical failure signature. Never log strings, dates or arbitrary titles. Retain relevant historical citations; use [] for unrelated history." },
        }, required: ["title", "basis", "evidenceIds", ...(options.review ? ["observed", "memoryRelation", "historical", "unverified"] : ["reasoning"])] } },
        checks: { type: "array", maxItems: 4, items: { type: "string" }, description: "Bounded read-only diagnostic steps. Unobserved architecture must be conditional (if present). No KEYS, deletion, unbounded scans or restarts." },
        avoid: { type: "array", maxItems: 2, items: { type: "string" }, description: "Relevant cautions without asserting an unverified mechanism or universal prohibition learned from a different incident." },
        missing: { type: "array", maxItems: 3, items: { type: "string" }, description: "Unknown observations to collect. Do not presuppose a defect, configuration error or absent architecture." },
      }, required: ["evidenceStatus", "summary", "hypotheses", "checks", "avoid", "missing"], anyOf: [
        { properties: { evidenceStatus: { const: "supported_hypothesis" }, hypotheses: { minItems: 1 } } },
        { properties: { evidenceStatus: { const: "insufficient_evidence" }, hypotheses: { maxItems: 0 } } },
      ] },
    });
    if (typeof data.text !== "string" || !data.text.trim()) throw new AppError("Hindsight did not return an investigation. Please retry.", 502);
    return data;
  }
}
