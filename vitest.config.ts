import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Les documents PDF sont écrits en JSX : sans le runtime automatique, esbuild produit du
  // `React.createElement` alors que les fichiers n'importent pas React, et le test échoue sur
  // « React is not defined » au lieu de tester ce qu'il vise.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/setup/global.ts"],
    // Tous les fichiers partagent le même atelier jetable et les mêmes compteurs de
    // numérotation : les exécuter en série rend les assertions déterministes.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    reporters: ["default"],
  },
});
