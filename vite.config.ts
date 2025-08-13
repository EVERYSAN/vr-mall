import { defineConfig } from "vite";

export default defineConfig({
  base: "/vr-mall/",            // ← リポジトリ名に合わせる
  optimizeDeps: { include: ["lil-gui"] } // 任意：安定化
});
