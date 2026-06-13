<script lang="ts" setup>
import {
  Menu,
  Document,
  Microphone,
  Cpu,
  Monitor,
  Headset,
  Setting,
  Notebook,
} from '@element-plus/icons-vue'

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

    <el-menu-item index="/info">
      Info
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
      <a class="size-full flex items-center justify-center" href="https://gitee.com/slamkuntech/wascore" target="_blank">
        <svg class="w-5 h-5" viewBox="0 0 1024 1024" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M512 1024q-104 0-199-40-92-39-163-110T40 711Q0 616 0 512t40-199Q79 221 150 150T313 40q95-40 199-40t199 40q92 39 163 110t110 163q40 95 40 199t-40 199q-39 92-110 163T711 984q-95 40-199 40z m259-569H480q-10 0-17.5 7.5T455 480v64q0 10 7.5 17.5T480 569h177q11 0 18.5 7.5T683 594v13q0 31-22.5 53.5T607 683H367q-11 0-18.5-7.5T341 657V417q0-31 22.5-53.5T417 341h354q11 0 18-7t7-18v-63q0-11-7-18t-18-7H417q-38 0-72.5 14T283 283q-27 27-41 61.5T228 417v354q0 11 7 18t18 7h373q46 0 85.5-22.5t62-62Q796 672 796 626V480q0-10-7-17.5t-18-7.5z"/>
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
