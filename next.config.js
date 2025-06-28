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
  webpack: (config, { isServer }) => {
    // Suppress warnings about require.extensions and dynamic require usage
    config.ignoreWarnings = [
      {
        message: /require\.extensions is not supported by webpack/,
      },
      {
        message: /Critical dependency: the request of a dependency is an expression/,
      },
      {
        message: /Module not found: Can't resolve '@opentelemetry\/exporter-jaeger'/,
      },
      {
        message: /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
      },
    ];

    // Add fallbacks for Node.js modules that might be used in browser context
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
