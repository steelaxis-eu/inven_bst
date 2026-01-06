import type { NextConfig } from "next";

import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["@napi-rs/canvas", "canvas"],
  transpilePackages: ["pdfjs-dist"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: '@napi-rs/canvas',
    }
    return config
  },
  experimental: {
    // serverActions: true, // Next 14 has this by default
  }
};

export default withPWA(withNextIntl(nextConfig));
