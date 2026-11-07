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
    if (!response.ok) throw new AppError(response.status === 401 || response.status === 403 ? "Hindsight rejected the API credentials. Check the API key and bank permissions." : response.status === 429 ? "Hindsight is rate-limited or has insufficient credits. Check the account and retry." : `Hindsight returned HTTP ${response.status}. Check the bank ID and connection settings, then retry.`, 502);
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
  async reflect(query: string) {
    const data = await this.request(`${this.bankPath}/reflect`, { query, budget: "mid", max_tokens: 2200, include: { facts: {} }, response_schema: { type: "object", properties: { summary: { type: "string" }, hypotheses: { type: "array", items: { type: "object", properties: { title: { type: "string" }, reasoning: { type: "string" } }, required: ["title", "reasoning"] } }, checks: { type: "array", items: { type: "string" } }, avoid: { type: "array", items: { type: "string" } }, missing: { type: "array", items: { type: "string" } } }, required: ["summary", "hypotheses", "checks", "avoid", "missing"] } });
    if (typeof data.text !== "string" || !data.text.trim()) throw new AppError("Hindsight did not return an investigation. Please retry.", 502);
    return data;
  }
}
