export interface SocialLink {
  id: string;
  label: string;
  url: string;
}

export interface SiteSettings {
  siteTitle: string;
  seoDescription: string;
  accentColor: string;
  scrollVideoUrl: string;
  heroName: string;
  heroTitle: string;
  heroTagline: string;
  heroLocation: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  aboutText: string;
  objectiveText: string;
  strengths: string[];
  contactEmail: string;
  contactLocation: string;
  socialLinks: SocialLink[];
  footerTagline: string;
  footerCopyright: string;
  footerShowSocials: boolean;
  footerShowThemeToggle: boolean;
  footerLinks: SocialLink[];
}

export interface ExpertiseGroup {
  id: number;
  title: string;
  skills: string[];
  sortOrder: number;
}

export interface ProjectItem {
  id: number;
  slug: string;
  numberLabel: string;
  title: string;
  summary: string;
  bullets: string[];
  technologies: string[];
  mediaType: 'image' | 'video';
  mediaUrl: string;
  liveUrl: string;
  published: boolean;
  sortOrder: number;
}

export interface ExperienceItem {
  id: number;
  role: string;
  organization: string;
  period: string;
  bullets: string[];
  sortOrder: number;
}

export interface EducationItem {
  id: number;
  institution: string;
  location: string;
  degree: string;
  period: string;
  sortOrder: number;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface PublicPortfolioData {
  settings: SiteSettings;
  expertise: ExpertiseGroup[];
  projects: ProjectItem[];
  experience: ExperienceItem[];
  education: EducationItem[];
}

export interface AdminDashboardData extends PublicPortfolioData {
  messages: ContactMessage[];
  unreadCount: number;
}
