import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The local desktop preview uses the loopback IP as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
  env: {
    NEXT_PUBLIC_SITEAUDIT_LOCAL_KEY_SETUP:
      process.env.SITEAUDIT_LOCAL_KEY_SETUP === "1" ? "1" : "0",
  },
};

export default nextConfig;
