import { useEffect, useRef, useState } from 'react';

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (coarse || reduced) {
      setEnabled(false);
      return;
    }

    setEnabled(true);
    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let isHovering = false;
    let rafId = 0;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      const target = e.target as HTMLElement | null;
      const interactive = Boolean(
        target?.closest('a, button, input, textarea, select, [data-cursor="interactive"]'),
      );
      isHovering = interactive;
    };

    const onLeave = () => {
      mouseX = -100;
      mouseY = -100;
    };

    const render = () => {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseX - 4}px, ${mouseY - 4}px, 0) scale(${isHovering ? 0.4 : 1})`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringX - 18}px, ${ringY - 18}px, 0) scale(${isHovering ? 1.45 : 1})`;
        ringRef.current.style.opacity = mouseX < 0 ? '0' : isHovering ? '0.9' : '0.45';
      }

      rafId = requestAnimationFrame(render);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50">
      <div
        ref={dotRef}
        className="fixed top-0 left-0 h-2 w-2 rounded-full transition-transform duration-150 ease-out"
        style={{
          backgroundColor: 'var(--accent)',
          transform: 'translate3d(-100px, -100px, 0)',
        }}
      />
      <div
        ref={ringRef}
        className="fixed top-0 left-0 h-9 w-9 rounded-full border transition-[opacity,transform] duration-200 ease-out"
        style={{
          borderColor: 'var(--accent)',
          opacity: 0,
          transform: 'translate3d(-100px, -100px, 0)',
        }}
      />
    </div>
  );
}
