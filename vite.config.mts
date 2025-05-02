import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 根据环境变量设置基础路径
  // 对于 Vercel 部署，使用 VITE_BASE_PATH 环境变量或默认为 "/"
  // 对于本地开发，默认使用 "/SuiQuora"
  const base = mode === "production" 
    ? (process.env.VITE_BASE_PATH || "/") 
    : "/SuiQuora";
    
  return {
    plugins: [react()],
    base
  };
});
