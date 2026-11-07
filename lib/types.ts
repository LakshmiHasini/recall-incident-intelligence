export type Resolution = { cause: string; fix: string; verification: string; prevention: string };
export type Incident = {
  id: string; title: string; service: string; environment: string; severity: string;
  status: string; description: string; logs: string; owner: string; revision: number;
  resolution: Resolution | null; createdAt: string; updatedAt: string; resolvedAt: string | null;
};
export type IncidentEvent = { id: string; kind: string; content: string; outcome: string | null; author: string; createdAt: string };
export type MemoryFact = { id: string; text: string; type?: string; context?: string; document_id?: string; metadata?: Record<string, string>; occurred_start?: string; tags?: string[] };
export type Investigation = {
  id: string; revision: number; createdAt: string;
  result: { text: string; facts: MemoryFact[]; basedOn: unknown; structured: { summary?: string; hypotheses?: { title: string; reasoning: string }[]; checks?: string[]; avoid?: string[]; missing?: string[] } | null; provider: string; durationMs: number };
};
export type MemoryJob = { id: string; incidentId: string; revision: number; documentId: string; status: string; attempts: number; lastError: string | null; updatedAt: string };
export type IncidentDetail = { incident: Incident; events: IncidentEvent[]; investigations: Investigation[]; jobs: MemoryJob[] };
export type ConnectionStatus = { configured: boolean; bankId: string | null; endpoint: string | null; webhookConfigured: boolean; missing: string[] };
