/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  // Keep turbopack rooted at this project when parent dirs also have lockfiles.
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      // Payment proofs, QR images, KYC docs, and up to 4 cleanliness photos.
      bodySizeLimit: "24mb",
    },
  },
};

export default nextConfig;
