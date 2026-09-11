/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  // Keep turbopack rooted at this project when parent dirs also have lockfiles.
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      // Public pay / tenant pay may attach screenshots up to 5 MB.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
