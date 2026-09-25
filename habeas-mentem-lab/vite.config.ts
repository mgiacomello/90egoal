/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // "./" per l'artifact e per Vercel con root propria; LAB_BASE=/lab/ quando il sito principale lo serve da /lab.
  base: process.env.LAB_BASE ?? "./",
  server: { port: 5173 },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
