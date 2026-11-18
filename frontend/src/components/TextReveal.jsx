import { useEffect, useRef, useState } from 'react';

/**
 * Headline text that rises into place word by word from behind a mask.
 * Screen readers get the plain sentence; the animated words are decorative.
 * `immediate` plays on load (for text at the top of a page) instead of waiting for scroll.
 */
export default function TextReveal({ text, as: Tag = 'span', className, delay = 0, immediate = false, ...props }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (immediate || !('IntersectionObserver' in window)) {
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
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [immediate]);

  const words = String(text || '').split(/\s+/).filter(Boolean);

  return (
    <Tag ref={ref} aria-label={text} className={['text-reveal', visible && 'is-visible', className].filter(Boolean).join(' ')} style={{ '--reveal-delay': `${delay}ms` }} {...props}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} aria-hidden="true">
          <span className="text-reveal-word"><span style={{ '--i': i }}>{word}</span></span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Tag>
  );
}
