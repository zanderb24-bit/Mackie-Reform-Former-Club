import { $, icons, toast } from "./utils.js";
import { signIn, signUp } from "./auth.js";
import { configured, request, setSession } from "./supabase-client.js";
let register = false;
icons();
window.addEventListener("load", icons);
$("#toggle-register").onclick = () => {
  register = !register;
  $("#name-field").hidden = !register;
  $("[name=display_name]").required = register;
  $("#auth-submit").textContent = register ? "Request membership" : "Sign in";
  $("#toggle-register").textContent = register
    ? "Already a member? Sign in"
    : "Request membership";
  $("[name=password]").autocomplete = register
    ? "new-password"
    : "current-password";
  $("#auth-message").textContent = "";
};
if (new URLSearchParams(location.search).has("pending"))
  $("#auth-message").textContent =
    "Your account is awaiting administrator approval. Please check back after your membership has been approved.";
$("#login-form").onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  $("#auth-submit").disabled = true;
  try {
    if (!configured)
      throw new Error(
        "Supabase is not connected yet. Explore the demo below, or follow README.md to configure your project.",
      );
    if (register) {
      await signUp(f.get("email"), f.get("password"), f.get("display_name"));
      $("#auth-message").textContent =
        "Request received. Check your email to confirm your address, then wait for administrator approval.";
    } else await signIn(f.get("email"), f.get("password"));
  } catch (err) {
    $("#auth-message").textContent = err.message;
  } finally {
    $("#auth-submit").disabled = false;
  }
};
$("#demo-button").onclick = () => {
  if (configured) {
    toast(
      "Demo mode is available in an unconfigured copy of the site. Sign in to access club data.",
    );
    return;
  }
  setSession(null);
  sessionStorage.setItem("mackie-demo", "yes");
  location.href = "dashboard.html";
};
$("#reset-password").onclick = async () => {
  const input = $("[name=email]");
  if (!input.checkValidity() || !input.value) {
    input.reportValidity();
    input.focus();
    return;
  }
  try {
    await request("/auth/v1/recover", {
      method: "POST",
      auth: false,
      body: {
        email: input.value,
        redirect_to: new URL("login.html", location.href).href,
      },
    });
    $("#auth-message").textContent =
      "If an account exists, a password reset link has been sent.";
  } catch (e) {
    $("#auth-message").textContent = e.message;
  }
};
const fragment = new URLSearchParams(location.hash.slice(1));
if (fragment.has("error_description")) {
  $("#auth-message").textContent = fragment.get("error_description");
  history.replaceState(null, "", location.pathname);
}
if (fragment.has("access_token")) {
  setSession({
    access_token: fragment.get("access_token"),
    refresh_token: fragment.get("refresh_token"),
    expires_at: Date.now() / 1000 + Number(fragment.get("expires_in") || 3600),
  });
  history.replaceState(null, "", location.pathname);
  if (fragment.get("type") === "recovery") {
    $("#auth-message").textContent = "Enter your new password below.";
    $("#name-field").hidden = true;
    $("[name=email]").closest("label").hidden = true;
    $("[name=email]").required = false;
    $("#auth-submit").textContent = "Save new password";
    $("#login-form").onsubmit = async (e) => {
      e.preventDefault();
      $("#auth-submit").disabled = true;
      try {
        await request("/auth/v1/user", {
          method: "PUT",
          body: { password: $("[name=password]").value },
        });
        setSession(null);
        location.href = "login.html";
      } catch (err) {
        $("#auth-message").textContent = err.message;
      } finally {
        $("#auth-submit").disabled = false;
      }
    };
  } else {
    setSession(null);
    $("#auth-message").textContent =
      "Email confirmed. You can sign in once an administrator approves your account.";
  }
}
