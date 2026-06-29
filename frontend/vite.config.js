import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "");
  const frontendPort = Number(env.FRONTEND_PORT || 5173);
  const backendPort = env.BACKEND_PORT || env.PORT || 8080;
  const proxyTarget = env.VITE_BACKEND_PROXY_TARGET || env.BACKEND_PUBLIC_URL || `http://localhost:${backendPort}`;
  const useHttps = env.FRONTEND_HTTPS !== "false";

  const proxy = {
    "/api": {
      target: proxyTarget,
      changeOrigin: true,
      secure: false,
      rewrite: (path) => path.replace(/^\/api/, ""),
    },
    "/uploads": {
      target: proxyTarget,
      changeOrigin: true,
      secure: false,
    },
  };

  return {
    envDir: "..",
    plugins: [
      react(),
      useHttps ? basicSsl() : null,
    ].filter(Boolean),
    server: {
      host: env.FRONTEND_HOST || true,
      port: Number.isFinite(frontendPort) ? frontendPort : 5173,
      strictPort: true,
      https: useHttps,
      proxy,
    },
    preview: {
      host: env.FRONTEND_HOST || true,
      port: Number.isFinite(frontendPort) ? frontendPort : 5173,
      strictPort: true,
      https: useHttps,
      proxy,
    },
  };
})
