import type { NextApiRequest, NextApiResponse } from 'next';

type AuthResponse = {
  authUrl?: string;
  error?: string;
};

export default function handler(req: NextApiRequest, res: NextApiResponse<AuthResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body;

  if (action === 'initiate') {
    const farcasterApiUrl = process.env.NEXT_PUBLIC_FARCASTER_API_URL || 'https://api.farcaster.xyz';
    return res.status(200).json({ authUrl: `${farcasterApiUrl}/auth` });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
