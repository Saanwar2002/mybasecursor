/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Required for Firebase App Hosting and optimal containerization
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
