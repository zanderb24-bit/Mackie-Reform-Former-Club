import { boot, heading, footer, showFatal, initials } from "./navigation.js";
import { profile, isStaff, isAdmin, isDemo } from "./auth.js";
import { data, visiblePosts, uploadImage, imageUrl } from "./data.js";
import {
  $,
  $$,
  escapeHTML as h,
  icons,
  empty,
  badge,
  dateLabel,
  modal,
  field,
  area,
  select,
  safeUrl,
  toast,
  showError,
  londonDay,
  londonToISO,
} from "./utils.js";
export const categories = [
  ["club_announcements", "Club Announcements"],
  ["training_updates", "Training Updates"],
  ["matchday_information", "Matchday Information"],
  ["social_events", "Social Events"],
  ["equipment", "Equipment"],
  ["general_discussion", "General Discussion"],
];
let posts = [],
  people = [],
  category = "",
  search = "",
  sort = "pinned";
export const canModerate = (p) =>
  isAdmin() ||
  p.author_id === profile.id ||
  (profile.role === "coach" &&
    ["training_updates", "matchday_information"].includes(p.category));
export const canEdit = (p) => canModerate(p);
async function load() {
  [posts, people] = await Promise.all([
    data.list("bulletin_posts"),
    data.list("profiles"),
  ]);
}
export function postCard(p, people, compact = false) {
  const author = people.find((a) => a.id === p.author_id);
  if (compact)
    return `<article class="announcement-row">${badge(p.category, categories.find((c) => c[0] === p.category)?.[1] || p.category)}<h3><a href="bulletin.html?post=${encodeURIComponent(p.id)}">${h(p.title)}</a></h3><p>${h(p.message)}</p><div class="post-meta"><span class="avatar">${h(initials(author?.display_name))}</span>${h(author?.display_name || "Club member")}<span>·</span>${h(dateLabel(p.created_at))}</div></article>`;
  return `<article class="panel post-card ${p.pinned ? "pinned" : ""}" id="post-${h(p.id)}"><div class="post-top">${badge(p.category, categories.find((c) => c[0] === p.category)?.[1] || p.category)}${p.pinned ? '<span class="pin-label"><i data-lucide="pin"></i>Pinned announcement</span>' : ""}</div><h2>${h(p.title)}</h2><p class="post-message">${h(p.message)}</p>${p.image_path ? `<div data-post-image="${h(p.id)}"></div>` : ""}${safeUrl(p.external_url) ? `<a class="external-link" href="${h(safeUrl(p.external_url))}" target="_blank" rel="noopener noreferrer">View linked information <i data-lucide="external-link"></i></a>` : ""}<div class="post-bottom"><div class="post-meta"><span class="avatar">${h(initials(author?.display_name))}</span><span>${h(author?.display_name || "Club member")} · ${h(dateLabel(p.created_at))}${p.updated_at !== p.created_at ? " · edited " + h(dateLabel(p.updated_at)) : ""}${p.expires_at ? " · expires " + h(dateLabel(p.expires_at)) : ""}</span></div><div class="post-actions">${canEdit(p) ? `<button class="icon-btn" data-edit-post="${h(p.id)}" aria-label="Edit ${h(p.title)}"><i data-lucide="pencil"></i></button>` : ""}${isAdmin() ? `<button class="icon-btn" data-pin-post="${h(p.id)}" aria-label="${p.pinned ? "Unpin" : "Pin"} ${h(p.title)}"><i data-lucide="pin"></i></button>` : ""}${canModerate(p) ? `<button class="icon-btn" data-delete-post="${h(p.id)}" aria-label="Delete ${h(p.title)}"><i data-lucide="trash-2"></i></button>` : ""}</div></div></article>`;
}
async function render() {
  let shown = visiblePosts(posts).filter(
    (p) =>
      (!category || p.category === category) &&
      `${p.title} ${p.message}`.toLowerCase().includes(search),
  );
  if (sort === "newest")
    shown.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  $("#posts").innerHTML =
    shown.map((p) => postCard(p, people)).join("") ||
    empty(
      "No posts match your filters. Start a conversation with your teammates.",
    );
  $$("[data-category]").forEach((b) => {
    b.classList.toggle("active", b.dataset.category === category);
    b.setAttribute("aria-pressed", b.dataset.category === category);
  });
  $$("[data-edit-post]").forEach(
    (b) =>
      (b.onclick = () =>
        editPost(posts.find((p) => p.id === b.dataset.editPost))),
  );
  $$("[data-delete-post]").forEach(
    (b) =>
      (b.onclick = async () => {
        const p = posts.find((p) => p.id === b.dataset.deletePost);
        if (
          !canModerate(p) ||
          !confirm(`Delete “${p.title}”? This cannot be undone.`)
        )
          return;
        try {
          await data.remove("bulletin_posts", p.id);
          await load();
          await render();
          toast("Post deleted.");
        } catch (e) {
          showError(e);
        }
      }),
  );
  $$("[data-pin-post]").forEach(
    (b) =>
      (b.onclick = async () => {
        const p = posts.find((p) => p.id === b.dataset.pinPost);
        try {
          await data.update("bulletin_posts", p.id, { pinned: !p.pinned });
          await load();
          await render();
          toast("Pinned status saved.");
        } catch (e) {
          showError(e);
        }
      }),
  );
  icons();
  for (const el of $$("[data-post-image]")) {
    const p = posts.find((p) => p.id === el.dataset.postImage);
    try {
      const url = await imageUrl(p.image_path);
      if (url) {
        const img = document.createElement("img");
        img.src = url;
        img.alt = `Attachment for ${p.title}`;
        img.className = "post-image";
        img.loading = "lazy";
        el.append(img);
      }
    } catch {
      el.textContent = "Attachment could not be loaded.";
    }
  }
}
function editPost(p = {}) {
  if (p.id && !canEdit(p)) return;
  const allowed = isAdmin()
    ? categories
    : profile.role === "coach"
      ? categories.filter((c) =>
          [
            "training_updates",
            "matchday_information",
            "general_discussion",
          ].includes(c[0]),
        )
      : categories.filter((c) => c[0] === "general_discussion");
  if (p.category && !allowed.some((c) => c[0] === p.category))
    allowed.push(categories.find((c) => c[0] === p.category));
  modal(
    p.id ? "Edit bulletin post" : "Create bulletin post",
    `${field("Title", "title", p.title || "")}${select("Category", "category", allowed, p.category || allowed[0][0])}${area("Message", "message", p.message || "", true)}${field("External link (optional)", "external_url", p.external_url || "", "url", false)}${field("Expiration date (optional, end of London day)", "expires", p.expires_at ? londonDay(p.expires_at) : "", "date", false)}<label>Image attachment (JPEG, PNG, WebP · maximum 5 MB)<input type="file" name="image" accept="image/jpeg,image/png,image/webp" ${isDemo() ? "disabled" : ""}></label>${isDemo() ? '<p class="fine-print">Image uploads are available after connecting Supabase.</p>' : ""}${p.image_path ? '<label class="inline-check"><input type="checkbox" name="remove_image">Remove current attachment</label>' : ""}${isAdmin() ? `<label class="inline-check"><input type="checkbox" name="pinned" ${p.pinned ? "checked" : ""}>Pin announcement</label>` : ""}`,
    async (f) => {
      if (p.id && !canEdit(p)) throw new Error("You cannot edit this post.");
      const row = {
        title: f.get("title").trim(),
        message: f.get("message").trim(),
        category: f.get("category"),
        external_url: f.get("external_url").trim(),
        expires_at: f.get("expires")
          ? londonToISO(f.get("expires"), "23:59")
          : null,
      };
      if (
        !row.title ||
        row.title.length > 160 ||
        !row.message ||
        row.message.length > 10000
      )
        throw new Error(
          "Use a title up to 160 characters and a message up to 10,000 characters.",
        );
      if (row.external_url && !safeUrl(row.external_url))
        throw new Error("Use an HTTP or HTTPS external link.");
      if (row.expires_at && new Date(row.expires_at) <= new Date())
        throw new Error("Expiration must be in the future.");
      if (isAdmin()) row.pinned = f.has("pinned");
      const file = f.get("image");
      if (file?.size) row.image_path = await uploadImage(file);
      else if (f.has("remove_image")) row.image_path = null;
      if (p.id) await data.update("bulletin_posts", p.id, row);
      else
        await data.insert("bulletin_posts", {
          ...row,
          author_id: profile.id,
          pinned: row.pinned || false,
        });
      await load();
      await render();
      toast("Post saved.");
    },
    p.id ? "Save post" : "Publish post",
  );
}
async function init() {
  if (!(await boot("bulletin"))) return;
  try {
    await load();
    $("#main").innerHTML =
      heading(
        "STAY IN THE LOOP",
        "Club Bulletin Board",
        "Team updates, matchday details and the conversations that keep us connected.",
        '<button class="button primary" id="new-post"><i data-lucide="plus"></i>Create post</button>',
      ) +
      `<div class="bulletin-layout"><aside><div class="section-label muted" style="margin-bottom:15px">Categories</div><nav class="category-nav" aria-label="Post categories"><button data-category="">All posts</button>${categories.map(([id, label]) => `<button data-category="${id}">${label}</button>`).join("")}</nav></aside><section><div class="toolbar"><label class="search"><span class="sr-label">Search bulletin posts</span><input type="search" placeholder="Search the bulletin board…" id="post-search"></label><label><span class="sr-label">Sort posts</span><select id="post-sort"><option value="pinned">Pinned, then newest</option><option value="newest">Newest first</option></select></label></div><div class="posts" id="posts"></div></section></div>` +
      footer();
    $("#new-post").onclick = () => editPost();
    $$("[data-category]").forEach(
      (b) =>
        (b.onclick = () => {
          category = b.dataset.category;
          render();
        }),
    );
    $("#post-search").oninput = (e) => {
      search = e.target.value.toLowerCase();
      render();
    };
    $("#post-sort").onchange = (e) => {
      sort = e.target.value;
      render();
    };
    await render();
    const id = new URLSearchParams(location.search).get("post");
    if (id)
      document
        .getElementById(`post-${id}`)
        ?.scrollIntoView({ block: "center" });
  } catch (e) {
    showFatal(e);
  }
}
if (location.pathname.endsWith("bulletin.html")) init();
