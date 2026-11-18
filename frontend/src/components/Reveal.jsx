import { useEffect, useRef, useState } from 'react';
import { cx } from './ui';

/**
 * Fades its content up into place the first time it scrolls into view.
 * `delay` (ms) staggers siblings. Shows immediately for people who prefer reduced motion.
 *
 * With `group`, the element itself stays put and its direct children rise in one after another
 * (each child sets its order with style={{ '--i': index }}). Use it for rows that scroll sideways,
 * where watching each child separately would leave off-screen items hidden.
 */
export default function Reveal({ as: Tag = 'div', delay = 0, group = false, className, style, children, ...props }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return undefined;
    }
    // Already on screen when it appears (the usual case for a freshly loaded product list):
    // show it straight away rather than waiting for the observer to report it.
    const box = el.getBoundingClientRect();
    if (box.bottom > 0 && box.top < window.innerHeight && box.width > 0) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.01 } // as soon as any part is on screen, so nothing peeking in at the fold stays hidden
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={cx(group ? 'reveal-group' : 'reveal', visible && 'is-visible', className)} style={{ ...style, '--reveal-delay': `${delay}ms` }} {...props}>
      {children}
    </Tag>
  );
}
