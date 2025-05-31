import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
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
    // If you are accessing your development server via a cloudworkstations.dev URL (or similar proxy),
    // ensure the EXACT origin URL you are using in your browser is listed here.
    // These URLs can sometimes be dynamic. If your URL changes, you'll need to update this list
    // and restart your development server.
    // Example: 'https://YOUR_NEW_PORT-YOUR_SERVICE-YOUR_HASH.REGION.cloudworkstations.dev'
    // For example, if your server now runs on port 9004, the URL might look like:
    // 'https://9004-firebase-studio-1748687301287.cluster-ombtxv25tbd6yrjpp3lukp6zhc.cloudworkstations.dev'
    allowedDevOrigins: ['https://9004-firebase-studio-1748687301287.cluster-ombtxv25tbd6yrjpp3lukp6zhc.cloudworkstations.dev'],
  },
};

export default nextConfig;
