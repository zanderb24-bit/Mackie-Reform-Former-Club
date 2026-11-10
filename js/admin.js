import { boot, heading, footer, showFatal } from "./navigation.js";
import { isAdmin, profile } from "./auth.js";
import { data } from "./data.js";
import {
  $,
  $$,
  escapeHTML as h,
  icons,
  empty,
  select,
  field,
  modal,
  toast,
  showError,
} from "./utils.js";
let people = [],
  teams = [],
  memberships = [];
async function render() {
  [people, teams, memberships] = await Promise.all(
    ["profiles", "teams", "team_memberships"].map((t) => data.list(t)),
  );
  $("#main").innerHTML =
    heading(
      "LOOK AFTER THE TEAM",
      "Team Administration",
      "Approve members, manage roles and organise the senior squads.",
      '<button class="button primary" id="new-team"><i data-lucide="plus"></i>Add team</button>',
    ) +
    `<div class="notice">New registrations remain blocked until approved here. Coaching staff can access senior-team attendance and workout records. Only administrators can change roles and approvals.</div><section class="panel"><div class="panel-head"><h2>Members & access requests</h2></div><div class="table-wrap"><table class="admin-table"><thead><tr><th>Member</th><th>Role</th><th>Membership</th><th>Teams</th><th>Actions</th></tr></thead><tbody>${people
      .map(
        (p) =>
          `<tr><td>${h(p.display_name)}${p.id === profile.id ? " (you)" : ""}</td><td>${h(p.role)}</td><td>${p.approved ? "Approved" : "Awaiting approval"}</td><td>${
            memberships
              .filter((m) => m.profile_id === p.id)
              .map((m) => h(teams.find((t) => t.id === m.team_id)?.name))
              .join(", ") || "—"
          }</td><td><button class="button secondary" data-member="${h(p.id)}">Manage</button></td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div></section><section class="panel" style="margin-top:24px"><div class="panel-head"><h2>Senior teams</h2></div><div class="panel-body">${teams.map((t) => `<div class="programme-row"><strong>${h(t.name)}</strong><button class="button secondary row-end" data-team="${h(t.id)}">Edit team</button></div>`).join("") || empty("Add your first senior team.")}</div></section>` +
    footer();
  $("#new-team").onclick = () => editTeam();
  $$("[data-team]").forEach(
    (b) =>
      (b.onclick = () => editTeam(teams.find((t) => t.id === b.dataset.team))),
  );
  $$("[data-member]").forEach(
    (b) =>
      (b.onclick = () =>
        editMember(people.find((p) => p.id === b.dataset.member))),
  );
  icons();
}
function editTeam(t = {}) {
  modal(
    t.id ? "Edit team" : "Add senior team",
    field("Team name", "name", t.name || ""),
    async (f) => {
      const name = f.get("name").trim();
      if (!name) throw new Error("Enter a team name.");
      if (t.id) await data.update("teams", t.id, { name });
      else await data.insert("teams", { name });
      await render();
      toast("Team saved.");
    },
  );
}
function editMember(p) {
  modal(
    `Manage ${p.display_name}`,
    `${select("Role", "role", ["player", "coach", "administrator"], p.role)}<label class="inline-check"><input type="checkbox" name="approved" ${p.approved ? "checked" : ""}>Approved senior-team member</label><h3>Team memberships</h3>${teams.map((t) => `<label class="inline-check"><input type="checkbox" name="team" value="${h(t.id)}" ${memberships.some((m) => m.profile_id === p.id && m.team_id === t.id) ? "checked" : ""}>${h(t.name)}</label>`).join("")}`,
    async (f) => {
      if (
        p.id === profile.id &&
        (f.get("role") !== "administrator" || !f.has("approved"))
      )
        throw new Error("You cannot remove your own administrator access.");
      await data.update("profiles", p.id, {
        role: f.get("role"),
        approved: f.has("approved"),
      });
      const wanted = f.getAll("team"),
        current = memberships.filter((m) => m.profile_id === p.id);
      for (const m of current.filter((m) => !wanted.includes(m.team_id)))
        await data.remove("team_memberships", m.id);
      for (const team_id of wanted.filter(
        (id) => !current.some((m) => m.team_id === id),
      ))
        await data.insert("team_memberships", { team_id, profile_id: p.id });
      await render();
      toast("Membership and permissions saved.");
    },
  );
}
if (await boot("admin")) {
  if (!isAdmin()) showFatal(new Error("Administrator access is required."));
  else render().catch(showFatal);
}
