
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
    // If you are accessing your development server via a proxy (like Google Cloud Workstations or Firebase Studio),
    // ensure the EXACT origin URL you are using in your browser is listed here.
    // The origin is the scheme (e.g., "https") + hostname (e.g., "example.com") + port (if not default).
    // This URL MUST EXACTLY MATCH the origin shown in any "Blocked cross-origin request" errors.
    // These URLs can sometimes be dynamic or change. If your URL changes, you'll need to update this list
    // and restart your development server.
    //
    // Example if your browser URL is 'https://YOUR_PORT-YOUR_SERVICE-YOUR_HASH.REGION.cloudworkstations.dev/some/path':
    // allowedDevOrigins: ['https://YOUR_PORT-YOUR_SERVICE-YOUR_HASH.REGION.cloudworkstations.dev']
    //
    // Example if your browser URL is 'https://studio.firebase.google.com/some/path':
    // allowedDevOrigins: ['https://studio.firebase.google.com']

    allowedDevOrigins: [
      // This URL is taken from the error message in your terminal (from the screenshot).
      'https://9004-firebase-studio-1748687301287.cluster-ombtxv25tbd6yrjpp3lukp6zhc.cloudworkstations.dev',
      // This URL is from your browser's address bar.
      'https://studio.firebase.google.com'
    ],
  },
};

export default nextConfig;
