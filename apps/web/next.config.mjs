import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// monorepo：从仓库根加载 .env，使 process.env 在构建/运行期可见。
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@aniradar/db", "@aniradar/shared", "@aniradar/config"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bullmq"],
  },
};

export default nextConfig;
