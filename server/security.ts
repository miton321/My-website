import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { CookieOptions, NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  deleteSessionById,
  getSessionByTokenHash,
  purgeExpiredSessions,
} from './db.ts';

export const SESSION_COOKIE_NAME = '__Host_mrm_session';
export const FALLBACK_COOKIE_NAME = 'mrm_session';

const secretFilePath = path.resolve(process.cwd(), 'data', '.session_secret');

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 16) return configured;
  try {
    if (fs.existsSync(secretFilePath)) {
      const stored = fs.readFileSync(secretFilePath, 'utf8').trim();
      if (stored.length >= 32) return stored;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(path.dirname(secretFilePath), { recursive: true });
    fs.writeFileSync(secretFilePath, generated, { mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}

export function hashString(value: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(value)
    .digest('hex');
}

export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Perform dummy comparison to avoid leaking length differences
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

// Sliding-window rate limiter with optional lockout
interface RateRecord {
  timestamps: number[];
  lockedUntil: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxAttempts: number;
  lockoutMs?: number;
}) {
  const store = new Map<string, RateRecord>();

  // Periodic cleanup every 10 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      const recent = record.timestamps.filter((t) => now - t < options.windowMs);
      if (recent.length === 0 && record.lockedUntil <= now) {
        store.delete(key);
      } else {
        record.timestamps = recent;
      }
    }
  }, 10 * 60 * 1000).unref();

  return {
    check(key: string): { allowed: boolean; retryAfterSec: number } {
      const now = Date.now();
      const record = store.get(key) || { timestamps: [], lockedUntil: 0 };

      if (record.lockedUntil > now) {
        return {
          allowed: false,
          retryAfterSec: Math.ceil((record.lockedUntil - now) / 1000),
        };
      }

      record.timestamps = record.timestamps.filter((t) => now - t < options.windowMs);
      if (record.timestamps.length >= options.maxAttempts) {
        if (options.lockoutMs) {
          record.lockedUntil = now + options.lockoutMs;
        }
        store.set(key, record);
        return {
          allowed: false,
          retryAfterSec: Math.ceil((options.lockoutMs || options.windowMs) / 1000),
        };
      }

      return { allowed: true, retryAfterSec: 0 };
    },
    hit(key: string) {
      const now = Date.now();
      const record = store.get(key) || { timestamps: [], lockedUntil: 0 };
      record.timestamps = record.timestamps.filter((t) => now - t < options.windowMs);
      record.timestamps.push(now);
      if (options.lockoutMs && record.timestamps.length >= options.maxAttempts) {
        record.lockedUntil = now + options.lockoutMs;
      }
      store.set(key, record);
    },
    reset(key: string) {
      store.delete(key);
    },
  };
}

export function sanitizePlainText(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

export function sanitizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('seed://')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

export const contactSubmissionSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().trim().email('Valid email is required').max(180),
  subject: z.string().trim().min(2, 'Subject is required').max(180),
  message: z.string().trim().min(3, 'Message must be at least 3 characters').max(4000),
  website: z.string().max(200).optional().default(''),
  hp_company_ref: z.string().max(200).optional().default(''),
});

export const loginSchema = z.object({
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(200),
  embedded: z.boolean().optional().default(false),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(200),
});

export const siteSettingsSchema = z.object({
  siteTitle: z.string().min(2).max(140),
  seoDescription: z.string().min(10).max(320),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
  scrollVideoUrl: z.string().max(500).optional().default(''),
  heroName: z.string().min(2).max(120),
  heroTitle: z.string().min(2).max(120),
  heroTagline: z.string().min(2).max(220),
  heroLocation: z.string().min(2).max(120),
  heroPrimaryCta: z.string().min(1).max(60),
  heroSecondaryCta: z.string().min(1).max(60),
  aboutText: z.string().min(10).max(3000),
  objectiveText: z.string().min(10).max(1500),
  strengths: z.array(z.string().min(1).max(120)).max(24),
  contactEmail: z.string().email().max(180),
  contactLocation: z.string().min(2).max(120),
  contactEndpoint: z.string().max(500).optional().default(''),
  socialLinks: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        label: z.string().min(1).max(60),
        url: z.string().min(1).max(400),
      }),
    )
    .max(12),
  footerTagline: z.string().max(400).optional().default(''),
  footerCopyright: z.string().max(240).optional().default(''),
  footerShowSocials: z.boolean().optional().default(true),
  footerShowThemeToggle: z.boolean().optional().default(true),
  footerLinks: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        label: z.string().min(1).max(60),
        url: z.string().min(1).max(400),
      }),
    )
    .max(12)
    .optional()
    .default([]),
});

export const expertiseArraySchema = z.object({
  groups: z
    .array(
      z.object({
        title: z.string().min(2).max(120),
        skills: z.array(z.string().min(1).max(120)).max(40),
      }),
    )
    .max(12),
});

export const projectInputSchema = z.object({
  numberLabel: z.string().trim().min(1, 'Project number is required').max(10),
  title: z.string().trim().min(2, 'Project title must be at least 2 characters').max(160),
  summary: z.string().max(2000, 'Summary must be 2000 characters or fewer').optional().default(''),
  bullets: z.array(z.string().min(1).max(500, 'Each bullet point must be 500 characters or fewer')).max(20),
  technologies: z.array(z.string().min(1).max(60)).max(24),
  mediaType: z.enum(['image', 'video']),
  mediaUrl: z.string().max(500).optional().default(''),
  liveUrl: z.string().max(500).optional().default(''),
  published: z.boolean(),
});

export const reorderSchema = z.object({
  orderedIds: z.array(z.number().int().positive()).min(1).max(100),
});

export const experienceArraySchema = z.object({
  items: z
    .array(
      z.object({
        role: z.string().min(2).max(160),
        organization: z.string().min(2).max(160),
        period: z.string().max(80).optional().default(''),
        bullets: z.array(z.string().min(1).max(300)).max(20),
      }),
    )
    .max(30),
});

export const educationArraySchema = z.object({
  items: z
    .array(
      z.object({
        institution: z.string().min(2).max(180),
        location: z.string().max(160).optional().default(''),
        degree: z.string().max(180).optional().default(''),
        period: z.string().max(80).optional().default(''),
      }),
    )
    .max(20),
});

export interface AdminRequest extends Request {
  admin?: {
    adminId: number;
    username: string;
    sessionId: string;
    csrfToken: string;
  };
}

export function isHttpsContext(req: Request): boolean {
  const xfProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const origin = String(req.headers.origin || '').toLowerCase();
  const referer = String(req.headers.referer || '').toLowerCase();
  return (
    req.secure ||
    xfProto.includes('https') ||
    origin.startsWith('https://') ||
    referer.startsWith('https://')
  );
}

export function getActiveCookieName(req: Request): string {
  return isHttpsContext(req) ? SESSION_COOKIE_NAME : FALLBACK_COOKIE_NAME;
}

export function readSessionCookie(req: Request): string | null {
  const cookies = req.cookies || {};
  return (
    (cookies[SESSION_COOKIE_NAME] as string | undefined) ||
    (cookies[FALLBACK_COOKIE_NAME] as string | undefined) ||
    null
  );
}

export function setSessionCookie(
  req: Request,
  res: Response,
  rawToken: string,
  maxAgeMs: number,
  embedded = false,
) {
  const secure = isHttpsContext(req);
  const name = secure ? SESSION_COOKIE_NAME : FALLBACK_COOKIE_NAME;
  const useEmbeddedIframeCookie = embedded && secure;
  const options: CookieOptions & { partitioned?: boolean } = {
    httpOnly: true,
    secure,
    sameSite: useEmbeddedIframeCookie ? 'none' : 'strict',
    ...(useEmbeddedIframeCookie ? { partitioned: true } : {}),
    path: '/',
    maxAge: maxAgeMs,
  };
  res.cookie(name, rawToken, options);
}

export function clearSessionCookies(req: Request, res: Response) {
  const secure = isHttpsContext(req);
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
  });
  const embeddedClearOpts: CookieOptions & { partitioned?: boolean } = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
  };
  res.clearCookie(SESSION_COOKIE_NAME, embeddedClearOpts);
  res.clearCookie(FALLBACK_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
  });
}

export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  purgeExpiredSessions();
  const rawToken = readSessionCookie(req);
  if (!rawToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tokenHash = hashString(rawToken);
  const session = getSessionByTokenHash(tokenHash);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    deleteSessionById(session.id);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.admin = {
    adminId: session.admin_id,
    username: session.username,
    sessionId: session.id,
    csrfToken: session.csrf_token,
  };
  return next();
}

export function verifyCsrf(req: AdminRequest, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }
  const headerToken = req.headers['x-csrf-token'];
  if (
    typeof headerToken !== 'string' ||
    !req.admin?.csrfToken ||
    !constantTimeEqual(headerToken, req.admin.csrfToken)
  ) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
}

// Validated file upload storage
export const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME_EXT[file.mimetype] || '';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const uploadMedia = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (Object.prototype.hasOwnProperty.call(ALLOWED_MIME_EXT, file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: JPG, PNG, WebP, MP4, WebM.'));
    }
  },
});
