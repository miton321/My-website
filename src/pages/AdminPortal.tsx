import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  adminLogin,
  adminLogout,
  changeAdminPassword,
  createAdminProject,
  deleteAdminMessage,
  deleteAdminProject,
  fetchAdminDashboard,
  fetchAdminSession,
  reorderAdminProjects,
  saveAdminEducation,
  saveAdminExperience,
  saveAdminExpertise,
  saveAdminSettings,
  toggleMessageRead,
  updateAdminProject,
  uploadAdminMedia,
} from '../lib/api.ts';
import { resolveMediaUrl } from '../lib/seedAssets.ts';
import type {
  AdminDashboardData,
  EducationItem,
  ExperienceItem,
  ExpertiseGroup,
  ProjectItem,
  SiteSettings,
} from '../types/portfolio.ts';

type AdminTab =
  | 'inbox'
  | 'hero'
  | 'expertise'
  | 'projects'
  | 'background'
  | 'contact'
  | 'footer'
  | 'settings'
  | 'security';

interface ToastItem {
  id: number;
  type: 'success' | 'error';
  text: string;
}

const ACCENT_PRESETS = ['#E04F26', '#C2410C', '#65A30D', '#0F766E', '#1D4ED8', '#18181B'];

export default function AdminPortal() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [adminUsername, setAdminUsername] = useState('');
  const [csrfToken, setCsrfToken] = useState('');

  // Login form state
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Dashboard state
  const [activeTab, setActiveTab] = useState<AdminTab>('inbox');
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loadingDash, setLoadingDash] = useState(false);

  // Draft editors
  const [settingsDraft, setSettingsDraft] = useState<SiteSettings | null>(null);
  const [expertiseDraft, setExpertiseDraft] = useState<ExpertiseGroup[]>([]);
  const [experienceDraft, setExperienceDraft] = useState<ExperienceItem[]>([]);
  const [educationDraft, setEducationDraft] = useState<EducationItem[]>([]);
  const [dirtyTabs, setDirtyTabs] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Project editor modal/drawer state
  const [editingProject, setEditingProject] = useState<
    (Omit<ProjectItem, 'id' | 'slug' | 'sortOrder'> & {
      id?: number;
      technologiesText: string;
    }) | null
  >(null);
  const [projectFormError, setProjectFormError] = useState('');
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<number | null>(null);
  const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState<number | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Inbox filters
  const [messageQuery, setMessageQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((type: 'success' | 'error', text: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Ensure noindex meta tag while on admin route
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow, noarchive';
    document.head.appendChild(meta);
    document.title = 'Admin Portal';
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  // Warn before leaving if there are unsaved edits
  const hasUnsavedChanges = useMemo(
    () => Object.values(dirtyTabs).some(Boolean),
    [dirtyTabs],
  );

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoadingDash(true);
    try {
      const res = await fetchAdminDashboard();
      setDashboard(res);
      setSettingsDraft((prev) => (prev && silent ? prev : res.settings));
      setExpertiseDraft((prev) => (prev.length && silent ? prev : res.expertise));
      setExperienceDraft((prev) => (prev.length && silent ? prev : res.experience));
      setEducationDraft((prev) => (prev.length && silent ? prev : res.education));
      if (!silent) setDirtyTabs({});
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard';
      if (msg === 'Unauthorized') {
        setAuthenticated(false);
        setCsrfToken('');
        setDashboard(null);
        setLoginError('Session expired or blocked. Please sign in again.');
      } else if (!silent) {
        pushToast('error', msg);
      }
    } finally {
      if (!silent) setLoadingDash(false);
    }
  }, [pushToast]);

  useEffect(() => {
    fetchAdminSession()
      .then((res) => {
        setConfigured(res.configured);
        if (res.authenticated && res.csrfToken) {
          setAuthenticated(true);
          setAdminUsername(res.username || '');
          setCsrfToken(res.csrfToken);
          loadDashboard();
        }
      })
      .catch(() => {})
      .finally(() => setCheckingSession(false));
  }, [loadDashboard]);

  // Keep inbox messages fresh when switching tabs, regaining focus, or polling
  useEffect(() => {
    if (!authenticated) return;
    const onFocus = () => {
      loadDashboard(true);
    };
    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(() => {
      if (activeTab === 'inbox' && !document.hidden) {
        loadDashboard(true);
      }
    }, 15000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, [authenticated, activeTab, loadDashboard]);

  useEffect(() => {
    if (!editingProject) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingProject(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingProject]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await adminLogin(loginUser, loginPass);
      setAuthenticated(true);
      setAdminUsername(res.username);
      setCsrfToken(res.csrfToken);
      setLoginPass('');
      await loadDashboard();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setLoggingIn(false);
    }
  };

  const performLogout = async () => {
    setConfirmLogout(false);
    try {
      await adminLogout(csrfToken);
    } catch {
      // clear local state regardless
    }
    setAuthenticated(false);
    setCsrfToken('');
    setDashboard(null);
    setDirtyTabs({});
  };

  const handleLogout = async () => {
    if (hasUnsavedChanges) {
      setConfirmLogout(true);
      return;
    }
    await performLogout();
  };

  const markDirty = (tabKey: string) => {
    setDirtyTabs((prev) => ({ ...prev, [tabKey]: true }));
  };

  const handleSaveSettings = async (tabKey: string) => {
    if (!settingsDraft) return;
    setSaving(true);
    try {
      const res = await saveAdminSettings(settingsDraft, csrfToken);
      setSettingsDraft(res.settings);
      setDashboard((prev) => (prev ? { ...prev, settings: res.settings } : prev));
      setDirtyTabs((prev) => ({ ...prev, [tabKey]: false }));
      pushToast('success', 'Changes saved');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExpertise = async () => {
    setSaving(true);
    try {
      const payload = expertiseDraft.map((g) => ({
        title: g.title,
        skills: g.skills.filter((s) => s.trim().length > 0),
      }));
      const res = await saveAdminExpertise(payload, csrfToken);
      setExpertiseDraft(res.expertise);
      setDashboard((prev) => (prev ? { ...prev, expertise: res.expertise } : prev));
      setDirtyTabs((prev) => ({ ...prev, expertise: false }));
      pushToast('success', 'Expertise updated');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to save expertise');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBackground = async () => {
    setSaving(true);
    try {
      const expRes = await saveAdminExperience(
        experienceDraft.map((e) => ({
          role: e.role,
          organization: e.organization,
          period: e.period,
          bullets: e.bullets.filter((b) => b.trim().length > 0),
        })),
        csrfToken,
      );
      const eduRes = await saveAdminEducation(
        educationDraft.map((e) => ({
          institution: e.institution,
          location: e.location,
          degree: e.degree,
          period: e.period,
        })),
        csrfToken,
      );
      setExperienceDraft(expRes.experience);
      setEducationDraft(eduRes.education);
      setDashboard((prev) =>
        prev
          ? { ...prev, experience: expRes.experience, education: eduRes.education }
          : prev,
      );
      setDirtyTabs((prev) => ({ ...prev, background: false }));
      pushToast('success', 'Experience and education saved');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to save background');
    } finally {
      setSaving(false);
    }
  };

  const normalizeLiveUrl = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    setProjectFormError('');

    const titleTrimmed = editingProject.title.trim();
    const numberTrimmed = editingProject.numberLabel.trim();
    if (!numberTrimmed) {
      setProjectFormError('Project number is required.');
      return;
    }
    if (titleTrimmed.length < 2) {
      setProjectFormError('Project title must be at least 2 characters.');
      return;
    }

    const parsedTechnologies = editingProject.technologiesText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const normalizedLiveUrl = normalizeLiveUrl(editingProject.liveUrl);

    setSaving(true);
    try {
      const payload = {
        numberLabel: numberTrimmed,
        title: titleTrimmed,
        summary: editingProject.summary.trim(),
        bullets: editingProject.bullets.map((b) => b.trim()).filter((b) => b.length > 0),
        technologies: parsedTechnologies,
        mediaType: editingProject.mediaType,
        mediaUrl: editingProject.mediaUrl.trim(),
        liveUrl: normalizedLiveUrl,
        published: editingProject.published,
      };
      if (editingProject.id) {
        const res = await updateAdminProject(editingProject.id, payload, csrfToken);
        setDashboard((prev) =>
          prev
            ? {
                ...prev,
                projects: prev.projects.map((p) => (p.id === res.project.id ? res.project : p)),
              }
            : prev,
        );
        pushToast('success', 'Project updated');
      } else {
        const res = await createAdminProject(payload, csrfToken);
        setDashboard((prev) =>
          prev ? { ...prev, projects: [...prev.projects, res.project] } : prev,
        );
        pushToast('success', 'Project created');
      }
      setEditingProject(null);
      await loadDashboard(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save project';
      setProjectFormError(msg);
      pushToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProjectPublish = async (project: ProjectItem) => {
    try {
      const res = await updateAdminProject(
        project.id,
        {
          numberLabel: project.numberLabel,
          title: project.title,
          summary: project.summary,
          bullets: project.bullets,
          technologies: project.technologies,
          mediaType: project.mediaType,
          mediaUrl: project.mediaUrl,
          liveUrl: project.liveUrl,
          published: !project.published,
        },
        csrfToken,
      );
      setDashboard((prev) =>
        prev
          ? {
              ...prev,
              projects: prev.projects.map((p) => (p.id === res.project.id ? res.project : p)),
            }
          : prev,
      );
      pushToast('success', project.published ? 'Project unpublished' : 'Project published');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleMoveProject = async (idx: number, dir: -1 | 1) => {
    if (!dashboard) return;
    const list = [...dashboard.projects];
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const [moved] = list.splice(idx, 1);
    list.splice(targetIdx, 0, moved);
    try {
      const res = await reorderAdminProjects(
        list.map((p) => p.id),
        csrfToken,
      );
      setDashboard((prev) => (prev ? { ...prev, projects: res.projects } : prev));
      pushToast('success', 'Project order updated');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Reorder failed');
    }
  };

  const handleDeleteProject = async (id: number) => {
    setConfirmDeleteProjectId(null);
    try {
      await deleteAdminProject(id, csrfToken);
      setDashboard((prev) =>
        prev ? { ...prev, projects: prev.projects.filter((p) => p.id !== id) } : prev,
      );
      if (editingProject?.id === id) {
        setEditingProject(null);
      }
      pushToast('success', 'Project deleted');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleFileUpload = async (
    file: File,
    onDone: (url: string, mediaType: 'image' | 'video') => void,
  ) => {
    setUploading(true);
    try {
      const res = await uploadAdminMedia(file, csrfToken);
      onDone(res.url, res.mediaType);
      pushToast('success', 'Media uploaded');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleMessage = async (id: number, currentRead: boolean) => {
    try {
      await toggleMessageRead(id, !currentRead, csrfToken);
      setDashboard((prev) => {
        if (!prev) return prev;
        const messages = prev.messages.map((m) =>
          m.id === id ? { ...m, isRead: !currentRead } : m,
        );
        return {
          ...prev,
          messages,
          unreadCount: messages.filter((m) => !m.isRead).length,
        };
      });
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to update message');
    }
  };

  const handleDeleteMessage = async (id: number) => {
    setConfirmDeleteMessageId(null);
    try {
      await deleteAdminMessage(id, csrfToken);
      setDashboard((prev) => {
        if (!prev) return prev;
        const messages = prev.messages.filter((m) => m.id !== id);
        return {
          ...prev,
          messages,
          unreadCount: messages.filter((m) => !m.isRead).length,
        };
      });
      pushToast('success', 'Message deleted');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      pushToast('error', 'New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      pushToast('error', 'Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await changeAdminPassword(currentPassword, newPassword, csrfToken);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      pushToast('success', 'Admin password updated');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Password change failed');
    } finally {
      setSaving(false);
    }
  };

  const filteredMessages = useMemo(() => {
    if (!dashboard) return [];
    const q = messageQuery.trim().toLowerCase();
    return dashboard.messages.filter((m) => {
      if (unreadOnly && m.isRead) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q) ||
        m.message.toLowerCase().includes(q)
      );
    });
  }, [dashboard, messageQuery, unreadOnly]);

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--bg-canvas) text-sm text-(--text-muted)">
        Verifying session...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--bg-canvas) px-6 py-12 text-(--text-ink)">
        <div className="w-full max-w-md border border-(--border-hairline) bg-(--bg-elevated) p-8">
          <div className="border-b border-(--border-hairline) pb-5">
            <p className="font-mono-tabular text-xs uppercase tracking-widest text-(--text-muted)">
              Private Portal
            </p>
            <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight">
              Portfolio Administration
            </h1>
          </div>

          {!configured && (
            <div className="mt-6 border border-amber-600/40 bg-amber-600/10 p-3.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              Set <code className="font-mono-tabular">ADMIN_USERNAME</code> and{' '}
              <code className="font-mono-tabular">ADMIN_PASSWORD</code> in your server environment
              variables to activate admin sign-in.
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-5">
            <div>
              <label htmlFor="admin-username" className="block text-xs font-medium text-(--text-muted)">
                Username
              </label>
              <input
                id="admin-username"
                type="text"
                autoComplete="username"
                required
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                className="mt-2 h-11 w-full border border-(--border-hairline) bg-transparent px-3.5 text-sm focus:border-(--accent) focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-xs font-medium text-(--text-muted)">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className="mt-2 h-11 w-full border border-(--border-hairline) bg-transparent px-3.5 text-sm focus:border-(--accent) focus:outline-none"
              />
            </div>

            {loginError && (
              <div
                role="alert"
                className="flex items-center gap-2 border border-red-600/40 bg-red-600/10 p-3 text-xs text-red-700 dark:text-red-300"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="h-11 w-full text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {loggingIn ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {typeof window !== 'undefined' && window.self !== window.top && (
            <div className="mt-5 border-t border-(--border-hairline) pt-4 text-center">
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-(--text-muted) underline underline-offset-4 hover:text-(--text-ink)"
              >
                <span>Open admin portal in a full browser tab</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: AdminTab; label: string; badge?: number; dirty?: boolean }> = [
    { id: 'inbox', label: 'Inbox', badge: dashboard?.unreadCount || 0 },
    { id: 'hero', label: 'Hero & Copy', dirty: dirtyTabs.hero },
    { id: 'expertise', label: 'Expertise', dirty: dirtyTabs.expertise },
    { id: 'projects', label: 'Projects' },
    { id: 'background', label: 'Experience & Edu', dirty: dirtyTabs.background },
    { id: 'contact', label: 'Contact & Socials', dirty: dirtyTabs.contact },
    { id: 'footer', label: 'Footer', dirty: dirtyTabs.footer },
    { id: 'settings', label: 'Site & Video', dirty: dirtyTabs.settings },
    { id: 'security', label: 'Security' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-(--bg-canvas) text-(--text-ink) lg:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full shrink-0 border-b border-(--border-hairline) bg-(--bg-surface) lg:w-64 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between border-b border-(--border-hairline) px-6 py-5">
          <div>
            <p className="font-mono-tabular text-[11px] uppercase tracking-widest text-(--text-muted)">
              Admin Console
            </p>
            <p className="font-display mt-1 text-base font-semibold">{adminUsername}</p>
          </div>
        </div>

        <nav className="flex overflow-x-auto p-3 lg:flex-col lg:gap-1" aria-label="Admin sections">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-between px-3.5 py-2.5 text-left text-sm whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-(--bg-canvas) font-medium text-(--text-ink)'
                    : 'text-(--text-muted) hover:text-(--text-ink)'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{tab.label}</span>
                  {tab.dirty && (
                    <span className="font-mono-tabular text-[10px] text-amber-600 dark:text-amber-400">
                      (unsaved)
                    </span>
                  )}
                </span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span
                    className="ml-2 px-1.5 py-0.5 font-mono-tabular text-[11px] text-white"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-(--border-hairline) bg-(--bg-canvas) px-6 py-4">
          <div className="flex items-center gap-3 text-xs font-mono-tabular text-(--text-muted)">
            <span>Portfolio CMS</span>
            <span>/</span>
            <span className="capitalize text-(--text-ink)">{activeTab}</span>
            {hasUnsavedChanges && (
              <span className="ml-2 border border-amber-600/40 bg-amber-600/10 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                Unsaved changes
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 border border-(--border-hairline) px-3.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors hover:border-(--accent)"
            >
              <span>View Site</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {confirmLogout ? (
              <div className="flex items-center gap-2 border border-amber-600/40 bg-amber-600/10 px-2.5 py-1 text-xs">
                <span className="text-amber-800 dark:text-amber-300">Unsaved changes.</span>
                <button
                  type="button"
                  onClick={performLogout}
                  className="font-medium text-red-600 hover:underline"
                >
                  Leave anyway
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmLogout(false)}
                  className="text-(--text-muted) hover:text-(--text-ink)"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-9 items-center gap-2 border border-(--border-hairline) px-3.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors hover:border-red-500 hover:text-red-600"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log Out</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 sm:p-10">
          {loadingDash || !dashboard || !settingsDraft ? (
            <p className="text-sm text-(--text-muted)">Loading portfolio data...</p>
          ) : (
            <div className="mx-auto max-w-4xl">
              {/* INBOX TAB */}
              {activeTab === 'inbox' && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-(--border-hairline) pb-5">
                    <div>
                      <h2 className="font-display text-2xl font-semibold">Messages Inbox</h2>
                      <p className="mt-1 text-sm text-(--text-muted)">
                        {dashboard.unreadCount} unread of {dashboard.messages.length} total
                        submissions.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--text-muted)" />
                        <input
                          type="search"
                          value={messageQuery}
                          onChange={(e) => setMessageQuery(e.target.value)}
                          placeholder="Search messages..."
                          className="h-10 border border-(--border-hairline) bg-transparent pr-3 pl-9 text-sm focus:border-(--accent) focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setUnreadOnly((v) => !v)}
                        className={`h-10 border px-3.5 text-xs font-medium transition-colors ${
                          unreadOnly
                            ? 'border-(--accent) text-(--accent)'
                            : 'border-(--border-hairline) text-(--text-muted)'
                        }`}
                      >
                        {unreadOnly ? 'Showing Unread' : 'Filter Unread'}
                      </button>
                      <button
                        type="button"
                        onClick={() => loadDashboard(false)}
                        className="inline-flex h-10 items-center gap-1.5 border border-(--border-hairline) px-3.5 text-xs font-medium transition-colors hover:border-(--accent)"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>

                  {filteredMessages.length === 0 ? (
                    <div className="mt-8 border border-(--border-hairline) p-10 text-center text-sm text-(--text-muted)">
                      No contact messages match your filter.
                    </div>
                  ) : (
                    <div className="mt-6 divide-y divide-(--border-hairline) border border-(--border-hairline)">
                      {filteredMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-6 transition-colors ${
                            msg.isRead ? 'bg-(--bg-canvas)' : 'bg-(--bg-surface)'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono-tabular text-(--text-muted)">
                                {!msg.isRead && (
                                  <span
                                    className="font-semibold uppercase"
                                    style={{ color: 'var(--accent)' }}
                                  >
                                    Unread
                                  </span>
                                )}
                                {!msg.isRead && <span>·</span>}
                                <span>{msg.createdAt}</span>
                                <span>·</span>
                                <span>{msg.email}</span>
                              </div>
                              <h3 className="font-display mt-2 text-lg font-semibold">
                                {msg.subject}
                              </h3>
                              <p className="text-xs text-(--text-muted)">From {msg.name}</p>
                            </div>

                            <div className="flex items-center gap-2">
                              <a
                                href={`mailto:${encodeURIComponent(msg.email)}?subject=${encodeURIComponent(
                                  `Re: ${msg.subject}`,
                                )}`}
                                className="inline-flex h-9 items-center gap-1.5 border border-(--border-hairline) px-3 text-xs font-medium transition-colors hover:border-(--accent)"
                              >
                                <Mail className="h-3.5 w-3.5" />
                                <span>Reply</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => handleToggleMessage(msg.id, msg.isRead)}
                                className="inline-flex h-9 items-center border border-(--border-hairline) px-3 text-xs font-medium transition-colors hover:border-(--accent)"
                              >
                                {msg.isRead ? 'Mark Unread' : 'Mark Read'}
                              </button>
                              {confirmDeleteMessageId === msg.id ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    className="inline-flex h-9 items-center border border-red-600 bg-red-600 px-2.5 text-xs font-medium text-white"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteMessageId(null)}
                                    className="inline-flex h-9 items-center border border-(--border-hairline) px-2.5 text-xs font-medium text-(--text-muted)"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteMessageId(msg.id)}
                                  aria-label="Delete message"
                                  className="inline-flex h-9 w-9 items-center justify-center border border-(--border-hairline) text-(--text-muted) transition-colors hover:border-red-500 hover:text-red-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-(--text-ink)">
                            {msg.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* HERO & NARRATIVE TAB */}
              {activeTab === 'hero' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between border-b border-(--border-hairline) pb-5">
                    <div>
                      <h2 className="font-display text-2xl font-semibold">Hero, About & Objective</h2>
                      <p className="mt-1 text-sm text-(--text-muted)">
                        Update primary hero messaging, biography, objective, and strengths.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveSettings('hero')}
                      className="h-10 px-5 text-xs font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Full Name">
                      <input
                        type="text"
                        value={settingsDraft.heroName}
                        onChange={(e) => {
                          setSettingsDraft({ ...settingsDraft, heroName: e.target.value });
                          markDirty('hero');
                        }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Professional Title">
                      <input
                        type="text"
                        value={settingsDraft.heroTitle}
                        onChange={(e) => {
                          setSettingsDraft({ ...settingsDraft, heroTitle: e.target.value });
                          markDirty('hero');
                        }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Hero Tagline">
                      <input
                        type="text"
                        value={settingsDraft.heroTagline}
                        onChange={(e) => {
                          setSettingsDraft({ ...settingsDraft, heroTagline: e.target.value });
                          markDirty('hero');
                        }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Hero Location">
                      <input
                        type="text"
                        value={settingsDraft.heroLocation}
                        onChange={(e) => {
                          setSettingsDraft({ ...settingsDraft, heroLocation: e.target.value });
                          markDirty('hero');
                        }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Primary CTA Label">
                      <input
                        type="text"
                        value={settingsDraft.heroPrimaryCta}
                        onChange={(e) => {
                          setSettingsDraft({ ...settingsDraft, heroPrimaryCta: e.target.value });
                          markDirty('hero');
                        }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Secondary CTA Label">
                      <input
                        type="text"
                        value={settingsDraft.heroSecondaryCta}
                        onChange={(e) => {
                          setSettingsDraft({ ...settingsDraft, heroSecondaryCta: e.target.value });
                          markDirty('hero');
                        }}
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <Field label="About Section Copy">
                    <textarea
                      rows={5}
                      value={settingsDraft.aboutText}
                      onChange={(e) => {
                        setSettingsDraft({ ...settingsDraft, aboutText: e.target.value });
                        markDirty('hero');
                      }}
                      className={textareaClass}
                    />
                  </Field>

                  <Field label="Career Objective">
                    <textarea
                      rows={3}
                      value={settingsDraft.objectiveText}
                      onChange={(e) => {
                        setSettingsDraft({ ...settingsDraft, objectiveText: e.target.value });
                        markDirty('hero');
                      }}
                      className={textareaClass}
                    />
                  </Field>

                  <div className="border-t border-(--border-hairline) pt-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-semibold">Core Strengths</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsDraft({
                            ...settingsDraft,
                            strengths: [...settingsDraft.strengths, ''],
                          });
                          markDirty('hero');
                        }}
                        className="inline-flex h-9 items-center gap-1.5 border border-(--border-hairline) px-3 text-xs font-medium hover:border-(--accent)"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Strength</span>
                      </button>
                    </div>
                    <div className="mt-4 space-y-2.5">
                      {settingsDraft.strengths.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => {
                              const next = [...settingsDraft.strengths];
                              next[idx] = e.target.value;
                              setSettingsDraft({ ...settingsDraft, strengths: next });
                              markDirty('hero');
                            }}
                            className={inputClass}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = settingsDraft.strengths.filter((_, i) => i !== idx);
                              setSettingsDraft({ ...settingsDraft, strengths: next });
                              markDirty('hero');
                            }}
                            aria-label="Remove strength"
                            className="flex h-10 w-10 shrink-0 items-center justify-center border border-(--border-hairline) text-(--text-muted) hover:border-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* EXPERTISE TAB */}
              {activeTab === 'expertise' && (
                <div className="space-y-8">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-(--border-hairline) pb-5">
                    <div>
                      <h2 className="font-display text-2xl font-semibold">Expertise Groups & Skills</h2>
                      <p className="mt-1 text-sm text-(--text-muted)">
                        Add, edit, delete, or reorder capability groups displayed on the public site.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setExpertiseDraft((prev) => [
                            ...prev,
                            {
                              id: Date.now(),
                              title: 'New Expertise Group',
                              skills: ['New Skill'],
                              sortOrder: prev.length,
                            },
                          ]);
                          markDirty('expertise');
                        }}
                        className="inline-flex h-10 items-center gap-1.5 border border-(--border-hairline) px-3.5 text-xs font-medium hover:border-(--accent)"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Group</span>
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleSaveExpertise}
                        className="h-10 px-5 text-xs font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: 'var(--accent)' }}
                      >
                        {saving ? 'Saving...' : 'Save Expertise'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {expertiseDraft.map((group, gIdx) => (
                      <div key={group.id} className="border border-(--border-hairline) p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <input
                            type="text"
                            value={group.title}
                            onChange={(e) => {
                              const next = [...expertiseDraft];
                              next[gIdx] = { ...group, title: e.target.value };
                              setExpertiseDraft(next);
                              markDirty('expertise');
                            }}
                            className="h-10 flex-1 border border-(--border-hairline) bg-transparent px-3 font-display text-base font-semibold focus:border-(--accent) focus:outline-none"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={gIdx === 0}
                              onClick={() => {
                                const next = [...expertiseDraft];
                                const [moved] = next.splice(gIdx, 1);
                                next.splice(gIdx - 1, 0, moved);
                                setExpertiseDraft(next);
                                markDirty('expertise');
                              }}
                              aria-label="Move group up"
                              className="flex h-9 w-9 items-center justify-center border border-(--border-hairline) disabled:opacity-30"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={gIdx === expertiseDraft.length - 1}
                              onClick={() => {
                                const next = [...expertiseDraft];
                                const [moved] = next.splice(gIdx, 1);
                                next.splice(gIdx + 1, 0, moved);
                                setExpertiseDraft(next);
                                markDirty('expertise');
                              }}
                              aria-label="Move group down"
                              className="flex h-9 w-9 items-center justify-center border border-(--border-hairline) disabled:opacity-30"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setExpertiseDraft((prev) => prev.filter((_, i) => i !== gIdx));
                                markDirty('expertise');
                              }}
                              aria-label="Delete group"
                              className="flex h-9 w-9 items-center justify-center border border-(--border-hairline) text-(--text-muted) hover:border-red-500 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-5 space-y-2">
                          {group.skills.map((skill, sIdx) => (
                            <div key={sIdx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={skill}
                                onChange={(e) => {
                                  const next = [...expertiseDraft];
                                  const nextSkills = [...group.skills];
                                  nextSkills[sIdx] = e.target.value;
                                  next[gIdx] = { ...group, skills: nextSkills };
                                  setExpertiseDraft(next);
                                  markDirty('expertise');
                                }}
                                className={inputClass}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...expertiseDraft];
                                  next[gIdx] = {
                                    ...group,
                                    skills: group.skills.filter((_, i) => i !== sIdx),
                                  };
                                  setExpertiseDraft(next);
                                  markDirty('expertise');
                                }}
                                aria-label="Remove skill"
                                className="flex h-10 w-10 shrink-0 items-center justify-center border border-(--border-hairline) text-(--text-muted) hover:border-red-500 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...expertiseDraft];
                              next[gIdx] = { ...group, skills: [...group.skills, ''] };
                              setExpertiseDraft(next);
                              markDirty('expertise');
                            }}
                            className="mt-2 inline-flex h-9 items-center gap-1.5 border border-(--border-hairline) px-3 text-xs font-medium hover:border-(--accent)"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add Skill</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PROJECTS TAB */}
              {activeTab === 'projects' && (
                <div className="space-y-8">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-(--border-hairline) pb-5">
                    <div>
                      <h2 className="font-display text-2xl font-semibold">Projects</h2>
                      <p className="mt-1 text-sm text-(--text-muted)">
                        Create, edit, publish/unpublish, reorder, and upload media for case studies.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectFormError('');
                        setEditingProject({
                          numberLabel: String(dashboard.projects.length + 1).padStart(2, '0'),
                          title: '',
                          summary: '',
                          bullets: [''],
                          technologies: [],
                          technologiesText: '',
                          mediaType: 'image',
                          mediaUrl: '',
                          liveUrl: '',
                          published: true,
                        });
                      }}
                      className="inline-flex h-10 items-center gap-1.5 px-4 text-xs font-medium text-white whitespace-nowrap shrink-0"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>New Project</span>
                    </button>
                  </div>

                  <div className="divide-y divide-(--border-hairline) border border-(--border-hairline)">
                    {dashboard.projects.length === 0 ? (
                      <div className="p-10 text-center text-sm text-(--text-muted)">
                        No projects yet. Click &ldquo;New Project&rdquo; to create your first case study.
                      </div>
                    ) : (
                      dashboard.projects.map((project, idx) => (
                        <div
                          key={project.id}
                          className="flex flex-wrap items-center justify-between gap-4 p-5"
                        >
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            {project.mediaUrl && (
                              project.mediaType === 'video' ? (
                                <video
                                  src={resolveMediaUrl(project.mediaUrl)}
                                  muted
                                  className="h-14 w-20 shrink-0 border border-(--border-hairline) object-cover"
                                />
                              ) : (
                                <img
                                  src={resolveMediaUrl(project.mediaUrl)}
                                  alt={project.title}
                                  className="h-14 w-20 shrink-0 border border-(--border-hairline) object-cover"
                                />
                              )
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2.5 font-mono-tabular text-xs text-(--text-muted)">
                                <span style={{ color: 'var(--accent)' }}>{project.numberLabel}</span>
                                <span>·</span>
                                <span>{project.published ? 'Published' : 'Draft'}</span>
                              </div>
                              <h3 className="font-display mt-1 truncate text-base font-semibold">
                                {project.title}
                              </h3>
                              <p className="mt-0.5 truncate font-mono-tabular text-xs text-(--text-muted)">
                                {project.technologies.join(' · ') || 'No tags set'}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveProject(idx, -1)}
                              aria-label="Move project up"
                              className="flex h-9 w-9 items-center justify-center border border-(--border-hairline) disabled:opacity-30"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === dashboard.projects.length - 1}
                              onClick={() => handleMoveProject(idx, 1)}
                              aria-label="Move project down"
                              className="flex h-9 w-9 items-center justify-center border border-(--border-hairline) disabled:opacity-30"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleProjectPublish(project)}
                              aria-label={project.published ? 'Unpublish project' : 'Publish project'}
                              className="inline-flex h-9 items-center gap-1.5 border border-(--border-hairline) px-3 text-xs font-medium whitespace-nowrap"
                            >
                              {project.published ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                              <span>{project.published ? 'Hide' : 'Publish'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setProjectFormError('');
                                setEditingProject({
                                  id: project.id,
                                  numberLabel: project.numberLabel,
                                  title: project.title,
                                  summary: project.summary,
                                  bullets: project.bullets.length ? [...project.bullets] : [''],
                                  technologies: [...project.technologies],
                                  technologiesText: project.technologies.join(', '),
                                  mediaType: project.mediaType,
                                  mediaUrl: project.mediaUrl,
                                  liveUrl: project.liveUrl,
                                  published: project.published,
                                });
                              }}
                              className="inline-flex h-9 items-center border border-(--border-hairline) px-3.5 text-xs font-medium hover:border-(--accent) whitespace-nowrap"
                            >
                              Edit
                            </button>

                            {confirmDeleteProjectId === project.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProject(project.id)}
                                  className="inline-flex h-9 items-center border border-red-600 bg-red-600 px-2.5 text-xs font-medium text-white"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteProjectId(null)}
                                  className="inline-flex h-9 items-center border border-(--border-hairline) px-2.5 text-xs font-medium text-(--text-muted)"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteProjectId(project.id)}
                                aria-label="Delete project"
                                className="flex h-9 w-9 items-center justify-center border border-(--border-hairline) text-(--text-muted) hover:border-red-500 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Project Editor Modal */}
                  {editingProject && (
                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="project-editor-heading"
                      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4 sm:p-8"
                      onClick={(e) => {
                        if (e.target === e.currentTarget) setEditingProject(null);
                      }}
                    >
                      <form
                        onSubmit={handleSaveProject}
                        className="my-auto w-full max-w-2xl border border-(--border-hairline) bg-(--bg-elevated) p-6 sm:p-8 space-y-5 shadow-xl"
                      >
                        <div className="flex items-center justify-between border-b border-(--border-hairline) pb-4">
                          <div>
                            <p className="font-mono-tabular text-[11px] uppercase tracking-widest text-(--text-muted)">
                              {editingProject.id ? `Project ${editingProject.numberLabel}` : 'New Case Study'}
                            </p>
                            <h3 id="project-editor-heading" className="font-display mt-1 text-xl font-semibold">
                              {editingProject.id ? 'Edit Project' : 'Create Project'}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingProject(null)}
                            aria-label="Close project editor"
                            className="flex h-9 w-9 items-center justify-center border border-(--border-hairline) text-(--text-muted) hover:border-(--accent) hover:text-(--text-ink)"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {projectFormError && (
                          <div
                            role="alert"
                            className="flex items-center gap-2 border border-red-600/40 bg-red-600/10 p-3 text-xs text-red-700 dark:text-red-300"
                          >
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{projectFormError}</span>
                          </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-4">
                          <Field label="Number">
                            <input
                              type="text"
                              required
                              maxLength={10}
                              value={editingProject.numberLabel}
                              onChange={(e) =>
                                setEditingProject({ ...editingProject, numberLabel: e.target.value })
                              }
                              className={inputClass}
                            />
                          </Field>
                          <div className="sm:col-span-3">
                            <Field label="Project Title">
                              <input
                                type="text"
                                required
                                maxLength={160}
                                value={editingProject.title}
                                onChange={(e) =>
                                  setEditingProject({ ...editingProject, title: e.target.value })
                                }
                                placeholder="e.g. AI-Powered Customer Support Agent"
                                className={inputClass}
                              />
                            </Field>
                          </div>
                        </div>

                        <Field label="Summary">
                          <textarea
                            rows={3}
                            maxLength={2000}
                            value={editingProject.summary}
                            onChange={(e) =>
                              setEditingProject({ ...editingProject, summary: e.target.value })
                            }
                            placeholder="Brief overview of what was built and why..."
                            className={textareaClass}
                          />
                        </Field>

                        <Field label="Technologies (comma-separated)">
                          <input
                            type="text"
                            value={editingProject.technologiesText}
                            onChange={(e) =>
                              setEditingProject({
                                ...editingProject,
                                technologiesText: e.target.value,
                              })
                            }
                            placeholder="n8n, AI Agent, Telegram Bot, Google Sheets"
                            className={inputClass}
                          />
                        </Field>

                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-(--text-muted)">
                              Key Bullet Points
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingProject({
                                  ...editingProject,
                                  bullets: [...editingProject.bullets, ''],
                                })
                              }
                              className="text-xs font-medium text-(--accent)"
                            >
                              + Add Bullet
                            </button>
                          </div>
                          <div className="mt-2 space-y-2">
                            {editingProject.bullets.length === 0 ? (
                              <p className="text-xs text-(--text-muted)">
                                No bullet points added yet.
                              </p>
                            ) : (
                              editingProject.bullets.map((b, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    maxLength={500}
                                    value={b}
                                    placeholder="Describe an outcome or implementation detail..."
                                    onChange={(e) => {
                                      const next = [...editingProject.bullets];
                                      next[i] = e.target.value;
                                      setEditingProject({ ...editingProject, bullets: next });
                                    }}
                                    className={inputClass}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingProject({
                                        ...editingProject,
                                        bullets: editingProject.bullets.filter((_, idx) => idx !== i),
                                      })
                                    }
                                    aria-label="Remove bullet"
                                    className="mt-1.5 flex h-10 w-10 shrink-0 items-center justify-center border border-(--border-hairline) text-(--text-muted) hover:border-red-500 hover:text-red-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Project Media (Image / Video)">
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <label className="inline-flex h-10 cursor-pointer items-center gap-2 border border-(--border-hairline) px-3.5 text-xs font-medium hover:border-(--accent)">
                                <Upload className="h-3.5 w-3.5" />
                                <span>{uploading ? 'Uploading...' : 'Upload File'}</span>
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                                  className="sr-only"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = '';
                                    if (file) {
                                      handleFileUpload(file, (url, mediaType) => {
                                        setEditingProject((prev) =>
                                          prev ? { ...prev, mediaUrl: url, mediaType } : prev,
                                        );
                                      });
                                    }
                                  }}
                                />
                              </label>
                              {editingProject.mediaUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingProject({ ...editingProject, mediaUrl: '' })
                                  }
                                  className="text-xs text-(--text-muted) hover:text-red-600"
                                >
                                  Clear media
                                </button>
                              )}
                            </div>

                            <input
                              type="text"
                              value={editingProject.mediaUrl}
                              onChange={(e) =>
                                setEditingProject({ ...editingProject, mediaUrl: e.target.value })
                              }
                              placeholder="/uploads/... or https://..."
                              className={inputClass}
                            />

                            {editingProject.mediaUrl && (
                              <div className="mt-2.5 flex items-center gap-3">
                                {editingProject.mediaType === 'video' ? (
                                  <video
                                    src={resolveMediaUrl(editingProject.mediaUrl)}
                                    controls
                                    muted
                                    className="h-16 w-24 border border-(--border-hairline) object-cover"
                                  />
                                ) : (
                                  <img
                                    src={resolveMediaUrl(editingProject.mediaUrl)}
                                    alt="Preview"
                                    className="h-16 w-24 border border-(--border-hairline) object-cover"
                                  />
                                )}
                                <select
                                  value={editingProject.mediaType}
                                  onChange={(e) =>
                                    setEditingProject({
                                      ...editingProject,
                                      mediaType: e.target.value === 'video' ? 'video' : 'image',
                                    })
                                  }
                                  aria-label="Media type"
                                  className="h-9 border border-(--border-hairline) bg-(--bg-canvas) px-2 text-xs text-(--text-ink)"
                                >
                                  <option value="image">Image</option>
                                  <option value="video">Video</option>
                                </select>
                              </div>
                            )}
                          </Field>

                          <Field label="Optional Live / Demo URL">
                            <input
                              type="text"
                              value={editingProject.liveUrl}
                              onChange={(e) =>
                                setEditingProject({ ...editingProject, liveUrl: e.target.value })
                              }
                              placeholder="https://..."
                              className={inputClass}
                            />
                          </Field>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-(--border-hairline) pt-4">
                          <label className="flex items-center gap-2.5 text-sm">
                            <input
                              type="checkbox"
                              checked={editingProject.published}
                              onChange={(e) =>
                                setEditingProject({ ...editingProject, published: e.target.checked })
                              }
                              className="h-4 w-4 accent-(--accent)"
                            />
                            <span>Published on public portfolio</span>
                          </label>

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setEditingProject(null)}
                              className="h-10 border border-(--border-hairline) px-4 text-xs font-medium text-(--text-muted) hover:text-(--text-ink)"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={saving || uploading}
                              className="h-10 px-6 text-xs font-medium text-white disabled:opacity-50"
                              style={{ backgroundColor: 'var(--accent)' }}
                            >
                              {saving ? 'Saving...' : 'Save Project'}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {/* EXPERIENCE & EDUCATION TAB */}
              {activeTab === 'background' && (
                <div className="space-y-10">
                  <div className="flex items-center justify-between border-b border-(--border-hairline) pb-5">
                    <div>
                      <h2 className="font-display text-2xl font-semibold">Experience & Education</h2>
                      <p className="mt-1 text-sm text-(--text-muted)">
                        Manage experience roles, contributions, and education records.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSaveBackground}
                      className="h-10 px-5 text-xs font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      {saving ? 'Saving...' : 'Save Background'}
                    </button>
                  </div>

                  {/* Experience Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-semibold">Experience Entries</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setExperienceDraft((prev) => [
                            ...prev,
                            {
                              id: Date.now(),
                              role: 'New Role',
                              organization: 'Organization',
                              period: '',
                              bullets: [''],
                              sortOrder: prev.length,
                            },
                          ]);
                          markDirty('background');
                        }}
                        className="inline-flex h-9 items-center gap-1.5 border border-(--border-hairline) px-3 text-xs font-medium"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Experience</span>
                      </button>
                    </div>

                    {experienceDraft.map((exp, idx) => (
                      <div key={exp.id} className="border border-(--border-hairline) p-5 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Field label="Role / Title">
                            <input
                              type="text"
                              value={exp.role}
                              onChange={(e) => {
                                const next = [...experienceDraft];
                                next[idx] = { ...exp, role: e.target.value };
                                setExperienceDraft(next);
                                markDirty('background');
                              }}
                              className={inputClass}
                            />
                          </Field>
                          <Field label="Organization">
                            <input
                              type="text"
                              value={exp.organization}
                              onChange={(e) => {
                                const next = [...experienceDraft];
                                next[idx] = { ...exp, organization: e.target.value };
                                setExperienceDraft(next);
                                markDirty('background');
                              }}
                              className={inputClass}
                            />
                          </Field>
                          <Field label="Period">
                            <input
                              type="text"
                              value={exp.period}
                              onChange={(e) => {
                                const next = [...experienceDraft];
                                next[idx] = { ...exp, period: e.target.value };
                                setExperienceDraft(next);
                                markDirty('background');
                              }}
                              className={inputClass}
                            />
                          </Field>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-(--text-muted)">
                              Contributions
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...experienceDraft];
                                next[idx] = { ...exp, bullets: [...exp.bullets, ''] };
                                setExperienceDraft(next);
                                markDirty('background');
                              }}
                              className="text-xs font-medium text-(--accent)"
                            >
                              + Add Bullet
                            </button>
                          </div>
                          {exp.bullets.map((b, bIdx) => (
                            <div key={bIdx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={b}
                                onChange={(e) => {
                                  const next = [...experienceDraft];
                                  const bullets = [...exp.bullets];
                                  bullets[bIdx] = e.target.value;
                                  next[idx] = { ...exp, bullets };
                                  setExperienceDraft(next);
                                  markDirty('background');
                                }}
                                className={inputClass}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...experienceDraft];
                                  next[idx] = {
                                    ...exp,
                                    bullets: exp.bullets.filter((_, i) => i !== bIdx),
                                  };
                                  setExperienceDraft(next);
                                  markDirty('background');
                                }}
                                className="flex h-10 w-10 shrink-0 items-center justify-center border border-(--border-hairline) text-(--text-muted)"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setExperienceDraft((prev) => prev.filter((_, i) => i !== idx));
                              markDirty('background');
                            }}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove Entry
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Education Section */}
                  <div className="space-y-4 border-t border-(--border-hairline) pt-8">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-semibold">Education Entries</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setEducationDraft((prev) => [
                            ...prev,
                            {
                              id: Date.now(),
                              institution: 'Institution Name',
                              location: '',
                              degree: '',
                              period: '',
                              sortOrder: prev.length,
                            },
                          ]);
                          markDirty('background');
                        }}
                        className="inline-flex h-9 items-center gap-1.5 border border-(--border-hairline) px-3 text-xs font-medium"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Education</span>
                      </button>
                    </div>

                    {educationDraft.map((edu, idx) => (
                      <div key={edu.id} className="border border-(--border-hairline) p-5 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Institution">
                            <input
                              type="text"
                              value={edu.institution}
                              onChange={(e) => {
                                const next = [...educationDraft];
                                next[idx] = { ...edu, institution: e.target.value };
                                setEducationDraft(next);
                                markDirty('background');
                              }}
                              className={inputClass}
                            />
                          </Field>
                          <Field label="Location">
                            <input
                              type="text"
                              value={edu.location}
                              onChange={(e) => {
                                const next = [...educationDraft];
                                next[idx] = { ...edu, location: e.target.value };
                                setEducationDraft(next);
                                markDirty('background');
                              }}
                              className={inputClass}
                            />
                          </Field>
                          <Field label="Program / Degree">
                            <input
                              type="text"
                              value={edu.degree}
                              onChange={(e) => {
                                const next = [...educationDraft];
                                next[idx] = { ...edu, degree: e.target.value };
                                setEducationDraft(next);
                                markDirty('background');
                              }}
                              className={inputClass}
                            />
                          </Field>
                          <Field label="Period">
                            <input
                              type="text"
                              value={edu.period}
                              onChange={(e) => {
                                const next = [...educationDraft];
                                next[idx] = { ...edu, period: e.target.value };
                                setEducationDraft(next);
                                markDirty('background');
                              }}
                              className={inputClass}
                            />
                          </Field>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setEducationDraft((prev) => prev.filter((_, i) => i !== idx));
                              markDirty('background');
                            }}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove Entry
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CONTACT & SOCIALS TAB */}
              {activeTab === 'contact' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between border-b border-(--border-hairline) pb-5">
                    <div>
                      <h2 className="font-display text-2xl font-semibold">Contact & Social Links</h2>
                      <p className="mt-1 text-sm text-(--text-muted)">
                        Configure public contact details and external links.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveSettings('contact')}
                      className="h-10 px-5 text-xs font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      {saving ? 'Saving...' : 'Save Contact'}
                    </button>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Public Email">
                      <input
                        type="email"
                        value={settingsDraft.contactEmail}
                        onChange={(e) => {
                          setSettingsDraft({ ...settingsDraft, contactEmail: e.target.value });
                          markDirty('contact');
                        }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Public Location">
                      <input
                        type="text"
                        value={settingsDraft.contactLocation}
                        onChange={(e) => {
                          setSettingsDraft({ ...settingsDraft, contactLocation: e.target.value });
                          markDirty('contact');
                        }}
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <div className="border-t border-(--border-hairline) pt-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-semibold">Social & Profile Links</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsDraft({
                            ...settingsDraft,
                            socialLinks: [
                              ...settingsDraft.socialLinks,
                              { id: `link-${Date.now()}`, label: 'GitHub', url: 'https://' },
                            ],
                          });
                          markDirty('contact');
                        }}
                        className="inline-flex h-9 items-center gap-1.5 border border-(--border-hairline) px-3 text-xs font-medium"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Link</span>
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {settingsDraft.socialLinks.length === 0 ? (
                        <p className="text-xs text-(--text-muted)">
                          No social links added yet.
                        </p>
                      ) : (
                        settingsDraft.socialLinks.map((link, idx) => (
                          <div key={link.id} className="grid gap-3 sm:grid-cols-12">
                            <div className="sm:col-span-4">
                              <input
                                type="text"
                                value={link.label}
                                placeholder="Label (e.g. LinkedIn)"
                                onChange={(e) => {
                                  const next = [...settingsDraft.socialLinks];
                                  next[idx] = { ...link, label: e.target.value };
                                  setSettingsDraft({ ...settingsDraft, socialLinks: next });
                                  markDirty('contact');
                                }}
                                className={inputClass}
                              />
                            </div>
                            <div className="sm:col-span-7">
                              <input
                                type="url"
                                value={link.url}
                                placeholder="https://..."
                                onChange={(e) => {
                                  const next = [...settingsDraft.socialLinks];
                                  next[idx] = { ...link, url: e.target.value };
                                  setSettingsDraft({ ...settingsDraft, socialLinks: next });
                                  markDirty('contact');
                                }}
                                className={inputClass}
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = settingsDraft.socialLinks.filter(
                                    (_, i) => i !== idx,
                                  );
                                  setSettingsDraft({ ...settingsDraft, socialLinks: next });
                                  markDirty('contact');
                                }}
                                aria-label="Remove social link"
                                className="flex h-10 w-full items-center justify-center border border-(--border-hairline) text-(--text-muted) hover:border-red-500 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* FOOTER SETTINGS TAB */}
              {activeTab === 'footer' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between border-b border-(--border-hairline) pb-5">
                    <div>
                      <h2 className="font-display text-2xl font-semibold">Footer Settings</h2>
                      <p className="mt-1 text-sm text-(--text-muted)">
                        Customize footer note, copyright line, visibility toggles, and custom links.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveSettings('footer')}
                      className="h-10 px-5 text-xs font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      {saving ? 'Saving...' : 'Save Footer'}
                    </button>
                  </div>

                  <Field label="Footer Tagline / Bio Note">
                    <textarea
                      rows={3}
                      value={settingsDraft.footerTagline}
                      onChange={(e) => {
                        setSettingsDraft({ ...settingsDraft, footerTagline: e.target.value });
                        markDirty('footer');
                      }}
                      placeholder="Short editorial line shown above the copyright row..."
                      className={textareaClass}
                    />
                  </Field>

                  <Field label="Copyright Text (use {year} for automatic current year)">
                    <input
                      type="text"
                      value={settingsDraft.footerCopyright}
                      onChange={(e) => {
                        setSettingsDraft({ ...settingsDraft, footerCopyright: e.target.value });
                        markDirty('footer');
                      }}
                      placeholder="© {year} Musaddik Rahman Miton. Gaibandha, Bangladesh."
                      className={inputClass}
                    />
                  </Field>

                  <div className="grid gap-4 border-t border-(--border-hairline) pt-6 sm:grid-cols-2">
                    <label className="flex items-center gap-3 border border-(--border-hairline) p-4 text-sm">
                      <input
                        type="checkbox"
                        checked={settingsDraft.footerShowSocials}
                        onChange={(e) => {
                          setSettingsDraft({
                            ...settingsDraft,
                            footerShowSocials: e.target.checked,
                          });
                          markDirty('footer');
                        }}
                        className="h-4 w-4 accent-(--accent)"
                      />
                      <span>Display social links in footer</span>
                    </label>

                    <label className="flex items-center gap-3 border border-(--border-hairline) p-4 text-sm">
                      <input
                        type="checkbox"
                        checked={settingsDraft.footerShowThemeToggle}
                        onChange={(e) => {
                          setSettingsDraft({
                            ...settingsDraft,
                            footerShowThemeToggle: e.target.checked,
                          });
                          markDirty('footer');
                        }}
                        className="h-4 w-4 accent-(--accent)"
                      />
                      <span>Display Light/Dark mode switch in footer</span>
                    </label>
                  </div>

                  <div className="border-t border-(--border-hairline) pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-display text-lg font-semibold">Custom Footer Links</h3>
                        <p className="mt-0.5 text-xs text-(--text-muted)">
                          Add extra links such as Resume, Case Studies, or Privacy Policy.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsDraft({
                            ...settingsDraft,
                            footerLinks: [
                              ...settingsDraft.footerLinks,
                              { id: `flink-${Date.now()}`, label: 'Resume', url: 'https://' },
                            ],
                          });
                          markDirty('footer');
                        }}
                        className="inline-flex h-9 items-center gap-1.5 border border-(--border-hairline) px-3 text-xs font-medium hover:border-(--accent)"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Footer Link</span>
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {settingsDraft.footerLinks.length === 0 ? (
                        <p className="text-xs text-(--text-muted)">
                          No custom footer links added yet.
                        </p>
                      ) : (
                        settingsDraft.footerLinks.map((link, idx) => (
                          <div key={link.id} className="grid gap-3 sm:grid-cols-12">
                            <div className="sm:col-span-4">
                              <input
                                type="text"
                                value={link.label}
                                placeholder="Label"
                                onChange={(e) => {
                                  const next = [...settingsDraft.footerLinks];
                                  next[idx] = { ...link, label: e.target.value };
                                  setSettingsDraft({ ...settingsDraft, footerLinks: next });
                                  markDirty('footer');
                                }}
                                className={inputClass}
                              />
                            </div>
                            <div className="sm:col-span-7">
                              <input
                                type="url"
                                value={link.url}
                                placeholder="https://..."
                                onChange={(e) => {
                                  const next = [...settingsDraft.footerLinks];
                                  next[idx] = { ...link, url: e.target.value };
                                  setSettingsDraft({ ...settingsDraft, footerLinks: next });
                                  markDirty('footer');
                                }}
                                className={inputClass}
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = settingsDraft.footerLinks.filter(
                                    (_, i) => i !== idx,
                                  );
                                  setSettingsDraft({ ...settingsDraft, footerLinks: next });
                                  markDirty('footer');
                                }}
                                aria-label="Remove footer link"
                                className="flex h-10 w-full items-center justify-center border border-(--border-hairline) text-(--text-muted) hover:border-red-500 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SITE SETTINGS & SCROLL VIDEO TAB */}
              {activeTab === 'settings' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between border-b border-(--border-hairline) pb-5">
                    <div>
                      <h2 className="font-display text-2xl font-semibold">
                        Site Settings & Scroll Media
                      </h2>
                      <p className="mt-1 text-sm text-(--text-muted)">
                        Configure SEO metadata, warm accent color, and optional scroll-scrubbed
                        background video.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveSettings('settings')}
                      className="h-10 px-5 text-xs font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>

                  <Field label="Site Title">
                    <input
                      type="text"
                      value={settingsDraft.siteTitle}
                      onChange={(e) => {
                        setSettingsDraft({ ...settingsDraft, siteTitle: e.target.value });
                        markDirty('settings');
                      }}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="SEO Meta Description">
                    <textarea
                      rows={3}
                      value={settingsDraft.seoDescription}
                      onChange={(e) => {
                        setSettingsDraft({ ...settingsDraft, seoDescription: e.target.value });
                        markDirty('settings');
                      }}
                      className={textareaClass}
                    />
                  </Field>

                  <div>
                    <label className="block text-xs font-medium text-(--text-muted)">
                      Warm Accent Color
                    </label>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {ACCENT_PRESETS.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => {
                            setSettingsDraft({ ...settingsDraft, accentColor: hex });
                            markDirty('settings');
                          }}
                          aria-label={`Select accent ${hex}`}
                          className={`h-9 w-9 border transition-transform ${
                            settingsDraft.accentColor.toUpperCase() === hex.toUpperCase()
                              ? 'scale-110 border-(--text-ink)'
                              : 'border-(--border-hairline)'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                      <input
                        type="text"
                        value={settingsDraft.accentColor}
                        onChange={(e) => {
                          setSettingsDraft({ ...settingsDraft, accentColor: e.target.value });
                          markDirty('settings');
                        }}
                        className="h-9 w-28 border border-(--border-hairline) bg-transparent px-2.5 font-mono-tabular text-xs"
                      />
                    </div>
                  </div>

                  <div className="border-t border-(--border-hairline) pt-6">
                    <h3 className="font-display text-lg font-semibold">
                      Optional Scroll-Scrubbed Background Video
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-(--text-muted)">
                      Upload an MP4 or WebM video to scrub frame-by-frame with page scroll. When
                      empty, the procedural Three.js workflow scene renders automatically.
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <label className="inline-flex h-10 cursor-pointer items-center gap-2 border border-(--border-hairline) px-4 text-xs font-medium hover:border-(--accent)">
                        <Upload className="h-3.5 w-3.5" />
                        <span>{uploading ? 'Uploading...' : 'Upload Video (MP4 / WebM)'}</span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(file, (url) => {
                                setSettingsDraft((prev) =>
                                  prev ? { ...prev, scrollVideoUrl: url } : prev,
                                );
                                markDirty('settings');
                              });
                            }
                          }}
                        />
                      </label>

                      {settingsDraft.scrollVideoUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setSettingsDraft({ ...settingsDraft, scrollVideoUrl: '' });
                            markDirty('settings');
                          }}
                          className="h-10 border border-(--border-hairline) px-3.5 text-xs text-red-600 hover:border-red-500"
                        >
                          Remove Video (Use 3D Scene)
                        </button>
                      )}
                    </div>

                    {settingsDraft.scrollVideoUrl && (
                      <p className="mt-3 font-mono-tabular text-xs text-(--text-muted)">
                        Active video: {settingsDraft.scrollVideoUrl}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* SECURITY / PASSWORD TAB */}
              {activeTab === 'security' && (
                <div className="max-w-md space-y-6">
                  <div className="border-b border-(--border-hairline) pb-5">
                    <h2 className="font-display text-2xl font-semibold">Admin Password</h2>
                    <p className="mt-1 text-sm text-(--text-muted)">
                      Updating your password invalidates all other active admin sessions.
                    </p>
                  </div>

                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <Field label="Current Password">
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="New Password (minimum 8 characters)">
                      <input
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Confirm New Password">
                      <input
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                    <button
                      type="submit"
                      disabled={saving}
                      className="h-10 px-6 text-xs font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      {saving ? 'Updating...' : 'Update Password'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Toast Stack */}
      <div className="fixed right-5 bottom-5 z-[60] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`flex items-center gap-2.5 border bg-(--bg-canvas) px-4 py-3 text-xs font-medium shadow-sm ${
              toast.type === 'success'
                ? 'border-emerald-600/50 text-emerald-800 dark:text-emerald-300'
                : 'border-red-600/50 text-red-800 dark:text-red-300'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputClass =
  'mt-1.5 h-10 w-full border border-(--border-hairline) bg-transparent px-3 text-sm text-(--text-ink) focus:border-(--accent) focus:outline-none';
const textareaClass =
  'mt-1.5 w-full border border-(--border-hairline) bg-transparent p-3 text-sm text-(--text-ink) focus:border-(--accent) focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-(--text-muted)">{label}</label>
      {children}
    </div>
  );
}
