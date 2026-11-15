import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { ArrowRight, ArrowUpRight, CheckCircle2, AlertCircle, Menu, Moon, Sun, X } from 'lucide-react';
import { CustomCursor } from '../components/CustomCursor.tsx';
import { MagneticButton } from '../components/MagneticButton.tsx';
import { ProjectModal } from '../components/ProjectModal.tsx';
import { WorkflowCanvas } from '../components/WorkflowCanvas.tsx';
import { fetchPublicPortfolio, submitContactForm } from '../lib/api.ts';
import { resolveMediaUrl } from '../lib/seedAssets.ts';
import type { ProjectItem, PublicPortfolioData } from '../types/portfolio.ts';

gsap.registerPlugin(ScrollTrigger);

const FALLBACK_PORTFOLIO: PublicPortfolioData = {
  settings: {
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
    contactEndpoint: '',
    socialLinks: [],
    footerTagline:
      'Designing intelligent automation workflows, AI agents, and reliable API integrations.',
    footerCopyright: '© {year} Musaddik Rahman Miton. Gaibandha, Bangladesh.',
    footerShowSocials: true,
    footerShowThemeToggle: true,
    footerLinks: [],
  },
  expertise: [
    {
      id: 1,
      title: 'AI and Intelligent Automation',
      skills: [
        'AI Agent Development',
        'Workflow Automation',
        'Prompt Engineering',
        'Conversational AI',
        'Business Process Automation',
        'AI Tool Integration',
      ],
      sortOrder: 0,
    },
    {
      id: 2,
      title: 'Automation and Integration',
      skills: [
        'n8n Workflow Development',
        'API Integration',
        'Webhooks',
        'Telegram Bot Automation',
        'Google Sheets Integration',
        'Automated Customer Support',
      ],
      sortOrder: 1,
    },
    {
      id: 3,
      title: 'Digital and Creative Technologies',
      skills: [
        'AI-Powered Content Creation',
        'Canva and Creative Design',
        'AI Video Advertising',
      ],
      sortOrder: 2,
    },
  ],
  projects: [
    {
      id: 1,
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
      published: true,
      sortOrder: 0,
    },
    {
      id: 2,
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
      published: true,
      sortOrder: 1,
    },
    {
      id: 3,
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
      published: true,
      sortOrder: 2,
    },
  ],
  experience: [
    {
      id: 1,
      role: 'AI Automation and Technology Projects',
      organization: 'Independent Project Development',
      period: 'Ongoing',
      bullets: [
        'Exploring practical AI automation solutions',
        'Designing intelligent workflow automation systems',
        'Developing AI-powered business solutions',
        'Integrating modern web technologies and automation platforms',
      ],
      sortOrder: 0,
    },
  ],
  education: [
    {
      id: 1,
      institution: 'Gaibandha Govt College',
      location: 'Gaibandha, Bangladesh',
      degree: 'Higher Secondary & Academic Studies',
      period: '',
      sortOrder: 0,
    },
  ],
};

export default function PublicPortfolio() {
  const [data, setData] = useState<PublicPortfolioData>(FALLBACK_PORTFOLIO);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('mrm-theme');
        if (saved === 'dark' || saved === 'light') return saved;
        if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
      }
    } catch {
      // ignore storage/media query access errors in restricted contexts
    }
    return 'light';
  });

  // Contact form state
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    hp_company_ref: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const scrollProgressRef = useRef(0);
  const lenisRef = useRef<Lenis | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);

  // Apply light/dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('mrm-theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  // Fetch published portfolio data from backend (gracefully keep fallback on static hosts)
  useEffect(() => {
    let active = true;
    fetchPublicPortfolio()
      .then((res) => {
        if (
          active &&
          res &&
          typeof res === 'object' &&
          res.settings &&
          typeof res.settings.heroName === 'string' &&
          Array.isArray(res.expertise) &&
          Array.isArray(res.projects) &&
          Array.isArray(res.experience) &&
          Array.isArray(res.education)
        ) {
          setData({
            settings: { ...FALLBACK_PORTFOLIO.settings, ...res.settings },
            expertise: res.expertise,
            projects: res.projects,
            experience: res.experience,
            education: res.education,
          });
        }
      })
      .catch(() => {
        // Retain initial structured content if network/API is unavailable (e.g. static hosting)
      });
    return () => {
      active = false;
    };
  }, []);

  // Sync accent color and SEO metadata
  useEffect(() => {
    const { settings } = data;
    document.documentElement.style.setProperty('--accent', settings.accentColor || '#E04F26');
    if (settings.siteTitle) {
      document.title = settings.siteTitle;
    }
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta && settings.seoDescription) {
      descMeta.setAttribute('content', settings.seoDescription);
    }
  }, [data]);

  // Lenis smooth scrolling + GSAP ScrollTrigger animations
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    lenis.on('scroll', ScrollTrigger.update);

    const tickerFn = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerFn);
    gsap.ticker.lagSmoothing(0);

    const ctx = gsap.context(() => {
      // Master scroll progress for 3D scene & video scrubbing
      ScrollTrigger.create({
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: (self) => {
          scrollProgressRef.current = self.progress;
        },
      });

      // Line-by-line mask reveal for hero elements
      gsap.from('.hero-reveal-line', {
        yPercent: 100,
        opacity: 0,
        duration: 0.85,
        stagger: 0.1,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });

      // Scroll-triggered section reveals
      gsap.utils.toArray<HTMLElement>('.section-reveal').forEach((el) => {
        gsap.from(el, {
          y: 26,
          opacity: 0,
          duration: 0.75,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
          scrollTrigger: {
            trigger: el,
            start: 'top 86%',
            once: true,
          },
        });
      });

      // Staggered project cards
      gsap.from('.project-card-item', {
        y: 32,
        opacity: 0,
        duration: 0.7,
        stagger: 0.12,
        ease: 'power2.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: '#projects',
          start: 'top 80%',
          once: true,
        },
      });
    }, pageRef);

    return () => {
      ctx.revert();
      gsap.ticker.remove(tickerFn);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [data.projects.length]);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (!el) return;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(el, { offset: -72 });
    } else {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitFeedback(null);

    const name = formState.name.trim();
    const email = formState.email.trim();
    const subject = formState.subject.trim();
    const message = formState.message.trim();

    if (name.length < 2) {
      setSubmitFeedback({ type: 'error', text: 'Please enter your name.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubmitFeedback({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }
    if (subject.length < 2) {
      setSubmitFeedback({ type: 'error', text: 'Please provide a subject.' });
      return;
    }
    if (message.length < 3) {
      setSubmitFeedback({
        type: 'error',
        text: 'Please write a message of at least 3 characters.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitContactForm({
        name,
        email,
        subject,
        message,
        hp_company_ref: formState.hp_company_ref,
        recipientEmail: settings.contactEmail,
        contactEndpoint: settings.contactEndpoint,
      });
      setFormState({ name: '', email: '', subject: '', message: '', hp_company_ref: '' });
      setSubmitFeedback({
        type: 'success',
        text: result.notice || 'Thank you. Your message has been delivered.',
      });
    } catch (err) {
      setSubmitFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to send message right now.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const { settings, expertise, projects, experience, education } = data;
  const adminHref =
    typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')
      ? '#/portal-x7k2'
      : '/portal-x7k2';
  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About' },
    { id: 'expertise', label: 'Expertise' },
    { id: 'projects', label: 'Projects' },
    { id: 'experience', label: 'Experience' },
    { id: 'education', label: 'Education' },
  ];

  return (
    <div ref={pageRef} className="relative min-h-screen bg-(--bg-canvas) text-(--text-ink)">
      <CustomCursor />
      <div className="grain-overlay" aria-hidden="true" />

      <WorkflowCanvas
        scrollProgressRef={scrollProgressRef}
        theme={theme}
        accentColor={settings.accentColor}
        scrollVideoUrl={settings.scrollVideoUrl}
      />

      {/* 3-zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-(--border-hairline) bg-(--bg-canvas)/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
          {/* Zone 1: Single-line brand wordmark */}
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('home');
            }}
            className="font-display text-lg font-semibold tracking-tight whitespace-nowrap shrink-0"
          >
            Musaddik Miton
          </a>

          {/* Zone 2: Clean single-line anchor navigation */}
          <nav
            aria-label="Primary navigation"
            className="hidden lg:flex items-center gap-6 text-sm text-(--text-muted)"
          >
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(item.id);
                }}
                className="relative py-1 whitespace-nowrap shrink-0 transition-colors hover:text-(--text-ink) after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 after:bg-(--accent) after:transition-all after:duration-200 hover:after:w-full"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Zone 3: Header actions (+ mobile menu button on small screens) */}
          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href={adminHref}
              rel="nofollow"
              className="hidden sm:inline-flex items-center border border-(--border-hairline) px-3.5 py-2 text-xs font-medium text-(--text-ink) whitespace-nowrap shrink-0 transition-colors hover:border-(--accent) hover:text-(--accent)"
            >
              Admin Panel
            </a>
            <button
              type="button"
              onClick={() => scrollToSection('contact')}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white whitespace-nowrap shrink-0 transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <span>Contact</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="flex h-10 w-10 items-center justify-center border border-(--border-hairline) lg:hidden"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="border-t border-(--border-hairline) bg-(--bg-canvas) px-6 py-4 lg:hidden">
            <nav aria-label="Mobile navigation" className="flex flex-col gap-3">
              {[...navItems, { id: 'contact', label: 'Contact' }].map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(item.id);
                  }}
                  className="py-1.5 text-sm font-medium text-(--text-ink)"
                >
                  {item.label}
                </a>
              ))}
              <a
                href={adminHref}
                rel="nofollow"
                className="mt-1 border-t border-(--border-hairline) pt-3 text-sm font-medium text-(--accent)"
              >
                Admin Panel
              </a>
            </nav>
          </div>
        )}
      </header>

      <main className="relative z-10">
        {/* 01 — HERO */}
        <section
          id="home"
          className="mx-auto flex min-h-[calc(100vh-73px)] max-w-6xl flex-col justify-between px-6 pt-12 pb-16 sm:pt-20 sm:pb-20"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-(--border-hairline) pb-5">
            <div className="flex items-center gap-3 font-mono-tabular text-xs text-(--text-muted)">
              <span style={{ color: 'var(--accent)' }}>01</span>
              <span aria-hidden="true">/</span>
              <span>{settings.heroLocation}</span>
            </div>
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              className="inline-flex h-10 items-center gap-2 border border-(--border-hairline) bg-(--bg-canvas)/80 px-3.5 text-xs font-medium text-(--text-ink) transition-colors hover:border-(--accent)"
            >
              {theme === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </button>
          </div>

          <div className="my-auto py-12 sm:py-16">
            <div className="reveal-mask">
              <p className="hero-reveal-line font-mono-tabular text-sm tracking-wide text-(--text-muted)">
                {settings.heroTitle}
              </p>
            </div>

            <div className="reveal-mask mt-4">
              <h1
                className="hero-reveal-line font-display text-4xl font-semibold tracking-tight leading-[1.04] sm:text-6xl lg:text-7xl"
                style={{ textWrap: 'balance' }}
              >
                {settings.heroName}
              </h1>
            </div>

            <div className="reveal-mask mt-6 max-w-2xl">
              <p className="hero-reveal-line text-lg leading-relaxed text-(--text-muted) sm:text-xl">
                {settings.heroTagline}
              </p>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <MagneticButton
                href="#projects"
                onClick={() => scrollToSection('projects')}
                className="inline-flex h-12 items-center gap-2.5 px-7 text-sm font-medium text-white whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <span>{settings.heroPrimaryCta}</span>
                <ArrowRight className="h-4 w-4" />
              </MagneticButton>

              <MagneticButton
                href="#contact"
                onClick={() => scrollToSection('contact')}
                className="inline-flex h-12 items-center gap-2.5 border border-(--border-hairline) bg-(--bg-canvas)/85 px-7 text-sm font-medium text-(--text-ink) whitespace-nowrap shrink-0 transition-colors hover:border-(--accent)"
              >
                <span>{settings.heroSecondaryCta}</span>
              </MagneticButton>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-(--border-hairline) pt-5 text-xs text-(--text-muted)">
            <span>Scroll to explore workflow systems</span>
            <span className="font-mono-tabular">Gaibandha, BD</span>
          </div>
        </section>

        {/* 02 — ABOUT & OBJECTIVE */}
        <section id="about" className="border-t border-(--border-hairline) bg-(--bg-canvas)/88">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
            <div className="section-reveal grid gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-4">
                <div className="flex items-center gap-3 font-mono-tabular text-xs text-(--text-muted)">
                  <span style={{ color: 'var(--accent)' }}>02</span>
                  <span aria-hidden="true">/</span>
                  <span>Profile & Focus</span>
                </div>
                <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  About
                </h2>
              </div>

              <div className="lg:col-span-8 space-y-10">
                <p className="text-lg leading-relaxed text-(--text-ink) sm:text-xl sm:leading-relaxed">
                  {settings.aboutText}
                </p>

                <div className="border-t border-(--border-hairline) pt-8">
                  <h3 className="font-mono-tabular text-xs uppercase tracking-widest text-(--text-muted)">
                    Objective
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-(--text-muted)">
                    {settings.objectiveText}
                  </p>
                </div>

                {settings.strengths.length > 0 && (
                  <div className="border-t border-(--border-hairline) pt-8">
                    <h3 className="font-mono-tabular text-xs uppercase tracking-widest text-(--text-muted)">
                      Core Strengths
                    </h3>
                    <ol className="mt-5 grid gap-x-10 gap-y-3 sm:grid-cols-2">
                      {settings.strengths.map((strength, idx) => (
                        <li
                          key={idx}
                          className="flex items-baseline gap-3 border-b border-(--border-hairline) pb-3 text-sm"
                        >
                          <span className="font-mono-tabular text-xs text-(--text-muted)">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 03 — EXPERTISE (Clean typographic lists, not icon cards) */}
        <section id="expertise" className="border-t border-(--border-hairline) bg-(--bg-surface)/85">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
            <div className="section-reveal mb-14 flex flex-wrap items-end justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 font-mono-tabular text-xs text-(--text-muted)">
                  <span style={{ color: 'var(--accent)' }}>03</span>
                  <span aria-hidden="true">/</span>
                  <span>Capabilities</span>
                </div>
                <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Expertise
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-(--text-muted)">
                Practical systems engineering across AI agents, workflow orchestration, APIs, and
                digital media production.
              </p>
            </div>

            <div className="section-reveal grid gap-10 md:grid-cols-3 md:gap-12">
              {expertise.map((group, groupIdx) => (
                <div
                  key={group.id || groupIdx}
                  className="border-t border-(--border-hairline) pt-6"
                >
                  <span className="font-mono-tabular text-xs text-(--text-muted)">
                    0{groupIdx + 1}
                  </span>
                  <h3 className="font-display mt-2 text-xl font-semibold tracking-tight">
                    {group.title}
                  </h3>
                  <ul className="mt-6 divide-y divide-(--border-hairline) border-y border-(--border-hairline)">
                    {group.skills.map((skill, idx) => (
                      <li key={idx} className="py-3 text-sm text-(--text-ink)">
                        {skill}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 04 — PROJECTS */}
        <section id="projects" className="border-t border-(--border-hairline) bg-(--bg-canvas)/90">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
            <div className="section-reveal mb-14 flex flex-wrap items-end justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 font-mono-tabular text-xs text-(--text-muted)">
                  <span style={{ color: 'var(--accent)' }}>04</span>
                  <span aria-hidden="true">/</span>
                  <span>Selected Work</span>
                </div>
                <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Projects
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-(--text-muted)">
                Select any project to inspect the full architecture, scope, and technology stack.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => {
                const resolvedMedia = resolveMediaUrl(project.mediaUrl);
                const imgBroken = failedImages[project.id];
                return (
                  <article
                    key={project.id}
                    className="project-card-item group flex flex-col border border-(--border-hairline) bg-(--bg-canvas) transition-colors hover:border-(--accent)"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedProject(project)}
                      className="flex h-full flex-col text-left"
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden border-b border-(--border-hairline) bg-(--bg-surface)">
                        {resolvedMedia && !imgBroken ? (
                          project.mediaType === 'video' ? (
                            <video
                              src={resolvedMedia}
                              muted
                              loop
                              playsInline
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <img
                              src={resolvedMedia}
                              alt={project.title}
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setFailedImages((prev) => ({ ...prev, [project.id]: true }))
                              }
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                          )
                        ) : (
                          <div className="flex h-full w-full flex-col justify-between p-6">
                            <span className="font-mono-tabular text-xs text-(--text-muted)">
                              {project.numberLabel}
                            </span>
                            <span className="font-display text-lg font-medium text-(--text-ink)">
                              {project.title}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col justify-between p-6">
                        <div>
                          <div className="flex items-center justify-between font-mono-tabular text-xs text-(--text-muted)">
                            <span style={{ color: 'var(--accent)' }}>{project.numberLabel}</span>
                            <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </div>

                          <h3
                            className="font-display mt-3 text-xl font-semibold tracking-tight"
                            style={{ textWrap: 'balance' }}
                          >
                            {project.title}
                          </h3>

                          {project.summary && (
                            <p className="mt-3 text-sm leading-relaxed text-(--text-muted)">
                              {project.summary}
                            </p>
                          )}

                          {project.bullets.length > 0 && (
                            <ul className="mt-4 space-y-1.5 border-t border-(--border-hairline) pt-4 text-xs leading-relaxed text-(--text-muted)">
                              {project.bullets.slice(0, 3).map((b, i) => (
                                <li key={i}>— {b}</li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="mt-6 border-t border-(--border-hairline) pt-4">
                          {project.technologies.length > 0 ? (
                            <p className="font-mono-tabular text-xs text-(--text-muted)">
                              {project.technologies.join(' · ')}
                            </p>
                          ) : (
                            <p className="font-mono-tabular text-xs text-(--text-muted)">
                              Full-stack implementation
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* 05 — EXPERIENCE */}
        <section id="experience" className="border-t border-(--border-hairline) bg-(--bg-surface)/85">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
            <div className="section-reveal mb-12">
              <div className="flex items-center gap-3 font-mono-tabular text-xs text-(--text-muted)">
                <span style={{ color: 'var(--accent)' }}>05</span>
                <span aria-hidden="true">/</span>
                <span>Practice</span>
              </div>
              <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Experience
              </h2>
            </div>

            <div className="section-reveal divide-y divide-(--border-hairline) border-y border-(--border-hairline)">
              {experience.map((exp, idx) => (
                <div key={exp.id || idx} className="grid gap-8 py-10 lg:grid-cols-12">
                  <div className="lg:col-span-5">
                    {exp.period && (
                      <p className="font-mono-tabular text-xs text-(--text-muted)">{exp.period}</p>
                    )}
                    <h3 className="font-display mt-2 text-xl font-semibold tracking-tight">
                      {exp.role}
                    </h3>
                    <p className="mt-1 text-sm text-(--text-muted)">{exp.organization}</p>
                  </div>

                  <div className="lg:col-span-7">
                    <ul className="space-y-3">
                      {exp.bullets.map((bullet, bIdx) => (
                        <li key={bIdx} className="flex items-start gap-3 text-sm leading-relaxed">
                          <span
                            aria-hidden="true"
                            className="mt-2 h-1.5 w-1.5 shrink-0"
                            style={{ backgroundColor: 'var(--accent)' }}
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 06 — EDUCATION */}
        <section id="education" className="border-t border-(--border-hairline) bg-(--bg-canvas)/90">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
            <div className="section-reveal grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <div className="flex items-center gap-3 font-mono-tabular text-xs text-(--text-muted)">
                  <span style={{ color: 'var(--accent)' }}>06</span>
                  <span aria-hidden="true">/</span>
                  <span>Academic Background</span>
                </div>
                <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Education
                </h2>
              </div>

              <div className="lg:col-span-7 divide-y divide-(--border-hairline) border-y border-(--border-hairline)">
                {education.map((edu, idx) => (
                  <div key={edu.id || idx} className="flex flex-wrap items-baseline justify-between gap-4 py-6">
                    <div>
                      <h3 className="font-display text-xl font-semibold tracking-tight">
                        {edu.institution}
                      </h3>
                      {edu.degree && (
                        <p className="mt-1 text-sm text-(--text-muted)">{edu.degree}</p>
                      )}
                    </div>
                    <div className="text-right font-mono-tabular text-xs text-(--text-muted)">
                      {edu.location && <p>{edu.location}</p>}
                      {edu.period && <p className="mt-1">{edu.period}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 07 — CONTACT */}
        <section id="contact" className="border-t border-(--border-hairline) bg-(--bg-surface)/92">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
            <div className="section-reveal grid gap-14 lg:grid-cols-12">
              <div className="lg:col-span-5 space-y-8">
                <div>
                  <div className="flex items-center gap-3 font-mono-tabular text-xs text-(--text-muted)">
                    <span style={{ color: 'var(--accent)' }}>07</span>
                    <span aria-hidden="true">/</span>
                    <span>Direct Inquiry</span>
                  </div>
                  <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                    Get in Touch
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-(--text-muted)">
                    Available for workflow automation builds, custom AI agent systems, and API
                    integration consulting.
                  </p>
                </div>

                <div className="space-y-4 border-t border-(--border-hairline) pt-6 text-sm">
                  <div>
                    <span className="font-mono-tabular text-xs uppercase tracking-wider text-(--text-muted)">
                      Email
                    </span>
                    <p className="mt-1">
                      <a
                        href={`mailto:${settings.contactEmail}`}
                        className="font-medium underline decoration-(--border-hairline) underline-offset-4 transition-colors hover:text-(--accent)"
                      >
                        {settings.contactEmail}
                      </a>
                    </p>
                  </div>
                  <div>
                    <span className="font-mono-tabular text-xs uppercase tracking-wider text-(--text-muted)">
                      Location
                    </span>
                    <p className="mt-1 font-medium">{settings.contactLocation}</p>
                  </div>

                  {settings.socialLinks.length > 0 && (
                    <div>
                      <span className="font-mono-tabular text-xs uppercase tracking-wider text-(--text-muted)">
                        Links
                      </span>
                      <div className="mt-2 flex flex-wrap gap-4">
                        {settings.socialLinks.map((link) => (
                          <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium transition-colors hover:text-(--accent)"
                          >
                            <span>{link.label}</span>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7">
                <form
                  onSubmit={handleContactSubmit}
                  noValidate
                  className="border border-(--border-hairline) bg-(--bg-canvas) p-6 sm:p-8"
                >
                  {/* Hidden honeypot field for bot mitigation (autofill-safe name) */}
                  <div
                    style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}
                    aria-hidden="true"
                  >
                    <label htmlFor="contact-hp-ref">Company Reference</label>
                    <input
                      id="contact-hp-ref"
                      name="hp_company_ref"
                      type="text"
                      tabIndex={-1}
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      value={formState.hp_company_ref}
                      onChange={(e) => setFormState((s) => ({ ...s, hp_company_ref: e.target.value }))}
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="contact-name" className="block text-xs font-medium text-(--text-muted)">
                        Name
                      </label>
                      <input
                        id="contact-name"
                        name="name"
                        type="text"
                        required
                        value={formState.name}
                        onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                        placeholder="Your full name"
                        className="mt-2 h-11 w-full border border-(--border-hairline) bg-transparent px-3.5 text-sm text-(--text-ink) placeholder:text-(--text-muted)/60 focus:border-(--accent) focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-email" className="block text-xs font-medium text-(--text-muted)">
                        Email
                      </label>
                      <input
                        id="contact-email"
                        name="email"
                        type="email"
                        required
                        value={formState.email}
                        onChange={(e) => setFormState((s) => ({ ...s, email: e.target.value }))}
                        placeholder="you@example.com"
                        className="mt-2 h-11 w-full border border-(--border-hairline) bg-transparent px-3.5 text-sm text-(--text-ink) placeholder:text-(--text-muted)/60 focus:border-(--accent) focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-5">
                    <label htmlFor="contact-subject" className="block text-xs font-medium text-(--text-muted)">
                      Subject
                    </label>
                    <input
                      id="contact-subject"
                      name="subject"
                      type="text"
                      required
                      value={formState.subject}
                      onChange={(e) => setFormState((s) => ({ ...s, subject: e.target.value }))}
                      placeholder="Workflow automation inquiry"
                      className="mt-2 h-11 w-full border border-(--border-hairline) bg-transparent px-3.5 text-sm text-(--text-ink) placeholder:text-(--text-muted)/60 focus:border-(--accent) focus:outline-none"
                    />
                  </div>

                  <div className="mt-5">
                    <label htmlFor="contact-message" className="block text-xs font-medium text-(--text-muted)">
                      Message
                    </label>
                    <textarea
                      id="contact-message"
                      name="message"
                      rows={5}
                      required
                      value={formState.message}
                      onChange={(e) => setFormState((s) => ({ ...s, message: e.target.value }))}
                      placeholder="Share your goals, tools, or project timeline..."
                      className="mt-2 w-full border border-(--border-hairline) bg-transparent p-3.5 text-sm text-(--text-ink) placeholder:text-(--text-muted)/60 focus:border-(--accent) focus:outline-none"
                    />
                  </div>

                  {submitFeedback && (
                    <div
                      role="status"
                      className={`mt-5 flex items-start gap-2.5 border p-3.5 text-sm transition-all duration-200 ${
                        submitFeedback.type === 'success'
                          ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300'
                          : 'border-red-600/40 bg-red-600/10 text-red-800 dark:text-red-300'
                      }`}
                    >
                      {submitFeedback.type === 'success' ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      ) : (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <div className="space-y-1.5">
                        <p>{submitFeedback.text}</p>
                        {submitFeedback.type === 'error' && settings.contactEmail && (
                          <p>
                            <a
                              href={`mailto:${encodeURIComponent(settings.contactEmail)}?subject=${encodeURIComponent(
                                formState.subject.trim() || 'Portfolio Inquiry',
                              )}&body=${encodeURIComponent(
                                `${formState.message.trim()}\n\nFrom: ${formState.name.trim()} (${formState.email.trim()})`,
                              )}`}
                              className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-4"
                            >
                              <span>Send directly to {settings.contactEmail}</span>
                              <ArrowUpRight className="h-3 w-3" />
                            </a>
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex items-center justify-between gap-4">
                    <p className="text-xs text-(--text-muted)">
                      Messages are stored securely and reviewed directly.
                    </p>
                    <MagneticButton
                      type="submit"
                      disabled={submitting}
                      className="inline-flex h-11 items-center gap-2 px-6 text-sm font-medium text-white whitespace-nowrap shrink-0 disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      <span>{submitting ? 'Sending...' : 'Send Message'}</span>
                      <ArrowRight className="h-4 w-4" />
                    </MagneticButton>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Editorial Footer (ZERO link to admin portal) */}
      <footer className="relative z-10 border-t border-(--border-hairline) bg-(--bg-canvas)">
        <div className="mx-auto max-w-6xl px-6 py-10 text-xs text-(--text-muted)">
          {(settings.footerTagline ||
            (settings.footerShowSocials && settings.socialLinks.length > 0) ||
            settings.footerLinks.length > 0) && (
            <div className="mb-8 flex flex-wrap items-start justify-between gap-6 border-b border-(--border-hairline) pb-8">
              {settings.footerTagline && (
                <p className="max-w-md text-sm leading-relaxed text-(--text-muted)">
                  {settings.footerTagline}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-6">
                {settings.footerShowSocials &&
                  settings.socialLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-(--text-ink) transition-colors hover:text-(--accent)"
                    >
                      <span>{link.label}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  ))}
                {settings.footerLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 transition-colors hover:text-(--text-ink)"
                  >
                    <span>{link.label}</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p>
              {(
                settings.footerCopyright ||
                `© {year} ${settings.heroName}. ${settings.contactLocation}.`
              ).replace(/\{year\}/gi, String(new Date().getFullYear()))}
            </p>
            <div className="flex items-center gap-6">
              {settings.footerShowThemeToggle && (
                <button
                  type="button"
                  onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
                  className="transition-colors hover:text-(--text-ink)"
                >
                  {theme === 'light' ? 'Switch to Dark' : 'Switch to Light'}
                </button>
              )}
              <a
                href="#home"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('home');
                }}
                className="transition-colors hover:text-(--text-ink)"
              >
                Back to top
              </a>
            </div>
          </div>
        </div>
      </footer>

      <ProjectModal project={selectedProject} onClose={() => setSelectedProject(null)} />
    </div>
  );
}
