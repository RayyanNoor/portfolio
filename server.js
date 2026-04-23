const fs = require("fs");
const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { Pool } = require("pg");

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const COOKIE_NAME = "portfolio_admin_session";
const COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 8;
const IS_PROD = process.env.NODE_ENV === "production";

if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL in environment.");
}

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET in environment.");
}

if (!ADMIN_PASSCODE) {
  throw new Error("Missing ADMIN_PASSCODE in environment.");
}

const cloudinaryEnabled = Boolean(
  CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET
);

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true
  });
} else {
  console.warn(
    "Cloudinary credentials missing. Admin uploads will fail until CLOUDINARY_* variables are configured."
  );
}

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

const defaultAnalyticsSettings = {
  showTotalVisits: false,
  showUniqueVisitors: false,
  showProjectPreviews: false,
  showContactClicks: false
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

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: IS_PROD ? { rejectUnauthorized: false } : false
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portfolio_content (
      id INTEGER PRIMARY KEY,
      content JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_credentials (
      id INTEGER PRIMARY KEY,
      passcode_hash TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id BIGSERIAL PRIMARY KEY,
      visitor_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      path TEXT NOT NULL,
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS analytics_settings (
      id INTEGER PRIMARY KEY,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const contentResult = await pool.query("SELECT id FROM portfolio_content WHERE id = 1");
  if (contentResult.rowCount === 0) {
    await pool.query("INSERT INTO portfolio_content (id, content) VALUES (1, $1::jsonb)", [
      JSON.stringify(defaultData)
    ]);
  }

  const authResult = await pool.query("SELECT id FROM admin_credentials WHERE id = 1");
  if (authResult.rowCount === 0) {
    const hash = await bcrypt.hash(ADMIN_PASSCODE, 12);
    await pool.query("INSERT INTO admin_credentials (id, passcode_hash) VALUES (1, $1)", [hash]);
  } else {
    const currentHashResult = await pool.query(
      "SELECT passcode_hash FROM admin_credentials WHERE id = 1"
    );
    const currentHash = currentHashResult.rows[0]?.passcode_hash;
    const matchesEnvPasscode = currentHash
      ? await bcrypt.compare(ADMIN_PASSCODE, currentHash)
      : false;

    // Keep env-admin passcode as source of truth to avoid lockouts after variable changes.
    if (!matchesEnvPasscode) {
      const hash = await bcrypt.hash(ADMIN_PASSCODE, 12);
      await pool.query(
        "UPDATE admin_credentials SET passcode_hash = $1, updated_at = NOW() WHERE id = 1",
        [hash]
      );
      console.log("Admin passcode hash synchronized from environment variable.");
    }
  }

  const analyticsSettingsResult = await pool.query("SELECT id FROM analytics_settings WHERE id = 1");
  if (analyticsSettingsResult.rowCount === 0) {
    await pool.query("INSERT INTO analytics_settings (id, settings) VALUES (1, $1::jsonb)", [
      JSON.stringify(defaultAnalyticsSettings)
    ]);
  }
}

async function readPortfolio() {
  const result = await pool.query("SELECT content FROM portfolio_content WHERE id = 1");
  if (result.rowCount === 0) return clone(defaultData);
  return normalize(result.rows[0].content);
}

async function writePortfolio(content) {
  const safe = normalize(content);
  await pool.query(
    `
      UPDATE portfolio_content
      SET content = $1::jsonb, updated_at = NOW()
      WHERE id = 1
    `,
    [JSON.stringify(safe)]
  );
  return safe;
}

function normalizeAnalyticsSettings(input) {
  return {
    showTotalVisits: Boolean(input?.showTotalVisits),
    showUniqueVisitors: Boolean(input?.showUniqueVisitors),
    showProjectPreviews: Boolean(input?.showProjectPreviews),
    showContactClicks: Boolean(input?.showContactClicks)
  };
}

async function readAnalyticsSettings() {
  const result = await pool.query("SELECT settings FROM analytics_settings WHERE id = 1");
  if (!result.rowCount) return { ...defaultAnalyticsSettings };
  return normalizeAnalyticsSettings({ ...defaultAnalyticsSettings, ...(result.rows[0].settings || {}) });
}

async function writeAnalyticsSettings(settings) {
  const safe = normalizeAnalyticsSettings(settings);
  await pool.query(
    "UPDATE analytics_settings SET settings = $1::jsonb, updated_at = NOW() WHERE id = 1",
    [JSON.stringify(safe)]
  );
  return safe;
}

function sanitizeMeta(meta) {
  const safe = {};
  if (!meta || typeof meta !== "object") return safe;
  Object.entries(meta).forEach(([key, value]) => {
    if (typeof key !== "string" || key.length > 40) return;
    if (typeof value === "string") {
      safe[key] = value.slice(0, 240);
      return;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    }
  });
  return safe;
}

async function readAnalyticsSummary() {
  const totalsResult = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'page_view')::int AS total_visits,
      COUNT(DISTINCT visitor_id) FILTER (WHERE event_type = 'page_view')::int AS unique_visitors,
      COUNT(*) FILTER (WHERE event_type = 'project_preview')::int AS project_previews,
      COUNT(*) FILTER (WHERE event_type = 'contact_click')::int AS contact_clicks
    FROM analytics_events
  `);

  const channelsResult = await pool.query(`
    SELECT COALESCE(meta->>'channel', 'unknown') AS channel, COUNT(*)::int AS count
    FROM analytics_events
    WHERE event_type = 'contact_click'
    GROUP BY COALESCE(meta->>'channel', 'unknown')
    ORDER BY count DESC
  `);

  const eventsResult = await pool.query(`
    SELECT visitor_id, event_type, path, meta, created_at
    FROM analytics_events
    ORDER BY created_at DESC
    LIMIT 80
  `);

  return {
    totals: {
      totalVisits: Number(totalsResult.rows[0]?.total_visits || 0),
      uniqueVisitors: Number(totalsResult.rows[0]?.unique_visitors || 0),
      projectPreviews: Number(totalsResult.rows[0]?.project_previews || 0),
      contactClicks: Number(totalsResult.rows[0]?.contact_clicks || 0)
    },
    contactByChannel: channelsResult.rows.map((row) => ({
      channel: row.channel,
      count: Number(row.count || 0)
    })),
    events: eventsResult.rows.map((row) => ({
      visitorId: row.visitor_id,
      eventType: row.event_type,
      path: row.path,
      meta: row.meta || {},
      createdAt: row.created_at
    }))
  };
}

function setAdminCookie(res, payload) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS
  });
}

function clearAdminCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax"
  });
}

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
    stream.end(buffer);
  });
}

function sanitizeFolderSegment(value) {
  const safe = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "");
  return safe || "general";
}

function requireAdmin(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, { clockTolerance: 30 });
    req.admin = payload;
    // Rolling admin session so active edits don't suddenly fail on expiry.
    setAdminCookie(res, { role: payload?.role || "admin" });
    next();
  } catch {
    clearAdminCookie(res);
    res.status(401).json({ error: "Unauthorized" });
  }
}

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/portfolio", async (_req, res) => {
  try {
    const content = await readPortfolio();
    res.json({ content });
  } catch (error) {
    console.error("Failed to read portfolio content", error);
    res.status(500).json({ error: "Failed to read portfolio content" });
  }
});

app.post("/api/analytics/track", async (req, res) => {
  try {
    const allowedEvents = new Set([
      "page_view",
      "project_preview",
      "project_repo_click",
      "contact_click",
      "console_command"
    ]);

    const eventType = String(req.body?.eventType || "").trim();
    const visitorId = String(req.body?.visitorId || "").trim();
    const pathValue = String(req.body?.path || req.path || "/").trim();
    const meta = sanitizeMeta(req.body?.meta);

    if (!allowedEvents.has(eventType)) {
      res.status(400).json({ error: "Invalid event type." });
      return;
    }

    if (!visitorId || visitorId.length > 80) {
      res.status(400).json({ error: "Invalid visitor id." });
      return;
    }

    await pool.query(
      `
        INSERT INTO analytics_events (visitor_id, event_type, path, meta)
        VALUES ($1, $2, $3, $4::jsonb)
      `,
      [visitorId, eventType, pathValue.slice(0, 180), JSON.stringify(meta)]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to track analytics event", error);
    res.status(500).json({ error: "Failed to track analytics event." });
  }
});

app.get("/api/analytics/public", async (_req, res) => {
  try {
    const settings = await readAnalyticsSettings();
    const summary = await readAnalyticsSummary();
    const visible = {};
    if (settings.showTotalVisits) visible.totalVisits = summary.totals.totalVisits;
    if (settings.showUniqueVisitors) visible.uniqueVisitors = summary.totals.uniqueVisitors;
    if (settings.showProjectPreviews) visible.projectPreviews = summary.totals.projectPreviews;
    if (settings.showContactClicks) visible.contactClicks = summary.totals.contactClicks;
    res.json({ settings, stats: visible });
  } catch (error) {
    console.error("Failed to read public analytics", error);
    res.status(500).json({ error: "Failed to read analytics." });
  }
});

app.post("/api/admin/login", async (req, res) => {
  try {
    const passcode = String(req.body?.passcode || "").trim();
    if (passcode.length < 10) {
      res.status(400).json({ error: "Passcode must be at least 10 characters." });
      return;
    }

    const result = await pool.query("SELECT passcode_hash FROM admin_credentials WHERE id = 1");
    if (result.rowCount === 0) {
      res.status(500).json({ error: "Admin credentials not initialized." });
      return;
    }

    const valid = await bcrypt.compare(passcode, result.rows[0].passcode_hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid passcode." });
      return;
    }

    setAdminCookie(res, { role: "admin" });
    res.json({ ok: true });
  } catch (error) {
    console.error("Login failed", error);
    res.status(500).json({ error: "Login failed." });
  }
});

app.post("/api/admin/logout", (req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

app.get("/api/admin/session", (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    res.json({ authenticated: false });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET, { clockTolerance: 30 });
    setAdminCookie(res, { role: payload?.role || "admin" });
    res.json({ authenticated: true });
  } catch {
    clearAdminCookie(res);
    res.json({ authenticated: false });
  }
});

app.post("/api/admin/change-passcode", requireAdmin, async (req, res) => {
  try {
    const currentPasscode = String(req.body?.currentPasscode || "").trim();
    const nextPasscode = String(req.body?.newPasscode || "").trim();

    if (nextPasscode.length < 10) {
      res.status(400).json({ error: "New passcode must be at least 10 characters." });
      return;
    }

    const result = await pool.query("SELECT passcode_hash FROM admin_credentials WHERE id = 1");
    if (result.rowCount === 0) {
      res.status(500).json({ error: "Admin credentials not initialized." });
      return;
    }

    const valid = await bcrypt.compare(currentPasscode, result.rows[0].passcode_hash);
    if (!valid) {
      res.status(401).json({ error: "Current passcode is incorrect." });
      return;
    }

    const hash = await bcrypt.hash(nextPasscode, 12);
    await pool.query(
      "UPDATE admin_credentials SET passcode_hash = $1, updated_at = NOW() WHERE id = 1",
      [hash]
    );

    setAdminCookie(res, { role: "admin" });
    res.json({ ok: true });
  } catch (error) {
    console.error("Failed to change passcode", error);
    res.status(500).json({ error: "Failed to change passcode." });
  }
});

app.get("/api/admin/analytics/summary", requireAdmin, async (_req, res) => {
  try {
    const [settings, summary] = await Promise.all([readAnalyticsSettings(), readAnalyticsSummary()]);
    res.json({
      settings,
      totals: summary.totals,
      contactByChannel: summary.contactByChannel,
      events: summary.events
    });
  } catch (error) {
    console.error("Failed to read analytics summary", error);
    res.status(500).json({ error: "Failed to read analytics summary." });
  }
});

app.put("/api/admin/analytics/settings", requireAdmin, async (req, res) => {
  try {
    const settings = await writeAnalyticsSettings(req.body?.settings || {});
    res.json({ settings });
  } catch (error) {
    console.error("Failed to update analytics settings", error);
    res.status(500).json({ error: "Failed to update analytics settings." });
  }
});

app.put("/api/admin/portfolio", requireAdmin, async (req, res) => {
  try {
    const content = normalize(req.body?.content);
    const saved = await writePortfolio(content);
    res.json({ content: saved });
  } catch (error) {
    console.error("Failed to update portfolio", error);
    res.status(500).json({ error: "Failed to update portfolio." });
  }
});

app.post("/api/admin/upload-image", requireAdmin, imageUpload.single("image"), async (req, res) => {
  try {
    if (!cloudinaryEnabled) {
      res.status(503).json({ error: "Cloudinary is not configured on the server." });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Image file is required." });
      return;
    }

    if (!/^image\//i.test(file.mimetype || "")) {
      res.status(400).json({ error: "Only image files are allowed." });
      return;
    }

    const category = sanitizeFolderSegment(req.body?.category);
    const uploadResult = await uploadToCloudinary(file.buffer, {
      folder: `portfolio/${category}`,
      resource_type: "image",
      overwrite: false
    });

    res.json({
      ok: true,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      width: uploadResult.width,
      height: uploadResult.height,
      format: uploadResult.format,
      bytes: uploadResult.bytes
    });
  } catch (error) {
    console.error("Failed to upload image", error);
    res.status(500).json({ error: "Failed to upload image." });
  }
});

app.post("/api/admin/reset", requireAdmin, async (_req, res) => {
  try {
    const saved = await writePortfolio(defaultData);
    res.json({ content: saved });
  } catch (error) {
    console.error("Failed to reset portfolio", error);
    res.status(500).json({ error: "Failed to reset portfolio." });
  }
});

app.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Image is too large. Maximum size is 8MB." });
      return;
    }
    res.status(400).json({ error: error.message || "Upload failed." });
    return;
  }
  next(error);
});

app.use(express.static(process.cwd(), { extensions: ["html"] }));

app.get("*", (req, res) => {
  const requested = req.path.replace(/^\/+/, "");
  if (!requested || requested === "/") {
    res.sendFile(path.join(process.cwd(), "index.html"));
    return;
  }

  const filePath = path.join(process.cwd(), requested);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
    return;
  }

  res.sendFile(path.join(process.cwd(), "index.html"));
});

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Portfolio server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database schema", error);
    process.exit(1);
  });
