/* Cloudflare Workers 运行时类型的最小子集（避免引入额外依赖；编辑器提示用） */
declare abstract class D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ results?: unknown[]; success: boolean; meta?: unknown }>;
}
declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T>;
}
declare interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta?: { changes?: number; duration?: number; last_row_id?: number };
}
declare abstract class KVNamespace {
  get(key: string, options?: { type?: "text" | "json" }): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}
declare interface PagesFunctionEnv {
  [key: string]: unknown;
}
declare type PagesFunction<E = Record<string, unknown>, C = Record<string, unknown>> = (context: {
  request: Request;
  env: E;
  params: Record<string, string | string[]>;
  data: C;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
}) => Promise<Response> | Response;
