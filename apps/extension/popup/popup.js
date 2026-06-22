// Reflex popup — demo state switching only (no real auth in the scaffold).
const screens = ["signedOut", "signedIn", "deactivated"];
function show(state) {
  screens.forEach(s => document.getElementById(s).classList.toggle("hidden", s !== state));
}
document.getElementById("signin").addEventListener("click", () => show("signedIn"));
document.getElementById("signout").addEventListener("click", () => show("signedOut"));
document.querySelectorAll(".demobar button").forEach(b =>
  b.addEventListener("click", () => show(b.dataset.state)));

// TODO(claude-code): replace with real auth.
//  - POST email/password to backend, receive JWT
//  - store JWT in chrome.storage.local
//  - on open, check token validity + active flag; show the right screen
//  - if the admin deactivated the user, the token check fails -> show "deactivated"
show("signedOut");
