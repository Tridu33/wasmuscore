<script lang="ts" setup>
import { toggleDark } from '~/composables'
</script>

<template>
  <el-menu class="el-menu-top" mode="horizontal" :ellipsis="false" router>
    <el-menu-item index="/">
      <div class="flex items-center justify-center gap-2">
        <div class="text-xl">
          <img src="../../assets/logo.png" class="logo">
        </div>
        <span>Wascore</span>
      </div>
    </el-menu-item>

    <el-sub-menu index="more">
      <template #title>
        More
      </template>
      <el-menu-item index="/wasm-test">
        ⚙️ WASM 引擎
      </el-menu-item>
      <el-menu-item index="/webgpu-test">
        🖥️ WebGPU
      </el-menu-item>
      <el-menu-item index="/audio-test">
        🔊 音频测试
      </el-menu-item>
    </el-sub-menu>

    <el-menu-item h="full" @click="toggleDark()">
      <button
        class="w-full cursor-pointer border-none bg-transparent flex items-center justify-center"
        style="height: var(--ep-menu-item-height)"
      >
        <i inline-flex i="dark:ep-moon ep-sunny" />
      </button>
    </el-menu-item>

    <el-menu-item h="full">
      <a class="size-full flex items-center justify-center" href="https://github.com/Tridu33/wasmuscore" target="_blank">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.337-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
        </svg>
      </a>
    </el-menu-item>
  </el-menu>
</template>

<style lang="scss">
.el-menu-top {
  height: 42px;

  .logo {
    width: 18px;
    height: 18px;
    line-height: 20px;
    margin-bottom: 5px;
  }
}
</style>
