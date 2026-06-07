"use client";

import { useRef, useState, useCallback } from 'react';

interface Props {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [started, setStarted] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStarted(true);
    } catch {
      setError('Could not access camera. Please upload a photo instead.');
    }
  }, []);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL('image/jpeg', 0.9);
    setPreview(dataUrl);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const retake = useCallback(() => {
    setPreview(null);
    startCamera();
  }, [startCamera]);

  const confirm = useCallback(() => {
    if (!preview) return;
    const byteString = atob(preview.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: 'image/jpeg' });
    const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: 'image/jpeg' });
    onCapture(file);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, [preview, onCapture]);

  const close = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    onClose();
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,33,28,.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--paper)', borderRadius: 'var(--radius)', width: '100%', maxWidth: 460, overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem' }}>Take a selfie</div>
          <button onClick={close} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-soft)', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 22 }}>
          {error && (
            <div style={{ background: 'var(--coral-tint)', borderRadius: 10, padding: '12px 14px', color: 'var(--coral-deep)', fontSize: '.86rem', marginBottom: 16 }}>{error}</div>
          )}

          {!started && !error && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
              <p style={{ color: 'var(--ink-soft)', fontSize: '.9rem', marginBottom: 20 }}>We&apos;ll use your device camera to take your profile photo.</p>
              <button onClick={startCamera}
                style={{ background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer' }}>
                Start Camera
              </button>
            </div>
          )}

          {started && !preview && (
            <>
              <video ref={videoRef} style={{ width: '100%', borderRadius: 10, background: '#000' }} autoPlay muted playsInline />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <button onClick={capture}
                style={{ width: '100%', marginTop: 14, background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer' }}>
                Capture Photo
              </button>
            </>
          )}

          {preview && (
            <>
              <img src={preview} alt="Preview" style={{ width: '100%', borderRadius: 10 }} />
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button onClick={retake}
                  style={{ flex: 1, background: 'var(--cream-2)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '.88rem', cursor: 'pointer' }}>
                  Retake
                </button>
                <button onClick={confirm}
                  style={{ flex: 1, background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '.88rem', cursor: 'pointer' }}>
                  Use this photo
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
