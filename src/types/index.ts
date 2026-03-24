export interface Env {
  KV: KVNamespace;
}

export type ApiPlan = "free" | "pro" | "agency";

export interface ApiKeyData {
  key_id: string;
  prefix: string;
  plan: ApiPlan;
  scopes: string[];
  status: "active" | "revoked";
  created_at: number;
  last_used_at?: number;
}
