import path from 'node:path'
import Vue from '@vitejs/plugin-vue'

import Unocss from 'unocss/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import topLevelAwait from 'vite-plugin-top-level-await'
import wasm from 'vite-plugin-wasm'

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // 根据需要调整，确保路径正确
  build: {
    outDir: 'dist_web', // 将构建输出到 dist_web 文件夹，以避免与 Electron 的 dist 混淆
    emptyOutDir: true, // 清空输出目录
  },
  server: {
    port: 3000,
    open: false, // 不自动打开浏览器
    host: true, // 允许局域网访问
  },
  define: {
    'process.env': {
    }, // 根据需要定义环境变量
  },
  resolve: {
    alias: {
      '~/': `${path.resolve(__dirname, 'src')}/`,
    },
  },

  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "~/styles/element/index.scss" as *;`,
        api: 'modern-compiler',
      },
    },
  },

  plugins: [
    Vue(),
    electron({
      entry: 'electron.main.js',
    }),

    // https://github.com/posva/unplugin-vue-router
    VueRouter({
      extensions: ['.vue', '.md'],
      dts: 'src/typed-router.d.ts',
    }),

    Components({
      // allow auto load markdown components under `./src/components/`
      extensions: ['vue', 'md'],
      // allow auto import and register components used in markdown
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      resolvers: [
        ElementPlusResolver({
          importStyle: 'sass',
        }),
      ],
      dts: 'src/components.d.ts',
    }),

    // https://github.com/antfu/unocss
    // see uno.config.ts for config
    Unocss(),
    // vite-wasm-plugin
    wasm(),
    topLevelAwait(),
  ],
  optimizeDeps: {
    exclude: [
      '@syntect/wasm',
    ],
  },
  ssr: {
    // TODO: workaround until they support native ESM
    noExternal: ['element-plus'],
  },
})
