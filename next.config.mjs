/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep heavy/native deps out of the server bundle so Next doesn't try to trace them.
    serverComponentsExternalPackages: ["@prisma/client", "prisma", "playwright", "nodemailer"],
  },
};

export default nextConfig;
