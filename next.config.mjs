/** @type {import('next').NextConfig} */
const nextConfig = { output: "standalone", poweredByHeader: false, serverExternalPackages: ["@google-cloud/firestore", "puppeteer-core"] };
export default nextConfig;
