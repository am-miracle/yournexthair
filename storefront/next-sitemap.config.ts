import type { IConfig } from "next-sitemap"

const excludedPaths = ["/checkout", "/account/*"]

const config: IConfig = {
  siteUrl: process.env.NEXT_PUBLIC_VERCEL_URL ?? "http://localhost:8000",
  generateRobotsTxt: true,
  exclude: [...excludedPaths, "/[sitemap]"],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
      },
      {
        userAgent: "*",
        disallow: excludedPaths,
      },
    ],
  },
}

export default config
