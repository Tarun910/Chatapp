/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'winston', 'bcryptjs'],
  },
  reactStrictMode: true,
};

export default nextConfig;

