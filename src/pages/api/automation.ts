import type { NextApiRequest, NextApiResponse } from 'next';
import { createWalletClient, createPublicClient, http, parseEther, encodeFunctionData, parseAbi } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const BASE_RPC = 'https://mainnet.base.org';

const PLINKS_CONTRACT = '0x31505c6102e5945eddf0bd04e8330ab99796adc1' as `0x${string}`;

const publicClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC),
});

type ApiResponse = {
  success: boolean;
  address?: string;
  balance?: string;
  balanceEth?: string;
  txHash?: string;
  gasEstimate?: string;
  error?: string;
  network?: string;
  blockNumber?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { action, seedPhrase, username, sessionId } = req.body;

  if (!seedPhrase || typeof seedPhrase !== 'string') {
    return res.status(400).json({ success: false, error: 'Seed phrase diperlukan' });
  }

  const words = seedPhrase.trim().split(/\s+/);
  if (words.length < 12) {
    return res.status(400).json({ success: false, error: 'Seed phrase minimal 12 kata' });
  }

  try {
    const account = mnemonicToAccount(seedPhrase.trim());
    const address = account.address;

    // --- getWalletInfo ---
    if (action === 'getWalletInfo') {
      const [balanceWei, blockNumber] = await Promise.all([
        publicClient.getBalance({ address }),
        publicClient.getBlockNumber(),
      ]);

      const balanceEth = (Number(balanceWei) / 1e18).toFixed(6);

      return res.status(200).json({
        success: true,
        address,
        balanceEth,
        balance: balanceWei.toString(),
        network: 'Base Mainnet',
        blockNumber: blockNumber.toString(),
      });
    }

    // --- sendFreePack ---
    if (action === 'sendFreePack') {
      if (!sessionId || !username) {
        return res.status(400).json({ success: false, error: 'sessionId dan username diperlukan' });
      }

      const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http(BASE_RPC),
      });

      // Encode calldata: function 0x9a4d23d3(string sessionId, bytes userData)
      const usernameBuf = Buffer.from(username, 'utf8');
      const userData = ('0x' + usernameBuf.toString('hex')) as `0x${string}`;

      const abi = parseAbi(['function openPack(string sessionId, bytes userData) external']);
      const data = encodeFunctionData({
        abi,
        functionName: 'openPack',
        args: [sessionId, userData],
      });

      // Use the actual selector 0x9a4d23d3 directly since function name is unknown
      const rawCalldata = ('0x9a4d23d3' + data.slice(10)) as `0x${string}`;

      const gasEstimate = await publicClient.estimateGas({
        account: address,
        to: PLINKS_CONTRACT,
        data: rawCalldata,
      });

      const txHash = await walletClient.sendTransaction({
        to: PLINKS_CONTRACT,
        data: rawCalldata,
        gas: (gasEstimate * 12n) / 10n, // +20% buffer
      });

      return res.status(200).json({
        success: true,
        txHash,
        address,
        gasEstimate: gasEstimate.toString(),
      });
    }

    // --- estimateGas ---
    if (action === 'estimateGas') {
      const balanceWei = await publicClient.getBalance({ address });
      const balanceEth = (Number(balanceWei) / 1e18).toFixed(6);

      const gasPrice = await publicClient.getGasPrice();
      const estimatedGas = 80000n;
      const gasCostWei = gasPrice * estimatedGas;
      const gasCostEth = (Number(gasCostWei) / 1e18).toFixed(8);

      return res.status(200).json({
        success: true,
        address,
        balanceEth,
        gasEstimate: gasCostEth,
        network: 'Base Mainnet',
      });
    }

    return res.status(400).json({ success: false, error: 'Action tidak dikenali' });

  } catch (err: any) {
    const msg = err?.message || 'Unknown error';
    if (msg.includes('Invalid mnemonic') || msg.includes('mnemonic')) {
      return res.status(400).json({ success: false, error: 'Seed phrase tidak valid' });
    }
    return res.status(500).json({ success: false, error: msg });
  }
}
