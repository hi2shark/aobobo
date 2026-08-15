import path from 'path';
import dotenv from 'dotenv';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import eslintPlugin from 'vite-plugin-eslint';
import packageJson from './package';
import { createAoboboDevProxy } from './vite.dev-proxy';

let proxy;
if (process.env.NODE_ENV === 'development') {
  dotenv.config({
    path: '.env.development.local',
  });
  proxy = createAoboboDevProxy(process.env);
}

// 读取版本号
process.env.VITE_APP_VERSION = process.env.VERSION || packageJson.version;

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: {
      overlay: false,
    },
    proxy,
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
  plugins: [
    vue(),
    eslintPlugin({
      include: ['src/**/*.js', 'src/**/*.vue', 'src/*.js', 'src/*.vue'],
    }),
  ],
  build: {
    assetsInlineLimit: 8192, // 8KB 以下的资源会被内联
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('echarts-gl') || id.includes('claygl')) {
              return 'detail-globe';
            }
            return 'vendor';
          }
          if (id.includes('src/data/world.geo.json')) {
            return 'world-geo';
          }
          if (id.includes('.svg')) {
            return 'svg';
          }
          return 'default';
        },
      },
    },
  },
  resolve: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src/'),
      },
      {
        find: '~@',
        replacement: path.resolve(__dirname, './src/'),
      },
    ],
  },
});
