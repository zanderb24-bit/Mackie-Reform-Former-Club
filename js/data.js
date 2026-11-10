import { db, request } from "./supabase-client.js";
import { isDemo, profile } from "./auth.js";
import { demoData } from "./demo.js";
let demo = structuredClone(demoData);
const load = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem("mackie-demo-data"));
    if (saved) demo = saved;
  } catch {}
};
load();
const save = () =>
  sessionStorage.setItem("mackie-demo-data", JSON.stringify(demo));
export const data = {
  async list(table, query = "") {
    if (isDemo()) return structuredClone(demo[table] || []);
    return db.list(table, query);
  },
  async insert(table, row) {
    if (isDemo()) {
      const r = {
        ...row,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      demo[table].push(r);
      save();
      return [r];
    }
    return db.insert(table, row);
  },
  async update(table, id, row) {
    if (isDemo()) {
      const r = demo[table].find((r) => r.id === id);
      if (!r) throw new Error("Record not found");
      Object.assign(r, row, { updated_at: new Date().toISOString() });
      save();
      return [structuredClone(r)];
    }
    const rows = await db.update(table, id, row);
    if (!rows?.length)
      throw new Error("Change was not saved. Check your permissions.");
    return rows;
  },
  async remove(table, id) {
    if (isDemo()) {
      demo[table] = demo[table].filter((r) => r.id !== id);
      save();
      return;
    }
    return db.remove(table, id);
  },
  async saveProgramme(id, row, items) {
    if (isDemo()) {
      const [saved] = id
        ? await data.update("training_programmes", id, row)
        : await data.insert("training_programmes", {
            ...row,
            created_by: profile.id,
            archived: false,
          });
      await data.replaceItems(
        row.kind === "gym" ? "gym_programme_exercises" : "programme_drills",
        saved.id,
        items,
      );
      return saved;
    }
    return request("/rest/v1/rpc/save_programme", {
      method: "POST",
      body: { p_id: id || null, p_programme: row, p_items: items },
    });
  },
  async attendance(session_id, status) {
    if (isDemo()) {
      const existing = demo.training_attendance.find(
        (a) => a.session_id === session_id && a.player_id === profile.id,
      );
      if (existing) existing.status = status;
      else
        demo.training_attendance.push({
          id: crypto.randomUUID(),
          session_id,
          player_id: profile.id,
          status,
        });
      save();
      return;
    }
    await db.upsert(
      "training_attendance",
      { session_id, player_id: profile.id, status },
      "session_id,player_id",
    );
  },
  async replaceItems(table, programme_id, items) {
    if (isDemo()) {
      demo[table] = demo[table].filter((r) => r.programme_id !== programme_id);
      items.forEach((r) =>
        demo[table].push({ ...r, id: crypto.randomUUID(), programme_id }),
      );
      save();
      return;
    }
    await request("/rest/v1/rpc/replace_programme_items", {
      method: "POST",
      body: {
        p_programme: programme_id,
        p_items: items,
        p_kind: table === "programme_drills" ? "field" : "gym",
      },
    });
  },
};
export function visiblePosts(posts) {
  return posts
    .filter((p) => !p.expires_at || new Date(p.expires_at) > new Date())
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        new Date(b.created_at) - new Date(a.created_at),
    );
}
export async function uploadImage(file) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("Choose a JPEG, PNG or WebP image up to 5 MB.");
  if (isDemo())
    throw new Error("Image uploads require a connected Supabase project.");
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[
    file.type
  ];
  const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
  await request(`/storage/v1/object/bulletin-images/${path}`, {
    method: "POST",
    body: file,
    raw: true,
    headers: { "Content-Type": file.type },
  });
  return path;
}
export async function imageUrl(path) {
  if (!path) return "";
  if (isDemo()) return "";
  const r = await request(`/storage/v1/object/sign/bulletin-images/${path}`, {
    method: "POST",
    body: { expiresIn: 300 },
  });
  const { config } = await import("./config.js");
  return `${config.supabaseUrl}/storage/v1${r.signedURL}`;
}
