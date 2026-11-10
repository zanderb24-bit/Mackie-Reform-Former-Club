import { config } from "./config.js";
export const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
const key = "mackie-session";
let session;
try {
  session = JSON.parse(sessionStorage.getItem(key) || "null");
} catch {
  session = null;
}
export const getSession = () => session;
export function setSession(value) {
  session = value;
  if (value) sessionStorage.setItem(key, JSON.stringify(value));
  else sessionStorage.removeItem(key);
}
let refreshing;
async function refresh() {
  if (!session?.refresh_token) return;
  if (!refreshing)
    refreshing = fetch(
      `${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: config.supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      },
    )
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setSession(null);
          throw new Error("Your session has expired. Please sign in again.");
        }
        setSession({
          ...data,
          expires_at: Date.now() / 1000 + data.expires_in,
        });
      })
      .finally(() => (refreshing = null));
  await refreshing;
}
export async function request(
  path,
  { method = "GET", body, headers = {}, auth = true, raw = false } = {},
) {
  if (!configured)
    throw new Error("Connect a Supabase project first. See README.md.");
  if (auth && session && session.expires_at < Date.now() / 1000 + 60)
    await refresh();
  const response = await fetch(`${config.supabaseUrl}${path}`, {
    method,
    headers: {
      apikey: config.supabaseAnonKey,
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : config.supabaseAnonKey.startsWith("eyJ")
          ? { Authorization: `Bearer ${config.supabaseAnonKey}` }
          : {}),
      ...(!raw ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok)
    throw new Error(
      data?.msg ||
        data?.message ||
        data?.error_description ||
        `Request failed (${response.status})`,
    );
  return data;
}
export const db = {
  async list(table, query = "") {
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await request(
        `/rest/v1/${table}?select=*&order=id&${query}&limit=1000&offset=${offset}`,
      );
      rows.push(...page);
      if (page.length < 1000) return rows;
    }
  },
  insert: (table, row) =>
    request(`/rest/v1/${table}`, {
      method: "POST",
      body: row,
      headers: { Prefer: "return=representation" },
    }),
  update: (table, id, row) =>
    request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: row,
      headers: { Prefer: "return=representation" },
    }),
  async remove(table, id) {
    const rows = await request(
      `/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE", headers: { Prefer: "return=representation" } },
    );
    if (!rows?.length)
      throw new Error("Record was not deleted. Check your permissions.");
    return rows;
  },
  upsert: (table, row, conflict) =>
    request(`/rest/v1/${table}?on_conflict=${conflict}`, {
      method: "POST",
      body: row,
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    }),
};
