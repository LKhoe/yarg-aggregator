'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.version === 'string' ? data.version : null;
  } catch {
    return null;
  }
}

async function clearCachesAndReload(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
  window.location.reload();
}

export function ServiceWorkerRegistration() {
  const pathname = usePathname();
  const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? null;

  // Register SW once on mount
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register(`/sw.js${currentVersion ? `?v=${encodeURIComponent(currentVersion)}` : ''}`, {
          scope: '/',
          updateViaCache: 'none',
        })
        .catch((err) => console.error('Service worker registration failed:', err));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for a new version on every navigation (including initial load / reload)
  useEffect(() => {
    if (!currentVersion) return;
    fetchLatestVersion().then((latest) => {
      if (latest && latest !== currentVersion) {
        clearCachesAndReload();
      }
    });
  }, [pathname, currentVersion]);

  return null;
}
