declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    HINDSIGHT_BASE_URL?: string;
    HINDSIGHT_API_KEY?: string;
    HINDSIGHT_BANK_ID?: string;
    WEBHOOK_SECRET?: string;
  }
}
