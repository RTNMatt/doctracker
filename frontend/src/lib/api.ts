import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import type { AxiosHeaders } from "axios";
// Dev org (used by OrgMiddleware when there is no subdomain)
const DEV_ORG = import.meta.env.VITE_DEV_ORG_SLUG ?? "default";

/**
 * Single axios client for the app.
 * - Uses Vite proxy: baseURL "/api"
 * - Sends cookies (HttpOnly JWT)
 * - Injects X-Org-Slug in local dev (unless caller overrides)
 * - Auto-refreshes on 401 once, then retries original request
 */
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

// ---------- Request interceptor: inject org header in local dev ----------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const isLocal =
    typeof window !== "undefined" &&
    /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(window.location.host);

  if (isLocal && DEV_ORG) {
    const h = config.headers;

    // Check if the header is already present (supports both AxiosHeaders and plain object)
    const alreadySet =
      (h && typeof (h as AxiosHeaders).get === "function"
        ? (h as AxiosHeaders).get("X-Org-Slug")
        : (h as any)?.["X-Org-Slug"]) != null;

    if (!alreadySet) {
      if (h && typeof (h as AxiosHeaders).set === "function") {
        // Axios v1 style: use the mutating setter on AxiosHeaders
        (h as AxiosHeaders).set("X-Org-Slug", DEV_ORG);
      } else {
        // Fallback: assign a plain object with the header merged in
        config.headers = { ...(h as any ?? {}), "X-Org-Slug": DEV_ORG } as any;
      }
    }
  }

  return config;
});

// ---------- Response interceptor: one-shot refresh on 401 ----------
// --- Refresh/retry single-flight state ---
let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;
const refreshWaiters: Array<() => void> = [];

function notifyWaiters() {
  refreshWaiters.splice(0).forEach((fn) => fn());
}

// Call /auth/refresh once; others await the same promise
async function refreshSessionOnce() {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      await api.post("/auth/refresh/", null, { withCredentials: true });
    } finally {
      isRefreshing = false;
      const p = refreshPromise;
      refreshPromise = null;
      notifyWaiters();
      await p; // settle
    }
  })();
  return refreshPromise;
}

// Helper to wait until current refresh finishes
function waitForRefresh(): Promise<void> {
  if (!isRefreshing || !refreshPromise) return Promise.resolve();
  return new Promise((res) => refreshWaiters.push(res));
}

// --- 401 handler: try refresh then retry original request once ---
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error || {};
    const status = response?.status;

    // Non-HTTP or not 401 -> pass through
    if (!status || status !== 401 || !config || config.__isRetry) {
      return Promise.reject(error);
    }

    try {
      await refreshSessionOnce();
      await waitForRefresh();

      // Retry original request exactly once
      const retryCfg = { ...config, __isRetry: true };
      return api.request(retryCfg);
    } catch (e) {
      // Refresh failed -> hard logout path (frontend state reset happens in AuthContext)
      return Promise.reject(error);
    }
  }
);

// ---------- Helper to tweak org header globally at runtime (optional) ----------
export function setOrgHeader(slug: string | null) {
  const h = (api.defaults.headers.common as Record<string, string>);
  if (slug) h["X-Org-Slug"] = slug;
  else delete h["X-Org-Slug"];
}

// ---------- API calls ----------
export const login = (u: string, p: string) =>
  api.post(
    "/auth/login/",
    { username: String(u ?? "").trim(), password: String(p ?? "") },
    { headers: { "Content-Type": "application/json" } }
  );

export const logout = () => api.post("/auth/logout/");

export const me = () => api.get("/auth/me/");

export const getTiles = () => api.get("/tiles/");



// ---------- Tags ----------
export const listTags = () => api.get("/tags/");

export const createTag = (payload: any) => api.post("/tags/", payload);

export const setDocumentTags = (docId: number, tagIds: number[]) =>
  api.post(`/documents/${docId}/set_tags/`, { tag_ids: tagIds });

// ---------- Collections ----------
export const listCollections = () => api.get("/collections/");

export const setDocumentCollections = (docId: number, collectionIds: number[]) =>
  api.post(`/documents/${docId}/set_collections/`, { collection_ids: collectionIds });

// ---------- Sections ----------
export const reorderDocumentSections = (docId: number, sectionIds: number[]) =>
  api.post(`/documents/${docId}/reorder_sections/`, { section_ids: sectionIds });

// ---------- Documents ----------
export async function listDocuments() {
  const res = await api.get("/documents/");
  const data = res.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

// ---------- Departments ----------
export async function listDepartments() {
  const res = await api.get("/departments/");
  const data = res.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

// lib/api.ts – add below existing exports
export type DocumentStatus = "draft" | "published" | "archived";

export async function listTemplates() {
  const res = await api.get("/templates/");
  // Your API returns plain arrays or {results: []} in some cases, so normalize
  const data = res.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}



export async function createDocument(payload: {
  title: string;
  everyone: boolean;
  status: DocumentStatus;
  template?: number | null;
  departments?: number[];
}) {
  // Note: tags, sections, links are NOT sent here.
  // tags are read-only on DocumentSerializer, and sections/links are child models.
  const res = await api.post("/documents/", payload);
  return res.data;
}


// ---------- Profiles ----------
export async function getProfile(userId?: number) {
  const url = userId ? `/profiles/${userId}/` : "/profiles/me/";
  const res = await api.get(url);
  return res.data;
}

export async function updateProfile(data: FormData) {
  const res = await api.patch("/profiles/me/", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function listUserDocuments(userId: number) {
  const res = await api.get(`/documents/?created_by=${userId}`);
  const data = res.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

export async function listUserCollections(userId: number) {
  const res = await api.get(`/collections/?created_by=${userId}`);
  const data = res.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}
