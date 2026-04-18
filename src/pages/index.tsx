import type { NextPage } from 'next';
import Head from 'next/head';
import LoginButton from '@/components/LoginButton';

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>Farcaster Mini</title>
        <meta name="description" content="Farcaster Miniapp with Plinks integration" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <h1>Farcaster Mini</h1>
        <p>Secure, private, and reliable messaging with decentralized architecture.</p>
        <LoginButton />
      </main>
    </>
  );
};

export default Home;
