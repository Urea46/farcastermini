import type { AppProps } from 'next/app';
import { AuthKitProvider } from '@farcaster/auth-kit';
import '@farcaster/auth-kit/styles.css';
import '@/styles/globals.css';

const config = {
  relay: 'https://relay.farcaster.xyz',
  rpcUrl: 'https://mainnet.optimism.io',
  domain: typeof window !== 'undefined' ? window.location.host : 'localhost',
  siweUri: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000',
};

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthKitProvider config={config}>
      <Component {...pageProps} />
    </AuthKitProvider>
  );
}
