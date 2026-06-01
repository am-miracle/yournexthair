import type { NextConfig } from "next"

import checkEnvVariables from "./check-env-variables"

checkEnvVariables()

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    staticGenerationRetryCount: 3,
    staticGenerationMaxConcurrency: 1,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "fashion-starter-demo.s3.eu-central-1.amazonaws.com",
      },
    ],
  },
}

export default nextConfig
