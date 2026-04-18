import type { NextPage } from 'next';
import Head from 'next/head';
import { useState } from 'react';
import styles from '@/styles/Home.module.css';

const Home: NextPage = () => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleOpenWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !password.trim()) {
      setError('Login ID dan Password harus diisi.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const key = `workspace_${loginId}`;
      const existing = localStorage.getItem(key);
      if (existing) {
        // verify password hash
        const stored = JSON.parse(existing);
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        if (stored.passwordHash !== hashHex) {
          setError('Password salah. Coba lagi.');
          setLoading(false);
          return;
        }
      } else {
        // create new workspace
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(key, JSON.stringify({
          loginId,
          passwordHash: hashHex,
          createdAt: new Date().toISOString(),
          accounts: [],
          plinksProgress: {},
        }));
      }
      sessionStorage.setItem('activeWorkspace', loginId);
      window.location.href = '/workspace';
    } catch (err) {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Farcaster Mini – Local Workspace</title>
        <meta name="description" content="Buka workspace tersimpan untuk automation Farcaster dan Plinks." />
      </Head>
      <div className={styles.page}>
        <div className={styles.badge}>Local Workspace Login</div>

        <div className={styles.hero}>
          <h1 className={styles.heading}>
            Buka workspace tersimpan<br />untuk automation.
          </h1>
          <p className={styles.subtext}>
            Login ini hanya lokal di browser kamu. Gunanya untuk menyimpan akun, field JSON, pack ID, dan
            progress step Plinks agar tidak hilang saat refresh.
          </p>
        </div>

        <div className={styles.content}>
          <form className={styles.card} onSubmit={handleOpenWorkspace}>
            <h2 className={styles.cardTitle}>Login Workspace</h2>
            <p className={styles.cardDesc}>
              Kalau login ID belum pernah dipakai, app akan membuat workspace baru. Kalau sudah ada,
              password yang sama akan membuka data tersimpan.
            </p>

            <div className={styles.formGroup}>
              <label className={styles.label}>LOGIN ID</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Contoh: yutini-main"
                value={loginId}
                onChange={e => setLoginId(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>PASSWORD</label>
              <input
                type="password"
                className={styles.input}
                placeholder="Buat password lokal"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? 'Membuka...' : 'Open Workspace'}
            </button>

            <p className={styles.hint}>
              Buat login ID + password lokal untuk menyimpan session dan field workflow setelah refresh.
            </p>
          </form>

          <div className={styles.noteCard}>
            <h3 className={styles.noteTitle}>Catatan</h3>
            <p className={styles.noteText}>
              Password ini bukan password Farcaster. Ini hanya kunci lokal untuk mengenkripsi workspace di
              browser yang sama.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
