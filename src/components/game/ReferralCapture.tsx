'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getWikiClient } from '@/lib/wikirush-client';
import { cleanRef, rememberRef } from '@/lib/referral';

/** Any page opened with ?ref=CODE remembers the code and, for signed-out visitors, opens the sign-up screen with it filled in. */
export default function ReferralCapture() {
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (path === '/login') return;
    const params = new URLSearchParams(window.location.search);
    const ref = cleanRef(params.get('ref'));
    if (!ref) return;
    rememberRef(ref);
    let alive = true;
    (async () => {
      const client = getWikiClient();
      const { data } = client ? await client.auth.getSession() : { data: { session: null } };
      if (!alive || data.session) return; // existing members just keep playing
      params.delete('ref');
      const rest = params.toString();
      const next = `${path}${rest ? `?${rest}` : ''}`;
      router.replace(`/login?mode=signup&ref=${encodeURIComponent(ref)}&next=${encodeURIComponent(next)}`);
    })();
    return () => { alive = false; };
  }, [path, router]);
  return null;
}
