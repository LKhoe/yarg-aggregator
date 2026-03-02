'use client';

import { useReportWebVitals } from 'next/web-vitals';

export function WebVitals() {
  useReportWebVitals((metric) => {
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      path: window.location.pathname,
      timestamp: new Date().toISOString(),
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/monitoring/vitals', body);
    } else {
      fetch('/api/monitoring/vitals', { method: 'POST', body, keepalive: true });
    }
  });
  return null;
}
