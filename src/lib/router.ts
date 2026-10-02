import { useSyncExternalStore } from 'react';

// Hash routing, so deep links work on GitHub Pages without a server-side fallback.
function current() {
  return window.location.hash.replace(/^#/, '') || '/';
}

export function useRoute(): string {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener('hashchange', l);
      return () => window.removeEventListener('hashchange', l);
    },
    current,
  );
}

export function navigate(path: string) {
  window.location.hash = path;
  window.scrollTo(0, 0);
}
