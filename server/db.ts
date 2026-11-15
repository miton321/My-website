import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import type {
  ContactMessage,
  EducationItem,
  ExperienceItem,
  ExpertiseGroup,
  ProjectItem,
  SiteSettings,
} from '../src/types/portfolio.ts';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'portfolio.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    csrf_token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS expertise_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    skills_json TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    number_label TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    bullets_json TEXT NOT NULL DEFAULT '[]',
    technologies_json TEXT NOT NULL DEFAULT '[]',
    media_type TEXT NOT NULL DEFAULT 'image',
    media_url TEXT NOT NULL DEFAULT '',
    live_url TEXT NOT NULL DEFAULT '',
    published INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS experiences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    organization TEXT NOT NULL,
    period TEXT NOT NULL DEFAULT '',
    bullets_json TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS educations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    degree TEXT NOT NULL DEFAULT '',
    period TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    ip_hash TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteTitle: 'Musaddik Rahman Miton — AI Automation Specialist',
  seoDescription:
    'Portfolio of Musaddik Rahman Miton, AI Automation Specialist from Gaibandha, Bangladesh designing intelligent workflows, AI agents, and API integrations.',
  accentColor: '#E04F26',
  scrollVideoUrl: '',
  heroName: 'Musaddik Rahman Miton',
  heroTitle: 'AI Automation Specialist',
  heroTagline: 'Intelligent Automation | AI Agents | Workflow Integration',
  heroLocation: 'Gaibandha, Bangladesh',
  heroPrimaryCta: 'View Projects',
  heroSecondaryCta: 'Get in Touch',
  aboutText:
    'AI Automation Specialist focused on designing intelligent automation solutions that streamline business operations, reduce repetitive tasks, and improve productivity. Experienced in developing AI-powered workflows, conversational AI agents, API integrations, and business process automation solutions. Passionate about combining artificial intelligence with modern technologies to solve real-world business challenges and build scalable digital solutions.',
  objectiveText:
    'To build intelligent, scalable, and efficient automation systems that empower businesses to work smarter through artificial intelligence, modern software, and innovative technology.',
  strengths: [
    'Automation-focused problem solving',
    'Analytical thinking',
    'Creative solution development',
    'Technology adaptability',
    'Continuous learning',
    'Business-oriented technical thinking',
  ],
  contactEmail: 'musaddikrahman0192@gmail.com',
  contactLocation: 'Gaibandha, Bangladesh',
  socialLinks: [],
  footerTagline:
    'Designing intelligent automation workflows, AI agents, and reliable API integrations.',
  footerCopyright: '© {year} Musaddik Rahman Miton. Gaibandha, Bangladesh.',
  footerShowSocials: true,
  footerShowThemeToggle: true,
  footerLinks: [],
};

function seedInitialPortfolioData() {
  const existingSettings = db
    .prepare('SELECT id FROM site_settings WHERE id = 1')
    .get() as { id: number } | undefined;

  if (!existingSettings) {
    db.prepare('INSERT INTO site_settings (id, data_json) VALUES (1, ?)').run(
      JSON.stringify(DEFAULT_SITE_SETTINGS),
    );
  }

  const expertiseCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM expertise_groups').get() as { cnt: number }
  ).cnt;
  if (expertiseCount === 0) {
    const insertExpertise = db.prepare(
      'INSERT INTO expertise_groups (title, skills_json, sort_order) VALUES (?, ?, ?)',
    );
    const groups = [
      {
        title: 'AI and Intelligent Automation',
        skills: [
          'AI Agent Development',
          'Workflow Automation',
          'Prompt Engineering',
          'Conversational AI',
          'Business Process Automation',
          'AI Tool Integration',
        ],
      },
      {
        title: 'Automation and Integration',
        skills: [
          'n8n Workflow Development',
          'API Integration',
          'Webhooks',
          'Telegram Bot Automation',
          'Google Sheets Integration',
          'Automated Customer Support',
        ],
      },
      {
        title: 'Digital and Creative Technologies',
        skills: [
          'AI-Powered Content Creation',
          'Canva and Creative Design',
          'AI Video Advertising',
        ],
      },
    ];
    groups.forEach((group, idx) => {
      insertExpertise.run(group.title, JSON.stringify(group.skills), idx);
    });
  }

  const projectCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM projects').get() as { cnt: number }
  ).cnt;
  if (projectCount === 0) {
    const insertProject = db.prepare(
      `INSERT INTO projects (
        slug, number_label, title, summary, bullets_json, technologies_json,
        media_type, media_url, live_url, published, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const seedProjects = [
      {
        slug: 'ai-powered-customer-support-agent',
        numberLabel: '01',
        title: 'AI-Powered Customer Support Agent',
        summary:
          'End-to-end conversational support architecture combining n8n workflow orchestration, Telegram messaging, and structured product data.',
        bullets: [
          'Designed an AI-powered customer support workflow',
          'Integrated Telegram-based conversational support',
          'Developed FAQ and product-information automation',
          'Implemented conversational memory concepts for contextual responses',
          'Focused on reducing repetitive customer support activities',
        ],
        technologies: ['n8n', 'AI Agent', 'Telegram Bot', 'Google Sheets'],
        mediaType: 'image',
        mediaUrl: 'seed://project_support_agent',
        liveUrl: '',
        published: 1,
        sortOrder: 0,
      },
      {
        slug: 'modern-ecommerce-web-application',
        numberLabel: '02',
        title: 'Modern E-commerce Web Application',
        summary:
          'Full-featured storefront and administrative platform tailored for the Bangladesh digital commerce ecosystem.',
        bullets: [
          'Developed an e-commerce application for the Bangladesh market',
          'Worked on customer-facing and administrative interfaces',
          'Integrated database and authentication functionality',
          'Focused on responsive design and user experience',
        ],
        technologies: [],
        mediaType: 'image',
        mediaUrl: 'seed://project_ecommerce_bd',
        liveUrl: '',
        published: 1,
        sortOrder: 1,
      },
      {
        slug: 'ai-powered-marketing-and-creative-solutions',
        numberLabel: '03',
        title: 'AI-Powered Marketing and Creative Solutions',
        summary:
          'Structured creative production pipelines pairing prompt engineering with visual design tooling for digital campaigns.',
        bullets: [
          'Developed AI-assisted advertising concepts',
          'Created product marketing and promotional content',
          'Explored AI-powered visual content generation',
          'Developed creative strategies for digital marketing',
        ],
        technologies: ['AI Tools', 'Prompt Engineering', 'Canva'],
        mediaType: 'image',
        mediaUrl: 'seed://project_creative_marketing',
        liveUrl: '',
        published: 1,
        sortOrder: 2,
      },
    ];

    seedProjects.forEach((p) => {
      insertProject.run(
        p.slug,
        p.numberLabel,
        p.title,
        p.summary,
        JSON.stringify(p.bullets),
        JSON.stringify(p.technologies),
        p.mediaType,
        p.mediaUrl,
        p.liveUrl,
        p.published,
        p.sortOrder,
      );
    });
  }

  const expCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM experiences').get() as { cnt: number }
  ).cnt;
  if (expCount === 0) {
    db.prepare(
      'INSERT INTO experiences (role, organization, period, bullets_json, sort_order) VALUES (?, ?, ?, ?, ?)',
    ).run(
      'AI Automation and Technology Projects',
      'Independent Project Development',
      'Ongoing',
      JSON.stringify([
        'Exploring practical AI automation solutions',
        'Designing intelligent workflow automation systems',
        'Developing AI-powered business solutions',
        'Integrating modern web technologies and automation platforms',
      ]),
      0,
    );
  }

  const eduCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM educations').get() as { cnt: number }
  ).cnt;
  if (eduCount === 0) {
    db.prepare(
      'INSERT INTO educations (institution, location, degree, period, sort_order) VALUES (?, ?, ?, ?, ?)',
    ).run('Gaibandha Govt College', 'Gaibandha, Bangladesh', 'Higher Secondary & Academic Studies', '', 0);
  }
}

export function ensureAdminSeededFromEnv(): boolean {
  const envUser = process.env.ADMIN_USERNAME?.trim();
  const envPass = process.env.ADMIN_PASSWORD;

  const existing = db
    .prepare('SELECT id, username FROM admin_users LIMIT 1')
    .get() as { id: number; username: string } | undefined;

  if (existing) {
    return true;
  }

  if (!envUser || !envPass) {
    return false;
  }

  const hash = bcrypt.hashSync(envPass, 12);
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(
    envUser,
    hash,
  );
  return true;
}

seedInitialPortfolioData();
ensureAdminSeededFromEnv();

export function getSiteSettings(): SiteSettings {
  const row = db
    .prepare('SELECT data_json FROM site_settings WHERE id = 1')
    .get() as { data_json: string } | undefined;
  if (!row) return DEFAULT_SITE_SETTINGS;
  try {
    return { ...DEFAULT_SITE_SETTINGS, ...JSON.parse(row.data_json) };
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

export function saveSiteSettings(settings: SiteSettings): SiteSettings {
  db.prepare(
    "UPDATE site_settings SET data_json = ?, updated_at = datetime('now') WHERE id = 1",
  ).run(JSON.stringify(settings));
  return settings;
}

export function getExpertiseGroups(): ExpertiseGroup[] {
  const rows = db
    .prepare('SELECT id, title, skills_json, sort_order FROM expertise_groups ORDER BY sort_order ASC, id ASC')
    .all() as Array<{ id: number; title: string; skills_json: string; sort_order: number }>;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    skills: safeJsonArray(r.skills_json),
    sortOrder: r.sort_order,
  }));
}

export function replaceExpertiseGroups(
  groups: Array<{ title: string; skills: string[] }>,
): ExpertiseGroup[] {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM expertise_groups').run();
    const stmt = db.prepare(
      'INSERT INTO expertise_groups (title, skills_json, sort_order) VALUES (?, ?, ?)',
    );
    groups.forEach((g, idx) => {
      stmt.run(g.title, JSON.stringify(g.skills), idx);
    });
  });
  tx();
  return getExpertiseGroups();
}

export function getProjects(includeUnpublished: boolean): ProjectItem[] {
  const sql = includeUnpublished
    ? 'SELECT * FROM projects ORDER BY sort_order ASC, id ASC'
    : 'SELECT * FROM projects WHERE published = 1 ORDER BY sort_order ASC, id ASC';
  const rows = db.prepare(sql).all() as Array<{
    id: number;
    slug: string;
    number_label: string;
    title: string;
    summary: string;
    bullets_json: string;
    technologies_json: string;
    media_type: 'image' | 'video';
    media_url: string;
    live_url: string;
    published: number;
    sort_order: number;
  }>;
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    numberLabel: r.number_label,
    title: r.title,
    summary: r.summary,
    bullets: safeJsonArray(r.bullets_json),
    technologies: safeJsonArray(r.technologies_json),
    mediaType: r.media_type === 'video' ? 'video' : 'image',
    mediaUrl: r.media_url,
    liveUrl: r.live_url,
    published: r.published === 1,
    sortOrder: r.sort_order,
  }));
}

export function createProject(
  input: Omit<ProjectItem, 'id' | 'slug' | 'sortOrder'>,
): ProjectItem {
  const maxOrderRow = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) as max_order FROM projects')
    .get() as { max_order: number };
  const nextOrder = maxOrderRow.max_order + 1;
  const baseSlug = slugify(input.title) || 'project';
  const slug = `${baseSlug}-${Date.now().toString(36)}`;
  const info = db
    .prepare(
      `INSERT INTO projects (
        slug, number_label, title, summary, bullets_json, technologies_json,
        media_type, media_url, live_url, published, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      slug,
      input.numberLabel || String(nextOrder + 1).padStart(2, '0'),
      input.title,
      input.summary,
      JSON.stringify(input.bullets),
      JSON.stringify(input.technologies),
      input.mediaType,
      input.mediaUrl,
      input.liveUrl,
      input.published ? 1 : 0,
      nextOrder,
    );

  const created = getProjects(true).find((p) => p.id === Number(info.lastInsertRowid));
  if (!created) throw new Error('Failed to create project');
  return created;
}

export function updateProject(
  id: number,
  input: Omit<ProjectItem, 'id' | 'slug' | 'sortOrder'>,
): ProjectItem | null {
  const result = db
    .prepare(
      `UPDATE projects SET
        number_label = ?,
        title = ?,
        summary = ?,
        bullets_json = ?,
        technologies_json = ?,
        media_type = ?,
        media_url = ?,
        live_url = ?,
        published = ?,
        updated_at = datetime('now')
      WHERE id = ?`,
    )
    .run(
      input.numberLabel,
      input.title,
      input.summary,
      JSON.stringify(input.bullets),
      JSON.stringify(input.technologies),
      input.mediaType,
      input.mediaUrl,
      input.liveUrl,
      input.published ? 1 : 0,
      id,
    );
  if (result.changes === 0) return null;
  return getProjects(true).find((p) => p.id === id) ?? null;
}

export function deleteProject(id: number): boolean {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return result.changes > 0;
}

export function reorderProjects(orderedIds: number[]): ProjectItem[] {
  const tx = db.transaction(() => {
    const stmt = db.prepare(
      'UPDATE projects SET sort_order = ?, number_label = ? WHERE id = ?',
    );
    orderedIds.forEach((id, idx) => {
      stmt.run(idx, String(idx + 1).padStart(2, '0'), id);
    });
  });
  tx();
  return getProjects(true);
}

export function getExperiences(): ExperienceItem[] {
  const rows = db
    .prepare('SELECT id, role, organization, period, bullets_json, sort_order FROM experiences ORDER BY sort_order ASC, id ASC')
    .all() as Array<{
      id: number;
      role: string;
      organization: string;
      period: string;
      bullets_json: string;
      sort_order: number;
    }>;
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    organization: r.organization,
    period: r.period,
    bullets: safeJsonArray(r.bullets_json),
    sortOrder: r.sort_order,
  }));
}

export function replaceExperiences(
  items: Array<Omit<ExperienceItem, 'id' | 'sortOrder'>>,
): ExperienceItem[] {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM experiences').run();
    const stmt = db.prepare(
      'INSERT INTO experiences (role, organization, period, bullets_json, sort_order) VALUES (?, ?, ?, ?, ?)',
    );
    items.forEach((item, idx) => {
      stmt.run(item.role, item.organization, item.period, JSON.stringify(item.bullets), idx);
    });
  });
  tx();
  return getExperiences();
}

export function getEducations(): EducationItem[] {
  const rows = db
    .prepare('SELECT id, institution, location, degree, period, sort_order FROM educations ORDER BY sort_order ASC, id ASC')
    .all() as Array<{
      id: number;
      institution: string;
      location: string;
      degree: string;
      period: string;
      sort_order: number;
    }>;
  return rows.map((r) => ({
    id: r.id,
    institution: r.institution,
    location: r.location,
    degree: r.degree,
    period: r.period,
    sortOrder: r.sort_order,
  }));
}

export function replaceEducations(
  items: Array<Omit<EducationItem, 'id' | 'sortOrder'>>,
): EducationItem[] {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM educations').run();
    const stmt = db.prepare(
      'INSERT INTO educations (institution, location, degree, period, sort_order) VALUES (?, ?, ?, ?, ?)',
    );
    items.forEach((item, idx) => {
      stmt.run(item.institution, item.location, item.degree, item.period, idx);
    });
  });
  tx();
  return getEducations();
}

export function createContactMessage(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
  ipHash: string;
}): number {
  const info = db
    .prepare(
      'INSERT INTO contact_messages (name, email, subject, message, is_read, ip_hash) VALUES (?, ?, ?, ?, 0, ?)',
    )
    .run(input.name, input.email, input.subject, input.message, input.ipHash);
  return Number(info.lastInsertRowid);
}

export function getContactMessages(): ContactMessage[] {
  const rows = db
    .prepare(
      'SELECT id, name, email, subject, message, is_read, created_at FROM contact_messages ORDER BY id DESC',
    )
    .all() as Array<{
      id: number;
      name: string;
      email: string;
      subject: string;
      message: string;
      is_read: number;
      created_at: string;
    }>;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    subject: r.subject,
    message: r.message,
    isRead: r.is_read === 1,
    createdAt: r.created_at,
  }));
}

export function setMessageReadStatus(id: number, isRead: boolean): boolean {
  const res = db
    .prepare('UPDATE contact_messages SET is_read = ? WHERE id = ?')
    .run(isRead ? 1 : 0, id);
  return res.changes > 0;
}

export function deleteContactMessage(id: number): boolean {
  const res = db.prepare('DELETE FROM contact_messages WHERE id = ?').run(id);
  return res.changes > 0;
}

export function getAdminByUsername(username: string) {
  return db
    .prepare('SELECT id, username, password_hash FROM admin_users WHERE username = ?')
    .get(username) as { id: number; username: string; password_hash: string } | undefined;
}

export function getAnyAdmin() {
  return db
    .prepare('SELECT id, username, password_hash FROM admin_users LIMIT 1')
    .get() as { id: number; username: string; password_hash: string } | undefined;
}

export function updateAdminPassword(adminId: number, newPasswordHash: string) {
  db.prepare("UPDATE admin_users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
    newPasswordHash,
    adminId,
  );
}

export function createSessionRecord(input: {
  id: string;
  adminId: number;
  tokenHash: string;
  csrfToken: string;
  expiresAtIso: string;
}) {
  db.prepare(
    'INSERT INTO admin_sessions (id, admin_id, token_hash, csrf_token, expires_at) VALUES (?, ?, ?, ?, ?)',
  ).run(input.id, input.adminId, input.tokenHash, input.csrfToken, input.expiresAtIso);
}

export function getSessionByTokenHash(tokenHash: string) {
  return db
    .prepare(
      `SELECT s.id, s.admin_id, s.csrf_token, s.expires_at, a.username
       FROM admin_sessions s
       JOIN admin_users a ON a.id = s.admin_id
       WHERE s.token_hash = ?`,
    )
    .get(tokenHash) as
    | {
        id: string;
        admin_id: number;
        csrf_token: string;
        expires_at: string;
        username: string;
      }
    | undefined;
}

export function deleteSessionById(sessionId: string) {
  db.prepare('DELETE FROM admin_sessions WHERE id = ?').run(sessionId);
}

export function deleteOtherSessions(adminId: number, keepSessionId: string) {
  db.prepare('DELETE FROM admin_sessions WHERE admin_id = ? AND id != ?').run(
    adminId,
    keepSessionId,
  );
}

export function purgeExpiredSessions() {
  db.prepare("DELETE FROM admin_sessions WHERE expires_at <= datetime('now')").run();
}

function safeJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
