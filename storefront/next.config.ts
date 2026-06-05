import type { NextConfig } from "next"

import checkEnvVariables from "./check-env-variables"

checkEnvVariables()

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    staticGenerationRetryCount: 3,
  },
  images: {
    qualities: [50, 75, 90],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "fashion-starter-demo.s3.eu-central-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "pub-213ee652e10844f0a352f876ae9467eb.r2.dev",
      },
    ],
  },
}

export default nextConfig
