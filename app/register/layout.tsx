'use client';

import { RegistrationProvider } from './context';

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <RegistrationProvider>{children}</RegistrationProvider>;
}
