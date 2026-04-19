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

  // Step 1: Get nonce
  const nonceRes = await fetch(`${PLINKS_BASE}/api/auth/nonce`, {
    headers: await plinksHeaders(),
  });
  if (!nonceRes.ok) throw new Error(`Nonce gagal: HTTP ${nonceRes.status}`);
  const { nonce } = await nonceRes.json();
  if (!nonce) throw new Error('Nonce kosong dari Plinks');

  // Step 2: Sign message (SIWE-lite style)
  const message = `Sign in to Plinks\n\nNonce: ${nonce}`;
  const signature = await account.signMessage({ message });

  // Step 3: Verify — body MUST include address + nonce
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
  // Encode username as bytes for the second parameter
  const usernameBuf = Buffer.from(username, 'utf8');
  const userData = ('0x' + usernameBuf.toString('hex')) as `0x${string}`;

  const abi = parseAbi(['function openPack(string sessionId, bytes userData) external']);
  const encoded = encodeFunctionData({ abi, functionName: 'openPack', args: [sessionId, userData] });

  // Replace selector with actual Plinks selector 0x9a4d23d3
  return ('0x9a4d23d3' + encoded.slice(10)) as `0x${string}`;
}

async function tryGetPackFromApi(token: string, username: string): Promise<string | null> {
  const headers = await plinksHeaders(token);

  const candidates = [
    { url: `${PLINKS_BASE}/api/pack/free`, method: 'POST', body: JSON.stringify({ username }) },
    { url: `${PLINKS_BASE}/api/pack/session`, method: 'POST', body: JSON.stringify({ username }) },
    { url: `${PLINKS_BASE}/api/packs/free`, method: 'POST', body: JSON.stringify({}) },
    { url: `${PLINKS_BASE}/api/game/start`, method: 'POST', body: JSON.stringify({}) },
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
    // 1. Auth with Plinks  2. Get/generate session UUID  3. Send tx
    if (action === 'fullOpenPack') {
      const walletClient = createWalletClient({ account, chain: base, transport: http(BASE_RPC) });
      const uname = username || address.slice(0, 10);

      // Step A: Authenticate
      let authToken: string;
      let step = 'auth';
      try {
        const authResult = await plinksAuth(account);
        authToken = authResult.token;
      } catch (e: any) {
        return res.status(200).json({ success: false, address, step, error: `Auth gagal: ${e.message}` });
      }

      // Step B: Get pack session UUID from API, or generate one
      step = 'get_session';
      let packSessionId = sessionId as string | null;
      if (!packSessionId) {
        packSessionId = await tryGetPackFromApi(authToken, uname);
      }
      if (!packSessionId) {
        // Generate UUID client-side (Plinks may track via on-chain events)
        packSessionId = randomUUID();
      }

      // Step C: Estimate gas (validates the tx is likely to succeed)
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

      // Step D: Send the transaction
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
