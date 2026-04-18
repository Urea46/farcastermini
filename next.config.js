/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    '*.replit.dev',
    '*.pike.replit.dev',
    '*.replit.app',
  ],
};

module.exports = nextConfig;
