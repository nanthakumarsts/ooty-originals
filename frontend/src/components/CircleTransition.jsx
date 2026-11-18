import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';

/** Waits (briefly) for a lazily-loaded page to finish loading so the circle reveals real content. */
function pageReady(timeout = 1200) {
  return new Promise((resolve) => {
    const started = performance.now();
    const check = () => {
      if (!document.querySelector('[data-route-loading]') || performance.now() - started > timeout) resolve();
      else requestAnimationFrame(check);
    };
    check();
  });
}

/**
 * Circle page transition.
 * When a link to another page is clicked, the new page opens as a circle that grows from the
 * click position (the same reveal used by theme switches). Uses the browser's View Transitions
 * API; browsers without it, and people who prefer reduced motion, get a normal page change.
 */
export default function CircleTransition() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!document.startViewTransition) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const root = document.documentElement;
    let running = false;

    const onClick = (event) => {
      if (running || reducedMotion.matches || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download') || 'noTransition' in link.dataset) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return; // same page (filters, anchors)

      event.preventDefault(); // the router link sees this and leaves the navigation to us

      // Keyboard activation has no pointer position, so grow from the link itself.
      let x = event.clientX;
      let y = event.clientY;
      if (!x && !y) {
        const box = link.getBoundingClientRect();
        x = box.left + box.width / 2;
        y = box.top + box.height / 2;
      }
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      root.style.setProperty('--circle-x', `${x}px`);
      root.style.setProperty('--circle-y', `${y}px`);
      root.style.setProperty('--circle-r', `${Math.ceil(radius)}px`);
      root.classList.add('circle-nav');
      running = true;

      const transition = document.startViewTransition(async () => {
        flushSync(() => navigate(url.pathname + url.search + url.hash));
        await pageReady();
      });
      transition.finished.finally(() => {
        root.classList.remove('circle-nav');
        running = false;
      });
    };

    // Capture phase on the document, so this runs before the router's own click handling.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [navigate]);

  return null;
}
