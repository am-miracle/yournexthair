import type { NextConfig } from "next"

import checkEnvVariables from "./check-env-variables"

checkEnvVariables()

const mediaUrl = process.env.S3_FILE_URL ? new URL(process.env.S3_FILE_URL) : null

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
      ...(mediaUrl
        ? [
            {
              protocol: mediaUrl.protocol === "http:" ? ("http" as const) : ("https" as const),
              hostname: mediaUrl.hostname,
            },
          ]
        : []),
    ],
  },
}

export default nextConfig
