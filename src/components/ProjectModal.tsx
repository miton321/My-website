import { useEffect } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { resolveMediaUrl } from '../lib/seedAssets.ts';
import type { ProjectItem } from '../types/portfolio.ts';

interface ProjectModalProps {
  project: ProjectItem | null;
  onClose: () => void;
}

export function ProjectModal({ project, onClose }: ProjectModalProps) {
  useEffect(() => {
    if (!project) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [project, onClose]);

  if (!project) return null;

  const resolvedMedia = resolveMediaUrl(project.mediaUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto border border-(--border-hairline) bg-(--bg-canvas) text-(--text-ink)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-(--border-hairline) bg-(--bg-canvas) px-6 py-4 sm:px-8">
          <div className="flex items-center gap-3 text-xs font-mono-tabular text-(--text-muted)">
            <span style={{ color: 'var(--accent)' }}>{project.numberLabel}</span>
            <span aria-hidden="true">/</span>
            <span>Case Study</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close project details"
            className="flex h-10 w-10 items-center justify-center border border-(--border-hairline) text-(--text-ink) transition-colors hover:border-(--accent) hover:text-(--accent)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {resolvedMedia ? (
            <div className="mb-8 aspect-[4/3] w-full overflow-hidden border border-(--border-hairline) bg-(--bg-surface)">
              {project.mediaType === 'video' ? (
                <video
                  src={resolvedMedia}
                  controls
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={resolvedMedia}
                  alt={project.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          ) : (
            <div className="mb-8 flex aspect-[16/7] w-full items-center justify-center border border-(--border-hairline) bg-(--bg-surface) px-6">
              <span className="font-mono-tabular text-xs text-(--text-muted)">
                {project.numberLabel} — {project.title}
              </span>
            </div>
          )}

          <h3
            id="project-modal-title"
            className="font-display text-2xl font-semibold tracking-tight sm:text-3xl"
            style={{ textWrap: 'balance' }}
          >
            {project.title}
          </h3>

          {project.technologies.length > 0 && (
            <p className="mt-3 font-mono-tabular text-xs text-(--text-muted)">
              {project.technologies.join(' · ')}
            </p>
          )}

          {project.summary && (
            <p className="mt-5 text-base leading-relaxed text-(--text-muted)">
              {project.summary}
            </p>
          )}

          {project.bullets.length > 0 && (
            <div className="mt-8 border-t border-(--border-hairline) pt-6">
              <h4 className="font-mono-tabular text-xs uppercase tracking-widest text-(--text-muted)">
                Implementation Scope
              </h4>
              <ul className="mt-4 space-y-3">
                {project.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm leading-relaxed">
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
          )}

          {project.liveUrl && (
            <div className="mt-8 border-t border-(--border-hairline) pt-6">
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-(--border-hairline) px-5 py-2.5 text-sm font-medium transition-colors hover:border-(--accent) hover:text-(--accent)"
              >
                <span>Open Live Project</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
