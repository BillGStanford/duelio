'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics';

export default function PageView() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith('/admin')) return;
    track('page_view', { path: pathname.slice(0, 90) });
  }, [pathname]);
  return null;
}

export function EventOnMount({ name, props }: { name: string; props?: Record<string, string | number | boolean> }) {
  useEffect(() => {
    track(name, props ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  return null;
}
