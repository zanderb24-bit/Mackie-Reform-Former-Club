export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const safeUrl = (value) => {
  if (!value) return "";
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : "";
  } catch {
    return "";
  }
};
export const dateLabel = (d, options = {}) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    ...options,
  }).format(new Date(d));
export const timeLabel = (d) =>
  dateLabel(d, {
    day: undefined,
    month: undefined,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
export const londonDay = (d) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d));
export function londonToISO(day, time) {
  const desired = `${day}T${time}:00`;
  const naive = new Date(`${desired}Z`);
  if (!Number.isFinite(+naive)) throw new Error("Enter a valid date and time.");
  const matches = [];
  for (const offset of [0, 60]) {
    const candidate = new Date(+naive - offset * 60000);
    if (londonDay(candidate) === day && timeLabel(candidate) === time)
      matches.push(candidate.toISOString());
  }
  if (!matches.length)
    throw new Error(
      "This London time does not exist because the clocks change.",
    );
  if (matches.length > 1)
    throw new Error(
      "This London time occurs twice because the clocks change. Choose a time outside 01:00–01:59.",
    );
  return matches[0];
}
export function weekStart(date = new Date()) {
  const d = new Date(`${londonDay(date)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}
export function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}
export const icons = () => window.lucide?.createIcons();
export function toast(message, error = false) {
  const el = $("#toast");
  el.textContent = message;
  el.className = error ? "toast error" : "toast";
  el.hidden = false;
  clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => (el.hidden = true), 6000);
}
export function showError(error) {
  toast(error.message || "Something went wrong. Please try again.", true);
}
export function modal(title, body, onSubmit, label = "Save changes") {
  const dialog = $("#modal");
  dialog.innerHTML = `<form id="modal-form"><header><h2>${escapeHTML(title)}</h2><button type="button" class="icon-btn close" aria-label="Close dialog"><i data-lucide="x"></i></button></header><div class="modal-body">${body}</div><p class="form-error" role="alert"></p><footer><button type="button" class="button ghost close">Close</button>${onSubmit ? `<button class="button primary" type="submit">${escapeHTML(label)}</button>` : ""}</footer></form>`;
  $$(".close", dialog).forEach((b) => (b.onclick = () => dialog.close()));
  if (onSubmit)
    $("#modal-form").onsubmit = async (e) => {
      e.preventDefault();
      const b = $("button[type=submit]", dialog);
      b.disabled = true;
      try {
        await onSubmit(new FormData(e.target), e.target);
        dialog.close();
      } catch (err) {
        $(".form-error", dialog).textContent = err.message;
      } finally {
        b.disabled = false;
      }
    };
  dialog.showModal();
  icons();
  return dialog;
}
export const field = (
  label,
  name,
  value = "",
  type = "text",
  required = true,
) =>
  `<label>${escapeHTML(label)}<input name="${name}" type="${type}" value="${escapeHTML(value)}" ${required ? "required" : ""}></label>`;
export const area = (label, name, value = "", required = false) =>
  `<label>${escapeHTML(label)}<textarea name="${name}" rows="3" ${required ? "required" : ""}>${escapeHTML(value)}</textarea></label>`;
export const select = (label, name, options, value = "") =>
  `<label>${escapeHTML(label)}<select name="${name}">${options
    .map((o) => {
      const [v, l] = Array.isArray(o) ? o : [o, o.replaceAll("_", " ")];
      return `<option value="${escapeHTML(v)}" ${v === value ? "selected" : ""}>${escapeHTML(l)}</option>`;
    })
    .join("")}</select></label>`;
export const empty = (message = "Nothing here yet.") =>
  `<div class="empty"><i data-lucide="inbox"></i><p>${escapeHTML(message)}</p></div>`;
export const badge = (type, text = type) =>
  `<span class="badge ${escapeHTML(type)}">${escapeHTML(text.replaceAll("_", " "))}</span>`;
