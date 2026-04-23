(function () {
  const CACHE_KEY = "rayan_portfolio_cache_v2";
  const API_BASE = "";

  const defaultData = {
    profile: {
      name: "Rayan",
      navRole: "Software Engineer",
      heroHeadingSuffix: "builds software that ships.",
      heroEyebrow: "AVAILABLE FOR FREELANCE + CONTRACT",
      heroTechs: ["TypeScript", "React", "Node.js", "PostgreSQL", "Docker"],
      role: "Full-Stack Software Engineer",
      headline:
        "I build production-grade web platforms with clean architecture, measurable performance, and premium UX.",
      aboutShort:
        "I specialize in building scalable products that are fast, maintainable, and business-focused.",
      aboutLong:
        "I turn requirements into reliable software systems, from interface architecture to backend services and data design. My engineering process emphasizes code quality, performance, and clear delivery so clients get software that works in production, not just in demos.",
      email: "rayan@example.com",
      whatsapp: "966500000000",
      github: "https://github.com/RayyanNoor",
      profileImage: "./assets/profile-placeholder.svg",
      location: "Riyadh, Saudi Arabia",
      footerLead: "Built by Rayan.",
      footerNote: "Production-ready portfolio"
    },
    projects: [
      {
        id: "portfolio-site",
        title: "Interactive Engineering Portfolio",
        description:
          "Single-page portfolio with dynamic project explorer, filters, command console, and dedicated admin dashboard.",
        languages: ["HTML", "CSS", "JavaScript"],
        screenshot: "./assets/project-placeholder-1.svg",
        screenshots: ["./assets/project-placeholder-1.svg"],
        repo: "https://github.com/RayyanNoor/portfolio",
        featured: true
      },
      {
        id: "analytics-workspace",
        title: "Real-Time Analytics Workspace",
        description:
          "Built a dashboard for business metrics with modular components and API-driven data pipelines.",
        languages: ["React", "TypeScript", "Node.js", "PostgreSQL"],
        screenshot: "./assets/project-placeholder-2.svg",
        screenshots: ["./assets/project-placeholder-2.svg", "./assets/project-placeholder-1.svg"],
        repo: "https://github.com/RayyanNoor/analytics-workspace",
        featured: true
      },
      {
        id: "api-gateway",
        title: "Service Gateway API",
        description:
          "Implemented authentication, request validation, rate limiting, and observability for multi-service applications.",
        languages: ["Node.js", "Express", "Redis", "Docker"],
        screenshot: "./assets/project-placeholder-1.svg",
        screenshots: ["./assets/project-placeholder-1.svg"],
        repo: "https://github.com/RayyanNoor/service-gateway",
        featured: false
      }
    ]
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalize(data) {
    if (!data || typeof data !== "object") return clone(defaultData);
    const profile = { ...defaultData.profile, ...(data.profile || {}) };
    const projects = Array.isArray(data.projects)
      ? data.projects.map((project, index) => {
          const screenshots = Array.isArray(project.screenshots)
            ? project.screenshots.filter(Boolean)
            : project.screenshot
              ? [project.screenshot]
              : ["./assets/project-placeholder-1.svg"];

          return {
            id: project.id || `project-${index + 1}`,
            title: project.title || "Untitled Project",
            description: project.description || "",
            languages: Array.isArray(project.languages) ? project.languages : [],
            screenshot: screenshots[0] || "./assets/project-placeholder-1.svg",
            screenshots,
            repo: project.repo || "",
            featured: Boolean(project.featured)
          };
        })
      : clone(defaultData.projects);

    return { profile, projects };
  }

  function saveCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn("Failed to cache portfolio data", error);
    }
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return normalize(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  let memory = loadCache() || clone(defaultData);

  function handleUnauthorized() {
    const next = encodeURIComponent("/admin");
    window.location.replace(`/admin-login?next=${next}`);
  }

  async function loadRemote() {
    const response = await fetch(`${API_BASE}/api/portfolio`, {
      method: "GET",
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error("Failed to load portfolio data from API.");
    }

    const body = await response.json();
    memory = normalize(body.content);
    saveCache(memory);
    return clone(memory);
  }

  function load() {
    return clone(memory);
  }

  async function save(data) {
    const safe = normalize(data);
    const response = await fetch(`${API_BASE}/api/admin/portfolio`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({ content: safe })
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error("Session expired. Please log in again.");
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Failed to save portfolio data.");
    }

    const body = await response.json();
    memory = normalize(body.content);
    saveCache(memory);
    return clone(memory);
  }

  async function reset() {
    const response = await fetch(`${API_BASE}/api/admin/reset`, {
      method: "POST",
      credentials: "include"
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error("Session expired. Please log in again.");
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Failed to reset portfolio data.");
    }

    const body = await response.json();
    memory = normalize(body.content);
    saveCache(memory);
    return clone(memory);
  }

  window.PortfolioData = {
    CACHE_KEY,
    defaultData,
    normalize,
    load,
    loadRemote,
    save,
    reset
  };
})();
