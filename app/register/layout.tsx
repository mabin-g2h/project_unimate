'use client';

import { useEffect } from 'react';
import { RegistrationProvider } from './context';
import { flushClientLogQueue } from '@/lib/client-log';

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  // Reports that could not be sent while the student was offline go out on the next visit or reconnect.
  useEffect(() => {
    void flushClientLogQueue();
    const onOnline = () => { void flushClientLogQueue(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  return <RegistrationProvider>{children}</RegistrationProvider>;
}
