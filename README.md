# Musaddik Rahman Miton — Portfolio & Private CMS

Editorial, scroll-driven 3D portfolio built with React, TypeScript, Tailwind CSS, Three.js, GSAP ScrollTrigger, Lenis, and an authenticated Express + SQLite backend (with PostgreSQL/Supabase RLS schema included).

## Features

- **Public Portfolio (`/`)**:
  - Editorial light and dark mode with configurable warm accent color, subtle grain texture, hairline dividers, and numbered sections (`01`–`07`).
  - Scroll-driven Three.js procedural workflow node-and-conduit scene with `RoomEnvironment` PBR lighting, mouse parallax, software-WebGL protection, reduced-motion static fallback, and optional scroll-scrubbed background video.
  - Smooth scrolling via Lenis + GSAP ScrollTrigger line-by-line mask reveals and staggered card entrances.
  - Project case-study modal with image/video playback, scope bullets, technology stack, and live links.
  - Rate-limited, honeypot-protected contact form persisted directly to the database.
- **Private Admin Panel (`/portal-x7k2`)**:
  - Hidden route excluded from `robots.txt`, `sitemap.xml`, and public navigation, served with `X-Robots-Tag: noindex, nofollow`.
  - Bcrypt-hashed admin authentication seeded from `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables with `httpOnly`, `SameSite=Strict` cookies, CSRF token verification, login rate-limiting, and lockout protection.
  - Full CMS controls for hero copy, about, objective, strengths, expertise groups/skills, projects (CRUD, reorder, publish/unpublish, media upload), experience, education, contact/social links, site settings, optional scroll video, inbox management, and password rotation.

## Environment Variables

Copy `.env.example` to `.env` (never commit `.env`) and configure:

| Variable | Purpose |
| --- | --- |
| `ADMIN_USERNAME` | Initial admin username seeded on the server |
| `ADMIN_PASSWORD` | Initial admin password (hashed with bcrypt on startup) |
| `SESSION_SECRET` | Random 64-char hex string for HMAC session & token hashing |
| `APP_URL` | Canonical production URL for CORS and `sitemap.xml` |
| `DATABASE_URL` | Optional PostgreSQL/Supabase connection string (local SQLite in `./data/portfolio.db` is used automatically when omitted) |
| `EMAIL_SERVICE_API_KEY` | Optional transactional email key |
| `STORAGE_KEY` | Optional cloud object storage key |

## Local Development & Production

```bash
npm install
npm run dev
```

Build and start in production mode:

```bash
npm run build
npm start
```

## Security Checklist

- [x] Zero admin credentials, hashes, or secrets in client-side code or Vite bundle.
- [x] `AdminPortal` is code-split via `React.lazy` and only loaded at `/portal-x7k2`.
- [x] Passwords hashed with `bcryptjs` (cost 12) and verified with constant-time comparisons.
- [x] Sessions stored in `httpOnly`, `SameSite=Strict` cookies (`Secure` on HTTPS); no tokens in `localStorage`.
- [x] CSRF `X-CSRF-Token` validation on all mutating admin endpoints.
- [x] Zod schema validation, HTML sanitization, parameterized SQL queries, Helmet headers, strict CORS, and IP rate-limiting + lockout.
- [x] Validated file uploads with MIME/size caps and randomized UUID filenames.
