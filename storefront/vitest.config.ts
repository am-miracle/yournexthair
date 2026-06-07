import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.unit.spec.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@lib": path.resolve(__dirname, "src/lib"),
      "@modules": path.resolve(__dirname, "src/modules"),
      "@": path.resolve(__dirname, "src"),
      hooks: path.resolve(__dirname, "src/hooks"),
    },
  },
})
