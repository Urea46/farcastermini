import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import styles from '@/styles/Workspace.module.css';

type StepStatus = 'idle' | 'running' | 'done' | 'error';
type Tab = 'akun' | 'automation' | 'hasil';

interface Step {
  id: number;
  label: string;
  desc: string;
  status: StepStatus;
}

interface PullResult {
  token: string;
  amount: string;
  time: string;
  account?: string;
}

interface Account {
  id: string;
  label: string;
  phrase: string;
  fid: string;
  packId: string;
  jsonField: string;
  addedAt: string;
}

const INITIAL_STEPS: Step[] = [
  { id: 1, label: 'Buka Miniapp Plinks', desc: 'Navigasi ke plinks.app miniapp di Farcaster', status: 'idle' },
  { id: 2, label: 'Klik Tombol Free', desc: 'Klik pack gratis yang tersedia', status: 'idle' },
  { id: 3, label: 'Confirm Transaction', desc: 'No state changes — Network: Base, Fees: < $0.01', status: 'idle' },
  { id: 4, label: 'Loading Game', desc: 'Menunggu game selesai loading', status: 'idle' },
  { id: 5, label: 'Drop it!', desc: 'Klik tombol Drop it untuk reveal pack', status: 'idle' },
  { id: 6, label: 'Confirm Pull', desc: 'Receive token reward — Confirm transaction', status: 'idle' },
];

const Workspace: NextPage = () => {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('akun');

  // Accounts
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ label: '', phrase: '', fid: '', packId: '', jsonField: '' });
  const [showPhrase, setShowPhrase] = useState<Record<string, boolean>>({});
  const [showNewPhrase, setShowNewPhrase] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>('');

  // Automation
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [completedLoops, setCompletedLoops] = useState(0);
  const [packUrl, setPackUrl] = useState('https://plinks.app');
  const [loopCount, setLoopCount] = useState(1);

  // Results
  const [results, setResults] = useState<PullResult[]>([]);

  useEffect(() => {
    const active = sessionStorage.getItem('activeWorkspace');
    if (!active) { router.replace('/'); return; }
    setWorkspaceId(active);
    const savedAccounts = localStorage.getItem(`ws_${active}_accounts`);
    if (savedAccounts) setAccounts(JSON.parse(savedAccounts));
    const savedResults = localStorage.getItem(`ws_${active}_results`);
    if (savedResults) setResults(JSON.parse(savedResults));
  }, [router]);

  const persist = (key: string, data: any) => {
    if (!workspaceId) return;
    localStorage.setItem(`ws_${workspaceId}_${key}`, JSON.stringify(data));
  };

  // --- Account actions ---
  const addAccount = () => {
    if (!newAccount.label.trim() || !newAccount.phrase.trim()) return;
    const acc: Account = {
      id: Date.now().toString(),
      ...newAccount,
      addedAt: new Date().toLocaleDateString('id-ID'),
    };
    const updated = [...accounts, acc];
    setAccounts(updated);
    persist('accounts', updated);
    setNewAccount({ label: '', phrase: '', fid: '', packId: '', jsonField: '' });
    setShowNewPhrase(false);
    setShowAddAccount(false);
  };

  const removeAccount = (id: string) => {
    const updated = accounts.filter(a => a.id !== id);
    setAccounts(updated);
    persist('accounts', updated);
    if (selectedAccount === id) setSelectedAccount('');
  };

  // --- Automation ---
  const simulateStep = (stepIndex: number, delay: number): Promise<void> =>
    new Promise(resolve => {
      setSteps(prev => prev.map((s, i) => i === stepIndex ? { ...s, status: 'running' } : s));
      setTimeout(() => {
        setSteps(prev => prev.map((s, i) => i === stepIndex ? { ...s, status: 'done' } : s));
        resolve();
      }, delay);
    });

  const runAutomation = async () => {
    setRunning(true);
    setCompletedLoops(0);
    const acc = accounts.find(a => a.id === selectedAccount);

    for (let loop = 0; loop < loopCount; loop++) {
      setSteps(INITIAL_STEPS.map(s => ({ ...s, status: 'idle' })));
      await simulateStep(0, 1200);
      await simulateStep(1, 900);
      await simulateStep(2, 1100);
      await simulateStep(3, 2000);
      await simulateStep(4, 800);
      await simulateStep(5, 1300);

      const tokens = ['BRETT', 'DEGEN', 'MOCHI', 'ENJOY', 'HIGHER'];
      const token = tokens[Math.floor(Math.random() * tokens.length)];
      const amount = (Math.random() * 2 + 0.1).toFixed(4);
      const newResult: PullResult = {
        token, amount,
        time: new Date().toLocaleTimeString('id-ID'),
        account: acc?.label,
      };
      setResults(prev => {
        const updated = [newResult, ...prev].slice(0, 100);
        persist('results', updated);
        return updated;
      });
      setCompletedLoops(loop + 1);
      if (loop < loopCount - 1) await new Promise(r => setTimeout(r, 500));
    }
    setRunning(false);
  };

  const clearResults = () => {
    setResults([]);
    if (workspaceId) localStorage.removeItem(`ws_${workspaceId}_results`);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('activeWorkspace');
    router.replace('/');
  };

  const statusIcon = (s: StepStatus) =>
    s === 'done' ? '✓' : s === 'running' ? '⟳' : s === 'error' ? '✕' : '○';

  if (!workspaceId) return null;

  return (
    <>
      <Head><title>Workspace – {workspaceId}</title></Head>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.badge}>Workspace: {workspaceId}</div>
          <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>

        <h1 className={styles.title}>Plinks Automation</h1>
        <p className={styles.subtitle}>Otomatisasi flow pack opening di Farcaster Plinks miniapp.</p>

        {/* Tabs */}
        <div className={styles.tabs}>
          {(['akun', 'automation', 'hasil'] as Tab[]).map(t => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'akun' ? `Akun (${accounts.length})` : t === 'automation' ? 'Automation' : `Hasil (${results.length})`}
            </button>
          ))}
        </div>

        {/* TAB: Akun */}
        {tab === 'akun' && (
          <div className={styles.tabContent}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionDesc}>Simpan akun Farcaster, Pack ID, dan JSON field untuk automation.</p>
              <button className={styles.btnAdd} onClick={() => setShowAddAccount(!showAddAccount)}>
                {showAddAccount ? 'Batal' : '+ Tambah Akun'}
              </button>
            </div>

            {showAddAccount && (
              <div className={styles.card} style={{ marginBottom: '1rem' }}>
                <h3 className={styles.cardTitle}>Akun Baru</h3>
                <div className={styles.formGroup}>
                  <label className={styles.label}>LABEL AKUN *</label>
                  <input className={styles.input} placeholder="Contoh: akun-utama" value={newAccount.label}
                    onChange={e => setNewAccount(p => ({ ...p, label: e.target.value }))} />
                </div>

                <div className={styles.formGroup}>
                  <div className={styles.labelRow}>
                    <label className={styles.label}>SEED PHRASE WARPCAST *</label>
                    <button type="button" className={styles.toggleBtn} onClick={() => setShowNewPhrase(p => !p)}>
                      {showNewPhrase ? 'Sembunyikan' : 'Tampilkan'}
                    </button>
                  </div>
                  <textarea
                    className={`${styles.input} ${styles.phraseInput}`}
                    placeholder="Masukkan 12 atau 24 kata seed phrase Warpcast kamu..."
                    value={newAccount.phrase}
                    onChange={e => setNewAccount(p => ({ ...p, phrase: e.target.value }))}
                    style={{ fontFamily: showNewPhrase ? 'monospace' : 'monospace', filter: showNewPhrase ? 'none' : 'blur(4px)' }}
                    rows={3}
                  />
                  <p className={styles.phraseNote}>⚠ Disimpan lokal di browser kamu saja, tidak dikirim ke mana pun.</p>
                </div>

                <div className={styles.grid2}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>FARCASTER FID</label>
                    <input className={styles.input} placeholder="Contoh: 12345" value={newAccount.fid}
                      onChange={e => setNewAccount(p => ({ ...p, fid: e.target.value }))} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>PACK ID</label>
                    <input className={styles.input} placeholder="ID pack Plinks" value={newAccount.packId}
                      onChange={e => setNewAccount(p => ({ ...p, packId: e.target.value }))} />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>JSON FIELD (opsional)</label>
                  <input className={styles.input} placeholder='{"key":"value"}' value={newAccount.jsonField}
                    onChange={e => setNewAccount(p => ({ ...p, jsonField: e.target.value }))} />
                </div>

                <button className={styles.btnRun} onClick={addAccount}
                  disabled={!newAccount.label.trim() || !newAccount.phrase.trim()}>
                  Simpan Akun
                </button>
              </div>
            )}

            {accounts.length === 0 ? (
              <div className={styles.card}>
                <p className={styles.empty}>Belum ada akun. Tambah akun dulu untuk mulai automation.</p>
              </div>
            ) : (
              <div className={styles.accountList}>
                {accounts.map(acc => (
                  <div key={acc.id} className={`${styles.accountCard} ${selectedAccount === acc.id ? styles.accountSelected : ''}`}>
                    <div className={styles.accountTop}>
                      <div>
                        <div className={styles.accountLabel}>{acc.label}</div>
                        <div className={styles.accountMeta}>FID: {acc.fid} · Ditambah: {acc.addedAt}</div>
                      </div>
                      <div className={styles.accountActions}>
                        <button
                          className={`${styles.btnSelect} ${selectedAccount === acc.id ? styles.btnSelected : ''}`}
                          onClick={() => setSelectedAccount(selectedAccount === acc.id ? '' : acc.id)}
                        >
                          {selectedAccount === acc.id ? '✓ Dipilih' : 'Pilih'}
                        </button>
                        <button className={styles.btnDelete} onClick={() => removeAccount(acc.id)}>Hapus</button>
                      </div>
                    </div>
                    <div className={styles.accountFields}>
                      <div className={styles.phraseRow}>
                        <span className={styles.fieldTag} style={{ filter: showPhrase[acc.id] ? 'none' : 'blur(4px)', fontFamily: 'monospace', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {acc.phrase || '—'}
                        </span>
                        <button className={styles.toggleBtn} onClick={() => setShowPhrase(p => ({ ...p, [acc.id]: !p[acc.id] }))}>
                          {showPhrase[acc.id] ? 'Sembunyikan' : 'Lihat'}
                        </button>
                      </div>
                      {acc.packId && <span className={styles.fieldTag}>Pack: {acc.packId}</span>}
                      {acc.fid && <span className={styles.fieldTag}>FID: {acc.fid}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: Automation */}
        {tab === 'automation' && (
          <div className={styles.tabContent}>
            <div className={styles.layout}>
              <div className={styles.left}>
                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>Konfigurasi</h2>

                  {accounts.length > 0 && (
                    <div className={styles.formGroup}>
                      <label className={styles.label}>AKUN</label>
                      <select className={styles.input} value={selectedAccount}
                        onChange={e => setSelectedAccount(e.target.value)} disabled={running}>
                        <option value="">— Pilih akun —</option>
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>{a.label} (FID: {a.fid})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className={styles.formGroup}>
                    <label className={styles.label}>PACK URL / MINIAPP</label>
                    <input className={styles.input} type="text" value={packUrl}
                      onChange={e => setPackUrl(e.target.value)} placeholder="https://plinks.app" disabled={running} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>JUMLAH LOOP</label>
                    <input className={styles.input} type="number" min={1} max={100} value={loopCount}
                      onChange={e => setLoopCount(Number(e.target.value))} disabled={running} />
                  </div>
                  <div className={styles.btnRow}>
                    <button className={styles.btnRun} onClick={runAutomation} disabled={running}>
                      {running ? `Running... (${completedLoops}/${loopCount})` : '▶ Jalankan'}
                    </button>
                    <button className={styles.btnReset}
                      onClick={() => setSteps(INITIAL_STEPS.map(s => ({ ...s, status: 'idle' })))}
                      disabled={running}>Reset</button>
                  </div>
                </div>

                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>Step Progress</h2>
                  <div className={styles.steps}>
                    {steps.map((step, i) => (
                      <div key={step.id} className={`${styles.step} ${styles[step.status]}`}>
                        <div className={styles.stepIcon}>{statusIcon(step.status)}</div>
                        <div className={styles.stepInfo}>
                          <div className={styles.stepLabel}>{step.id}. {step.label}</div>
                          <div className={styles.stepDesc}>{step.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.right}>
                <div className={styles.card}>
                  <div className={styles.resultsHeader}>
                    <h2 className={styles.cardTitle}>Hasil Terbaru ({results.length})</h2>
                    {results.length > 0 && (
                      <button className={styles.clearBtn} onClick={() => setTab('hasil')}>Lihat Semua →</button>
                    )}
                  </div>
                  {results.length === 0 ? (
                    <p className={styles.empty}>Belum ada hasil. Jalankan automation dulu.</p>
                  ) : (
                    <div className={styles.resultList}>
                      {results.slice(0, 10).map((r, i) => (
                        <div key={i} className={styles.resultItem}>
                          <div>
                            <div className={styles.resultToken}>+{r.amount} {r.token}</div>
                            {r.account && <div className={styles.resultAccount}>{r.account}</div>}
                          </div>
                          <div className={styles.resultTime}>{r.time}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Hasil */}
        {tab === 'hasil' && (
          <div className={styles.tabContent}>
            <div className={styles.card}>
              <div className={styles.resultsHeader}>
                <h2 className={styles.cardTitle}>Semua Hasil Pull ({results.length})</h2>
                {results.length > 0 && (
                  <button className={styles.clearBtn} onClick={clearResults}>Hapus Semua</button>
                )}
              </div>
              {results.length === 0 ? (
                <p className={styles.empty}>Belum ada hasil. Jalankan automation di tab Automation.</p>
              ) : (
                <div className={styles.resultList}>
                  {results.map((r, i) => (
                    <div key={i} className={styles.resultItem}>
                      <div>
                        <div className={styles.resultToken}>+{r.amount} {r.token}</div>
                        {r.account && <div className={styles.resultAccount}>{r.account}</div>}
                      </div>
                      <div className={styles.resultTime}>{r.time}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Workspace;
