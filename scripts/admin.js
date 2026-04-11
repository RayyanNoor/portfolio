(function () {
  const dataApi = window.PortfolioData;
  if (!dataApi) return;

  const state = dataApi.load();
  let editMode = false;
  const SYNC_KEY = "rayan_portfolio_last_update";

  const profileForm = document.getElementById("profileForm");
  const passkeyForm = document.getElementById("passkeyForm");
  const projectForm = document.getElementById("projectForm");
  const projectList = document.getElementById("projectList");
  const resetButton = document.getElementById("resetData");
  const toggleEditModeBtn = document.getElementById("toggleEditMode");
  const editModeState = document.getElementById("editModeState");
  const analyticsRefreshBtn = document.getElementById("analyticsRefreshBtn");
  const analyticsVisibilityForm = document.getElementById("analyticsVisibilityForm");
  const analyticsEventsList = document.getElementById("analyticsEventsList");

  if (!profileForm || !projectForm || !projectList) return;

  const idField = document.getElementById("projectId");
  const titleField = document.getElementById("projectTitle");
  const descField = document.getElementById("projectDescription");
  const langField = document.getElementById("projectLanguages");
  const shotsField = document.getElementById("projectScreenshots");
  const shotFilesField = document.getElementById("projectScreenshotFiles");
  const shotCountField = document.getElementById("projectScreenshotCount");
  const shotPreviewField = document.getElementById("projectScreenshotPreview");
  const profilePreviewImage = document.getElementById("profileImagePreview");
  const repoField = document.getElementById("projectRepo");
  const featField = document.getElementById("projectFeatured");
  const saveProjectLabel = document.getElementById("saveProjectLabel");
  const profileImageFileField = document.getElementById("profileImageFile");
  let uploadedScreenshots = [];

  function notify(message) {
    const node = document.getElementById("adminNotice");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(window.noticeTimer);
    window.noticeTimer = setTimeout(() => node.classList.remove("show"), 2400);
  }

  function showSaveBanner(message) {
    const banner = document.getElementById("adminSaveBanner");
    if (!banner) return;
    banner.textContent = message;
    banner.classList.add("show");
    clearTimeout(window.saveBannerTimer);
    window.saveBannerTimer = setTimeout(() => {
      banner.classList.remove("show");
    }, 2400);
  }

  function pulseSection(id) {
    const section = document.getElementById(id);
    if (!section) return;
    section.classList.remove("admin-section-saved");
    void section.offsetWidth;
    section.classList.add("admin-section-saved");
    setTimeout(() => section.classList.remove("admin-section-saved"), 1100);
  }

  async function fetchAnalyticsSummary() {
    const response = await fetch("/api/admin/analytics/summary", {
      method: "GET",
      credentials: "include"
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "Failed to load analytics");
    }
    return body;
  }

  async function saveAnalyticsSettings(settings) {
    const response = await fetch("/api/admin/analytics/settings", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "Failed to save analytics settings");
    }
    return body.settings || settings;
  }

  function renderAnalytics(data) {
    const totals = data?.totals || {};
    const settings = data?.settings || {};
    const events = Array.isArray(data?.events) ? data.events : [];

    const map = {
      analyticsTotalVisits: totals.totalVisits || 0,
      analyticsUniqueVisitors: totals.uniqueVisitors || 0,
      analyticsProjectPreviews: totals.projectPreviews || 0,
      analyticsContactClicks: totals.contactClicks || 0
    };

    Object.entries(map).forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = String(value);
    });

    if (analyticsVisibilityForm) {
      const names = ["showTotalVisits", "showUniqueVisitors", "showProjectPreviews", "showContactClicks"];
      names.forEach((name) => {
        const input = analyticsVisibilityForm.querySelector(`#${name}`);
        if (input) input.checked = Boolean(settings[name]);
      });
    }

    if (analyticsEventsList) {
      if (!events.length) {
        analyticsEventsList.innerHTML = "No analytics events yet.";
        return;
      }
      analyticsEventsList.innerHTML = events
        .map((event) => {
          const when = new Date(event.createdAt).toLocaleString();
          const meta = event.meta && Object.keys(event.meta).length ? ` | ${JSON.stringify(event.meta)}` : "";
          return `<p><strong>${event.visitorId}</strong> -> ${event.eventType} @ ${event.path}${meta} <span class="muted">(${when})</span></p>`;
        })
        .join("");
    }
  }

  async function saveState() {
    await dataApi.save(state);
    localStorage.setItem(SYNC_KEY, String(Date.now()));
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  function parseScreenshots(value) {
    return String(value || "")
      .split(/\r?\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function isDataUrl(value) {
    return /^data:image\//i.test(String(value || ""));
  }

  function screenshotsFor(project) {
    if (Array.isArray(project.screenshots) && project.screenshots.length) return project.screenshots;
    if (project.screenshot) return [project.screenshot];
    return [];
  }

  function updateScreenshotCount() {
    if (!shotCountField || !shotsField) return;
    const manualCount = parseScreenshots(shotsField.value).length;
    const uploadCount = uploadedScreenshots.length;
    const count = manualCount + uploadCount;
    shotCountField.textContent = `${count} screenshot${count === 1 ? "" : "s"} selected (${uploadCount} uploaded, ${manualCount} manual)`;
  }

  function uniqueOrdered(items) {
    const out = [];
    const seen = new Set();
    items.forEach((item) => {
      if (!item || seen.has(item)) return;
      seen.add(item);
      out.push(item);
    });
    return out;
  }

  function allScreenshots() {
    const manual = parseScreenshots(shotsField?.value || "");
    return uniqueOrdered([...manual, ...uploadedScreenshots]);
  }

  function removeScreenshotAt(index) {
    const all = allScreenshots();
    const target = all[index];
    if (!target) return;

    if (isDataUrl(target)) {
      uploadedScreenshots = uploadedScreenshots.filter((item) => item !== target);
    } else if (shotsField) {
      const manual = parseScreenshots(shotsField.value).filter((item) => item !== target);
      shotsField.value = manual.join("\n");
    }

    renderScreenshotPreview();
    updateScreenshotCount();
    notify("Screenshot removed");
  }

  function renderScreenshotPreview() {
    if (!shotPreviewField) return;
    const list = allScreenshots();

    if (!list.length) {
      shotPreviewField.innerHTML = "<p class='muted'>No screenshots selected yet.</p>";
      return;
    }

    shotPreviewField.innerHTML = list
      .map(
        (src, index) => `
          <article class="admin-shot-card">
            <img src="${src}" alt="Screenshot preview ${index + 1}" loading="lazy">
            <div class="admin-shot-meta">
              <span class="chip">${isDataUrl(src) ? "uploaded" : "manual"}</span>
              <button class="button danger" type="button" data-remove-shot="${index}">Remove</button>
            </div>
          </article>
        `
      )
      .join("");

    shotPreviewField.querySelectorAll("[data-remove-shot]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!editMode) return;
        removeScreenshotAt(Number(button.dataset.removeShot || "-1"));
      });
    });
  }

  function syncProfileForm() {
    profileForm.name.value = state.profile.name;
    profileForm.navRole.value = state.profile.navRole;
    profileForm.heroEyebrow.value = state.profile.heroEyebrow;
    profileForm.heroHeadingSuffix.value = state.profile.heroHeadingSuffix;
    profileForm.heroTechs.value = (state.profile.heroTechs || []).join(", ");
    profileForm.role.value = state.profile.role;
    profileForm.headline.value = state.profile.headline;
    profileForm.aboutShort.value = state.profile.aboutShort;
    profileForm.aboutLong.value = state.profile.aboutLong;
    profileForm.email.value = state.profile.email;
    profileForm.whatsapp.value = state.profile.whatsapp;
    profileForm.github.value = state.profile.github;
    profileForm.profileImage.value = state.profile.profileImage;
    if (profilePreviewImage) {
      profilePreviewImage.src = state.profile.profileImage || "./assets/profile-placeholder.svg";
    }
    profileForm.location.value = state.profile.location;
    profileForm.footerLead.value = state.profile.footerLead || `Built by ${state.profile.name}.`;
    profileForm.footerNote.value = state.profile.footerNote || "Production-ready portfolio";
    if (profileImageFileField) profileImageFileField.value = "";
  }

  function setEditMode(enabled) {
    editMode = enabled;

    const controls = document.querySelectorAll(
      "#profileForm input, #profileForm textarea, #profileForm button, #passkeyForm input, #passkeyForm button, #projectForm input, #projectForm textarea, #projectForm button, #analyticsVisibilityForm input, #analyticsVisibilityForm button, [data-edit], [data-delete], #resetData"
    );

    controls.forEach((node) => {
      if (node.id === "toggleEditMode") return;
      if (node.id === "adminLogoutBtn") return;
      node.disabled = !enabled;
    });

    if (toggleEditModeBtn) {
      toggleEditModeBtn.textContent = enabled ? "Disable Edit Mode" : "Enable Edit Mode";
      toggleEditModeBtn.classList.toggle("danger", enabled);
      toggleEditModeBtn.classList.toggle("primary", !enabled);
    }

    if (editModeState) {
      editModeState.textContent = enabled
        ? "Edit mode enabled: changes are allowed."
        : "View mode: editing is locked.";
    }
  }

  function syncProjectList() {
    if (!state.projects.length) {
      projectList.innerHTML = "<p class='muted'>No projects yet. Add your first project below.</p>";
      return;
    }

    projectList.innerHTML = state.projects
      .map(
        (project) => `
        <article class="admin-project">
          <div>
            <h4>${project.title}</h4>
            <p>${project.description}</p>
            <p class="muted">${project.languages.join(", ")}</p>
            <p class="muted">${screenshotsFor(project).length} image(s)</p>
          </div>
          <div class="admin-actions">
            <button class="button ghost" data-edit="${project.id}">Edit</button>
            <button class="button danger" data-delete="${project.id}">Delete</button>
          </div>
        </article>
      `
      )
      .join("");

    projectList.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!editMode) return;
        fillProjectForm(button.dataset.edit);
      });
    });

    projectList.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!editMode) return;
        try {
          await deleteProject(button.dataset.delete);
        } catch (error) {
          notify(error.message || "Failed to delete project");
        }
      });
    });

    setEditMode(editMode);
  }

  function clearProjectForm() {
    idField.value = "";
    titleField.value = "";
    descField.value = "";
    langField.value = "";
    shotsField.value = "";
    if (shotFilesField) shotFilesField.value = "";
    uploadedScreenshots = [];
    repoField.value = "";
    featField.checked = false;
    saveProjectLabel.textContent = "Add Project";
    updateScreenshotCount();
    renderScreenshotPreview();
  }

  function fillProjectForm(id) {
    const project = state.projects.find((item) => item.id === id);
    if (!project) return;

    idField.value = project.id;
    titleField.value = project.title;
    descField.value = project.description;
    langField.value = project.languages.join(", ");
    const allShots = screenshotsFor(project);
    const manualShots = allShots.filter((item) => !isDataUrl(item));
    const uploadedShots = allShots.filter((item) => isDataUrl(item));
    shotsField.value = manualShots.join("\n");
    uploadedScreenshots = uploadedShots;
    if (shotFilesField) shotFilesField.value = "";
    repoField.value = project.repo;
    featField.checked = project.featured;
    saveProjectLabel.textContent = "Update Project";
    updateScreenshotCount();
    renderScreenshotPreview();
    projectForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deleteProject(id) {
    const index = state.projects.findIndex((item) => item.id === id);
    if (index < 0) return;
    state.projects.splice(index, 1);
    await saveState();
    syncProjectList();
    notify("Project deleted");
  }

  if (profileImageFileField) {
    profileImageFileField.addEventListener("change", async () => {
      if (!editMode) return;
      const file = profileImageFileField.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await fileToDataUrl(file);
        profileForm.profileImage.value = dataUrl;
        if (profilePreviewImage) profilePreviewImage.src = dataUrl;
        notify("Profile image loaded");
      } catch {
        notify("Failed to load profile image");
      }
    });
  }

  if (shotsField) {
    shotsField.addEventListener("input", () => {
      updateScreenshotCount();
      renderScreenshotPreview();
    });
  }

  if (shotFilesField) {
    shotFilesField.addEventListener("change", async () => {
      if (!editMode) return;
      const files = Array.from(shotFilesField.files || []);
      if (!files.length) return;
      try {
        const dataUrls = await Promise.all(files.map((file) => fileToDataUrl(file)));
        const manual = parseScreenshots(shotsField.value);
        const existing = new Set([...manual, ...uploadedScreenshots]);
        const uniqueNew = [];
        let duplicateCount = 0;

        dataUrls.forEach((url) => {
          if (existing.has(url)) {
            duplicateCount += 1;
            return;
          }
          existing.add(url);
          uniqueNew.push(url);
        });

        uploadedScreenshots = [...uploadedScreenshots, ...uniqueNew];

        if (duplicateCount > 0 && uniqueNew.length > 0) {
          notify(`${uniqueNew.length} loaded, ${duplicateCount} duplicate skipped`);
        } else if (duplicateCount > 0) {
          notify(duplicateCount === 1 ? "You already chose this picture" : `You already chose ${duplicateCount} pictures`);
        } else if (uniqueNew.length > 0) {
          notify(`${uniqueNew.length} screenshot(s) loaded`);
        }

        updateScreenshotCount();
        renderScreenshotPreview();
      } catch {
        notify("Failed to load screenshot(s)");
      } finally {
        shotFilesField.value = "";
      }
    });
  }

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!editMode) return;

    state.profile = {
      name: profileForm.name.value.trim(),
      navRole: profileForm.navRole.value.trim(),
      heroEyebrow: profileForm.heroEyebrow.value.trim(),
      heroHeadingSuffix: profileForm.heroHeadingSuffix.value.trim(),
      heroTechs: profileForm.heroTechs.value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      role: profileForm.role.value.trim(),
      headline: profileForm.headline.value.trim(),
      aboutShort: profileForm.aboutShort.value.trim(),
      aboutLong: profileForm.aboutLong.value.trim(),
      email: profileForm.email.value.trim(),
      whatsapp: profileForm.whatsapp.value.trim(),
      github: profileForm.github.value.trim(),
      profileImage: profileForm.profileImage.value.trim(),
      location: profileForm.location.value.trim(),
      footerLead: profileForm.footerLead.value.trim(),
      footerNote: profileForm.footerNote.value.trim()
    };

    try {
      await saveState();
      notify("Profile updated");
      showSaveBanner("Profile saved to database");
      pulseSection("admin-profile");
    } catch (error) {
      notify(error.message || "Failed to save profile");
    }
  });

  projectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!editMode) return;

    const id = idField.value.trim() || `project-${Date.now()}`;
    const screenshots = allScreenshots();
    const payload = {
      id,
      title: titleField.value.trim(),
      description: descField.value.trim(),
      languages: langField.value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      screenshot: screenshots[0] || "./assets/project-placeholder-1.svg",
      screenshots,
      repo: repoField.value.trim(),
      featured: featField.checked
    };

    const index = state.projects.findIndex((item) => item.id === id);
    if (index >= 0) {
      state.projects[index] = payload;
      notify("Project updated");
    } else {
      state.projects.unshift(payload);
      notify("Project added");
    }

    try {
      await saveState();
      syncProjectList();
      clearProjectForm();
      showSaveBanner("Project changes saved to database");
      pulseSection("admin-projects");
    } catch (error) {
      notify(error.message || "Failed to save project");
    }
  });

  document.getElementById("clearProjectForm").addEventListener("click", () => {
    if (!editMode) return;
    clearProjectForm();
  });

  if (resetButton) {
    resetButton.addEventListener("click", async () => {
      if (!editMode) return;
      try {
        const resetData = await dataApi.reset();
        state.profile = resetData.profile;
        state.projects = resetData.projects;
        syncProfileForm();
        syncProjectList();
        clearProjectForm();
        notify("Reset to default data");
        showSaveBanner("Data reset in database");
        pulseSection("admin-overview");
      } catch (error) {
        notify(error.message || "Failed to reset data");
      }
    });
  }

  if (toggleEditModeBtn) {
    toggleEditModeBtn.addEventListener("click", () => {
      setEditMode(!editMode);
    });
  }

  if (analyticsRefreshBtn) {
    analyticsRefreshBtn.addEventListener("click", async () => {
      try {
        const summary = await fetchAnalyticsSummary();
        renderAnalytics(summary);
        notify("Analytics refreshed");
      } catch (error) {
        notify(error.message || "Failed to refresh analytics");
      }
    });
  }

  if (analyticsVisibilityForm) {
    analyticsVisibilityForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!editMode) return;
      const settings = {
        showTotalVisits: Boolean(document.getElementById("showTotalVisits")?.checked),
        showUniqueVisitors: Boolean(document.getElementById("showUniqueVisitors")?.checked),
        showProjectPreviews: Boolean(document.getElementById("showProjectPreviews")?.checked),
        showContactClicks: Boolean(document.getElementById("showContactClicks")?.checked)
      };
      try {
        await saveAnalyticsSettings(settings);
        notify("Analytics visibility settings saved");
        showSaveBanner("Analytics visibility updated");
        pulseSection("admin-analytics");
      } catch (error) {
        notify(error.message || "Failed to save analytics visibility");
      }
    });
  }

  if (passkeyForm) {
    passkeyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!editMode) return;
      if (!window.AdminAuth?.changePasscode) {
        notify("Auth module unavailable");
        return;
      }

      const currentPass = String(document.getElementById("currentPasskey")?.value || "");
      const nextPass = String(document.getElementById("newPasskey")?.value || "");
      const confirmPass = String(document.getElementById("confirmPasskey")?.value || "");

      if (nextPass !== confirmPass) {
        notify("New passkeys do not match");
        return;
      }

      const result = await window.AdminAuth.changePasscode(currentPass, nextPass);
      if (!result.ok) {
        notify(result.message || "Failed to change passkey");
        return;
      }

      passkeyForm.reset();
      notify("Passkey changed successfully");
      showSaveBanner("Passkey changed successfully");
      pulseSection("admin-profile");
    });
  }

  (async function init() {
    try {
      const [remote, analytics] = await Promise.all([dataApi.loadRemote(), fetchAnalyticsSummary()]);
      state.profile = remote.profile;
      state.projects = remote.projects;
      renderAnalytics(analytics);
    } catch {
      notify("Could not load remote data. Showing cached data.");
    }

    syncProfileForm();
    syncProjectList();
    clearProjectForm();
    renderScreenshotPreview();
    setEditMode(false);
  })();
})();
