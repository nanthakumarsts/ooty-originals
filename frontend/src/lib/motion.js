/**
 * Press ripple for every `.btn`: a soft circle grows from the exact point of the press.
 * One delegated listener for the whole app; nothing to wire up per button.
 */
export function initRipple() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (reducedMotion.matches || event.button > 0) return;
      const button = event.target.closest?.('.btn');
      if (!button || button.disabled) return;

      const box = button.getBoundingClientRect();
      const size = Math.max(box.width, box.height) * 2.2;
      const dot = document.createElement('span');
      dot.className = 'ripple-dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.width = dot.style.height = `${size}px`;
      dot.style.left = `${event.clientX - box.left - size / 2}px`;
      dot.style.top = `${event.clientY - box.top - size / 2}px`;
      dot.addEventListener('animationend', () => dot.remove(), { once: true });
      button.appendChild(dot);
    },
    { passive: true }
  );
}
