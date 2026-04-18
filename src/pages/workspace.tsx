import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const Workspace: NextPage = () => {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    const active = sessionStorage.getItem('activeWorkspace');
    if (!active) {
      router.replace('/');
      return;
    }
    setWorkspaceId(active);
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem('activeWorkspace');
    router.replace('/');
  };

  if (!workspaceId) return null;

  return (
    <>
      <Head>
        <title>Workspace – {workspaceId}</title>
      </Head>
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0e1a 0%, #0d1526 50%, #111827 100%)',
        color: '#fff',
        padding: '2rem',
        fontFamily: 'Segoe UI, Arial, sans-serif',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 20,
            padding: '0.35rem 1rem',
            fontSize: '0.85rem',
            color: '#a0aec0',
          }}>
            Workspace: {workspaceId}
          </div>
          <button onClick={handleLogout} style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color: '#a0aec0',
            padding: '0.4rem 1rem',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}>
            Logout
          </button>
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Selamat datang, {workspaceId}!
        </h1>
        <p style={{ color: '#718096', marginBottom: '2rem' }}>
          Workspace kamu sudah aktif. Data akun, JSON, dan progress Plinks akan tersimpan di sini.
        </p>

        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '2rem',
          maxWidth: 500,
          color: '#718096',
          fontSize: '0.95rem',
          lineHeight: 1.6,
        }}>
          Fitur workspace (akun, Plinks, JSON fields) akan tersedia di sini.
        </div>
      </div>
    </>
  );
};

export default Workspace;
