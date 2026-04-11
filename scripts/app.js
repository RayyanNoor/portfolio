(function () {
  const dataApi = window.PortfolioData;
  if (!dataApi) return;

  const THEME_KEY = "rayan_portfolio_theme_mode";
  const SYNC_KEY = "rayan_portfolio_last_update";
  let state = dataApi.load();

  let activeFilter = "all";
  let activeSort = "featured";
  let currentProjectsPage = 1;
  let themeMode = localStorage.getItem(THEME_KEY) || "system";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const galleryTimers = [];
  const PROJECTS_PER_PAGE = 4;
  const VISITOR_KEY = "rayan_portfolio_visitor_id";
  let pageViewTracked = false;

  function resolvedTheme(mode) {
    if (mode === "light" || mode === "dark") return mode;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(mode) {
    const theme = resolvedTheme(mode);
    document.documentElement.classList.add("theme-animate");
    document.documentElement.setAttribute("data-theme", theme);
    clearTimeout(window.themeAnimTimer);
    window.themeAnimTimer = setTimeout(() => {
      document.documentElement.classList.remove("theme-animate");
    }, 380);
  }

  function wireThemeToggle() {
    applyTheme(themeMode);
    const themeButtons = document.querySelectorAll("[data-theme-mode]");
    if (themeButtons.length) {
      themeButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.themeMode === themeMode);
        button.addEventListener("click", () => {
          themeMode = button.dataset.themeMode || "system";
          localStorage.setItem(THEME_KEY, themeMode);
          applyTheme(themeMode);
          themeButtons.forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.themeMode === themeMode);
          });
        });
      });
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", () => {
      if (themeMode === "system") {
        applyTheme("system");
      }
    });
  }

  function wireScrollProgress() {
    if (reduceMotion) return;
    if (document.getElementById("scrollProgress")) return;
    const bar = document.createElement("div");
    bar.id = "scrollProgress";
    bar.className = "scroll-progress";
    document.body.appendChild(bar);

    function update() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? (window.scrollY / max) * 100 : 0;
      bar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  function wireCursorGlow() {
    if (reduceMotion) return;
    if (window.matchMedia("(hover: none)").matches) return;
    if (document.getElementById("cursorGlow")) return;

    const glow = document.createElement("div");
    glow.id = "cursorGlow";
    glow.className = "cursor-glow";
    document.body.appendChild(glow);
    document.documentElement.classList.add("motion-ready");

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let tx = mx;
    let ty = my;

    function move(event) {
      tx = event.clientX;
      ty = event.clientY;
    }

    function frame() {
      mx += (tx - mx) * 0.12;
      my += (ty - my) * 0.12;
      glow.style.left = `${mx}px`;
      glow.style.top = `${my}px`;
      requestAnimationFrame(frame);
    }

    window.addEventListener("mousemove", move, { passive: true });
    requestAnimationFrame(frame);
  }

  function wireHeroParallax() {
    if (reduceMotion) return;
    const hero = document.getElementById("home");
    if (!hero) return;
    hero.classList.add("motion-parallax");

    hero.addEventListener("mousemove", (event) => {
      const rect = hero.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const tiltY = (px - 0.5) * 4;
      const tiltX = (0.5 - py) * 3;
      hero.style.setProperty("--tiltX", `${tiltX.toFixed(2)}deg`);
      hero.style.setProperty("--tiltY", `${tiltY.toFixed(2)}deg`);
    });

    hero.addEventListener("mouseleave", () => {
      hero.style.setProperty("--tiltX", "0deg");
      hero.style.setProperty("--tiltY", "0deg");
    });
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function setImage(id, src, alt) {
    const node = document.getElementById(id);
    if (!node) return;
    node.src = src;
    node.alt = alt;
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => toast.classList.remove("show"), 1700);
  }

  function getVisitorId() {
    let id = localStorage.getItem(VISITOR_KEY);
    if (id) return id;
    id = (crypto.randomUUID
      ? crypto.randomUUID()
      : `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`).slice(0, 80);
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  }

  async function trackEvent(eventType, meta = {}) {
    try {
      await fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId: getVisitorId(),
          eventType,
          path: window.location.pathname + window.location.hash,
          meta
        })
      });
    } catch {
      // Analytics should not break UI.
    }
  }

  async function renderPublicAnalytics() {
    const section = document.getElementById("publicStatsSection");
    const grid = document.getElementById("publicStatsGrid");
    if (!section || !grid) return;

    try {
      const response = await fetch("/api/analytics/public");
      if (!response.ok) throw new Error("Failed to load analytics");
      const body = await response.json();
      const stats = body?.stats || {};
      const entries = Object.entries(stats);

      if (!entries.length) {
        section.hidden = true;
        grid.innerHTML = "";
        return;
      }

      const labels = {
        totalVisits: "Total Visits",
        uniqueVisitors: "Unique Visitors",
        projectPreviews: "Project Previews",
        contactClicks: "Contact Clicks"
      };

      grid.innerHTML = entries
        .map(
          ([key, value]) => `
            <article class="metric-card panel">
              <p>${labels[key] || key}</p>
              <strong>${Number(value || 0)}</strong>
            </article>
          `
        )
        .join("");
      section.hidden = false;
    } catch {
      section.hidden = true;
      grid.innerHTML = "";
    }
  }

  function normalizeText(input) {
    return String(input || "").trim().toLowerCase();
  }

  function shortText(input, maxLength = 150) {
    const text = String(input || "").trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trimEnd()}…`;
  }

  function uniqueLanguages(projects) {
    const set = new Set();
    projects.forEach((project) => {
      project.languages.forEach((language) => set.add(language));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  async function reloadState() {
    try {
      await dataApi.loadRemote();
    } catch (error) {
      console.warn("Using cached portfolio data.", error);
    }
    state = dataApi.load();
  }

  function applyProfile() {
    const { profile } = state;

    document.title = `${profile.name} | Software Engineer`;
    setText("navName", profile.name);
    setText("navRole", profile.navRole);
    setText("heroName", profile.name);
    setText("heroEyebrow", profile.heroEyebrow);
    setText("heroHeadingSuffix", profile.heroHeadingSuffix);
    setText("heroRole", profile.role);
    setText("heroHeadline", profile.headline);
    setText("aboutShort", profile.aboutShort);
    setText("aboutLong", profile.aboutLong);
    setText("contactName", profile.name);
    setText("contactRole", profile.role);
    setText("contactLocation", profile.location);
    setText("footerLead", profile.footerLead || `Built by ${profile.name}.`);
    setText("footerNote", profile.footerNote || "Production-ready portfolio");

    setImage("heroImage", profile.profileImage, `${profile.name} profile picture`);
    setImage("contactImage", profile.profileImage, `${profile.name} profile picture`);

    const githubLinks = document.querySelectorAll("[data-profile='github']");
    githubLinks.forEach((link) => {
      link.href = profile.github;
      link.textContent = profile.github.replace("https://", "");
    });

    const emailLinks = document.querySelectorAll("[data-profile='email']");
    emailLinks.forEach((link) => {
      link.href = `mailto:${profile.email}`;
      link.textContent = profile.email;
    });

    const waNumber = String(profile.whatsapp || "").replace(/[^\d]/g, "");
    const whatsappLinks = document.querySelectorAll("[data-profile='whatsapp']");
    whatsappLinks.forEach((link) => {
      link.href = `https://wa.me/${waNumber}`;
    });
  }

  function projectCard(project) {
    const tags = project.languages.map((item) => `<span class=\"tag\">${item}</span>`).join("");
    const screenshots = Array.isArray(project.screenshots) && project.screenshots.length
      ? project.screenshots
      : [project.screenshot];

    const gallerySlides = screenshots
      .map(
        (image, index) => `
          <img class="project-slide ${index === 0 ? "active" : ""}" data-gallery-slide="${index}" src="${image}" alt="Screenshot ${index + 1} of ${project.title}" loading="lazy">
        `
      )
      .join("");

    const galleryDots = screenshots
      .map(
        (_, index) => `
          <button class="gallery-dot ${index === 0 ? "active" : ""}" type="button" data-gallery-dot="${index}" aria-label="Show screenshot ${index + 1}"></button>
        `
      )
      .join("");

    const galleryControls = screenshots.length > 1
      ? `
        <div class="gallery-controls">
          <button class="gallery-btn" type="button" data-gallery-prev aria-label="Previous screenshot">&lt;</button>
          <div class="gallery-dots">${galleryDots}</div>
          <button class="gallery-btn" type="button" data-gallery-next aria-label="Next screenshot">&gt;</button>
        </div>
      `
      : "";

    return `
      <article class="project-card reveal" data-preview-card="${project.id}" tabindex="0" aria-label="Open ${project.title} details">
        <div class="project-gallery ${screenshots.length > 1 ? "" : "single"}" data-gallery>
          <div class="project-gallery-stage">
            ${gallerySlides}
          </div>
          ${galleryControls}
        </div>
        <div class="project-body">
          <h3>${project.title}</h3>
          <p class="project-summary">${shortText(project.description, 150)}</p>
          <div class="tag-row">${tags}</div>
          <div class="button-row">
            <button class="button preview" type="button" data-preview="${project.id}">Preview Project</button>
            <a class="button ghost" href="${project.repo}" target="_blank" rel="noreferrer">GitHub Repository</a>
          </div>
        </div>
      </article>
    `;
  }

  function clearGalleryTimers() {
    while (galleryTimers.length) {
      clearInterval(galleryTimers.pop());
    }
  }

  function wireProjectGalleries() {
    const galleries = document.querySelectorAll("[data-gallery]");
    galleries.forEach((gallery) => {
      const slides = Array.from(gallery.querySelectorAll("[data-gallery-slide]"));
      if (slides.length < 2) return;

      const dots = Array.from(gallery.querySelectorAll("[data-gallery-dot]"));
      const prev = gallery.querySelector("[data-gallery-prev]");
      const next = gallery.querySelector("[data-gallery-next]");
      let index = 0;
      let sliding = false;

      function setSlide(nextIndex) {
        if (sliding) return;
        const targetIndex = (nextIndex + slides.length) % slides.length;
        if (targetIndex === index) return;

        const current = slides[index];
        const target = slides[targetIndex];
        if (!current || !target) return;

        sliding = true;
        current.style.zIndex = "2";
        target.style.zIndex = "3";
        target.classList.add("active");

        window.setTimeout(() => {
          current.classList.remove("active");
          current.style.zIndex = "";
          target.style.zIndex = "";
          index = targetIndex;
          sliding = false;
        }, 520);

        dots.forEach((dot, dotIndex) => {
          dot.classList.toggle("active", dotIndex === targetIndex);
        });
      }

      prev?.addEventListener("click", () => setSlide(index - 1));
      next?.addEventListener("click", () => setSlide(index + 1));
      dots.forEach((dot, dotIndex) => {
        dot.addEventListener("click", () => setSlide(dotIndex));
      });

      if (!reduceMotion) {
        const timer = window.setInterval(() => setSlide(index + 1), 3800);
        galleryTimers.push(timer);
      }
    });
  }

  function wireProjectPreviewModal() {
    const modal = document.getElementById("projectModal");
    const closeButton = document.getElementById("projectModalClose");
    const closeLayer = modal?.querySelector("[data-modal-close]");
    const image = document.getElementById("modalImage");
    const title = document.getElementById("modalTitle");
    const description = document.getElementById("modalDescription");
    const langs = document.getElementById("modalLanguages");
    const repo = document.getElementById("modalRepo");
    const thumbs = document.getElementById("modalThumbs");
    const prev = document.getElementById("modalPrev");
    const next = document.getElementById("modalNext");
    const projectsGrid = document.getElementById("projectsGrid");

    if (!modal || !image || !title || !description || !langs || !repo || !thumbs || !prev || !next || !projectsGrid) return;

    let currentProject = null;
    let currentIndex = 0;
    let closeTimer = 0;
    let modalAutoTimer = 0;

    function screenshotsFor(project) {
      if (!project) return [];
      if (Array.isArray(project.screenshots) && project.screenshots.length) return project.screenshots;
      return project.screenshot ? [project.screenshot] : ["./assets/project-placeholder-1.svg"];
    }

    function renderModalImage() {
      if (!currentProject) return;
      const images = screenshotsFor(currentProject);
      const src = images[currentIndex] || images[0];
      image.classList.remove("show");
      requestAnimationFrame(() => {
        image.src = src;
        image.alt = `${currentProject.title} preview ${currentIndex + 1}`;
        image.classList.add("show");
      });
      thumbs.querySelectorAll("[data-modal-thumb]").forEach((button, index) => {
        button.classList.toggle("active", index === currentIndex);
      });
    }

    function stopModalAuto() {
      if (!modalAutoTimer) return;
      clearInterval(modalAutoTimer);
      modalAutoTimer = 0;
    }

    function startModalAuto() {
      stopModalAuto();
      if (!currentProject) return;
      const images = screenshotsFor(currentProject);
      if (images.length < 2) return;
      modalAutoTimer = window.setInterval(() => {
        currentIndex = (currentIndex + 1) % images.length;
        renderModalImage();
      }, 3200);
    }

    function openModal(projectId) {
      const project = state.projects.find((item) => item.id === projectId);
      if (!project) return;
      void trackEvent("project_preview", { projectId });
      currentProject = project;
      currentIndex = 0;

      title.textContent = project.title;
      description.textContent = project.description;
      langs.innerHTML = project.languages.map((language) => `<span class="tag">${language}</span>`).join("");
      repo.href = project.repo;

      const images = screenshotsFor(project);
      thumbs.innerHTML = images
        .map(
          (src, index) => `
            <button class="modal-thumb ${index === 0 ? "active" : ""}" type="button" data-modal-thumb="${index}" aria-label="Show image ${index + 1}">
              <img src="${src}" alt="Thumbnail ${index + 1} for ${project.title}" loading="lazy">
            </button>
          `
        )
        .join("");

      thumbs.querySelectorAll("[data-modal-thumb]").forEach((button) => {
        button.addEventListener("click", () => {
          currentIndex = Number(button.dataset.modalThumb || 0);
          renderModalImage();
        });
      });

      prev.hidden = images.length < 2;
      next.hidden = images.length < 2;
      renderModalImage();
      startModalAuto();

      clearTimeout(closeTimer);
      modal.classList.remove("open");
      modal.hidden = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          modal.classList.add("open");
        });
      });
      document.body.style.overflow = "hidden";
      document.body.classList.add("modal-open");
    }

    function closeModal() {
      stopModalAuto();
      modal.classList.remove("open");
      clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => {
        modal.hidden = true;
      }, 240);
      document.body.style.overflow = "";
      document.body.classList.remove("modal-open");
    }

    projectsGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-preview]");
      if (button) {
        openModal(button.dataset.preview);
        return;
      }

      if (event.target.closest("a, button, input, select, textarea, label")) return;
      const card = event.target.closest("[data-preview-card]");
      if (!card) return;
      openModal(card.dataset.previewCard);
    });

    projectsGrid.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest("[data-preview-card]");
      if (!card) return;
      event.preventDefault();
      openModal(card.dataset.previewCard);
    });

    closeButton.addEventListener("click", closeModal);
    closeLayer?.addEventListener("click", closeModal);
    prev.addEventListener("click", () => {
      if (!currentProject) return;
        const images = screenshotsFor(currentProject);
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        renderModalImage();
        startModalAuto();
      });
      next.addEventListener("click", () => {
      if (!currentProject) return;
        const images = screenshotsFor(currentProject);
        currentIndex = (currentIndex + 1) % images.length;
        renderModalImage();
        startModalAuto();
      });

    document.addEventListener("keydown", (event) => {
      if (modal.hidden) return;
      if (event.key === "Escape") closeModal();
      if (event.key === "ArrowLeft") prev.click();
      if (event.key === "ArrowRight") next.click();
    });
  }

  function filteredProjects() {
    const searchValue = normalizeText(document.getElementById("projectSearch")?.value);
    const sortValue = activeSort;

    let data = state.projects.filter((project) => {
      if (activeFilter !== "all") {
        const contains = project.languages.some((language) => normalizeText(language) === normalizeText(activeFilter));
        if (!contains) return false;
      }

      if (!searchValue) return true;

      const blob = normalizeText(`${project.title} ${project.description} ${project.languages.join(" ")}`);
      return blob.includes(searchValue);
    });

    data = data.sort((a, b) => {
      if (sortValue === "title-asc") return a.title.localeCompare(b.title);
      if (sortValue === "title-desc") return b.title.localeCompare(a.title);
      if (a.featured === b.featured) return a.title.localeCompare(b.title);
      return a.featured ? -1 : 1;
    });

    return data;
  }

  function renderSortPills() {
    const pills = document.querySelectorAll("[data-sort]");
    pills.forEach((pill) => {
      pill.classList.toggle("active", pill.dataset.sort === activeSort);
    });
  }

  function renderProjects() {
    const projectsGrid = document.getElementById("projectsGrid");
    const pagination = document.getElementById("projectsPagination");
    const empty = document.getElementById("projectEmpty");
    if (!projectsGrid) return;

    clearGalleryTimers();
    const data = filteredProjects();
    const totalPages = Math.max(1, Math.ceil(data.length / PROJECTS_PER_PAGE));
    currentProjectsPage = Math.min(currentProjectsPage, totalPages);
    const from = (currentProjectsPage - 1) * PROJECTS_PER_PAGE;
    const pageItems = data.slice(from, from + PROJECTS_PER_PAGE);

    if (!data.length) {
      projectsGrid.innerHTML = "";
      if (pagination) pagination.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;
    projectsGrid.innerHTML = pageItems.map(projectCard).join("");
    wireProjectGalleries();
    renderProjectsPagination(data.length);
    wireRevealAnimations();
    wireCardTilt();
  }

  function renderProjectsPagination(totalItems) {
    const pagination = document.getElementById("projectsPagination");
    if (!pagination) return;

    const totalPages = Math.ceil(totalItems / PROJECTS_PER_PAGE);
    if (totalPages <= 1) {
      pagination.innerHTML = "";
      return;
    }

    const maxVisible = 5;
    const start = Math.max(1, Math.min(currentProjectsPage - 2, totalPages - maxVisible + 1));
    const end = Math.min(totalPages, start + maxVisible - 1);
    const pages = [];
    for (let p = start; p <= end; p += 1) {
      pages.push(p);
    }

    pagination.innerHTML = `
      <button class="page-btn edge" type="button" data-page-nav="prev" ${currentProjectsPage === 1 ? "disabled" : ""}>Prev</button>
      ${pages
        .map(
          (p) => `<button class="page-btn ${p === currentProjectsPage ? "active" : ""}" type="button" data-page="${p}">${p}</button>`
        )
        .join("")}
      <button class="page-btn edge" type="button" data-page-nav="next" ${currentProjectsPage === totalPages ? "disabled" : ""}>Next</button>
    `;

    pagination.querySelectorAll("[data-page]").forEach((button) => {
      button.addEventListener("click", () => {
        currentProjectsPage = Number(button.dataset.page || "1");
        renderProjects();
        pagination.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });

    const prev = pagination.querySelector("[data-page-nav='prev']");
    const next = pagination.querySelector("[data-page-nav='next']");

    prev?.addEventListener("click", () => {
      if (currentProjectsPage <= 1) return;
      currentProjectsPage -= 1;
      renderProjects();
      pagination.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    next?.addEventListener("click", () => {
      if (currentProjectsPage >= totalPages) return;
      currentProjectsPage += 1;
      renderProjects();
      pagination.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function renderFilters() {
    const filters = document.getElementById("stackFilters");
    if (!filters) return;

    const langs = uniqueLanguages(state.projects);
    const options = ["all", ...langs];

    filters.innerHTML = options
      .map((option) => {
        const label = option === "all" ? "all" : option;
        const activeClass = option === activeFilter ? "active" : "";
        return `<button class="stack-filter ${activeClass}" data-filter="${option}" type="button">${label}</button>`;
      })
      .join("");

    filters.querySelectorAll("[data-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;
        currentProjectsPage = 1;
        renderFilters();
        renderProjects();
      });
    });
  }

  function renderLanguageCloud() {
    const cloud = document.getElementById("languageCloud");
    if (!cloud) return;

    const explicit = Array.isArray(state.profile.heroTechs) ? state.profile.heroTechs : [];
    const langs = explicit.length ? explicit : uniqueLanguages(state.projects);
    cloud.innerHTML = langs
      .slice(0, 10)
      .map((lang, index) => `<span class="chip float-chip" style="animation-delay:${index * 120}ms">${lang}</span>`)
      .join("");
  }

  async function refreshRenderedContent() {
    await reloadState();
    applyProfile();
    renderLanguageCloud();
    renderSortPills();
    renderFilters();
    renderProjects();
    renderMetrics();
    await renderPublicAnalytics();
  }

  function animateMetric(id, target) {
    const node = document.getElementById(id);
    if (!node) return;

    node.dataset.target = String(target);
    const duration = 700;
    const start = performance.now();

    function step(time) {
      const progress = Math.min((time - start) / duration, 1);
      node.textContent = String(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  function renderMetrics() {
    const projectCount = state.projects.length;
    const stackCount = uniqueLanguages(state.projects).length;
    const featuredCount = state.projects.filter((project) => project.featured).length;

    animateMetric("metricProjects", projectCount);
    animateMetric("metricStacks", stackCount);
    animateMetric("metricFeatured", featuredCount);
  }

  function wireExplorerTools() {
    const searchInput = document.getElementById("projectSearch");
    const sortPills = document.querySelectorAll("[data-sort]");

    function animateSortRefresh() {
      const grid = document.getElementById("projectsGrid");
      if (!grid || reduceMotion) {
        renderProjects();
        return;
      }
      grid.classList.add("sorting");
      window.setTimeout(() => {
        renderProjects();
        requestAnimationFrame(() => grid.classList.remove("sorting"));
      }, 120);
    }

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        currentProjectsPage = 1;
        renderProjects();
      });
    }

    if (sortPills.length) {
      sortPills.forEach((pill) => {
        pill.addEventListener("click", () => {
          activeSort = pill.dataset.sort || "featured";
          renderSortPills();
          currentProjectsPage = 1;
          animateSortRefresh();
        });
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && document.activeElement !== searchInput) {
        event.preventDefault();
        searchInput?.focus();
      }
    });
  }

  function wireCopyEmail() {
    const button = document.getElementById("copyEmailBtn");
    if (!button) return;

    button.addEventListener("click", async () => {
      const email = state.profile.email;
      if (!email) return;
      void trackEvent("contact_click", { channel: "copy_email" });
      try {
        await navigator.clipboard.writeText(email);
        showToast("Email copied");
      } catch {
        showToast("Could not copy email");
      }
    });
  }

  function wireContactTracking() {
    const channels = [
      { selector: "[data-profile='whatsapp']", channel: "whatsapp" },
      { selector: "[data-profile='email']", channel: "email" },
      { selector: "[data-profile='github']", channel: "github" }
    ];

    channels.forEach(({ selector, channel }) => {
      document.querySelectorAll(selector).forEach((node) => {
        node.addEventListener("click", () => {
          void trackEvent("contact_click", { channel });
        });
      });
    });

    const projectsGrid = document.getElementById("projectsGrid");
    if (!projectsGrid) return;

    projectsGrid.addEventListener("click", (event) => {
      const link = event.target.closest("a.button.ghost");
      if (!link) return;
      const card = event.target.closest("[data-preview-card]");
      const projectId = card?.dataset.previewCard || "unknown";
      void trackEvent("project_repo_click", { projectId });
    });
  }

  function wireConsole() {
    const form = document.getElementById("consoleForm");
    const input = document.getElementById("consoleInput");
    const output = document.getElementById("consoleOutput");
    if (!form || !input || !output) return;

    function print(line, className = "") {
      const p = document.createElement("p");
      p.className = `console-line ${className}`.trim();
      p.textContent = line;
      output.appendChild(p);
      output.scrollTop = output.scrollHeight;
    }

    const commands = {
      help: () => print("Commands: help, projects, contact, email, whatsapp, github, clear", "output"),
      projects: () => {
        document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" });
        print("Navigating to projects...", "output");
      },
      contact: () => {
        document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
        print("Navigating to contact...", "output");
      },
      email: () => {
        window.location.href = `mailto:${state.profile.email}`;
        print("Opening email client...", "output");
      },
      whatsapp: () => {
        const waNumber = String(state.profile.whatsapp || "").replace(/[^\d]/g, "");
        window.open(`https://wa.me/${waNumber}`, "_blank", "noopener,noreferrer");
        print("Opening WhatsApp...", "output");
      },
      github: () => {
        window.open(state.profile.github, "_blank", "noopener,noreferrer");
        print("Opening GitHub...", "output");
      },
      clear: () => {
        output.innerHTML = "";
      }
    };

    print("Portfolio console ready. Type 'help' to begin.", "output");

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const command = normalizeText(input.value);
      if (!command) return;

      print(`$ ${command}`);

      if (commands[command]) {
        void trackEvent("console_command", { command });
        commands[command]();
      } else {
        print(`Unknown command: ${command}. Type 'help'.`, "output");
      }

      input.value = "";
    });
  }

  function wireMobileMenu() {
    const menuButton = document.getElementById("menuButton");
    const nav = document.getElementById("mainNav");
    if (!menuButton || !nav) return;

    menuButton.addEventListener("click", () => nav.classList.toggle("open"));

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => nav.classList.remove("open"));
    });
  }

  function activateSectionNav() {
    const nav = document.getElementById("mainNav");
    if (!nav) return;

    const navLinks = Array.from(nav.querySelectorAll(".nav-link[href^='#']"));
    if (!navLinks.length) return;

    const mapped = navLinks
      .map((link) => {
        const hash = link.getAttribute("href") || "";
        const section = hash ? document.querySelector(hash) : null;
        return { link, hash, section };
      })
      .filter((item) => item.section);

    if (!mapped.length) return;

    const themeSwitch = nav.querySelector(".theme-switch");
    const ordered = [...mapped].sort(
      (a, b) => a.section.offsetTop - b.section.offsetTop
    );

    ordered.forEach(({ link }) => {
      nav.insertBefore(link, themeSwitch || null);
    });

    function setActive(hash) {
      navLinks.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === hash);
      });
    }

    function updateActiveByScroll() {
      const checkpoint = window.scrollY + 120;
      let activeHash = ordered[0].hash;

      ordered.forEach(({ hash, section }) => {
        if (section.offsetTop <= checkpoint) {
          activeHash = hash;
        }
      });

      setActive(activeHash);
    }

    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        const hash = link.getAttribute("href") || "";
        if (hash) setActive(hash);
      });
    });

    window.addEventListener("scroll", updateActiveByScroll, { passive: true });
    window.addEventListener("resize", updateActiveByScroll);
    window.addEventListener("hashchange", () => {
      const hash = window.location.hash;
      if (hash) setActive(hash);
      updateActiveByScroll();
    });

    updateActiveByScroll();
  }

  function wireRevealAnimations() {
    const revealNodes = document.querySelectorAll(".reveal:not(.in-view)");
    if (!revealNodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    revealNodes.forEach((node, index) => {
      node.style.transitionDelay = `${Math.min(index * 50, 240)}ms`;
      observer.observe(node);
    });
  }

  function wireCardTilt() {
    if (reduceMotion) return;
    const cards = document.querySelectorAll(".project-card");
    cards.forEach((card) => {
      card.addEventListener("mousemove", (event) => {
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        const tiltY = (px - 0.5) * 6;
        const tiltX = (0.5 - py) * 4;
        card.style.transform = `perspective(900px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) translateY(-3px)`;
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
      });
    });
  }

  function wireAdminSyncRefresh() {
    window.addEventListener("storage", (event) => {
      if (event.key === SYNC_KEY || event.key === dataApi.CACHE_KEY) {
        void refreshRenderedContent();
      }
    });

    window.addEventListener("focus", () => {
      void refreshRenderedContent();
    });
  }

  wireThemeToggle();
  wireScrollProgress();
  wireCursorGlow();
  wireHeroParallax();
  wireExplorerTools();
  wireCopyEmail();
  wireConsole();
  wireMobileMenu();
  activateSectionNav();
  wireRevealAnimations();
  wireAdminSyncRefresh();
  wireProjectPreviewModal();
  wireContactTracking();
  void refreshRenderedContent();
  if (!pageViewTracked) {
    pageViewTracked = true;
    void trackEvent("page_view", { hash: window.location.hash || "#home" });
  }
})();
