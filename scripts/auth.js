(function () {
  const path = window.location.pathname.split("/").pop() || "index.html";
  const isAdminPage = path === "admin.html";
  const isLoginPage = path === "admin-login.html";

  async function api(pathname, options = {}) {
    const response = await fetch(pathname, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, body };
  }

  function redirectToLogin() {
    const next = encodeURIComponent("admin.html");
    window.location.replace(`admin-login.html?next=${next}`);
  }

  async function checkSession() {
    const result = await api("/api/admin/session", { method: "GET" });
    return Boolean(result.body?.authenticated);
  }

  async function login(passcode) {
    const result = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ passcode })
    });
    return result;
  }

  async function logout() {
    await api("/api/admin/logout", { method: "POST" });
  }

  async function changePasscode(currentPasscode, newPasscode) {
    const result = await api("/api/admin/change-passcode", {
      method: "POST",
      body: JSON.stringify({ currentPasscode, newPasscode })
    });
    if (!result.ok) {
      return { ok: false, message: result.body?.error || "Failed to change passkey." };
    }
    return { ok: true };
  }

  function wireLogoutButton() {
    const button = document.getElementById("adminLogoutBtn");
    if (!button) return;
    button.addEventListener("click", async () => {
      await logout();
      redirectToLogin();
    });
  }

  function wireLoginForm() {
    const form = document.getElementById("adminLoginForm");
    const message = document.getElementById("adminLoginMessage");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const passcode = String(form.passcode.value || "").trim();
      if (passcode.length < 10) {
        if (message) message.textContent = "Use at least 10 characters for passkey.";
        return;
      }

      const result = await login(passcode);
      if (!result.ok) {
        if (message) message.textContent = result.body?.error || "Invalid passkey.";
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "admin.html";
      window.location.replace(next);
    });
  }

  window.AdminAuth = {
    changePasscode,
    closeSession: logout
  };

  (async function init() {
    if (isAdminPage) {
      const authenticated = await checkSession();
      if (!authenticated) {
        redirectToLogin();
        return;
      }
      wireLogoutButton();
      return;
    }

    if (isLoginPage) {
      const authenticated = await checkSession();
      if (authenticated) {
        const params = new URLSearchParams(window.location.search);
        const next = params.get("next") || "admin.html";
        window.location.replace(next);
        return;
      }
      wireLoginForm();
    }
  })();
})();
