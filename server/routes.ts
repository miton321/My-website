import crypto from 'node:crypto';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import express, { type Request, type Response } from 'express';
import {
  createContactMessage,
  createProject,
  createSessionRecord,
  deleteContactMessage,
  deleteOtherSessions,
  deleteProject,
  deleteSessionById,
  ensureAdminSeededFromEnv,
  getAdminByUsername,
  getAnyAdmin,
  getContactMessages,
  getEducations,
  getExperiences,
  getExpertiseGroups,
  getProjects,
  getSiteSettings,
  reorderProjects,
  replaceEducations,
  replaceExperiences,
  replaceExpertiseGroups,
  saveSiteSettings,
  setMessageReadStatus,
  updateAdminPassword,
  updateProject,
} from './db.ts';
import {
  type AdminRequest,
  clearSessionCookies,
  constantTimeEqual,
  contactSubmissionSchema,
  createRateLimiter,
  educationArraySchema,
  experienceArraySchema,
  expertiseArraySchema,
  getClientIp,
  hashString,
  loginSchema,
  passwordChangeSchema,
  projectInputSchema,
  readSessionCookie,
  reorderSchema,
  requireAdmin,
  sanitizePlainText,
  sanitizeUrl,
  setSessionCookie,
  siteSettingsSchema,
  uploadMedia,
  verifyCsrf,
} from './security.ts';

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
  lockoutMs: 15 * 60 * 1000,
});

const contactLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
});

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export function createApiRouter() {
  const router = express.Router();

  // PUBLIC READ-ONLY ENDPOINT (published content only, zero secrets or messages)
  router.get('/public/portfolio', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      res.json({
        settings: getSiteSettings(),
        expertise: getExpertiseGroups(),
        projects: getProjects(false),
        experience: getExperiences(),
        education: getEducations(),
      });
    } catch {
      res.status(500).json({ error: 'Failed to load portfolio data' });
    }
  });

  // PUBLIC RATE-LIMITED CONTACT SUBMISSION
  router.post('/public/contact', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const rate = contactLimiter.check(`contact:${ip}`);
    if (!rate.allowed) {
      return res
        .status(429)
        .json({ error: `Too many requests. Please try again in ${rate.retryAfterSec}s.` });
    }

    const parsed = contactSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Please check your input fields.',
      });
    }

    contactLimiter.hit(`contact:${ip}`);

    const cleanName = sanitizePlainText(parsed.data.name);
    const cleanEmail = sanitizePlainText(parsed.data.email);
    const cleanSubject = sanitizePlainText(parsed.data.subject);
    const cleanMessage = sanitizePlainText(parsed.data.message);

    try {
      createContactMessage({
        name: cleanName,
        email: cleanEmail,
        subject: cleanSubject,
        message: cleanMessage,
        ipHash: hashString(ip),
      });

      // Optionally forward to external webhook/form endpoint if configured by admin
      const settings = getSiteSettings();
      const webhookUrl = sanitizeUrl(settings.contactEndpoint || '');
      if (webhookUrl && webhookUrl.startsWith('https://')) {
        try {
          const parsedUrl = new URL(webhookUrl);
          const host = parsedUrl.hostname.toLowerCase();
          const isPrivate =
            host === 'localhost' ||
            host === '127.0.0.1' ||
            host === '::1' ||
            host.startsWith('10.') ||
            host.startsWith('192.168.') ||
            host.startsWith('169.254.') ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(host);
          if (!isPrivate) {
            fetch(webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({
                name: cleanName,
                email: cleanEmail,
                subject: cleanSubject,
                message: cleanMessage,
              }),
              signal: AbortSignal.timeout(5000),
            }).catch(() => {});
          }
        } catch {
          // ignore malformed webhook URL
        }
      }

      return res.status(201).json({ ok: true });
    } catch {
      return res.status(500).json({ error: 'Unable to save your message right now.' });
    }
  });

  // ADMIN AUTHENTICATION
  router.get('/admin/session', (req: AdminRequest, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const configured = ensureAdminSeededFromEnv() || Boolean(getAnyAdmin());
    const rawToken = readSessionCookie(req);
    if (!rawToken) {
      return res.json({ authenticated: false, configured });
    }
    // Reuse requireAdmin semantics quietly
    requireAdmin(req, res, () => {
      return res.json({
        authenticated: true,
        configured,
        username: req.admin?.username,
        csrfToken: req.admin?.csrfToken,
      });
    });
  });

  router.post('/admin/login', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const rate = loginLimiter.check(`login:${ip}`);
    if (!rate.allowed) {
      return res
        .status(429)
        .json({ error: 'Too many failed attempts. Please try again later.' });
    }

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      loginLimiter.hit(`login:${ip}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isSeeded = ensureAdminSeededFromEnv();
    if (!isSeeded && !getAnyAdmin()) {
      return res.status(503).json({
        error: 'Admin credentials are not configured in server environment variables.',
      });
    }

    const submittedUser = parsed.data.username.trim();
    const admin = getAdminByUsername(submittedUser);

    if (!admin) {
      // Constant-time dummy bcrypt check to avoid timing side-channel
      await bcrypt.compare(
        parsed.data.password,
        '$2a$12$C6UzMDM.H6dfI/f/IKxGhu6fO1X6wLJvV8pV6fQ9iM9pQ8zX9yG2m',
      );
      loginLimiter.hit(`login:${ip}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const usernameMatches = constantTimeEqual(submittedUser, admin.username);
    const passwordMatches = await bcrypt.compare(
      parsed.data.password,
      admin.password_hash,
    );

    if (!usernameMatches || !passwordMatches) {
      loginLimiter.hit(`login:${ip}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    loginLimiter.reset(`login:${ip}`);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const csrfToken = crypto.randomBytes(24).toString('hex');
    const sessionId = crypto.randomUUID();
    const expiresAtIso = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    createSessionRecord({
      id: sessionId,
      adminId: admin.id,
      tokenHash: hashString(rawToken),
      csrfToken,
      expiresAtIso,
    });

    setSessionCookie(req, res, rawToken, SESSION_TTL_MS, parsed.data.embedded);

    return res.json({
      authenticated: true,
      username: admin.username,
      csrfToken,
    });
  });

  router.post('/admin/logout', requireAdmin, verifyCsrf, (req: AdminRequest, res: Response) => {
    if (req.admin?.sessionId) {
      deleteSessionById(req.admin.sessionId);
    }
    clearSessionCookies(req, res);
    res.json({ ok: true });
  });

  // PROTECTED ADMIN DATA ROUTES
  router.get('/admin/dashboard', requireAdmin, (_req: AdminRequest, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const messages = getContactMessages();
      const unreadCount = messages.filter((m) => !m.isRead).length;
      res.json({
        settings: getSiteSettings(),
        expertise: getExpertiseGroups(),
        projects: getProjects(true),
        experience: getExperiences(),
        education: getEducations(),
        messages,
        unreadCount,
      });
    } catch {
      res.status(500).json({ error: 'Failed to load dashboard data' });
    }
  });

  router.put('/admin/settings', requireAdmin, verifyCsrf, (req: AdminRequest, res: Response) => {
    const parsed = siteSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid settings payload',
      });
    }
    const d = parsed.data;
    const saved = saveSiteSettings({
      siteTitle: sanitizePlainText(d.siteTitle),
      seoDescription: sanitizePlainText(d.seoDescription),
      accentColor: d.accentColor,
      scrollVideoUrl: sanitizeUrl(d.scrollVideoUrl),
      heroName: sanitizePlainText(d.heroName),
      heroTitle: sanitizePlainText(d.heroTitle),
      heroTagline: sanitizePlainText(d.heroTagline),
      heroLocation: sanitizePlainText(d.heroLocation),
      heroPrimaryCta: sanitizePlainText(d.heroPrimaryCta),
      heroSecondaryCta: sanitizePlainText(d.heroSecondaryCta),
      aboutText: sanitizePlainText(d.aboutText),
      objectiveText: sanitizePlainText(d.objectiveText),
      strengths: d.strengths.map(sanitizePlainText).filter(Boolean),
      contactEmail: sanitizePlainText(d.contactEmail),
      contactLocation: sanitizePlainText(d.contactLocation),
      contactEndpoint: sanitizeUrl(d.contactEndpoint),
      socialLinks: d.socialLinks
        .map((s) => ({
          id: sanitizePlainText(s.id),
          label: sanitizePlainText(s.label),
          url: sanitizeUrl(s.url),
        }))
        .filter((s) => s.label && s.url),
      footerTagline: sanitizePlainText(d.footerTagline),
      footerCopyright: sanitizePlainText(d.footerCopyright),
      footerShowSocials: d.footerShowSocials,
      footerShowThemeToggle: d.footerShowThemeToggle,
      footerLinks: d.footerLinks
        .map((l) => ({
          id: sanitizePlainText(l.id),
          label: sanitizePlainText(l.label),
          url: sanitizeUrl(l.url),
        }))
        .filter((l) => l.label && l.url),
    });
    return res.json({ settings: saved });
  });

  router.put('/admin/expertise', requireAdmin, verifyCsrf, (req: AdminRequest, res: Response) => {
    const parsed = expertiseArraySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid expertise data' });
    }
    const cleaned = parsed.data.groups.map((g) => ({
      title: sanitizePlainText(g.title),
      skills: g.skills.map(sanitizePlainText).filter(Boolean),
    }));
    const updated = replaceExpertiseGroups(cleaned);
    return res.json({ expertise: updated });
  });

  router.post('/admin/projects', requireAdmin, verifyCsrf, (req: AdminRequest, res: Response) => {
    const parsed = projectInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid project data' });
    }
    const d = parsed.data;
    const created = createProject({
      numberLabel: sanitizePlainText(d.numberLabel),
      title: sanitizePlainText(d.title),
      summary: sanitizePlainText(d.summary),
      bullets: d.bullets.map(sanitizePlainText).filter(Boolean),
      technologies: d.technologies.map(sanitizePlainText).filter(Boolean),
      mediaType: d.mediaType,
      mediaUrl: sanitizeUrl(d.mediaUrl),
      liveUrl: sanitizeUrl(d.liveUrl),
      published: d.published,
    });
    return res.status(201).json({ project: created });
  });

  router.put('/admin/projects/reorder', requireAdmin, verifyCsrf, (req: AdminRequest, res: Response) => {
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid project order' });
    }
    const projects = reorderProjects(parsed.data.orderedIds);
    return res.json({ projects });
  });

  router.put('/admin/projects/:id', requireAdmin, verifyCsrf, (req: AdminRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid project id' });
    }
    const parsed = projectInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid project data' });
    }
    const d = parsed.data;
    const updated = updateProject(id, {
      numberLabel: sanitizePlainText(d.numberLabel),
      title: sanitizePlainText(d.title),
      summary: sanitizePlainText(d.summary),
      bullets: d.bullets.map(sanitizePlainText).filter(Boolean),
      technologies: d.technologies.map(sanitizePlainText).filter(Boolean),
      mediaType: d.mediaType,
      mediaUrl: sanitizeUrl(d.mediaUrl),
      liveUrl: sanitizeUrl(d.liveUrl),
      published: d.published,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Project not found' });
    }
    return res.json({ project: updated });
  });

  router.delete('/admin/projects/:id', requireAdmin, verifyCsrf, (req: AdminRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid project id' });
    }
    const deleted = deleteProject(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Project not found' });
    }
    return res.json({ ok: true });
  });

  router.put('/admin/experience', requireAdmin, verifyCsrf, (req: AdminRequest, res: Response) => {
    const parsed = experienceArraySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid experience data' });
    }
    const cleaned = parsed.data.items.map((item) => ({
      role: sanitizePlainText(item.role),
      organization: sanitizePlainText(item.organization),
      period: sanitizePlainText(item.period),
      bullets: item.bullets.map(sanitizePlainText).filter(Boolean),
    }));
    return res.json({ experience: replaceExperiences(cleaned) });
  });

  router.put('/admin/education', requireAdmin, verifyCsrf, (req: AdminRequest, res: Response) => {
    const parsed = educationArraySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid education data' });
    }
    const cleaned = parsed.data.items.map((item) => ({
      institution: sanitizePlainText(item.institution),
      location: sanitizePlainText(item.location),
      degree: sanitizePlainText(item.degree),
      period: sanitizePlainText(item.period),
    }));
    return res.json({ education: replaceEducations(cleaned) });
  });

  router.patch('/admin/messages/:id', requireAdmin, verifyCsrf, (req: AdminRequest, res: Response) => {
    const id = Number(req.params.id);
    const isRead = Boolean(req.body?.isRead);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid message id' });
    }
    const ok = setMessageReadStatus(id, isRead);
    if (!ok) {
      return res.status(404).json({ error: 'Message not found' });
    }
    return res.json({ ok: true });
  });

  router.delete('/admin/messages/:id', requireAdmin, verifyCsrf, (req: AdminRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid message id' });
    }
    const ok = deleteContactMessage(id);
    if (!ok) {
      return res.status(404).json({ error: 'Message not found' });
    }
    return res.json({ ok: true });
  });

  router.post('/admin/upload', requireAdmin, verifyCsrf, (req: AdminRequest, res: Response) => {
    uploadMedia.single('file')(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : 'File upload failed';
        return res.status(400).json({ error: message });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const isImage = req.file.mimetype.startsWith('image/');
      if (isImage && req.file.size > 8 * 1024 * 1024) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'Image size must be 8 MB or smaller' });
      }

      return res.status(201).json({
        url: `/uploads/${req.file.filename}`,
        mediaType: isImage ? 'image' : 'video',
      });
    });
  });

  router.post('/admin/password', requireAdmin, verifyCsrf, async (req: AdminRequest, res: Response) => {
    const parsed = passwordChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid password payload',
      });
    }

    const admin = req.admin ? getAdminByUsername(req.admin.username) : undefined;
    if (!admin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const matches = await bcrypt.compare(parsed.data.currentPassword, admin.password_hash);
    if (!matches) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
    updateAdminPassword(admin.id, newHash);
    if (req.admin?.sessionId) {
      deleteOtherSessions(admin.id, req.admin.sessionId);
    }
    return res.json({ ok: true });
  });

  return router;
}
