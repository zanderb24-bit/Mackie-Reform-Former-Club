import { requireMember, profile, isDemo, isAdmin, signOut } from "./auth.js";
import { $, escapeHTML, icons, dateLabel, empty } from "./utils.js";
export const initials = (name) =>
  (name || "Member")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export async function boot(active) {
  try {
    const p = await requireMember();
    if (!p) return false;
    const nav = [
      ["dashboard", "layout-dashboard", "Overview"],
      ["schedule", "calendar-days", "Training Schedule"],
      ["programmes", "dumbbell", "Training Programmes"],
      ["bulletin", "messages-square", "Club Bulletin Board"],
      ...(isAdmin() ? [["admin", "users", "Administration"]] : []),
    ];
    $("#shell").innerHTML =
      `<aside class="sidebar" id="sidebar"><a class="brand" href="dashboard.html"><img src="assets/icons/crest.svg" alt="Club logo placeholder"><div>MACKIE RUGBY<small>PLAYER HUB</small></div></a><span class="eyebrow">YOUR CLUB. YOUR PERFORMANCE.</span><nav aria-label="Main navigation">${nav.map(([id, icon, label]) => `<a class="nav-link ${active === id ? "active" : ""}" href="${id}.html" ${active === id ? 'aria-current="page"' : ""}><i data-lucide="${icon}"></i>${label}</a>`).join("")}</nav><div class="sidebar-bottom"><div class="club-note"><strong>TOGETHER, WE GO FURTHER.</strong>Work hard. Back your teammates.<br>Represent the badge.</div><div class="user-card"><span class="avatar">${escapeHTML(initials(p.display_name))}</span><div><strong>${escapeHTML(p.display_name)}</strong><small>${isDemo() ? "Demo player" : escapeHTML(p.role)}</small></div><button class="icon-btn" id="sign-out" aria-label="Sign out"><i data-lucide="log-out"></i></button></div></div></aside><header class="topbar"><div class="topbar-left"><button class="icon-btn mobile-menu" id="menu-toggle" aria-label="Open navigation" aria-expanded="false"><i data-lucide="menu"></i></button>Mackie Rugby <span class="muted">/</span> <strong>Senior Player Hub</strong></div><div class="topbar-right"><span class="topbar-date">${dateLabel(new Date(), { weekday: "long", year: "numeric" })}</span><button class="icon-btn" id="theme-toggle" aria-label="Toggle light or dark mode"><i data-lucide="sun-moon"></i></button><span class="avatar" aria-label="${escapeHTML(p.display_name)}">${escapeHTML(initials(p.display_name))}</span></div></header>`;
    document.body.classList.toggle(
      "light",
      localStorage.getItem("mackie-theme") === "light",
    );
    $("#theme-toggle").onclick = () => {
      document.body.classList.toggle("light");
      localStorage.setItem(
        "mackie-theme",
        document.body.classList.contains("light") ? "light" : "dark",
      );
    };
    $("#sign-out").onclick = () => signOut().catch(showFatal);
    $("#menu-toggle").onclick = (e) => {
      e.stopPropagation();
      const open = $("#sidebar").classList.toggle("open");
      $("#menu-toggle").setAttribute("aria-expanded", open);
    };
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#sidebar") && !e.target.closest("#menu-toggle")) {
        $("#sidebar").classList.remove("open");
        $("#menu-toggle").setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        $("#sidebar").classList.remove("open");
        $("#menu-toggle").setAttribute("aria-expanded", "false");
      }
    });
    icons();
    return true;
  } catch (e) {
    showFatal(e);
    return false;
  }
}
export const banner = () =>
  isDemo()
    ? `<div class="demo-banner"><i data-lucide="flask-conical"></i><span><strong>DEMONSTRATION MODE</strong> · Sample teams, times and locations only. Changes last in this tab and are not shared club records.</span></div>`
    : "";
export const heading = (kicker, title, subtitle, actions = "") =>
  `${banner()}<div class="page-heading"><div><span class="eyebrow">${escapeHTML(kicker)}</span><h1>${escapeHTML(title)}</h1><p>${escapeHTML(subtitle)}</p></div><div class="heading-actions">${actions}</div></div>`;
export const footer = () =>
  `<footer class="footer-note"><span>MACKIE RUGBY · SENIOR PLAYER HUB</span><span>Built for the work behind the performance.</span></footer>`;
export function showFatal(err) {
  $("#main").innerHTML =
    empty(err.message) +
    `<p style="text-align:center"><a class="button secondary" href="login.html">Return to sign in</a> <button class="button secondary" onclick="location.reload()">Try again</button></p>`;
  icons();
}
