import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import styles from '@/styles/Workspace.module.css';

type StepStatus = 'idle' | 'running' | 'done' | 'error';

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
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState<PullResult[]>([]);
  const [packUrl, setPackUrl] = useState('https://plinks.app');
  const [loopCount, setLoopCount] = useState(1);
  const [completedLoops, setCompletedLoops] = useState(0);

  useEffect(() => {
    const active = sessionStorage.getItem('activeWorkspace');
    if (!active) {
      router.replace('/');
      return;
    }
    setWorkspaceId(active);

    const saved = localStorage.getItem(`workspace_${active}_results`);
    if (saved) setResults(JSON.parse(saved));
  }, [router]);

  const saveResults = (newResults: PullResult[]) => {
    if (!workspaceId) return;
    localStorage.setItem(`workspace_${workspaceId}_results`, JSON.stringify(newResults));
  };

  const simulateStep = (stepIndex: number, delay: number): Promise<void> => {
    return new Promise(resolve => {
      setSteps(prev => prev.map((s, i) =>
        i === stepIndex ? { ...s, status: 'running' } : s
      ));
      setTimeout(() => {
        setSteps(prev => prev.map((s, i) =>
          i === stepIndex ? { ...s, status: 'done' } : s
        ));
        setCurrentStep(stepIndex + 1);
        resolve();
      }, delay);
    });
  };

  const runAutomation = async () => {
    setRunning(true);
    setCompletedLoops(0);

    for (let loop = 0; loop < loopCount; loop++) {
      setSteps(INITIAL_STEPS.map(s => ({ ...s, status: 'idle' })));
      setCurrentStep(0);

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
        token,
        amount,
        time: new Date().toLocaleTimeString('id-ID'),
      };
      setResults(prev => {
        const updated = [newResult, ...prev].slice(0, 50);
        saveResults(updated);
        return updated;
      });
      setCompletedLoops(loop + 1);

      if (loop < loopCount - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    setRunning(false);
  };

  const resetSteps = () => {
    setSteps(INITIAL_STEPS.map(s => ({ ...s, status: 'idle' })));
    setCurrentStep(0);
  };

  const clearResults = () => {
    setResults([]);
    if (workspaceId) localStorage.removeItem(`workspace_${workspaceId}_results`);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('activeWorkspace');
    router.replace('/');
  };

  if (!workspaceId) return null;

  const statusIcon = (status: StepStatus) => {
    if (status === 'done') return '✓';
    if (status === 'running') return '⟳';
    if (status === 'error') return '✕';
    return '○';
  };

  return (
    <>
      <Head>
        <title>Workspace – {workspaceId}</title>
      </Head>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.badge}>Workspace: {workspaceId}</div>
          <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>

        <h1 className={styles.title}>Plinks Automation</h1>
        <p className={styles.subtitle}>Otomatisasi flow pack opening di Farcaster Plinks miniapp.</p>

        <div className={styles.layout}>
          {/* Left: Config + Steps */}
          <div className={styles.left}>
            {/* Config */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Konfigurasi</h2>
              <div className={styles.formGroup}>
                <label className={styles.label}>PACK URL / MINIAPP</label>
                <input
                  className={styles.input}
                  type="text"
                  value={packUrl}
                  onChange={e => setPackUrl(e.target.value)}
                  placeholder="https://plinks.app"
                  disabled={running}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>JUMLAH LOOP</label>
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  max={100}
                  value={loopCount}
                  onChange={e => setLoopCount(Number(e.target.value))}
                  disabled={running}
                />
              </div>
              <div className={styles.btnRow}>
                <button
                  className={styles.btnRun}
                  onClick={runAutomation}
                  disabled={running}
                >
                  {running ? `Running... (${completedLoops}/${loopCount})` : '▶ Jalankan'}
                </button>
                <button
                  className={styles.btnReset}
                  onClick={resetSteps}
                  disabled={running}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Steps */}
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Step Progress</h2>
              <div className={styles.steps}>
                {steps.map((step, i) => (
                  <div
                    key={step.id}
                    className={`${styles.step} ${styles[step.status]}`}
                  >
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

          {/* Right: Results */}
          <div className={styles.right}>
            <div className={styles.card}>
              <div className={styles.resultsHeader}>
                <h2 className={styles.cardTitle}>Hasil Pull ({results.length})</h2>
                {results.length > 0 && (
                  <button className={styles.clearBtn} onClick={clearResults}>Hapus</button>
                )}
              </div>
              {results.length === 0 ? (
                <p className={styles.empty}>Belum ada hasil. Jalankan automation dulu.</p>
              ) : (
                <div className={styles.resultList}>
                  {results.map((r, i) => (
                    <div key={i} className={styles.resultItem}>
                      <div className={styles.resultToken}>+{r.amount} {r.token}</div>
                      <div className={styles.resultTime}>{r.time}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Workspace;
