import {
  configured,
  request,
  getSession,
  setSession,
  db,
} from "./supabase-client.js";
import { demoProfile } from "./demo.js";
export const isDemo = () =>
  !configured && sessionStorage.getItem("mackie-demo") === "yes";
export let profile = null;
export const isStaff = () => ["administrator", "coach"].includes(profile?.role);
export const isAdmin = () => profile?.role === "administrator";
export async function requireMember() {
  if (isDemo()) {
    profile = demoProfile;
    return profile;
  }
  if (!getSession()) {
    location.replace("login.html");
    return null;
  }
  const rows = await db.list("profiles", `id=eq.${getSession().user.id}`);
  profile = rows[0];
  if (!profile?.approved) {
    location.replace("login.html?pending=1");
    return null;
  }
  return profile;
}
export async function signIn(email, password) {
  const data = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  setSession({ ...data, expires_at: Date.now() / 1000 + data.expires_in });
  sessionStorage.removeItem("mackie-demo");
  location.href = "dashboard.html";
}
export async function signUp(email, password, display_name) {
  await request("/auth/v1/signup", {
    method: "POST",
    auth: false,
    body: { email, password, data: { display_name } },
  });
}
export async function signOut() {
  try {
    if (getSession()) await request("/auth/v1/logout", { method: "POST" });
  } finally {
    setSession(null);
    sessionStorage.removeItem("mackie-demo");
    location.href = "login.html";
  }
}
