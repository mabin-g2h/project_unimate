"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useRegistration } from './context';
import AppLogo from '@/app/components/AppLogo';

const COUNTRIES = ['Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bangladesh','Belgium','Brazil','Cambodia','Canada','Chile','China','Colombia','Denmark','Egypt','Ethiopia','Finland','France','Germany','Ghana','Greece','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kenya','Malaysia','Mexico','Morocco','Myanmar','Nepal','Netherlands','New Zealand','Nigeria','Norway','Pakistan','Philippines','Poland','Portugal','Romania','Russia','Saudi Arabia','Singapore','South Africa','South Korea','Spain','Sri Lanka','Sweden','Switzerland','Taiwan','Thailand','Turkey','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Vietnam','Zimbabwe'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DEGREES = ["Bachelor's Degree", "Postgraduate Certificate", "Postgraduate Diploma", "Master's Degree", "PhD / Doctorate", "Professional Degree", "Other"];
const GENDERS = ['Male', 'Female'];
const YEARS = [2024, 2025, 2026, 2027];

interface University { id: number; name: string; }
interface City { id: number; label: string; }

interface FormState {
  full_name: string; phone: string;
  country_of_origin: string; country_of_education: string;
  university_name: string; degree_level: string;
  course_name: string; intake_month: string; intake_year: string;
  city: string; gender: string;
}

function resizeImage(file: File, maxPx = 400): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('resize failed'));
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.82);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function RegisterPage() {
  const router = useRouter();
  const { data: registrationData, setData: setRegistrationData } = useRegistration();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormState>({
    full_name: '', phone: '', country_of_origin: '', country_of_education: '',
    university_name: '', degree_level: '', course_name: '', intake_month: '', intake_year: '', city: '', gender: '',
  });
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [admissionFile, setAdmissionFile] = useState<File | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);

  const [universities, setUniversities] = useState<University[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  const passportRef = useRef<HTMLInputElement>(null);
  const admissionRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(({ user }) => {
      if (!user) { router.replace('/login'); return; }
      if (!user.email_verified) { router.replace('/login'); return; }
      if (user.registration_status === 'approved') { router.replace('/'); return; }
      if (user.registration_status === 'pending') { router.replace('/pending'); return; }
      // Restore form state if returning from the consent page
      if (registrationData) {
        setForm(registrationData.form);
        setPassportFile(registrationData.passportFile);
        setAdmissionFile(registrationData.admissionFile);
        setProfileFile(registrationData.profileFile);
        const reader = new FileReader();
        reader.onload = e => setProfilePreview(e.target?.result as string);
        reader.readAsDataURL(registrationData.profileFile);
      }
      setLoading(false);
    });
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch('/api/options/universities')
      .then(r => r.json())
      .then(({ universities: list }) => {
        setUniversities(list ?? []);
      });
    fetch('/api/options/cities')
      .then(r => r.json())
      .then(({ cities: list }) => setCities(list ?? []));
  }, []);

  function set(field: keyof FormState, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleProfileFile(file: File) {
    const resized = await resizeImage(file);
    setProfileFile(resized);
    const reader = new FileReader();
    reader.onload = e => setProfilePreview(e.target?.result as string);
    reader.readAsDataURL(resized);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    for (const [k, v] of Object.entries(form)) {
      if (!v.trim()) { setError(`Please fill in all fields (missing: ${k.replace(/_/g,' ')})`); return; }
    }
    if (!isValidPhoneNumber(form.phone)) {
      setError('Please enter a valid mobile number (with country code).'); return;
    }
    if (!passportFile) { setError('Please upload your passport (PDF).'); return; }
    if (!admissionFile) { setError('Please upload your admission letter (PDF).'); return; }
    if (!profileFile) { setError('Please upload a profile photo.'); return; }

    setRegistrationData({ form, passportFile, admissionFile, profileFile });
    router.push('/register/consent');
  }

  if (loading) return (
    <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  );

  return (
    <>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 60px' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <AppLogo height={48} />
        </div>

        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.6rem,4vw,2.2rem)', letterSpacing: '-.03em', marginBottom: 6 }}>
          Complete your profile
        </h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: '.95rem', marginBottom: 16 }}>
          Fill in your details and upload your documents. Our team will review and verify your profile.
        </p>
        <p style={{ fontSize: '.8rem', color: 'var(--ink-soft)', marginBottom: 24 }}>
          <span style={{ color: 'var(--coral)', fontWeight: 800 }}>*</span> Required
        </p>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: 'var(--coral-tint)', border: '1px solid var(--coral)', borderRadius: 10, padding: '12px 16px', marginBottom: 22, color: 'var(--coral-deep)', fontSize: '.88rem', fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* Personal Details */}
          <Section title="Personal Details">
            <Field label="Full name (as in passport)" required>
              <input style={inp} value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. Ishita Raman" required />
            </Field>
            <Field label="Phone number with country code" required>
              <PhoneInput
                international
                defaultCountry="IN"
                value={form.phone || undefined}
                onChange={v => set('phone', v ?? '')}
                className="unimate-phone"
                placeholder="98765 43210"
              />
            </Field>
            <Field label="Country of origin" required>
              <select style={inp} value={form.country_of_origin} onChange={e => set('country_of_origin', e.target.value)} required>
                <option value="">Select country</option>
                {COUNTRIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Gender" required>
              <select style={inp} value={form.gender} onChange={e => set('gender', e.target.value)} required>
                <option value="">Select gender</option>
                {GENDERS.map(g => <option key={g}>{g}</option>)}
              </select>
            </Field>
          </Section>

          {/* Academic Details */}
          <Section title="Academic Details">
            <Field label="Country of education (destination)" required>
              <select style={inp} value={form.country_of_education} onChange={e => set('country_of_education', e.target.value)} required>
                <option value="">Select country</option>
                {COUNTRIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="University / institution name" required>
              <select style={inp} value={form.university_name} onChange={e => set('university_name', e.target.value)} required>
                <option value="">Select university</option>
                {universities.length === 0 && (
                  <option disabled value="">No universities configured — contact admin</option>
                )}
                {universities.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Degree level" required>
              <select style={inp} value={form.degree_level} onChange={e => set('degree_level', e.target.value)} required>
                <option value="">Select level</option>
                {DEGREES.map(d => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Course / programme name" required>
              <p style={{ fontSize: '.78rem', color: 'var(--ink-soft)', marginBottom: 6, lineHeight: 1.4 }}>
                Enter the exact programme name as written on your admission letter.
              </p>
              <input
                type="text"
                style={inp}
                value={form.course_name}
                onChange={e => set('course_name', e.target.value)}
                placeholder="e.g. Master of Information Technology"
                required
              />
            </Field>
            <div className="two-col-sm" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Intake month" required>
                <select style={inp} value={form.intake_month} onChange={e => set('intake_month', e.target.value)} required>
                  <option value="">Month</option>
                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Intake year" required>
                <select style={inp} value={form.intake_year} onChange={e => set('intake_year', e.target.value)} required>
                  <option value="">Year</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
            </div>
            <Field label="City (where you'll be studying)" required>
              <select style={inp} value={form.city} onChange={e => set('city', e.target.value)} required>
                <option value="">Select city</option>
                {cities.length === 0 && (
                  <option disabled value="">No cities configured — contact admin</option>
                )}
                {cities.map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
              </select>
            </Field>
          </Section>

          {/* Documents */}
          <Section title="Documents & Photo">
            <p style={{ color: 'var(--ink-soft)', fontSize: '.84rem', marginBottom: 18, lineHeight: 1.6 }}>
              Passport and admission letter must be PDF — max 2 MB each. Profile photo must be JPEG or PNG — max 1 MB. Documents are securely stored and deleted after verification.
            </p>

            <Field label="Passport copy (PDF)" required>
              <div
                onClick={() => passportRef.current?.click()}
                style={{ ...uploadBox, borderColor: passportFile ? 'var(--teal)' : 'var(--line)', background: passportFile ? 'var(--teal-tint)' : 'var(--cream-2)' }}
              >
                <input ref={passportRef} type="file" accept=".pdf" style={{ display: 'none' }}
                  onChange={e => setPassportFile(e.target.files?.[0] ?? null)} />
                <span style={{ fontSize: 22 }}>📄</span>
                <span style={{ fontSize: '.86rem', fontWeight: 600, color: passportFile ? 'var(--teal-deep)' : 'var(--ink-soft)' }}>
                  {passportFile ? passportFile.name : 'Click to upload passport PDF'}
                </span>
              </div>
            </Field>

            <Field label="Admission letter (PDF)" required>
              <div
                onClick={() => admissionRef.current?.click()}
                style={{ ...uploadBox, borderColor: admissionFile ? 'var(--teal)' : 'var(--line)', background: admissionFile ? 'var(--teal-tint)' : 'var(--cream-2)' }}
              >
                <input ref={admissionRef} type="file" accept=".pdf" style={{ display: 'none' }}
                  onChange={e => setAdmissionFile(e.target.files?.[0] ?? null)} />
                <span style={{ fontSize: 22 }}>📋</span>
                <span style={{ fontSize: '.86rem', fontWeight: 600, color: admissionFile ? 'var(--teal-deep)' : 'var(--ink-soft)' }}>
                  {admissionFile ? admissionFile.name : 'Click to upload admission letter PDF'}
                </span>
              </div>
            </Field>

            <Field label="Profile photo" required>
              {profilePreview ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <img src={profilePreview} alt="Profile preview" style={{ width: 72, height: 72, borderRadius: 14, objectFit: 'cover', border: '2px solid var(--teal)' }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '.86rem', color: 'var(--teal-deep)', marginBottom: 4 }}>Photo selected</div>
                    <button type="button" onClick={() => { setProfileFile(null); setProfilePreview(null); }}
                      style={{ background: 'none', border: 'none', color: 'var(--coral)', fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', padding: 0 }}>
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => profileRef.current?.click()}
                  style={{ width: '100%', ...uploadBox, flexDirection: 'row', cursor: 'pointer', justifyContent: 'center' }}>
                  <input ref={profileRef} type="file" accept="image/jpeg,image/png,image/jpg" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleProfileFile(f); }} />
                  <span style={{ fontSize: 18 }}>🖼️</span>
                  <span style={{ fontSize: '.84rem', fontWeight: 600, color: 'var(--ink-soft)' }}>Upload photo</span>
                </button>
              )}
            </Field>
          </Section>

          <button type="submit"
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none',
              background: 'var(--teal)', color: '#fff',
              fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
            }}>
            Continue to Review &amp; Consent →
          </button>
        </form>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius)', padding: '24px', marginBottom: 18, boxShadow: 'var(--shadow)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-.01em', marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--line-soft)' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label style={{ display: 'block', fontWeight: 700, fontSize: '.82rem', marginBottom: 6, color: 'var(--ink)' }}>
        {label}{required && <span style={{ color: 'var(--coral)', marginLeft: 3, fontWeight: 800 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Spinner() {
  return <div style={{ width: 36, height: 36, border: '3px solid var(--line)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}

const inp: React.CSSProperties = {
  width: '100%', fontFamily: 'var(--font-body)', fontSize: '.9rem', color: 'var(--ink)',
  background: 'var(--cream-2)', border: '1px solid var(--line)', borderRadius: 10,
  padding: '11px 14px', outline: 'none', boxSizing: 'border-box', appearance: 'none',
};

const uploadBox: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
  padding: '18px 14px', borderRadius: 10, border: '1.5px dashed var(--line)',
  cursor: 'pointer', transition: '.18s', background: 'var(--cream-2)',
};
