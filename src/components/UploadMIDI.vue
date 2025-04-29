<script setup lang="ts">
import { UploadFilled } from '@element-plus/icons-vue'
</script>

<template>
  <el-upload
    class="upload-demo"
    drag
    action="https://run.mocky.io/v3/9d059bf9-4660-45f2-925d-ce80ad6c4d15"
    multiple
  >
    <el-icon class="el-icon--upload">
      <UploadFilled />
    </el-icon>
    <div class="el-upload__text">
      Drop file here or <em>click to upload</em>
    </div>
    <template #tip>
      <div class="el-upload__tip">
        xml/midi files with a size less than 2500kb.
      </div>
    </template>
  </el-upload>
</template>
