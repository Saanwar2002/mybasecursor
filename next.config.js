/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    allowedDevOrigins: [
        // This needs to match the specific origin your Cloud Workstation preview uses.
        // The one from your logs: https://firebase-studio-1748687301287.cluster-ombtxv25tbd6yrjpp3lukp6zhc.cloudworkstations.dev
        // Assuming port 9004 is the target for the dev server, but the origin itself might not include the port if proxied.
        // Let's try the one from the deleted next.config.ts first as it had the port.
        "https://9004-firebase-studio-1748687301287.cluster-ombtxv25tbd6yrjpp3lukp6zhc.cloudworkstations.dev"
    ],
  },
};

module.exports = nextConfig;
