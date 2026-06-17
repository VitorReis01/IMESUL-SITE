/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [],
    unoptimized: true,
  },
  experimental: {
    optimizeCss: false,
  },
};

module.exports = nextConfig;
