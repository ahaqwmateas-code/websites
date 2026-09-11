/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow preview proxy hosts (Arena / e2b) — don't block iframe preview
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
