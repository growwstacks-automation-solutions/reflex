// Reflex popup — real auth against the Worker's /auth/login (via the background worker,
// which holds the JWT). Mirrors the portal: same endpoint + { token, user } shape.
const screens = ["signedOut", "signedIn", "deactivated"];
function show(state) {
  screens.forEach((s) => document.getElementById(s).classList.toggle("hidden", s !== state));
}

const $ = (id) => document.getElementById(id);
const emailEl = $("email");
const pwEl = $("pw");
const signinBtn = $("signin");
const errEl = $("error");
const userEl = $("userName");
const avatarEl = $("userAvatar");

function setError(text) {
  errEl.textContent = text || "";
  errEl.classList.toggle("hidden", !text);
}

function renderSignedIn(user) {
  const name = (user && user.full_name) || "Signed in";
  if (userEl) userEl.textContent = name;
  if (avatarEl) avatarEl.textContent = (name.trim()[0] || "R");
  show("signedIn");
}

// Promise wrapper around the background message channel.
// Reads chrome.runtime.lastError so a closed/asleep port degrades to undefined
// instead of logging "Unchecked runtime.lastError: The message port closed…".
function send(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        console.warn("[Reflex popup] no response from background:", err.message,
          "— reload the extension at chrome://extensions if you just changed background.js");
        resolve(undefined);
        return;
      }
      resolve(response);
    });
  });
}

async function doSignIn() {
  const email = (emailEl.value || "").trim();
  const password = pwEl.value || "";
  if (!email || !password) {
    setError("Enter your email and password.");
    return;
  }
  setError("");
  signinBtn.disabled = true;
  signinBtn.textContent = "Signing in…";
  console.log("[Reflex popup] sign-in attempt:", email);

  const res = await send({ type: "LOGIN", email, password });

  signinBtn.disabled = false;
  signinBtn.textContent = "Sign in";
  console.log("[Reflex popup] LOGIN result:", res); // {ok,user} or {error,status} — no token here

  if (res && res.ok) {
    pwEl.value = "";
    renderSignedIn(res.user);
    return;
  }
  if (res && res.status === 403) {
    show("deactivated"); // account disabled by the admin
    return;
  }
  setError((res && res.error) || "Sign in failed.");
}

async function doSignOut() {
  await send({ type: "LOGOUT" });
  pwEl.value = "";
  setError("");
  show("signedOut");
}

signinBtn.addEventListener("click", doSignIn);
$("signout").addEventListener("click", doSignOut);
[emailEl, pwEl].forEach((el) =>
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSignIn();
  })
);

// On open: pick the screen from the stored token (set by a prior sign-in).
(async () => {
  const auth = await send({ type: "GET_AUTH" });
  if (auth && auth.token) renderSignedIn(auth.user);
  else show("signedOut");
})();
