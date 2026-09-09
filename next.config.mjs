/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  // Keep turbopack rooted at this project when parent dirs also have lockfiles.
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      // Payment proofs, QR/KYC, and maintenance media (photos + short videos).
      bodySizeLimit: "64mb",
    },
  },
};

export default nextConfig;
