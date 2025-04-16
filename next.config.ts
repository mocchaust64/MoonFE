import { NextConfig } from "next";

const config: NextConfig = {
  async headers() {
    return [
      {
        // Áp dụng cho tất cả các routes
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
  
  // Thêm cấu hình để giải quyết vấn đề 404 với static assets
  reactStrictMode: true,
  output: 'standalone',
};

export default config;
