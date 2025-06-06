
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    allowedDevOrigins: [
        "https://9004-firebase-studio-1748687301287.cluster-ombtxv25tbd6yrjpp3lukp6zhc.cloudworkstations.dev"
    ],
  },
};

export default nextConfig;
