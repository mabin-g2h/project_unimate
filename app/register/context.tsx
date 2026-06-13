'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface RegistrationForm {
  full_name: string;
  phone: string;
  country_of_origin: string;
  country_of_education: string;
  university_name: string;
  degree_level: string;
  course_name: string;
  intake_month: string;
  intake_year: string;
  city: string;
  gender: string;
}

export interface RegistrationData {
  form: RegistrationForm;
  passportFile: File;
  admissionFile: File;
  profileFile: File;
}

interface RegistrationContextValue {
  data: RegistrationData | null;
  setData: (d: RegistrationData) => void;
  clear: () => void;
}

const RegistrationContext = createContext<RegistrationContextValue | null>(null);

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<RegistrationData | null>(null);
  return (
    <RegistrationContext.Provider value={{ data, setData, clear: () => setData(null) }}>
      {children}
    </RegistrationContext.Provider>
  );
}

export function useRegistration() {
  const ctx = useContext(RegistrationContext);
  if (!ctx) throw new Error('useRegistration must be used within RegistrationProvider');
  return ctx;
}
