/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  experimental: {
    allowedDevOrigins: [
        "https://9004-firebase-studio-1748687301287.cluster-ombtxv25tbd6yrjpp3lukp6zhc.cloudworkstations.dev"
    ],
  },
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
};

module.exports = nextConfig;
