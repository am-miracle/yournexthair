import type { Config } from "jest"

import { loadEnv } from "@medusajs/utils"

loadEnv("test", process.cwd())

const config: Config = {
  transform: {
    "^.+\\.[jt]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
        },
      },
    ],
  },
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "json"],
  modulePathIgnorePatterns: ["dist/"],
}

if (process.env.TEST_TYPE === "integration:http") {
  config.testMatch = ["**/integration-tests/http/*.spec.[jt]s"]
} else if (process.env.TEST_TYPE === "integration:modules") {
  config.testMatch = ["**/src/modules/*/__tests__/**/*.[jt]s"]
} else if (process.env.TEST_TYPE === "unit") {
  config.testMatch = ["**/src/**/__tests__/**/*.unit.spec.[jt]s"]
}

export default config
