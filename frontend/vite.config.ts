import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 开发时 /api 代理到 wrangler pages dev（8788）；构建产物为纯静态
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8788", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter(
          (d) =>
            !d.includes("vendor-antd") &&
            !d.includes("SettingsDrawer") &&
            !d.includes("IconLibraryModal") &&
            !d.includes("EditServiceModal") &&
            !d.includes("GroupModal") &&
            !d.includes("AntdShell"),
        ),
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("commonjsHelpers")) return "vendor-react";
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "vendor-react";
          if (/node_modules[\\/]@dnd-kit[\\/]/.test(id)) return "vendor-dnd";
          if (/node_modules[\\/]@iconify[\\/]/.test(id)) return "vendor-icons";
          if (/node_modules[\\/](antd|@ant-design|rc-[^\\/]+)[\\/]/.test(id)) return "vendor-antd";
        },
      },
    },
  },
});
