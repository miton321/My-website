import { useRef } from 'react';

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  href?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

export function MagneticButton({
  children,
  className = '',
  style,
  onClick,
  href,
  type = 'button',
  disabled = false,
}: MagneticButtonProps) {
  const ref = useRef<HTMLElement | null>(null);

  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    if (disabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) * 0.16;
    const dy = (e.clientY - (rect.top + rect.height / 2)) * 0.16;
    el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
  };

  const handleLeave = () => {
    const el = ref.current;
    if (el) {
      el.style.transform = 'translate3d(0px, 0px, 0)';
    }
  };

  const sharedProps = {
    className: `transition-transform duration-200 ease-out ${className}`,
    style,
    onMouseMove: handleMove,
    onMouseLeave: handleLeave,
  };

  if (href) {
    return (
      <a
        ref={(node) => {
          ref.current = node;
        }}
        href={href}
        onClick={(e) => {
          if (onClick) {
            e.preventDefault();
            onClick();
          }
        }}
        {...sharedProps}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      ref={(node) => {
        ref.current = node;
      }}
      type={type}
      disabled={disabled}
      onClick={onClick}
      {...sharedProps}
    >
      {children}
    </button>
  );
}
