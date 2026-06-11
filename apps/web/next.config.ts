import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Filesystems sem symlink (exFAT/drives de rede): evita readlink no webpack.
  // O patch completo de readlink fica em scripts/fs-readlink-patch.cjs.
  webpack: (config) => {
    config.resolve.symlinks = false;
    return config;
  },
};

export default nextConfig;
