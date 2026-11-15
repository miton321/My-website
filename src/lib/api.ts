import type {
  AdminDashboardData,
  EducationItem,
  ExperienceItem,
  ExpertiseGroup,
  ProjectItem,
  PublicPortfolioData,
  SiteSettings,
} from '../types/portfolio.ts';

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg =
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : 'Request failed';
    throw new Error(errMsg);
  }
  return data as T;
}

export async function fetchPublicPortfolio(): Promise<PublicPortfolioData> {
  const res = await fetch('/api/public/portfolio', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  return parseJson<PublicPortfolioData>(res);
}

export async function submitContactForm(payload: {
  name: string;
  email: string;
  subject: string;
  message: string;
  website: string;
}): Promise<{ ok: boolean }> {
  const res = await fetch('/api/public/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseJson<{ ok: boolean }>(res);
}

export interface AdminSessionStatus {
  authenticated: boolean;
  configured: boolean;
  username?: string;
  csrfToken?: string;
}

export async function fetchAdminSession(): Promise<AdminSessionStatus> {
  const res = await fetch('/api/admin/session', {
    method: 'GET',
    credentials: 'include',
  });
  return parseJson<AdminSessionStatus>(res);
}

export async function adminLogin(
  username: string,
  password: string,
): Promise<{ authenticated: boolean; username: string; csrfToken: string }> {
  const embedded = typeof window !== 'undefined' && window.self !== window.top;
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, embedded }),
  });
  return parseJson(res);
}

export async function adminLogout(csrfToken: string): Promise<void> {
  const res = await fetch('/api/admin/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Token': csrfToken },
  });
  await parseJson(res);
}

export async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  const res = await fetch('/api/admin/dashboard', {
    method: 'GET',
    credentials: 'include',
  });
  return parseJson<AdminDashboardData>(res);
}

export async function saveAdminSettings(
  settings: SiteSettings,
  csrfToken: string,
): Promise<{ settings: SiteSettings }> {
  const res = await fetch('/api/admin/settings', {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(settings),
  });
  return parseJson(res);
}

export async function saveAdminExpertise(
  groups: Array<{ title: string; skills: string[] }>,
  csrfToken: string,
): Promise<{ expertise: ExpertiseGroup[] }> {
  const res = await fetch('/api/admin/expertise', {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ groups }),
  });
  return parseJson(res);
}

export async function createAdminProject(
  project: Omit<ProjectItem, 'id' | 'slug' | 'sortOrder'>,
  csrfToken: string,
): Promise<{ project: ProjectItem }> {
  const res = await fetch('/api/admin/projects', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(project),
  });
  return parseJson(res);
}

export async function updateAdminProject(
  id: number,
  project: Omit<ProjectItem, 'id' | 'slug' | 'sortOrder'>,
  csrfToken: string,
): Promise<{ project: ProjectItem }> {
  const res = await fetch(`/api/admin/projects/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(project),
  });
  return parseJson(res);
}

export async function deleteAdminProject(id: number, csrfToken: string): Promise<void> {
  const res = await fetch(`/api/admin/projects/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'X-CSRF-Token': csrfToken },
  });
  await parseJson(res);
}

export async function reorderAdminProjects(
  orderedIds: number[],
  csrfToken: string,
): Promise<{ projects: ProjectItem[] }> {
  const res = await fetch('/api/admin/projects/reorder', {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ orderedIds }),
  });
  return parseJson(res);
}

export async function saveAdminExperience(
  items: Array<Omit<ExperienceItem, 'id' | 'sortOrder'>>,
  csrfToken: string,
): Promise<{ experience: ExperienceItem[] }> {
  const res = await fetch('/api/admin/experience', {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ items }),
  });
  return parseJson(res);
}

export async function saveAdminEducation(
  items: Array<Omit<EducationItem, 'id' | 'sortOrder'>>,
  csrfToken: string,
): Promise<{ education: EducationItem[] }> {
  const res = await fetch('/api/admin/education', {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ items }),
  });
  return parseJson(res);
}

export async function toggleMessageRead(
  id: number,
  isRead: boolean,
  csrfToken: string,
): Promise<void> {
  const res = await fetch(`/api/admin/messages/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ isRead }),
  });
  await parseJson(res);
}

export async function deleteAdminMessage(id: number, csrfToken: string): Promise<void> {
  const res = await fetch(`/api/admin/messages/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'X-CSRF-Token': csrfToken },
  });
  await parseJson(res);
}

export async function uploadAdminMedia(
  file: File,
  csrfToken: string,
): Promise<{ url: string; mediaType: 'image' | 'video' }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Token': csrfToken },
    body: formData,
  });
  return parseJson(res);
}

export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string,
  csrfToken: string,
): Promise<void> {
  const res = await fetch('/api/admin/password', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  await parseJson(res);
}
