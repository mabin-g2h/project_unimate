"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

const COUNTRIES = ['Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bangladesh','Belgium','Brazil','Cambodia','Canada','Chile','China','Colombia','Denmark','Egypt','Ethiopia','Finland','France','Germany','Ghana','Greece','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kenya','Malaysia','Mexico','Morocco','Myanmar','Nepal','Netherlands','New Zealand','Nigeria','Norway','Pakistan','Philippines','Poland','Portugal','Romania','Russia','Saudi Arabia','Singapore','South Africa','South Korea','Spain','Sri Lanka','Sweden','Switzerland','Taiwan','Thailand','Turkey','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Vietnam','Zimbabwe'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DEGREES = ["Bachelor's Degree", "Postgraduate Certificate", "Postgraduate Diploma", "Master's Degree", "PhD / Doctorate", "Professional Degree", "Other"];
const YEARS = [2024, 2025, 2026, 2027];

interface Course { id: number; name: string; }
interface University { id: number; name: string; courses: Course[]; }

interface FormState {
  full_name: string; phone: string;
  country_of_origin: string; country_of_education: string;
  university_name: string; degree_level: string;
  course_name: string; intake_month: string; intake_year: string;
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormState>({
    full_name: '', phone: '', country_of_origin: '', country_of_education: '',
    university_name: '', degree_level: '', course_name: '', intake_month: '', intake_year: '',
  });
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [admissionFile, setAdmissionFile] = useState<File | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);

  const [universities, setUniversities] = useState<University[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);

  const passportRef = useRef<HTMLInputElement>(null);
  const admissionRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(({ user }) => {
      if (!user) { router.replace('/login'); return; }
      if (user.registration_status === 'approved') { router.replace('/'); return; }
      if (user.registration_status === 'pending') { router.replace('/pending'); return; }
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    fetch('/api/options/universities')
      .then(r => r.json())
      .then(({ universities: list }) => setUniversities(list ?? []));
  }, []);

  function set(field: keyof FormState, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleUniversityChange(name: string) {
    set('university_name', name);
    set('course_name', '');
    const uni = universities.find(u => u.name === name);
    setAvailableCourses(uni?.courses ?? []);
  }

  async function handleProfileFile(file: File) {
    const resized = await resizeImage(file);
    setProfileFile(resized);
    const reader = new FileReader();
    reader.onload = e => setProfilePreview(e.target?.result as string);
    reader.readAsDataURL(resized);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    for (const [k, v] of Object.entries(form)) {
      if (!v.trim()) { setError(`Please fill in all fields (missing: ${k.replace(/_/g,' ')})`); return; }
    }
    if (!passportFile) { setError('Please upload your passport (PDF).'); return; }
    if (!admissionFile) { setError('Please upload your admission letter (PDF).'); return; }
    if (!profileFile) { setError('Please upload a profile photo.'); return; }

    setSubmitting(true);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append('passport', passportFile);
    fd.append('admission_letter', admissionFile);
    fd.append('profile_picture', profileFile);

    const res = await fetch('/api/student/register', { method: 'POST', body: fd });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) { setError(data.error ?? 'Submission failed.'); return; }
    router.push('/pending');
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  );

  return (
    <>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 60px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--teal)', display: 'grid', placeItems: 'center', transform: 'rotate(-6deg)', boxShadow: '0 4px 10px -3px rgba(14,110,98,.5)', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5S18 3 16.5 4.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-.02em' }}>Uni Mate</div>
          </div>
        </div>

        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.6rem,4vw,2.2rem)', letterSpacing: '-.03em', marginBottom: 6 }}>
          Complete your profile
        </h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: '.95rem', marginBottom: 28 }}>
          Fill in your details and upload your documents. Our team will review and verify your profile.
        </p>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: 'var(--coral-tint)', border: '1px solid var(--coral)', borderRadius: 10, padding: '12px 16px', marginBottom: 22, color: 'var(--coral-deep)', fontSize: '.88rem', fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* Personal Details */}
          <Section title="Personal Details">
            <Field label="Full name (as in passport)">
              <input style={inp} value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. Ishita Raman" required />
            </Field>
            <Field label="Phone number with country code">
              <input style={inp} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="e.g. +91 98765 43210" required />
            </Field>
            <Field label="Country of origin">
              <select style={inp} value={form.country_of_origin} onChange={e => set('country_of_origin', e.target.value)} required>
                <option value="">Select country</option>
                {COUNTRIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </Section>

          {/* Academic Details */}
          <Section title="Academic Details">
            <Field label="Country of education (destination)">
              <select style={inp} value={form.country_of_education} onChange={e => set('country_of_education', e.target.value)} required>
                <option value="">Select country</option>
                {COUNTRIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="University / institution name">
              <select style={inp} value={form.university_name} onChange={e => handleUniversityChange(e.target.value)} required>
                <option value="">Select university</option>
                {universities.length === 0 && (
                  <option disabled value="">No universities configured — contact admin</option>
                )}
                {universities.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Degree level">
              <select style={inp} value={form.degree_level} onChange={e => set('degree_level', e.target.value)} required>
                <option value="">Select level</option>
                {DEGREES.map(d => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Course / programme name">
              <select
                style={{ ...inp, opacity: !form.university_name ? 0.5 : 1 }}
                value={form.course_name}
                onChange={e => set('course_name', e.target.value)}
                disabled={!form.university_name}
                required
              >
                <option value="">
                  {form.university_name ? 'Select course' : 'Select a university first'}
                </option>
                {availableCourses.length === 0 && form.university_name && (
                  <option disabled value="">No courses configured for this university</option>
                )}
                {availableCourses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Intake month">
                <select style={inp} value={form.intake_month} onChange={e => set('intake_month', e.target.value)} required>
                  <option value="">Month</option>
                  {MONTHS.map(m => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Intake year">
                <select style={inp} value={form.intake_year} onChange={e => set('intake_year', e.target.value)} required>
                  <option value="">Year</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          {/* Documents */}
          <Section title="Documents & Photo">
            <p style={{ color: 'var(--ink-soft)', fontSize: '.84rem', marginBottom: 18, lineHeight: 1.6 }}>
              Passport and admission letter must be PDF. Profile photo must be JPEG or PNG. Max file size: 5MB per file. Documents are securely stored and deleted after verification.
            </p>

            <Field label="Passport copy (PDF)">
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

            <Field label="Admission letter (PDF)">
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

            <Field label="Profile photo">
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

          <div style={{ background: 'var(--cream-2)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 18px', marginBottom: 24, fontSize: '.83rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            By submitting, you confirm that all documents are genuine and accurate. Fraudulent submissions will result in permanent disqualification.
          </div>

          <button type="submit" disabled={submitting}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none',
              background: submitting ? 'var(--teal-tint)' : 'var(--teal)', color: '#fff',
              fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '1rem', cursor: submitting ? 'not-allowed' : 'pointer',
            }}>
            {submitting ? 'Submitting…' : 'Submit Application'}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontWeight: 700, fontSize: '.82rem', marginBottom: 6, color: 'var(--ink)' }}>{label}</label>
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
