import type { NextApiRequest, NextApiResponse } from 'next';
import { createWalletClient, createPublicClient, http, encodeFunctionData, parseAbi } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { randomUUID } from 'crypto';

const BASE_RPC = 'https://mainnet.base.org';
const PLINKS_BASE = 'https://plinks.app';
const PLINKS_CONTRACT = '0x31505c6102e5945eddf0bd04e8330ab99796adc1' as `0x${string}`;

const publicClient = createPublicClient({ chain: base, transport: http(BASE_RPC) });

type ApiResponse = {
  success: boolean;
  address?: string;
  balanceEth?: string;
  txHash?: string;
  rewardTxHash?: string;
  sessionId?: string;
  token?: string;
  error?: string;
  network?: string;
  blockNumber?: string;
  gasEstimate?: string;
  step?: string;
  debug?: any;
};

async function plinksHeaders(token?: string) {
  const h: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    'Referer': 'https://plinks.app/',
    'Origin': 'https://plinks.app',
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function plinksAuth(account: ReturnType<typeof mnemonicToAccount>): Promise<{ token: string; user: any }> {
  const address = account.address;

  const nonceRes = await fetch(`${PLINKS_BASE}/api/auth/nonce`, {
    headers: await plinksHeaders(),
  });
  if (!nonceRes.ok) throw new Error(`Nonce gagal: HTTP ${nonceRes.status}`);
  const { nonce } = await nonceRes.json();
  if (!nonce) throw new Error('Nonce kosong dari Plinks');

  const message = `Sign in to Plinks\n\nNonce: ${nonce}`;
  const signature = await account.signMessage({ message });

  const verifyRes = await fetch(`${PLINKS_BASE}/api/auth/verify`, {
    method: 'POST',
    headers: await plinksHeaders(),
    body: JSON.stringify({ message, signature, address, nonce }),
  });

  const verifyText = await verifyRes.text();
  if (!verifyRes.ok) throw new Error(`Verify gagal: HTTP ${verifyRes.status} — ${verifyText.slice(0, 200)}`);

  const verifyData = JSON.parse(verifyText);
  if (!verifyData.token) throw new Error(`Token tidak diterima: ${verifyText.slice(0, 200)}`);

  return { token: verifyData.token, user: verifyData.user };
}

function buildPackCalldata(sessionId: string, username: string): `0x${string}` {
  const usernameBuf = Buffer.from(username, 'utf8');
  const userData = ('0x' + usernameBuf.toString('hex')) as `0x${string}`;

  const abi = parseAbi(['function openPack(string sessionId, bytes userData) external']);
  const encoded = encodeFunctionData({ abi, functionName: 'openPack', args: [sessionId, userData] });

  return ('0x9a4d23d3' + encoded.slice(10)) as `0x${string}`;
}

function buildRewardCalldata(
  sessionId: string,
  recipient: `0x${string}`,
  tokens: `0x${string}`[],
  amounts: bigint[],
  expiry: bigint,
  signature: `0x${string}`
): `0x${string}` {
  const abi = parseAbi([
    'function transferBallRewards(string sessionId, address recipient, address[] tokens, uint256[] amounts, uint256 expiry, bytes signature) external'
  ]);
  const encoded = encodeFunctionData({
    abi,
    functionName: 'transferBallRewards',
    args: [sessionId, recipient, tokens, amounts, expiry, signature],
  });
  // Replace selector with actual Plinks selector 0x62e89cdc
  return ('0x62e89cdc' + encoded.slice(10)) as `0x${string}`;
}

async function tryGetPackFromApi(token: string, username: string): Promise<string | null> {
  const headers = await plinksHeaders(token);

  const candidates = [
    { url: `${PLINKS_BASE}/api/pack/free`, method: 'POST', body: JSON.stringify({ username }) },
    { url: `${PLINKS_BASE}/api/pack/session`, method: 'POST', body: JSON.stringify({ username }) },
    { url: `${PLINKS_BASE}/api/packs/free`, method: 'POST', body: JSON.stringify({}) },
    { url: `${PLINKS_BASE}/api/pack/open`, method: 'POST', body: JSON.stringify({}) },
    { url: `${PLINKS_BASE}/api/user/packs`, method: 'GET' },
    { url: `${PLINKS_BASE}/api/packs`, method: 'GET' },
  ];

  for (const c of candidates) {
    try {
      const r = await fetch(c.url, { method: c.method, headers, ...(c.body ? { body: c.body } : {}) });
      if (r.status !== 404 && r.status !== 405) {
        const text = await r.text();
        const uuidMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (uuidMatch) return uuidMatch[0];
      }
    } catch { /* ignore */ }
  }
  return null;
}

async function gameResume(token: string, address: string): Promise<any> {
  const headers = await plinksHeaders(token);
  const r = await fetch(`${PLINKS_BASE}/api/game/resume?walletAddress=${address}`, {
    method: 'GET',
    headers,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`game/resume gagal: HTTP ${r.status} — ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function gameStart(token: string, sessionId: string): Promise<any> {
  const headers = await plinksHeaders(token);
  const r = await fetch(`${PLINKS_BASE}/api/game/${sessionId}/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`game/start gagal: HTTP ${r.status} — ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function gameDrop(token: string, sessionId: string, startData: any): Promise<any> {
  const headers = await plinksHeaders(token);

  // Build candidate bodies — use data from start response if available
  const slot = Math.floor(Math.random() * 9);
  const bodies: any[] = [
    {},
    { slot },
    { position: slot },
    { lane: slot },
  ];

  // If start returned specific fields, use them
  if (startData?.slot !== undefined) bodies.unshift({ slot: startData.slot });
  if (startData?.position !== undefined) bodies.unshift({ position: startData.position });
  if (startData?.ballData) bodies.unshift({ ballData: startData.ballData });
  if (startData?.gameData) bodies.unshift({ gameData: startData.gameData });

  let lastError = '';
  for (const body of bodies) {
    const r = await fetch(`${PLINKS_BASE}/api/game/${sessionId}/drop`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await r.text();
    if (r.ok) {
      try { return JSON.parse(text); } catch { return { raw: text }; }
    }
    lastError = `HTTP ${r.status} — ${text.slice(0, 300)}`;
    // If 400/422, the body format is wrong — keep trying other formats
    // If 401/403, stop trying (auth issue)
    if (r.status === 401 || r.status === 403) break;
  }
  throw new Error(`game/drop gagal: ${lastError}`);
}

function parseRewardData(data: any): {
  tokens: `0x${string}`[];
  amounts: bigint[];
  expiry: bigint;
  signature: `0x${string}`;
} | null {
  if (!data) return null;

  // The API response might nest data under various keys
  const d = data.data ?? data.reward ?? data.prize ?? data.result ?? data;

  const rawTokens: string[] = d.tokens ?? d.tokenAddresses ?? d.tokenContracts ?? [];
  const rawAmounts: string[] = d.amounts ?? d.tokenAmounts ?? d.values ?? [];
  const rawExpiry: string | number = d.expiry ?? d.expiresAt ?? d.deadline ?? d.exp ?? 0;
  const rawSig: string = d.signature ?? d.sig ?? d.proof ?? '';

  if (!rawTokens.length || !rawAmounts.length || !rawSig) return null;

  return {
    tokens: rawTokens.map(t => t as `0x${string}`),
    amounts: rawAmounts.map(a => BigInt(a)),
    expiry: BigInt(rawExpiry),
    signature: rawSig as `0x${string}`,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { action, seedPhrase, username, sessionId, token } = req.body;

  if (!seedPhrase || typeof seedPhrase !== 'string') {
    return res.status(400).json({ success: false, error: 'Seed phrase diperlukan' });
  }
  if (seedPhrase.trim().split(/\s+/).length < 12) {
    return res.status(400).json({ success: false, error: 'Seed phrase minimal 12 kata' });
  }

  try {
    const account = mnemonicToAccount(seedPhrase.trim());
    const address = account.address;

    // ── getWalletInfo ──────────────────────────────────────────
    if (action === 'getWalletInfo') {
      const [balanceWei, blockNumber] = await Promise.all([
        publicClient.getBalance({ address }),
        publicClient.getBlockNumber(),
      ]);
      return res.status(200).json({
        success: true, address,
        balanceEth: (Number(balanceWei) / 1e18).toFixed(6),
        network: 'Base Mainnet',
        blockNumber: blockNumber.toString(),
      });
    }

    // ── authenticate ───────────────────────────────────────────
    if (action === 'authenticate') {
      const { token: authToken, user } = await plinksAuth(account);
      return res.status(200).json({ success: true, token: authToken, address, debug: { user } });
    }

    // ── fullOpenPack ───────────────────────────────────────────
    if (action === 'fullOpenPack') {
      const walletClient = createWalletClient({ account, chain: base, transport: http(BASE_RPC) });
      const uname = username || address.slice(0, 10);

      let authToken: string;
      let step = 'auth';
      try {
        const authResult = await plinksAuth(account);
        authToken = authResult.token;
      } catch (e: any) {
        return res.status(200).json({ success: false, address, step, error: `Auth gagal: ${e.message}` });
      }

      step = 'get_session';
      let packSessionId = sessionId as string | null;
      if (!packSessionId) {
        packSessionId = await tryGetPackFromApi(authToken, uname);
      }
      if (!packSessionId) {
        packSessionId = randomUUID();
      }

      step = 'estimate_gas';
      const rawCalldata = buildPackCalldata(packSessionId, uname);
      let gasEstimate: bigint;
      try {
        gasEstimate = await publicClient.estimateGas({
          account: address, to: PLINKS_CONTRACT, data: rawCalldata,
        });
      } catch (e: any) {
        return res.status(200).json({
          success: false, address, step, sessionId: packSessionId, token: authToken,
          error: `Gas estimate gagal: ${e.message.slice(0, 150)}`,
        });
      }

      step = 'send_tx';
      const txHash = await walletClient.sendTransaction({
        to: PLINKS_CONTRACT, data: rawCalldata,
        gas: (gasEstimate * 12n) / 10n,
      });

      return res.status(200).json({
        success: true, txHash, address,
        sessionId: packSessionId, token: authToken,
        gasEstimate: gasEstimate.toString(),
      });
    }

    // ── claimReward ────────────────────────────────────────────
    // Flow: resume (get pending game) → start → drop → transferBallRewards TX
    if (action === 'claimReward') {
      const walletClient = createWalletClient({ account, chain: base, transport: http(BASE_RPC) });
      let step = 'auth';

      // Auth — use provided token or re-authenticate
      let authToken: string = token;
      if (!authToken) {
        try {
          const authResult = await plinksAuth(account);
          authToken = authResult.token;
        } catch (e: any) {
          return res.status(200).json({ success: false, address, step, error: `Auth gagal: ${e.message}` });
        }
      }

      // Step A: game/resume — get pending session for this wallet
      step = 'game_resume';
      let resumeData: any = null;
      let activeSessionId: string = sessionId;
      try {
        resumeData = await gameResume(authToken, address);
        // Extract session ID from resume response
        const fromResume =
          resumeData?.sessionId ??
          resumeData?.id ??
          resumeData?.gameId ??
          resumeData?.packSessionId ??
          resumeData?.session?.id ??
          resumeData?.game?.sessionId ??
          resumeData?.game?.id;

        if (fromResume) activeSessionId = fromResume;

        // Check if resume already returns reward data (direct claim path)
        const directReward = parseRewardData(resumeData);
        if (directReward && activeSessionId) {
          // resume returned full reward data — skip start/drop, go straight to TX
          const { tokens, amounts, expiry, signature: rewardSig } = directReward;
          step = 'send_reward_tx';
          const rewardCalldata = buildRewardCalldata(activeSessionId, address, tokens, amounts, expiry, rewardSig);
          let rewardGas: bigint;
          try {
            rewardGas = await publicClient.estimateGas({ account: address, to: PLINKS_CONTRACT, data: rewardCalldata });
          } catch (e: any) {
            return res.status(200).json({
              success: false, address, step, sessionId: activeSessionId,
              error: `Gas estimate gagal: ${e.message.slice(0, 200)}`,
              debug: { resumeData, directReward },
            });
          }
          const rewardTxHash = await walletClient.sendTransaction({
            to: PLINKS_CONTRACT, data: rewardCalldata, gas: (rewardGas * 12n) / 10n,
          });
          return res.status(200).json({
            success: true, rewardTxHash, address, sessionId: activeSessionId,
            debug: { tokens, amounts: amounts.map(a => a.toString()), expiry: expiry.toString(), resumeData },
          });
        }
      } catch (e: any) {
        // resume failing is non-fatal — fall back to provided sessionId
        resumeData = { error: e.message };
      }

      if (!activeSessionId) {
        return res.status(200).json({
          success: false, address, step: 'game_resume',
          error: 'Tidak ada sessionId — resume kosong dan tidak ada sessionId yang diberikan',
          debug: { resumeData },
        });
      }

      // Step B: game/start
      step = 'game_start';
      let startData: any;
      try {
        startData = await gameStart(authToken, activeSessionId);
      } catch (e: any) {
        return res.status(200).json({
          success: false, address, step, sessionId: activeSessionId,
          error: e.message, debug: { resumeData },
        });
      }

      // Step C: game/drop — get reward signing data from Plinks
      step = 'game_drop';
      let dropData: any;
      try {
        dropData = await gameDrop(authToken, activeSessionId, startData);
      } catch (e: any) {
        return res.status(200).json({
          success: false, address, step, sessionId: activeSessionId,
          error: e.message, debug: { startData, resumeData },
        });
      }

      // Step D: Parse reward data from drop response
      step = 'parse_reward';
      const rewardData = parseRewardData(dropData);
      if (!rewardData) {
        return res.status(200).json({
          success: false, address, step, sessionId: activeSessionId,
          error: 'Tidak dapat parse reward data dari response Plinks',
          debug: { dropData, startData, resumeData },
        });
      }

      const { tokens, amounts, expiry, signature: rewardSig } = rewardData;

      // Step E: Build + estimate + send transferBallRewards TX
      step = 'estimate_reward_gas';
      const rewardCalldata = buildRewardCalldata(activeSessionId, address, tokens, amounts, expiry, rewardSig);
      let rewardGas: bigint;
      try {
        rewardGas = await publicClient.estimateGas({
          account: address, to: PLINKS_CONTRACT, data: rewardCalldata,
        });
      } catch (e: any) {
        return res.status(200).json({
          success: false, address, step, sessionId: activeSessionId,
          error: `Gas estimate reward gagal: ${e.message.slice(0, 200)}`,
          debug: { rewardData, dropData, startData, resumeData },
        });
      }

      step = 'send_reward_tx';
      const rewardTxHash = await walletClient.sendTransaction({
        to: PLINKS_CONTRACT, data: rewardCalldata,
        gas: (rewardGas * 12n) / 10n,
      });

      return res.status(200).json({
        success: true, rewardTxHash, address, sessionId: activeSessionId,
        debug: {
          tokens,
          amounts: amounts.map(a => a.toString()),
          expiry: expiry.toString(),
          startData, dropData, resumeData,
        },
      });
    }

    // ── estimateGas (quick check) ──────────────────────────────
    if (action === 'estimateGas') {
      const balanceWei = await publicClient.getBalance({ address });
      const gasPrice = await publicClient.getGasPrice();
      const gasCostEth = (Number(gasPrice * 80000n) / 1e18).toFixed(8);
      return res.status(200).json({
        success: true, address,
        balanceEth: (Number(balanceWei) / 1e18).toFixed(6),
        gasEstimate: gasCostEth, network: 'Base Mainnet',
      });
    }

    return res.status(400).json({ success: false, error: 'Action tidak dikenali' });

  } catch (err: any) {
    const msg = err?.message || 'Unknown error';
    if (msg.toLowerCase().includes('mnemonic') || msg.includes('Invalid mnemonic')) {
      return res.status(400).json({ success: false, error: 'Seed phrase tidak valid' });
    }
    return res.status(500).json({ success: false, error: msg.slice(0, 300) });
  }
}
