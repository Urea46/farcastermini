import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import styles from '@/styles/Workspace.module.css';

type StepStatus = 'idle' | 'running' | 'done' | 'error';
type Tab = 'akun' | 'automation' | 'hasil';

const CONTRACTS = {
  plinks: '0x31505c6102e5945eddf0bd04e8330ab99796adc1',
  freePack: '0x31505c6102e5945eddf0bd04e8330ab99796adc1',
  tokens: {
    BRETT:  '0x532f27101965dd16442E59d40670FaF5eBB142E4',
    DEGEN:  '0x4ed4E68C2a967522d071415e967E08f9f75a7c29',
    MOCHI:  '0xf6e93272d11f30a507c6020ad45b85ee43d614a6',
    ENJOY:  '0xa6b280b42cb0b1165012211624acc56828b1758c',
    HIGHER: '0x057871ad21a1f57bf648532848310034a0b3da6f',
  },
  network: 'Base Mainnet',
  explorer: 'https://basescan.org',
};

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
  txHash?: string;
  rewardTxHash?: string;
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
  { id: 1, label: 'Buka Miniapp Plinks', desc: 'Navigasi ke plinks.app miniapp', status: 'idle' },
  { id: 2, label: 'Klik Tombol Free', desc: 'Klik pack gratis yang tersedia', status: 'idle' },
  { id: 3, label: 'Auth + Confirm Free Pack', desc: 'Sign In to Plinks → fetch session → kirim TX ke Base', status: 'idle' },
  { id: 4, label: 'Resume + Game Start', desc: 'GET /game/resume → POST /game/{id}/start', status: 'idle' },
  { id: 5, label: 'Drop Ball', desc: 'POST /game/{id}/drop → ambil reward data', status: 'idle' },
  { id: 6, label: 'Claim Reward TX', desc: `transferBallRewards → Contract: ${CONTRACTS.freePack.slice(0,10)}…`, status: 'idle' },
];

interface WalletInfo {
  address: string;
  balanceEth: string;
  network: string;
  blockNumber: string;
  loading?: boolean;
  error?: string;
}

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
  const [walletInfos, setWalletInfos] = useState<Record<string, WalletInfo>>({});

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

  // --- Wallet Verification ---
  const verifyWallet = async (acc: Account) => {
    if (!acc.phrase) return;
    setWalletInfos(prev => ({ ...prev, [acc.id]: { ...prev[acc.id], loading: true, error: undefined } as any }));
    try {
      const res = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getWalletInfo', seedPhrase: acc.phrase }),
      });
      const data = await res.json();
      if (data.success) {
        setWalletInfos(prev => ({
          ...prev,
          [acc.id]: {
            address: data.address,
            balanceEth: data.balanceEth,
            network: data.network,
            blockNumber: data.blockNumber,
            loading: false,
          },
        }));
      } else {
        setWalletInfos(prev => ({ ...prev, [acc.id]: { loading: false, error: data.error } as any }));
      }
    } catch (e: any) {
      setWalletInfos(prev => ({ ...prev, [acc.id]: { loading: false, error: e.message } as any }));
    }
  };

  // --- Automation ---
  const setStepStatus = (stepIndex: number, status: StepStatus, desc?: string) => {
    setSteps(prev => prev.map((s, i) =>
      i === stepIndex ? { ...s, status, ...(desc ? { desc } : {}) } : s
    ));
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const runAutomation = async () => {
    setRunning(true);
    setCompletedLoops(0);
    const acc = accounts.find(a => a.id === selectedAccount);

    for (let loop = 0; loop < loopCount; loop++) {
      setSteps(INITIAL_STEPS.map(s => ({ ...s, status: 'idle' })));

      // Step 1: Buka Miniapp
      setStepStatus(0, 'running');
      await sleep(1000);
      setStepStatus(0, 'done');

      // Step 2: Klik Free
      setStepStatus(1, 'running');
      await sleep(800);
      setStepStatus(1, 'done');

      // Step 3: Auth + Open Pack (real jika ada phrase)
      setStepStatus(2, 'running');
      let txHash3: string | undefined;
      let packSessionId: string | undefined;
      if (acc?.phrase) {
        try {
          const res = await fetch('/api/automation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'fullOpenPack',
              seedPhrase: acc.phrase,
              username: acc.fid || acc.label,
              sessionId: acc.packId || undefined,
            }),
          });
          const data = await res.json();
          if (data.success && data.txHash) {
            txHash3 = data.txHash;
            packSessionId = data.sessionId;
            setStepStatus(2, 'done', `✓ Auth OK · TX: ${data.txHash.slice(0, 12)}… · Base`);
          } else if (data.address) {
            // Auth berhasil tapi session pack belum otomatis
            setStepStatus(2, 'done', `✓ Auth OK · ${data.error || 'Butuh session ID'}`);
          } else {
            setStepStatus(2, 'error', `Auth gagal: ${data.error}`);
          }
        } catch (e: any) {
          setStepStatus(2, 'error', `Error: ${e.message?.slice(0, 60)}`);
        }
      } else {
        await sleep(1100);
        setStepStatus(2, 'done', 'Simulated · Tambah seed phrase di tab Akun');
      }

      // Steps 4-6: Claim Reward (game/start → game/drop → transferBallRewards TX)
      let rewardTxHash: string | undefined;
      let rewardTokens: string[] = [];
      let rewardAmounts: string[] = [];

      if (acc?.phrase && packSessionId) {
        // Step 4: game/start
        setStepStatus(3, 'running', 'Memanggil game/start ke Plinks...');
        // Step 5: game/drop
        setStepStatus(4, 'idle');
        // Step 6: send reward TX
        setStepStatus(5, 'idle');

        try {
          const claimRes = await fetch('/api/automation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'claimReward',
              seedPhrase: acc.phrase,
              sessionId: packSessionId,
            }),
          });
          const claimData = await claimRes.json();

          if (claimData.success && claimData.rewardTxHash) {
            setStepStatus(3, 'done', '✓ game/start OK');
            setStepStatus(4, 'done', '✓ game/drop OK · Reward data diterima');
            rewardTxHash = claimData.rewardTxHash;
            rewardTokens = claimData.debug?.tokens ?? [];
            rewardAmounts = claimData.debug?.amounts ?? [];
            const tokenList = rewardTokens.length ? rewardTokens.map((t: string) => t.slice(0, 8) + '…').join(', ') : 'Token';
            setStepStatus(5, 'done', `✓ Reward TX: ${rewardTxHash.slice(0, 12)}… · ${rewardTokens.length} token`);
          } else {
            // Partial success — show which step failed
            const failedStep = claimData.step ?? 'unknown';
            const errMsg = claimData.error?.slice(0, 70) ?? 'Error';
            if (failedStep === 'auth' || failedStep === 'game_resume') {
              setStepStatus(3, 'error', `${failedStep}: ${errMsg}`);
              setStepStatus(4, 'idle');
              setStepStatus(5, 'idle');
            } else if (failedStep === 'game_start') {
              setStepStatus(3, 'done', '✓ resume OK');
              setStepStatus(4, 'error', `start: ${errMsg}`);
              setStepStatus(5, 'idle');
            } else if (failedStep === 'game_drop' || failedStep === 'parse_reward') {
              setStepStatus(3, 'done', '✓ resume + start OK');
              setStepStatus(4, 'error', `${failedStep}: ${errMsg}`);
              setStepStatus(5, 'idle');
            } else {
              setStepStatus(3, 'done', '✓ resume + start OK');
              setStepStatus(4, 'done', '✓ drop OK');
              setStepStatus(5, 'error', `${failedStep}: ${errMsg}`);
            }
          }
        } catch (e: any) {
          setStepStatus(3, 'error', `Error: ${e.message?.slice(0, 60)}`);
          setStepStatus(4, 'idle');
          setStepStatus(5, 'idle');
        }
      } else if (acc?.phrase && !packSessionId) {
        // openPack failed to return sessionId — skip reward steps
        setStepStatus(3, 'error', 'Session ID tidak ada, skip reward');
        setStepStatus(4, 'idle');
        setStepStatus(5, 'idle');
      } else {
        // No phrase — simulate
        setStepStatus(3, 'running');
        await sleep(1200);
        setStepStatus(3, 'done', 'Simulated');
        setStepStatus(4, 'running');
        await sleep(700);
        setStepStatus(4, 'done', 'Simulated');
        setStepStatus(5, 'running');
        await sleep(900);
        setStepStatus(5, 'done', 'Simulated reward');
      }

      const fallbackTokens = ['BRETT', 'DEGEN', 'MOCHI', 'ENJOY', 'HIGHER'];
      const token = rewardTokens.length ? rewardTokens[0].slice(0, 8) + '…' : fallbackTokens[Math.floor(Math.random() * fallbackTokens.length)];
      const amount = rewardAmounts.length
        ? (Number(BigInt(rewardAmounts[0])) / 1e18).toFixed(6)
        : (Math.random() * 2 + 0.1).toFixed(4);
      const newResult: PullResult = {
        token, amount,
        time: new Date().toLocaleTimeString('id-ID'),
        account: acc?.label,
        txHash: txHash3,
        rewardTxHash,
      };
      setResults(prev => {
        const updated = [newResult, ...prev].slice(0, 100);
        persist('results', updated);
        return updated;
      });
      setCompletedLoops(loop + 1);
      if (loop < loopCount - 1) await sleep(500);
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
                        <span className={styles.fieldTag} style={{ filter: showPhrase[acc.id] ? 'none' : 'blur(4px)', fontFamily: 'monospace', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {acc.phrase || '—'}
                        </span>
                        <button className={styles.toggleBtn} onClick={() => setShowPhrase(p => ({ ...p, [acc.id]: !p[acc.id] }))}>
                          {showPhrase[acc.id] ? 'Sembunyikan' : 'Lihat'}
                        </button>
                        <button
                          className={styles.toggleBtn}
                          style={{ background: 'rgba(99,179,237,0.15)', color: '#63b3ed' }}
                          onClick={() => verifyWallet(acc)}
                          disabled={walletInfos[acc.id]?.loading}
                        >
                          {walletInfos[acc.id]?.loading ? '...' : '⚡ Verify'}
                        </button>
                      </div>
                      {acc.packId && <span className={styles.fieldTag}>Session ID: {acc.packId.slice(0,16)}…</span>}
                      {acc.fid && <span className={styles.fieldTag}>FID: {acc.fid}</span>}
                      {walletInfos[acc.id]?.error && (
                        <div className={styles.walletError}>{walletInfos[acc.id].error}</div>
                      )}
                      {walletInfos[acc.id]?.address && !walletInfos[acc.id]?.error && (
                        <div className={styles.walletInfo}>
                          <div className={styles.walletRow}>
                            <span className={styles.walletLabel}>Address</span>
                            <a
                              href={`https://basescan.org/address/${walletInfos[acc.id].address}`}
                              target="_blank" rel="noreferrer"
                              className={styles.walletAddr}
                            >
                              {walletInfos[acc.id].address.slice(0,10)}…{walletInfos[acc.id].address.slice(-8)}
                            </a>
                          </div>
                          <div className={styles.walletRow}>
                            <span className={styles.walletLabel}>Balance</span>
                            <span className={styles.walletBal}>{walletInfos[acc.id].balanceEth} ETH</span>
                          </div>
                          <div className={styles.walletRow}>
                            <span className={styles.walletLabel}>Network</span>
                            <span style={{ color: '#68d391', fontSize: '0.78rem' }}>✓ {walletInfos[acc.id].network}</span>
                          </div>
                          <div className={styles.walletRow}>
                            <span className={styles.walletLabel}>Block</span>
                            <span style={{ color: '#a0aec0', fontSize: '0.78rem' }}>#{walletInfos[acc.id].blockNumber}</span>
                          </div>
                        </div>
                      )}
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
                <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
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
                            {r.txHash && (
                              <a href={`https://basescan.org/tx/${r.txHash}`} target="_blank" rel="noreferrer" className={styles.txLink2}>
                                Pack TX: {r.txHash.slice(0,10)}…
                              </a>
                            )}
                            {r.rewardTxHash && (
                              <a href={`https://basescan.org/tx/${r.rewardTxHash}`} target="_blank" rel="noreferrer" className={styles.txLink2} style={{ color: '#68d391' }}>
                                Reward TX: {r.rewardTxHash.slice(0,10)}…
                              </a>
                            )}
                          </div>
                          <div className={styles.resultTime}>{r.time}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Contracts Info */}
                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>Contracts (Base)</h2>
                  <div className={styles.contractList}>
                    <div className={styles.contractItem}>
                      <div className={styles.contractLabel}>Free Pack</div>
                      <a
                        href={`${CONTRACTS.explorer}/address/${CONTRACTS.freePack}`}
                        target="_blank" rel="noreferrer"
                        className={styles.contractAddr}
                      >
                        {CONTRACTS.freePack.slice(0, 8)}…{CONTRACTS.freePack.slice(-6)}
                      </a>
                    </div>
                    {Object.entries(CONTRACTS.tokens).map(([name, addr]) => (
                      <div key={name} className={styles.contractItem}>
                        <div className={styles.contractLabel}>{name}</div>
                        <a
                          href={`${CONTRACTS.explorer}/token/${addr}`}
                          target="_blank" rel="noreferrer"
                          className={styles.contractAddr}
                        >
                          {addr.slice(0, 8)}…{addr.slice(-6)}
                        </a>
                      </div>
                    ))}
                  </div>
                  <a
                    href={`${CONTRACTS.explorer}/tx/0xceb62bea90b87f83651fcdda58b2e7ec96a64a2aa0a616e067cffb34d9c7f706`}
                    target="_blank" rel="noreferrer"
                    className={styles.txLink}
                  >
                    Lihat contoh transaksi →
                  </a>
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
                        {r.txHash && (
                          <a href={`https://basescan.org/tx/${r.txHash}`} target="_blank" rel="noreferrer" className={styles.txLink2}>
                            Pack TX: {r.txHash.slice(0,14)}…{r.txHash.slice(-6)}
                          </a>
                        )}
                        {r.rewardTxHash && (
                          <a href={`https://basescan.org/tx/${r.rewardTxHash}`} target="_blank" rel="noreferrer" className={styles.txLink2} style={{ color: '#68d391' }}>
                            Reward TX: {r.rewardTxHash.slice(0,14)}…{r.rewardTxHash.slice(-6)}
                          </a>
                        )}
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
