
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true, // Temporarily re-enable to see all errors
  },
  eslint: {
    ignoreDuringBuilds: true, // Temporarily re-enable to see all errors
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'unpkg.com',
        port: '',
        pathname: '/leaflet@*/dist/images/**',
      }
    ],
  },
  experimental: {
    allowedDevOrigins: [
      'https://9004-firebase-studio-1748687301287.cluster-ombtxv25tbd6yrjpp3lukp6zhc.cloudworkstations.dev',
      'https://studio.firebase.google.com'
    ],
  },
};

export default nextConfig;
