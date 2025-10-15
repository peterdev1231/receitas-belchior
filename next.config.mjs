/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['yt-dlp-wrap'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'yt-dlp-wrap': 'commonjs yt-dlp-wrap',
      });
    }
    return config;
  },
};

export default nextConfig;

