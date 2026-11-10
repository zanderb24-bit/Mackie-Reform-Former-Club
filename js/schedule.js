import { boot, heading, footer, showFatal } from "./navigation.js";
import { profile, isStaff, isAdmin } from "./auth.js";
import { data } from "./data.js";
import {
  $,
  $$,
  escapeHTML as h,
  icons,
  empty,
  badge,
  dateLabel,
  timeLabel,
  londonDay,
  londonToISO,
  weekStart,
  addDays,
  modal,
  field,
  area,
  select,
  toast,
  showError,
} from "./utils.js";
export const types = ["rugby", "gym", "meeting", "match", "recovery"];
let sessions = [],
  teams = [],
  people = [],
  attendance = [],
  cursor = new Date(),
  view = "month",
  typeFilter = "",
  teamFilter = "";
export async function loadSchedule() {
  [sessions, teams, people, attendance] = await Promise.all(
    ["training_sessions", "teams", "profiles", "training_attendance"].map((t) =>
      data.list(t),
    ),
  );
}
export function sessionButton(s) {
  return `<button class="mini-session ${h(s.type)} ${s.status === "cancelled" ? "cancelled-item" : ""}" data-session="${h(s.id)}">${s.status === "cancelled" ? "Cancelled · " : ""}${h(s.title)}<time>${h(timeLabel(s.starts_at))} · ${h(s.type)}</time></button>`;
}
export function bindSessions(root = document) {
  $$("[data-session]", root).forEach(
    (b) => (b.onclick = () => openSession(b.dataset.session).catch(showError)),
  );
}
export async function openSession(id) {
  if (!sessions.length) await loadSchedule();
  const s = sessions.find((r) => r.id === id);
  if (!s) throw new Error("Session no longer available.");
  const coach = people.find((p) => p.id === s.coach_id),
    team = teams.find((t) => t.id === s.team_id);
  const mine = attendance.find(
    (a) => a.session_id === id && a.player_id === profile.id,
  );
  const d = modal(
    s.title,
    `${badge(s.type)} ${s.status === "cancelled" ? badge("cancelled") : ""}<dl class="detail-list"><div><dt>Date</dt><dd>${h(dateLabel(s.starts_at, { weekday: "long", year: "numeric" }))}</dd></div><div><dt>Time · Europe/London</dt><dd>${h(timeLabel(s.starts_at))}–${h(timeLabel(s.ends_at))}</dd></div><div><dt>Location</dt><dd>${h(s.location)}</dd></div><div><dt>Team</dt><dd>${h(team?.name || "All senior teams")}</dd></div><div><dt>Coach / organiser</dt><dd>${h(coach?.display_name || "To be confirmed")}</dd></div><div><dt>Required equipment</dt><dd>${h(s.equipment || "None specified")}</dd></div></dl>${s.address ? `<p class="muted">${h(s.address)}</p><a class="external-link" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}">Get directions <i data-lucide="external-link"></i></a>` : ""}<div class="detail-section"><h3>Session plan</h3><p class="detail-description">${h(s.description || "No description provided.")}</p></div>${s.attendance_enabled && s.status !== "cancelled" ? `<div class="detail-section"><h3>Your attendance</h3><div class="attendance-buttons">${["attending", "not_attending", "unsure"].map((st) => `<button type="button" class="button secondary ${mine?.status === st ? "selected" : ""}" data-attendance="${st}">${h(st.replaceAll("_", " "))}</button>`).join("")}</div>${isStaff() ? `<p class="attendance-counts">${["attending", "not_attending", "unsure"].map((st) => `${attendance.filter((a) => a.session_id === id && a.status === st).length} ${st.replaceAll("_", " ")}`).join(" · ")}</p>` : ""}</div>` : ""}<p class="fine-print">Last updated ${h(dateLabel(s.updated_at, { hour: "2-digit", minute: "2-digit" }))}</p>${isStaff() ? `<div class="heading-actions"><button type="button" class="button secondary" id="edit-session"><i data-lucide="pencil"></i>Edit / reschedule</button><button type="button" class="button danger" id="cancel-session">${s.status === "cancelled" ? "Restore session" : "Cancel session"}</button>${isAdmin() ? '<button type="button" class="button danger" id="delete-session">Delete</button>' : ""}</div>` : ""}`,
  );
  $$("[data-attendance]", d).forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          b.disabled = true;
          await data.attendance(id, b.dataset.attendance);
          await loadSchedule();
          d.close();
          await openSession(id);
          toast("Attendance saved.");
        } catch (e) {
          showError(e);
          b.disabled = false;
        }
      }),
  );
  if (isStaff()) {
    $("#edit-session").onclick = () => {
      d.close();
      editSession(s);
    };
    $("#cancel-session").onclick = async () => {
      if (
        !confirm(
          `${s.status === "cancelled" ? "Restore" : "Cancel"} this session?`,
        )
      )
        return;
      try {
        await data.update("training_sessions", s.id, {
          status: s.status === "cancelled" ? "scheduled" : "cancelled",
        });
        await loadSchedule();
        d.close();
        if ($("#calendar-content")) renderCalendar();
        toast("Session updated.");
      } catch (e) {
        showError(e);
      }
    };
    if (isAdmin())
      $("#delete-session").onclick = async () => {
        if (
          !confirm(
            "Permanently delete this session and its attendance records?",
          )
        )
          return;
        try {
          await data.remove("training_sessions", id);
          await loadSchedule();
          d.close();
          renderCalendar();
          toast("Session deleted.");
        } catch (e) {
          showError(e);
        }
      };
  }
}
export function editSession(s = {}) {
  const day = s.starts_at ? londonDay(s.starts_at) : londonDay(cursor);
  modal(
    s.id ? "Edit training session" : "Create training session",
    `<div class="form-grid">${field("Session title", "title", s.title || "")}${select("Senior team", "team_id", [["", "All senior teams"], ...teams.map((t) => [t.id, t.name])], s.team_id || "")}${field("Date · Europe/London", "date", day, "date")}${select("Session type", "type", types, s.type || "rugby")}${field("Start time", "start", s.starts_at ? timeLabel(s.starts_at) : "19:00", "time")}${field("End time", "end", s.ends_at ? timeLabel(s.ends_at) : "20:30", "time")}${field("Location name", "location", s.location || "")}${field("Address", "address", s.address || "", "text", false)}${select(
      "Coach / organiser",
      "coach_id",
      people
        .filter((p) => p.approved && p.role !== "player")
        .map((p) => [p.id, p.display_name]),
      s.coach_id || profile.id,
    )}${field("Required equipment", "equipment", s.equipment || "", "text", false)}</div>${area("Description", "description", s.description || "")}<label class="inline-check"><input type="checkbox" name="attendance_enabled" ${s.attendance_enabled !== false ? "checked" : ""}> Allow attendance confirmations</label><p class="fine-print">Times use Europe/London, including daylight saving. Ambiguous clock-change times must be avoided.</p>`,
    async (f) => {
      if (!isStaff())
        throw new Error("Only coaching staff can manage sessions.");
      const starts_at = londonToISO(f.get("date"), f.get("start")),
        ends_at = londonToISO(f.get("date"), f.get("end"));
      if (ends_at <= starts_at)
        throw new Error("End time must be after start time on the same day.");
      const row = {
        title: f.get("title").trim(),
        team_id: f.get("team_id") || null,
        type: f.get("type"),
        starts_at,
        ends_at,
        location: f.get("location").trim(),
        address: f.get("address").trim(),
        coach_id: f.get("coach_id"),
        equipment: f.get("equipment").trim(),
        description: f.get("description").trim(),
        attendance_enabled: f.has("attendance_enabled"),
      };
      if (!row.title || !row.location)
        throw new Error("Enter a title and location.");
      if (s.id) await data.update("training_sessions", s.id, row);
      else
        await data.insert("training_sessions", {
          ...row,
          created_by: profile.id,
          status: "scheduled",
        });
      await loadSchedule();
      if ($("#calendar-content")) renderCalendar();
      toast("Training session saved.");
    },
  );
}
function filtered() {
  return sessions
    .filter(
      (s) =>
        (!typeFilter || s.type === typeFilter) &&
        (!teamFilter || !s.team_id || s.team_id === teamFilter),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
function renderCalendar() {
  const list = filtered(),
    start =
      view === "month"
        ? new Date(
            Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1, 12),
          )
        : weekStart(cursor);
  const label =
    view === "month"
      ? dateLabel(cursor, { month: "long", year: "numeric", day: undefined })
      : `${dateLabel(start)} – ${dateLabel(addDays(start, 6))}`;
  $("#calendar-title").textContent = label;
  $$("[data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
    b.setAttribute("aria-pressed", b.dataset.view === view);
  });
  const content = $("#calendar-content");
  if (view === "list") {
    const end = addDays(start, 7);
    const shown = list.filter(
      (s) =>
        londonDay(s.starts_at) >= londonDay(start) &&
        londonDay(s.starts_at) < londonDay(end),
    );
    content.className = "panel";
    content.innerHTML = `<div class="schedule-list">${shown.map((s) => `<button class="schedule-item" data-session="${h(s.id)}"><span class="schedule-date"><strong>${h(dateLabel(s.starts_at, { month: undefined }))}</strong><small>${h(dateLabel(s.starts_at, { day: undefined, month: "short" }))}</small></span><span class="schedule-info">${badge(s.type)} ${s.status === "cancelled" ? badge("cancelled") : ""}<strong>${h(s.title)}</strong><small>${h(timeLabel(s.starts_at))}–${h(timeLabel(s.ends_at))} · ${h(s.location)}</small></span><i data-lucide="chevron-right"></i></button>`).join("") || empty("No sessions this week. Try another date or filter.")}</div>`;
  } else {
    const first = view === "month" ? weekStart(start) : start;
    const days = view === "month" ? 42 : 7;
    content.className = "panel calendar-panel";
    content.innerHTML = `<div class="calendar-weekdays">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<span>${d}</span>`).join("")}</div><div class="month-grid">${Array.from(
      { length: days },
      (_, i) => {
        const day = addDays(first, i),
          key = londonDay(day);
        return `<div class="month-cell ${londonDay(new Date()) === key ? "today" : ""} ${view === "month" && day.getUTCMonth() !== cursor.getUTCMonth() ? "outside" : ""}"><span class="date-number">${day.getUTCDate()}</span>${list
          .filter((s) => londonDay(s.starts_at) === key)
          .map(sessionButton)
          .join("")}</div>`;
      },
    ).join("")}</div>`;
  }
  bindSessions(content);
  icons();
}
async function init() {
  if (!(await boot("schedule"))) return;
  try {
    await loadSchedule();
    $("#main").innerHTML =
      heading(
        "PLAN. PREPARE. PERFORM.",
        "Training Schedule",
        "Your week, organised. All session times are shown in Europe/London.",
        isStaff()
          ? '<button class="button primary" id="new-session"><i data-lucide="plus"></i>Add session</button>'
          : "",
      ) +
      `<div class="toolbar"><div class="calendar-heading"><button class="icon-btn" id="prev" aria-label="Previous period"><i data-lucide="chevron-left"></i></button><h2 id="calendar-title"></h2><button class="icon-btn" id="next" aria-label="Next period"><i data-lucide="chevron-right"></i></button><button class="button secondary" id="today">Today</button></div><span class="toolbar-spacer"></span><div class="segmented">${["month", "week", "list"].map((v) => `<button data-view="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join("")}</div><label><span class="sr-label">Session type</span><select id="type-filter"><option value="">All session types</option>${types.map((t) => `<option value="${t}">${t[0].toUpperCase() + t.slice(1)}</option>`).join("")}</select></label><label><span class="sr-label">Senior team</span><select id="team-filter"><option value="">All senior teams</option>${teams.map((t) => `<option value="${h(t.id)}">${h(t.name)}</option>`).join("")}</select></label></div><div id="calendar-content"></div>` +
      footer();
    $$("[data-view]").forEach(
      (b) =>
        (b.onclick = () => {
          view = b.dataset.view;
          renderCalendar();
        }),
    );
    const navigate = (n) => {
      if (view === "month")
        cursor = new Date(
          Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + n, 1, 12),
        );
      else cursor = addDays(cursor, n * 7);
      renderCalendar();
    };
    $("#prev").onclick = () => navigate(-1);
    $("#next").onclick = () => navigate(1);
    $("#today").onclick = () => {
      cursor = new Date();
      renderCalendar();
    };
    $("#type-filter").onchange = (e) => {
      typeFilter = e.target.value;
      renderCalendar();
    };
    $("#team-filter").onchange = (e) => {
      teamFilter = e.target.value;
      renderCalendar();
    };
    if (isStaff()) $("#new-session").onclick = () => editSession();
    renderCalendar();
  } catch (e) {
    showFatal(e);
  }
}
if (location.pathname.endsWith("schedule.html")) init();
