(function () {
  const AUTH = {
    sessionKey: "rayan_admin_session",
    failCountKey: "rayan_admin_fail_count",
    lockUntilKey: "rayan_admin_lock_until",
    overrideHashKey: "rayan_admin_hash_override",
    overrideSaltKey: "rayan_admin_salt_override",
    overrideIterKey: "rayan_admin_iter_override",
    sessionTtlMs: 30 * 60 * 1000,
    iterations: 210000,
    maxAttempts: 5,
    lockMinutes: 10,

    // Owner-managed credentials (fallback if no override is stored).
    passcodeHashB64: "oMgtpLOryRhq3ZQEOUQBQIl4Z2kkCygh6RiydzOQB4Y=",
    passcodeSaltB64: "Am4i4YYKh1SGO5BuA7HjIg=="
  };

  const path = window.location.pathname.split("/").pop() || "index.html";
  const isAdminPage = path === "admin.html";
  const isLoginPage = path === "admin-login.html";

  const encoder = new TextEncoder();

  function b64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  }

  function fromB64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function randomSaltB64() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return b64(bytes.buffer);
  }

  async function deriveHash(passcode, saltBase64, iterations) {
    const passKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(passcode),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: fromB64(saltBase64),
        iterations,
        hash: "SHA-256"
      },
      passKey,
      256
    );

    return b64(bits);
  }

  function getAuthConfig() {
    const overrideHash = localStorage.getItem(AUTH.overrideHashKey);
    const overrideSalt = localStorage.getItem(AUTH.overrideSaltKey);
    const overrideIter = Number(localStorage.getItem(AUTH.overrideIterKey) || AUTH.iterations);

    if (overrideHash && overrideSalt) {
      return {
        hash: overrideHash,
        salt: overrideSalt,
        iterations: overrideIter,
        source: "override"
      };
    }

    return {
      hash: AUTH.passcodeHashB64,
      salt: AUTH.passcodeSaltB64,
      iterations: AUTH.iterations,
      source: "fallback"
    };
  }

  function credentialsConfigured() {
    const cfg = getAuthConfig();
    return Boolean(cfg.hash && cfg.salt);
  }

  function isSessionValid() {
    try {
      const raw = sessionStorage.getItem(AUTH.sessionKey);
      if (!raw) return false;
      const payload = JSON.parse(raw);
      if (!payload.expiresAt) return false;
      if (Date.now() > payload.expiresAt) {
        sessionStorage.removeItem(AUTH.sessionKey);
        return false;
      }
      return payload.ok === true;
    } catch {
      sessionStorage.removeItem(AUTH.sessionKey);
      return false;
    }
  }

  function openSession() {
    const payload = {
      ok: true,
      expiresAt: Date.now() + AUTH.sessionTtlMs
    };
    sessionStorage.setItem(AUTH.sessionKey, JSON.stringify(payload));
  }

  function closeSession() {
    sessionStorage.removeItem(AUTH.sessionKey);
  }

  function lockState() {
    const lockUntil = Number(localStorage.getItem(AUTH.lockUntilKey) || 0);
    const attempts = Number(localStorage.getItem(AUTH.failCountKey) || 0);
    const now = Date.now();
    return {
      locked: lockUntil > now,
      lockUntil,
      attempts
    };
  }

  function registerFailure() {
    const now = Date.now();
    const attempts = Number(localStorage.getItem(AUTH.failCountKey) || 0) + 1;
    localStorage.setItem(AUTH.failCountKey, String(attempts));

    if (attempts >= AUTH.maxAttempts) {
      const lockUntil = now + AUTH.lockMinutes * 60 * 1000;
      localStorage.setItem(AUTH.lockUntilKey, String(lockUntil));
      return { locked: true, lockUntil };
    }

    return { locked: false, attempts };
  }

  function clearFailures() {
    localStorage.removeItem(AUTH.failCountKey);
    localStorage.removeItem(AUTH.lockUntilKey);
  }

  function formatRemaining(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${String(sec).padStart(2, "0")}`;
  }

  function redirectToLogin() {
    const next = encodeURIComponent("admin.html");
    window.location.replace(`admin-login.html?next=${next}`);
  }

  function wireLogoutButton() {
    const button = document.getElementById("adminLogoutBtn");
    if (!button) return;
    button.addEventListener("click", () => {
      closeSession();
      redirectToLogin();
    });
  }

  async function verifyPasscode(inputPasscode) {
    if (!credentialsConfigured()) return false;
    const cfg = getAuthConfig();
    const hash = await deriveHash(inputPasscode, cfg.salt, cfg.iterations);
    return hash === cfg.hash;
  }

  async function changePasscode(currentPasscode, newPasscode) {
    const current = String(currentPasscode || "").trim();
    const next = String(newPasscode || "").trim();

    if (next.length < 10) {
      return { ok: false, message: "New passkey must be at least 10 characters." };
    }

    const validCurrent = await verifyPasscode(current);
    if (!validCurrent) {
      return { ok: false, message: "Current passkey is incorrect." };
    }

    const salt = randomSaltB64();
    const hash = await deriveHash(next, salt, AUTH.iterations);

    localStorage.setItem(AUTH.overrideSaltKey, salt);
    localStorage.setItem(AUTH.overrideHashKey, hash);
    localStorage.setItem(AUTH.overrideIterKey, String(AUTH.iterations));

    clearFailures();
    openSession();
    return { ok: true };
  }

  async function wireLoginForm() {
    const form = document.getElementById("adminLoginForm");
    const message = document.getElementById("adminLoginMessage");
    if (!form) return;

    if (!credentialsConfigured()) {
      if (message) {
        message.textContent = "Admin passkey is not configured. Set hash/salt in scripts/auth.js.";
      }
      const controls = form.querySelectorAll("input, button");
      controls.forEach((node) => {
        if (node.tagName !== "A") node.disabled = true;
      });
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const state = lockState();
      if (state.locked) {
        if (message) message.textContent = `Temporarily locked. Try again in ${formatRemaining(state.lockUntil - Date.now())}.`;
        return;
      }

      const passcode = String(form.passcode.value || "").trim();
      if (passcode.length < 10) {
        if (message) message.textContent = "Use at least 10 characters for passkey.";
        return;
      }

      const ok = await verifyPasscode(passcode);
      if (!ok) {
        const fail = registerFailure();
        if (fail.locked) {
          if (message) message.textContent = `Too many attempts. Locked for ${AUTH.lockMinutes} minutes.`;
        } else if (message) {
          const remaining = Math.max(0, AUTH.maxAttempts - Number(localStorage.getItem(AUTH.failCountKey) || 0));
          message.textContent = `Invalid passkey. Attempts remaining: ${remaining}.`;
        }
        return;
      }

      clearFailures();
      openSession();
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "admin.html";
      window.location.replace(next);
    });
  }

  window.AdminAuth = {
    changePasscode,
    verifyPasscode,
    isConfigured: credentialsConfigured,
    closeSession
  };

  (async function init() {
    if (isAdminPage && !isSessionValid()) {
      redirectToLogin();
      return;
    }

    if (isAdminPage) {
      wireLogoutButton();
      return;
    }

    if (isLoginPage) {
      if (isSessionValid()) {
        const params = new URLSearchParams(window.location.search);
        const next = params.get("next") || "admin.html";
        window.location.replace(next);
        return;
      }

      await wireLoginForm();
    }
  })();
})();
