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
  serverExternalPackages: ["canvas"],
  experimental: {
    // serverActions: true, // Next 14 has this by default
  }
};

export default withPWA(withNextIntl(nextConfig));
