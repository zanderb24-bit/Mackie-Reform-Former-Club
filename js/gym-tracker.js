import { profile, isDemo, isStaff } from "./auth.js";
import { data } from "./data.js";
import { request } from "./supabase-client.js";
import {
  $,
  $$,
  escapeHTML as h,
  modal,
  area,
  field,
  select,
  londonDay,
  dateLabel,
  toast,
  showError,
  empty,
  icons,
} from "./utils.js";
export async function persistWorkout(log, sets) {
  if (isDemo()) {
    const [saved] = log.id
      ? await data.update("workout_logs", log.id, log)
      : await data.insert("workout_logs", log);
    const existing = (await data.list("workout_sets")).filter(
      (s) => s.workout_id === saved.id,
    );
    for (const s of existing) await data.remove("workout_sets", s.id);
    for (const s of sets)
      await data.insert("workout_sets", { ...s, workout_id: saved.id });
    return saved.id;
  }
  return request("/rest/v1/rpc/save_workout", {
    method: "POST",
    body: { p_log: log, p_sets: sets },
  });
}
export async function startWorkout(p, assignment, state, onSave) {
  try {
    const logs = (await data.list("workout_logs"))
      .filter((l) => l.player_id === profile.id && l.programme_id === p.id)
      .sort(
        (a, b) =>
          b.performed_on.localeCompare(a.performed_on) ||
          new Date(b.created_at) - new Date(a.created_at),
      );
    const draft = logs.find(
        (l) => l.assignment_id === assignment.id && !l.completed_at,
      ),
      allSets = (await data.list("workout_sets")).filter((s) =>
        logs.some((l) => l.id === s.workout_id),
      );
    const prescription = state.gym_programme_exercises
      .filter((e) => e.programme_id === p.id)
      .sort((a, b) => a.position - b.position);
    const d = modal(
      p.kind === "gym" ? `Workout · ${p.title}` : `Field session · ${p.title}`,
      `${field("Date performed · Europe/London", "performed_on", draft?.performed_on || londonDay(new Date()), "date")}${
        p.kind === "gym"
          ? prescription
              .map((item) => {
                const exercise = state.gym_exercises.find(
                    (e) => e.id === item.exercise_id,
                  ),
                  previousLog = logs.find(
                    (l) =>
                      l.completed_at &&
                      allSets.some(
                        (s) =>
                          s.workout_id === l.id &&
                          s.exercise_id === item.exercise_id,
                      ),
                  ),
                  previous = allSets.filter(
                    (s) =>
                      s.workout_id === previousLog?.id &&
                      s.exercise_id === item.exercise_id,
                  );
                const current = allSets.filter(
                  (s) =>
                    s.workout_id === draft?.id &&
                    s.exercise_id === item.exercise_id,
                );
                return `<section class="exercise" data-exercise="${h(item.exercise_id)}"><h3>${h(exercise?.name || "Exercise")}</h3><p>${h(exercise?.instructions)}<br>Target: ${item.sets} × ${item.reps} · ${h(item.target)} · Rest ${item.rest_seconds}s</p><div class="previous-result">Previous: ${previous.length ? `${h(previousLog.performed_on)} · ${previous.map((s) => `${s.weight_kg} kg × ${s.reps}`).join(" / ")}` : "No completed sets recorded yet."}</div>${Array.from(
                  { length: item.sets },
                  (_, index) => {
                    const s = current.find((s) => s.set_number === index + 1);
                    return `<div class="set-row" data-set="${index + 1}"><span>SET ${index + 1}</span><label>Weight (kg)<input type="number" class="weight" value="${s?.weight_kg ?? ""}" min="0" max="600" step="0.5" placeholder="0"></label><label>Repetitions<input type="number" class="reps" value="${s?.reps ?? ""}" min="1" max="200" step="1" placeholder="${item.reps}"></label></div>`;
                  },
                ).join("")}</section>`;
              })
              .join("")
          : `<div class="notice">Complete the assigned drills, then save this activity to your personal training record. You can save a draft before finishing.</div>`
      }${area("Personal notes", "notes", draft?.notes || "")}<label class="inline-check"><input type="checkbox" name="complete"> Mark workout complete</label><p class="fine-print">Only you and authorised coaching staff can view your workout records. Blank sets are not recorded.</p>`,
      async (f, form) => {
        const date = f.get("performed_on");
        if (date > londonDay(new Date()))
          throw new Error("Workout date cannot be in the future.");
        if (
          date < assignment.week_of ||
          date >
            londonDay(
              new Date(`${assignment.week_of}T12:00:00Z`).setUTCDate(
                new Date(`${assignment.week_of}T12:00:00Z`).getUTCDate() + 6,
              ),
            )
        )
          throw new Error("Use a workout date within the assigned week.");
        const sets = [];
        $$("[data-exercise]", form).forEach((el) =>
          $$("[data-set]", el).forEach((row) => {
            const weight = $(".weight", row).value,
              reps = $(".reps", row).value;
            if (!weight && !reps) return;
            if (weight === "" || reps === "")
              throw new Error(
                "Enter both weight and repetitions for each recorded set.",
              );
            const w = Number(weight),
              r = Number(reps);
            if (
              !Number.isFinite(w) ||
              w < 0 ||
              w > 600 ||
              !Number.isInteger(r) ||
              r < 1 ||
              r > 200
            )
              throw new Error("Use 0–600 kg and 1–200 whole repetitions.");
            sets.push({
              exercise_id: el.dataset.exercise,
              set_number: Number(row.dataset.set),
              weight_kg: w,
              reps: r,
            });
          }),
        );
        if (f.has("complete") && p.kind === "gym" && !sets.length)
          throw new Error(
            "Record at least one completed set before finishing.",
          );
        const log = {
          ...(draft ? { id: draft.id } : {}),
          player_id: profile.id,
          programme_id: p.id,
          assignment_id: assignment.id,
          performed_on: date,
          notes: f.get("notes"),
          completed_at: f.has("complete") ? new Date().toISOString() : null,
        };
        await persistWorkout(log, sets);
        await onSave?.();
        toast(
          f.has("complete")
            ? "Workout complete. Progress saved."
            : "Workout draft saved.",
        );
      },
      "Save workout",
    );
  } catch (e) {
    showError(e);
  }
}
export function chartPoints(values, width = 500, height = 110) {
  if (!values.length) return "";
  const min = Math.min(...values),
    max = Math.max(...values);
  return values
    .map(
      (v, i) =>
        `${20 + (i * (width - 40)) / Math.max(1, values.length - 1)},${height - 20 - ((v - min) / (max - min || 1)) * (height - 40)}`,
    )
    .join(" ");
}
export async function showHistory(p, state) {
  const logs = (await data.list("workout_logs"))
    .filter((l) => l.programme_id === p.id && l.completed_at)
    .sort(
      (a, b) =>
        a.performed_on.localeCompare(b.performed_on) ||
        new Date(a.created_at) - new Date(b.created_at),
    );
  const sets = await data.list("workout_sets");
  const staff = isStaff();
  const people = state.profiles.filter((person) =>
    logs.some((l) => l.player_id === person.id),
  );
  const d = modal(
    `Workout history · ${p.title}`,
    `${staff ? select("Player", "history-player", [[profile.id, "My results"], ...people.filter((v) => v.id !== profile.id).map((v) => [v.id, v.display_name])]) : ""}${
      p.kind === "gym"
        ? select(
            "Exercise",
            "history-exercise",
            state.gym_exercises
              .filter((e) =>
                sets.some(
                  (s) =>
                    s.exercise_id === e.id &&
                    logs.some((l) => l.id === s.workout_id),
                ),
              )
              .map((e) => [e.id, e.name]),
          ) +
          select("Progress metric", "history-metric", [
            ["weight", "Maximum weight (kg)"],
            ["reps", "Total repetitions"],
          ])
        : ""
    }<div id="history-content"></div>`,
  );
  const render = () => {
    const player = staff ? $("[name=history-player]", d).value : profile.id,
      exercise = $("[name=history-exercise]", d)?.value,
      metric = $("[name=history-metric]", d)?.value;
    const own = logs.filter((l) => l.player_id === player);
    const points = own
      .map((l) => {
        const rows = sets.filter(
          (s) => s.workout_id === l.id && s.exercise_id === exercise,
        );
        return {
          log: l,
          rows,
          value: rows.length
            ? metric === "weight"
              ? Math.max(...rows.map((s) => Number(s.weight_kg)))
              : rows.reduce((n, s) => n + s.reps, 0)
            : null,
        };
      })
      .filter((v) => p.kind === "field" || v.value !== null);
    const values = points.map((v) => v.value);
    const improvement =
      values.length > 1 ? values.at(-1) - values.at(-2) : null;
    $("#history-content", d).innerHTML = points.length
      ? `${
          p.kind === "gym"
            ? `<p class="fine-print">${metric === "weight" ? "Maximum load per session (kg)" : "Total repetitions per session"}. ${improvement === null ? "Record a second session to compare." : `Change from previous session: ${improvement > 0 ? "+" : ""}${improvement} ${metric === "weight" ? "kg" : "reps"}.`}</p><svg class="history-chart" viewBox="0 0 500 130" role="img" aria-label="${h(values.join(", "))} ${metric === "weight" ? "kilograms" : "repetitions"}, oldest to newest"><polyline points="${chartPoints(values, 500, 130)}" fill="none" stroke="#ffd100" stroke-width="3"/>${chartPoints(
                values,
                500,
                130,
              )
                .split(" ")
                .map(
                  (pt) =>
                    `<circle cx="${pt.split(",")[0]}" cy="${pt.split(",")[1]}" r="4" fill="#c8102e"/>`,
                )
                .join("")}</svg>`
            : ""
        }<div class="table-wrap"><table class="history-table"><thead><tr><th>Date</th>${p.kind === "gym" ? "<th>Recorded sets</th>" : ""}<th>Notes</th></tr></thead><tbody>${points
          .toReversed()
          .map(
            (v) =>
              `<tr><td>${h(dateLabel(v.log.performed_on + "T12:00:00Z"))}</td>${p.kind === "gym" ? `<td>${v.rows.map((s) => `${s.weight_kg} kg × ${s.reps}`).join(" / ")}</td>` : ""}<td>${h(v.log.notes || "—")}</td></tr>`,
          )
          .join("")}</tbody></table></div>`
      : empty("No completed results for this selection.");
  };
  $$("select", d).forEach((s) => (s.onchange = render));
  render();
  icons();
}
