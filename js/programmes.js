import { boot, heading, footer, showFatal } from "./navigation.js";
import { profile, isStaff } from "./auth.js";
import { data } from "./data.js";
import {
  $,
  $$,
  escapeHTML as h,
  icons,
  empty,
  badge,
  modal,
  field,
  area,
  select,
  safeUrl,
  toast,
  showError,
  londonDay,
  weekStart,
} from "./utils.js";
import { startWorkout, showHistory } from "./gym-tracker.js";
export const fieldCategories = [
  "Speed and acceleration",
  "Agility and footwork",
  "Defensive structure",
  "Attacking structure",
  "Handling and passing",
  "Contact technique",
  "Conditioning",
  "Position-specific development",
];
export const gymCategories = [
  "Upper-body strength",
  "Lower-body strength",
  "Full-body strength",
  "Power and explosiveness",
  "Conditioning",
  "Mobility and recovery",
];
let state = {},
  tab = "gym",
  search = "",
  archived = false;
export async function loadProgrammes() {
  const names = [
    "training_programmes",
    "training_drills",
    "programme_drills",
    "gym_exercises",
    "gym_programme_exercises",
    "programme_assignments",
    "teams",
    "profiles",
    "team_memberships",
    "workout_logs",
  ];
  const values = await Promise.all(names.map((t) => data.list(t)));
  state = Object.fromEntries(names.map((t, i) => [t, values[i]]));
  return state;
}
export function ownAssignments(s = state) {
  const teamIds = s.team_memberships
    .filter((m) => m.profile_id === profile.id)
    .map((m) => m.team_id);
  return s.programme_assignments.filter(
    (a) => a.player_id === profile.id || teamIds.includes(a.team_id),
  );
}
export function weeklyProgress(s = state) {
  const week = londonDay(weekStart());
  const assignments = ownAssignments(s).filter(
    (a) =>
      a.week_of === week &&
      s.training_programmes.some((p) => p.id === a.programme_id && !p.archived),
  );
  const complete = assignments.filter((a) =>
    s.workout_logs.some(
      (l) =>
        l.assignment_id === a.id &&
        l.player_id === profile.id &&
        l.completed_at,
    ),
  );
  return {
    assignments,
    complete,
    percent: assignments.length
      ? Math.round((complete.length / assignments.length) * 100)
      : 0,
  };
}
export async function openProgramme(id) {
  if (!state.training_programmes) await loadProgrammes();
  const p = state.training_programmes.find((p) => p.id === id);
  if (!p) throw new Error("Programme unavailable.");
  const assignments = ownAssignments()
    .filter((a) => a.programme_id === id)
    .sort((a, b) => b.week_of.localeCompare(a.week_of));
  const assignment =
    assignments.find((a) => a.week_of === londonDay(weekStart())) ||
    assignments[0];
  const items =
    p.kind === "gym"
      ? state.gym_programme_exercises.filter((e) => e.programme_id === id)
      : state.programme_drills.filter((e) => e.programme_id === id);
  items.sort((a, b) => a.position - b.position);
  const d = modal(
    p.title,
    `${badge(p.kind)} ${p.archived ? badge("cancelled", "Archived") : ""}<p class="detail-description" style="margin-top:18px">${h(p.objective)}</p><dl class="detail-list"><div><dt>Category</dt><dd>${h(p.category)}</dd></div><div><dt>Difficulty</dt><dd>${h(p.difficulty)}</dd></div><div><dt>Estimated duration</dt><dd>${p.duration} minutes</dd></div><div><dt>Equipment</dt><dd>${h(p.equipment || "None specified")}</dd></div></dl><div class="detail-section"><h3>Coaching instructions</h3><p class="detail-description">${h(p.instructions)}</p></div>${
      items
        .map((item) => {
          const e =
            p.kind === "gym"
              ? state.gym_exercises.find((e) => e.id === item.exercise_id)
              : state.training_drills.find((e) => e.id === item.drill_id);
          if (!e) return "";
          return `<details class="exercise" open><summary><strong>${h(e.name)}</strong></summary><p style="margin-top:10px">${h(p.kind === "gym" ? e.instructions : e.description)}</p><p>${p.kind === "gym" ? `${item.sets} sets × ${item.reps} reps · ${h(item.target)} · ${item.rest_seconds}s rest` : `${e.duration} min · ${h(e.sets_reps || "")}<br>${h(e.coaching_points || "")}<br>Equipment: ${h(e.equipment || "None")}`}</p>${safeUrl(e.video_url) ? `<a class="external-link" href="${h(safeUrl(e.video_url))}" target="_blank" rel="noopener noreferrer">Watch demonstration <i data-lucide="external-link"></i></a>` : ""}${safeUrl(e.diagram_url) ? `<a class="external-link" href="${h(safeUrl(e.diagram_url))}" target="_blank" rel="noopener noreferrer">View drill diagram <i data-lucide="image"></i></a>` : ""}</details>`;
        })
        .join("") || empty("No exercises or drills have been added.")
    }<div class="detail-section"><h3>Coaching notes</h3><p class="detail-description">${h(p.notes || "No additional notes.")}</p></div>${assignment && !p.archived ? `<div class="notice">Assigned week of ${h(assignment.week_of)}. ${state.workout_logs.some((l) => l.assignment_id === assignment.id && l.player_id === profile.id && l.completed_at) ? "Completed — you can log another session." : ""}</div><button type="button" class="button primary" id="start-workout">${p.kind === "gym" ? "Start / resume workout" : "Start / complete field session"}</button>` : `<p class="notice">${p.archived ? "This programme is archived." : "No personal or team assignment. Ask your coach to assign this programme."}</p>`}<button type="button" class="button secondary" id="workout-history">Workout history</button>${isStaff() ? `<div class="detail-section heading-actions"><button type="button" class="button secondary" id="edit-programme">Edit programme</button><button type="button" class="button secondary" id="duplicate-programme">Duplicate</button><button type="button" class="button secondary" id="assign-programme">Assign</button><button type="button" class="button danger" id="archive-programme">${p.archived ? "Restore" : "Archive"}</button></div>` : ""}`,
  );
  if (assignment && !p.archived) {
    $("#start-workout").onclick = () => {
      d.close();
      startWorkout(p, assignment, state, async () => {
        await loadProgrammes();
        if ($("#programme-grid")) renderCards();
      });
    };
  }
  $("#workout-history").onclick = () => {
    d.close();
    showHistory(p, state).catch(showError);
  };
  if (isStaff()) {
    $("#edit-programme").onclick = () => {
      d.close();
      editProgramme(p);
    };
    $("#assign-programme").onclick = () => {
      d.close();
      assignProgramme(p);
    };
    $("#archive-programme").onclick = async () => {
      if (!confirm(`${p.archived ? "Restore" : "Archive"} this programme?`))
        return;
      try {
        await data.update("training_programmes", id, { archived: !p.archived });
        await refresh();
        d.close();
        toast("Programme updated.");
      } catch (e) {
        showError(e);
      }
    };
    $("#duplicate-programme").onclick = async () => {
      try {
        const { id: oldId, created_at, updated_at, ...copy } = p;
        await data.saveProgramme(
          null,
          {
            ...copy,
            title: `${p.title} (copy)`,
            created_by: profile.id,
            archived: false,
          },
          items.map(
            ({ id, programme_id, created_at, updated_at, ...rest }) => rest,
          ),
        );
        await refresh();
        d.close();
        toast("Programme duplicated.");
      } catch (e) {
        showError(e);
      }
    };
  }
}
async function refresh() {
  await loadProgrammes();
  if ($("#programme-grid")) renderCards();
}
function gymItem(item = {}) {
  return `<div class="repeater-item"><div class="form-grid">${select(
    "Exercise",
    "exercise_id",
    state.gym_exercises.map((e) => [e.id, e.name]),
    item.exercise_id,
  )}${field("Sets", "sets", item.sets || 3, "number")}${field("Repetitions", "reps", item.reps || 8, "number")}${field("Target weight / intensity", "target", item.target || "RPE 7")}${field("Rest (seconds)", "rest_seconds", item.rest_seconds ?? 90, "number")}</div><button type="button" class="text-button remove-item">Remove exercise</button></div>`;
}
export function editProgramme(p = { kind: tab }) {
  const gym = p.kind === "gym",
    items = gym
      ? state.gym_programme_exercises
          .filter((e) => e.programme_id === p.id)
          .sort((a, b) => a.position - b.position)
      : state.programme_drills.filter((e) => e.programme_id === p.id);
  const d = modal(
    p.id ? "Edit programme" : `New ${gym ? "gym" : "on-field"} programme`,
    `<div class="form-grid">${field("Programme title", "title", p.title || "")}${select("Category", "category", gym ? gymCategories : fieldCategories, p.category)}${select("Difficulty", "difficulty", ["All levels", "Beginner", "Intermediate", "Advanced"], p.difficulty || "All levels")}${field("Duration (minutes)", "duration", p.duration || 45, "number")}${field("Required equipment", "equipment", p.equipment || "", "text", false)}</div>${area("Training objective", "objective", p.objective || "", true)}${area("Coaching instructions", "instructions", p.instructions || "")}${area("Coaching notes", "notes", p.notes || "")}${gym ? `<h3>Exercise prescription</h3><div id="exercise-items">${items.map(gymItem).join("")}</div><button type="button" class="button secondary" id="add-exercise">Add exercise</button><p class="fine-print">Create reusable exercises using the exercise library before adding them here.</p>` : `<h3>Select reusable drills</h3><div class="library-list">${state.training_drills.map((dr) => `<label><input type="checkbox" name="drill" value="${h(dr.id)}" ${items.some((i) => i.drill_id === dr.id) ? "checked" : ""}>${h(dr.name)} · ${dr.duration} min</label>`).join("") || '<p class="muted">Add drills to the library first.</p>'}</div>`}`,
    async (f, form) => {
      if (!isStaff()) throw new Error("Coach permissions required.");
      const duration = Number(f.get("duration"));
      if (duration < 1 || duration > 600)
        throw new Error("Duration must be 1–600 minutes.");
      const rows = gym
        ? $$(".repeater-item", form).map((el, position) => {
            const value = (name) => $(`[name=${name}]`, el).value;
            const row = {
              exercise_id: value("exercise_id"),
              sets: Number(value("sets")),
              reps: Number(value("reps")),
              target: value("target").trim(),
              rest_seconds: Number(value("rest_seconds")),
              position,
            };
            if (
              !row.exercise_id ||
              row.sets < 1 ||
              row.sets > 20 ||
              row.reps < 1 ||
              row.reps > 200 ||
              row.rest_seconds < 0 ||
              row.rest_seconds > 1800
            )
              throw new Error(
                "Use 1–20 sets, 1–200 reps and 0–1800 seconds rest.",
              );
            return row;
          })
        : f
            .getAll("drill")
            .map((drill_id, position) => ({ drill_id, position }));
      if (!rows.length) throw new Error("Add at least one exercise or drill.");
      const row = {
        title: f.get("title").trim(),
        kind: p.kind,
        category: f.get("category"),
        difficulty: f.get("difficulty"),
        duration,
        equipment: f.get("equipment"),
        objective: f.get("objective").trim(),
        instructions: f.get("instructions"),
        notes: f.get("notes"),
      };
      if (!row.title || !row.objective)
        throw new Error("Enter a title and objective.");
      await data.saveProgramme(p.id, row, rows);
      await refresh();
      toast("Programme saved.");
    },
  );
  if (gym) {
    const bind = () =>
      $$(".remove-item", d).forEach(
        (b) => (b.onclick = () => b.closest(".repeater-item").remove()),
      );
    $("#add-exercise").onclick = () => {
      if (!state.gym_exercises.length) {
        toast("Add an exercise to the library first.", true);
        return;
      }
      $("#exercise-items").insertAdjacentHTML("beforeend", gymItem());
      bind();
    };
    bind();
  }
}
function assignProgramme(p) {
  modal(
    `Assign ${p.title}`,
    `${field("Week beginning (Monday)", "week_of", londonDay(weekStart()), "date")}${select(
      "Assign to",
      "target_type",
      [
        ["team", "Senior team"],
        ["player", "Individual player"],
      ],
    )}<div id="assignment-target"></div><p class="fine-print">Each assignment represents one programme completion for the selected week.</p>`,
    async (f) => {
      const week = f.get("week_of");
      if (new Date(`${week}T12:00:00Z`).getUTCDay() !== 1)
        throw new Error("Choose a Monday for the programme week.");
      const target = f.get("target_id");
      if (!target) throw new Error("Select a team or approved player.");
      await data.insert("programme_assignments", {
        programme_id: p.id,
        week_of: week,
        team_id: f.get("target_type") === "team" ? target : null,
        player_id: f.get("target_type") === "player" ? target : null,
        assigned_by: profile.id,
      });
      await refresh();
      toast("Programme assigned.");
    },
  );
  const update = () =>
    ($("#assignment-target").innerHTML = select(
      "Recipient",
      "target_id",
      $("[name=target_type]").value === "team"
        ? state.teams.map((t) => [t.id, t.name])
        : state.profiles
            .filter((p) => p.approved)
            .map((p) => [p.id, p.display_name]),
    ));
  $("[name=target_type]").onchange = update;
  update();
}
function library(kind) {
  const gym = kind === "gym",
    table = gym ? "gym_exercises" : "training_drills";
  const render = () => {
    const d = modal(
      gym ? "Exercise library" : "On-field drill library",
      `<button type="button" class="button primary" id="new-library-item">Add ${gym ? "exercise" : "drill"}</button><div class="detail-section">${state[table].map((e) => `<div class="programme-row"><div><strong>${h(e.name)}</strong><small>${h(gym ? e.instructions : e.description)}</small></div><button type="button" class="button secondary row-end" data-library-edit="${h(e.id)}">Edit</button></div>`).join("") || empty("No library items yet.")}</div>`,
    );
    $("#new-library-item").onclick = () => {
      d.close();
      editLibrary({});
    };
    $$("[data-library-edit]").forEach(
      (b) =>
        (b.onclick = () => {
          d.close();
          editLibrary(state[table].find((e) => e.id === b.dataset.libraryEdit));
        }),
    );
  };
  function editLibrary(e) {
    modal(
      gym ? "Edit exercise" : "Edit drill",
      `${field("Name", "name", e.name || "")}${area(gym ? "Exercise instructions" : "Description", gym ? "instructions" : "description", e.instructions || e.description || "", true)}${!gym ? `<div class="form-grid">${field("Duration (minutes)", "duration", e.duration || 10, "number")}${field("Sets / repetitions", "sets_reps", e.sets_reps || "", "text", false)}${field("Equipment", "equipment", e.equipment || "", "text", false)}</div>${area("Coaching points", "coaching_points", e.coaching_points || "")}${field("Diagram image URL (optional)", "diagram_url", e.diagram_url || "", "url", false)}` : ""}${field("Video demonstration URL (optional)", "video_url", e.video_url || "", "url", false)}`,
      async (f) => {
        const row = Object.fromEntries(f);
        row.name = row.name.trim();
        if (!row.name) throw new Error("Enter a name.");
        for (const key of ["video_url", "diagram_url"])
          if (row[key] && !safeUrl(row[key]))
            throw new Error("Use a valid HTTP or HTTPS URL.");
        if (!gym) {
          row.duration = Number(row.duration);
          if (row.duration < 1 || row.duration > 180)
            throw new Error("Use a duration of 1–180 minutes.");
        }
        if (e.id) await data.update(table, e.id, row);
        else await data.insert(table, { ...row, created_by: profile.id });
        await refresh();
        toast("Library item saved.");
      },
    );
  }
  render();
}
function renderCards() {
  let programmes = state.training_programmes.filter(
    (p) =>
      p.kind === tab &&
      p.archived === archived &&
      `${p.title} ${p.objective} ${p.category}`.toLowerCase().includes(search),
  );
  if (!isStaff()) {
    const ids = [
      ...ownAssignments().map((a) => a.programme_id),
      ...state.workout_logs
        .filter((l) => l.player_id === profile.id)
        .map((l) => l.programme_id),
    ];
    programmes = programmes.filter((p) => ids.includes(p.id));
  }
  $("#programme-grid").innerHTML =
    programmes
      .map((p) => {
        const assignment = ownAssignments().find(
          (a) =>
            a.programme_id === p.id && a.week_of === londonDay(weekStart()),
        );
        const complete =
          assignment &&
          state.workout_logs.some(
            (l) =>
              l.assignment_id === assignment.id &&
              l.player_id === profile.id &&
              l.completed_at,
          );
        return `<article class="panel programme-card"><div class="card-symbol"><i data-lucide="${p.kind === "gym" ? "dumbbell" : "footprints"}"></i></div><div>${badge(p.kind)} ${complete ? badge("complete", "Completed") : ""}</div><h2>${h(p.title)}</h2><p>${h(p.objective)}</p><div class="card-meta"><span>${p.duration} minutes</span><span>${h(p.difficulty)}</span></div><div class="card-footer"><button class="button secondary" data-programme="${h(p.id)}">View programme <i data-lucide="arrow-right"></i></button></div></article>`;
      })
      .join("") ||
    empty(
      search
        ? "No programmes match your search."
        : "No assigned programmes here yet. Your coach can assign a programme to you or your team.",
    );
  $$("[data-programme]").forEach(
    (b) =>
      (b.onclick = () => openProgramme(b.dataset.programme).catch(showError)),
  );
  $$("[data-tab]").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
    b.setAttribute("aria-selected", b.dataset.tab === tab);
  });
  icons();
}
async function init() {
  if (!(await boot("programmes"))) return;
  try {
    await loadProgrammes();
    $("#main").innerHTML =
      heading(
        "TRAIN WITH INTENT",
        "Training Programmes",
        "Structured work. Measurable progress. Built for your next performance.",
        isStaff()
          ? '<button class="button secondary" id="library"><i data-lucide="library"></i>Drill / exercise library</button><button class="button primary" id="new-programme"><i data-lucide="plus"></i>Create programme</button>'
          : "",
      ) +
      `<div class="tabs" role="tablist" aria-label="Programme type"><button role="tab" data-tab="field"><i data-lucide="footprints"></i>On-Field Training</button><button role="tab" data-tab="gym"><i data-lucide="dumbbell"></i>Gym Training</button></div><div class="toolbar programme-toolbar"><label class="search"><span class="sr-label">Search programmes</span><input type="search" id="programme-search" placeholder="Search programmes…"></label><label class="inline-check"><input type="checkbox" id="archived"> Show archived</label></div><div class="card-grid" id="programme-grid"></div>` +
      footer();
    $$("[data-tab]").forEach(
      (b) =>
        (b.onclick = () => {
          tab = b.dataset.tab;
          renderCards();
        }),
    );
    $("#programme-search").oninput = (e) => {
      search = e.target.value.toLowerCase();
      renderCards();
    };
    if (isStaff()) {
      $("#new-programme").onclick = () => editProgramme({ kind: tab });
      $("#library").onclick = () => library(tab);
    }
    $("#archived").onchange = (e) => {
      archived = e.target.checked;
      renderCards();
    };
    renderCards();
    const id = new URLSearchParams(location.search).get("id");
    if (id) await openProgramme(id);
  } catch (e) {
    showFatal(e);
  }
}
if (location.pathname.endsWith("programmes.html")) init();
