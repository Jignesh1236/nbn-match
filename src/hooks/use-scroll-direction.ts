import { useEffect, useState } from 'react';

/** Distance from the top (px) below which the navbar is always visible. */
const TOP_ZONE = 120;
/** Accumulated scroll distance (px) needed before the navbar reacts. */
const MOVE_THRESHOLD = 10;

/**
 * Direction-based navbar visibility.
 * - Near the top of the page the navbar is always visible.
 * - A clear scroll UP shows the navbar.
 * - A clear scroll DOWN hides the navbar.
 * - Tiny/jittery movements (less than MOVE_THRESHOLD) are ignored, so
 *   normal scrolling never makes the navbar flicker.
 * Works together with Lenis because Lenis scrolls the real window,
 * so native scroll events still fire.
 */
export function useScrollDirection() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let accumulated = 0; // net distance moved since the last show/hide decision
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastY;

        if (currentY <= TOP_ZONE) {
          // Near the top: always keep the navbar visible.
          setHidden(false);
          accumulated = 0;
        } else {
          accumulated += delta;
          if (accumulated > MOVE_THRESHOLD) {
            setHidden(true); // clear scroll down -> hide
            accumulated = 0;
          } else if (accumulated < -MOVE_THRESHOLD) {
            setHidden(false); // clear scroll up -> show
            accumulated = 0;
          }
        }

        lastY = currentY;
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return hidden;
}
