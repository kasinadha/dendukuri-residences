/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep turbopack rooted at this project when parent dirs also have lockfiles.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
