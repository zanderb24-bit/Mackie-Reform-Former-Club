import { boot, heading, footer, showFatal } from "./navigation.js";
import { profile } from "./auth.js";
import { data, visiblePosts } from "./data.js";
import {
  loadSchedule,
  sessionButton,
  bindSessions,
  openSession,
} from "./schedule.js";
import { loadProgrammes, weeklyProgress } from "./programmes.js";
import { postCard } from "./bulletin.js";
import {
  $,
  $$,
  escapeHTML as h,
  icons,
  empty,
  badge,
  dateLabel,
  timeLabel,
  weekStart,
  addDays,
  londonDay,
  showError,
} from "./utils.js";
async function init() {
  if (!(await boot("dashboard"))) return;
  try {
    const [sessions, posts, people, s] = await Promise.all([
      data.list("training_sessions"),
      data.list("bulletin_posts"),
      data.list("profiles"),
      loadProgrammes(),
    ]);
    await loadSchedule();
    const next = sessions
      .filter(
        (s) => s.status !== "cancelled" && new Date(s.ends_at) > new Date(),
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    const week = weekStart(),
      end = addDays(week, 7);
    const weekly = sessions.filter(
      (s) =>
        londonDay(s.starts_at) >= londonDay(week) &&
        londonDay(s.starts_at) < londonDay(end),
    );
    const { assignments, complete, percent } = weeklyProgress(s);
    const completedGym = complete.filter(
      (a) =>
        s.training_programmes.find((p) => p.id === a.programme_id)?.kind ===
        "gym",
    ).length;
    const coach = next ? people.find((p) => p.id === next.coach_id) : null;
    $("#main").innerHTML =
      heading(
        "YOUR WEEK STARTS HERE",
        `Welcome back, ${profile.display_name.split(" ")[0]}.`,
        "Show up. Put in the work. Move the team forward.",
        `<a class="button secondary" href="schedule.html"><i data-lucide="calendar-days"></i>View Training Schedule</a>`,
      ) +
      `<section class="stats" aria-label="Your weekly overview">${[
        [
          "calendar-days",
          "Sessions this week",
          weekly.filter((s) => s.status !== "cancelled").length,
          "Training, matchday & recovery",
        ],
        [
          "dumbbell",
          "Gym sessions complete",
          completedGym,
          "From your saved activity records",
        ],
        [
          "clipboard-list",
          "Assigned programmes",
          assignments.length,
          "Your training plan for this week",
        ],
        [
          "trending-up",
          "Weekly progress",
          `${percent}%`,
          `${complete.length} of ${assignments.length} assigned activities complete`,
        ],
      ]
        .map(
          ([icon, label, value, note]) =>
            `<div class="stat-card"><div class="stat-top">${label}<i data-lucide="${icon}"></i></div><div class="stat-value">${value}</div><div class="stat-foot">${note}</div></div>`,
        )
        .join(
          "",
        )}</section><div class="dashboard-grid"><section class="panel"><div class="panel-head"><h2>Up next</h2><span class="eyebrow">YOUR NEXT SESSION</span></div>${next ? `<div class="hero-session">${badge(next.type)}<h2>${h(next.title)}</h2><div class="session-meta"><span><i data-lucide="calendar-days"></i>${h(dateLabel(next.starts_at, { weekday: "short" }))}</span><span><i data-lucide="clock-3"></i>${h(timeLabel(next.starts_at))}–${h(timeLabel(next.ends_at))}</span><span><i data-lucide="map-pin"></i>${h(next.location)}</span></div><p>${h(next.description || "Check the session details and get ready to train.")}</p><div class="session-meta" style="margin-bottom:18px"><span><i data-lucide="user-round"></i>Coach ${h(coach?.display_name || "to be confirmed")}</span></div><button class="button primary" id="next-session">Session details <i data-lucide="arrow-right"></i></button></div>` : empty("No upcoming sessions. Your coaches will add the next team session here.")}</section><section class="panel"><div class="panel-head"><h2>Your training progress</h2><a class="panel-link" href="programmes.html">View plan <i data-lucide="arrow-up-right"></i></a></div><div class="panel-body"><div class="progress-summary"><div class="progress-ring" style="--progress:${percent}%"><div><strong>${percent}%</strong><small>THIS WEEK</small></div></div><div><h3>${assignments.length ? "Keep building momentum." : "Your next chapter starts here."}</h3><p>${assignments.length ? `${complete.length} of ${assignments.length} activities completed.<br>Every session moves you forward.` : "Your coach can assign your weekly<br>training programme."}</p></div></div>${assignments
        .slice(0, 3)
        .map((a) => {
          const p = s.training_programmes.find((p) => p.id === a.programme_id);
          const done = complete.some((c) => c.id === a.id);
          return `<a class="programme-row" href="programmes.html?id=${encodeURIComponent(a.programme_id)}"><span class="square-icon"><i data-lucide="${done ? "check" : p?.kind === "gym" ? "dumbbell" : "footprints"}"></i></span><div><strong>${h(p?.title || "Training programme")}</strong><small>${p?.duration || 0} min · ${h(p?.category || "Training")}</small></div><span class="row-end">${done ? "Complete" : "To do"}</span></a>`;
        })
        .join(
          "",
        )}</div></section><section class="panel week-panel"><div class="panel-head"><h2>This week <span class="muted" style="font-size:11px;font-weight:400;margin-left:10px">${h(dateLabel(week))} – ${h(dateLabel(addDays(week, 6)))}</span></h2><div class="legend"><span>Rugby</span><span class="gym">Gym</span><span class="match">Match</span><span class="recovery">Recovery</span><span class="meeting">Meeting</span></div></div><div class="week-strip">${Array.from(
        { length: 7 },
        (_, i) => {
          const day = addDays(week, i),
            key = londonDay(day),
            daily = weekly.filter((s) => londonDay(s.starts_at) === key);
          return `<div class="week-day ${key === londonDay(new Date()) ? "today" : ""}"><div class="day-label">${h(dateLabel(day, { weekday: "short", day: undefined, month: undefined }))}<strong>${day.getUTCDate()}</strong></div>${daily.map(sessionButton).join("") || '<span class="rest-day">No scheduled activity</span>'}</div>`;
        },
      ).join(
        "",
      )}</div></section><section class="panel"><div class="panel-head"><h2>Latest club announcements</h2><a class="panel-link" href="bulletin.html">All posts <i data-lucide="arrow-up-right"></i></a></div><div class="panel-body">${
        visiblePosts(posts)
          .filter((p) =>
            [
              "club_announcements",
              "training_updates",
              "matchday_information",
            ].includes(p.category),
          )
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 3)
          .map((p) => postCard(p, people, true))
          .join("") || empty("No announcements yet.")
      }</div></section><section class="panel"><div class="panel-head"><h2>Your next workouts</h2><i data-lucide="activity" style="width:17px;color:var(--muted)"></i></div><div class="panel-body">${
        assignments
          .filter((a) => !complete.some((c) => c.id === a.id))
          .map((a) => {
            const p = s.training_programmes.find(
              (p) => p.id === a.programme_id,
            );
            return `<a class="programme-row" href="programmes.html?id=${encodeURIComponent(a.programme_id)}"><span class="square-icon"><i data-lucide="${p?.kind === "gym" ? "dumbbell" : "footprints"}"></i></span><div><strong>${h(p?.title)}</strong><small>${h(p?.objective)}</small></div><i data-lucide="chevron-right" class="row-end" style="width:15px"></i></a>`;
          })
          .join("") ||
        empty("You’re up to date. Check your programmes for more details.")
      }<div class="notice" style="margin-top:23px;margin-bottom:0"><strong>THE WORK ADDS UP.</strong><br>Prepare well, recover properly, and look out for the person beside you.</div></div></section></div>` +
      footer();
    if (next)
      $("#next-session").onclick = () => openSession(next.id).catch(showError);
    bindSessions();
    icons();
  } catch (e) {
    showFatal(e);
  }
}
init();
