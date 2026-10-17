import { useEffect } from 'react';
import Lenis from 'lenis';

let lenisInstance: Lenis | null = null;

/** Stop Lenis smooth scrolling (e.g. while a modal is open). */
export function stopLenis() {
  lenisInstance?.stop();
}

/** Resume Lenis smooth scrolling. */
export function startLenis() {
  lenisInstance?.start();
}

/** Jump instantly to the top of the page (used on route changes). */
export function resetScroll() {
  if (lenisInstance) {
    lenisInstance.scrollTo(0, { immediate: true });
  } else {
    window.scrollTo(0, 0);
  }
}

/**
 * Initializes Lenis smooth scrolling for the whole app.
 * Call once, high in the component tree (App).
 */
export function useLenis() {
  useEffect(() => {
    // Respect users who prefer reduced motion: fall back to native scrolling.
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easeOutExpo
      smoothWheel: true,
      // Makes in-page anchors (#about, #stories...) smooth-scroll too.
      anchors: true,
    });
    lenisInstance = lenis;

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      lenisInstance = null;
    };
  }, []);
}
