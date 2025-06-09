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
    // Attempt to disable the default Next.js development service worker
    // by pointing it to a non-existent file.
    devSwSrc: '/intentionally-non-existent-service-worker.js',
  },
};

module.exports = nextConfig;
