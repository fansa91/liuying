<template>
  <v-container style="max-width: 720px">
    <h2 class="text-h6 mb-4">设置</h2>

    <v-card variant="tonal" class="mb-4">
      <v-card-title class="text-subtitle-1">播放与加载</v-card-title>
      <v-card-text>
        <v-switch
          v-model="settings.proxyImage"
          label="图片经服务器代理加载"
          hint="海报图走 /api/proxy, 解决防盗链"
          persistent-hint
          color="primary"
        />
        <v-switch
          v-model="settings.proxyPlay"
          label="播放链接经服务器代理"
          hint="m3u8 及分片走 /api/proxy, 解决跨域 / 防盗链"
          persistent-hint
          color="primary"
        />
      </v-card-text>
    </v-card>

    <v-card variant="tonal">
      <v-card-title class="text-subtitle-1">外观</v-card-title>
      <v-card-text>
        <div class="text-body-2 mb-2">主题模式</div>
        <v-btn-toggle v-model="settings.themeMode" color="primary" mandatory class="mb-5">
          <v-btn value="light">浅色</v-btn>
          <v-btn value="dark">深色</v-btn>
          <v-btn value="system">跟随系统</v-btn>
        </v-btn-toggle>

        <div class="text-body-2 mb-3">主题色 (Material 3)</div>
        <div class="d-flex flex-wrap ga-3 align-center">
          <v-avatar
            v-for="c in presets"
            :key="c"
            :color="c"
            size="40"
            class="swatch"
            :class="{ active: settings.seedColor.toLowerCase() === c.toLowerCase() }"
            @click="settings.seedColor = c"
          />
          <label class="custom-color">
            <input type="color" v-model="settings.seedColor" />
            <span class="text-caption text-medium-emphasis mt-1">自定义</span>
          </label>
        </div>
        <div class="text-caption text-medium-emphasis mt-3">当前: {{ settings.seedColor }}</div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { settings } from '../settings'

const presets = ['#6750A4', '#0061A4', '#006A6A', '#2E6B00', '#8B4D00', '#984061', '#BA1A1A']
</script>

<style scoped>
.swatch {
  cursor: pointer;
  border: 2px solid transparent;
}
.swatch.active {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.custom-color {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}
.custom-color input {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  padding: 0;
  background: none;
  cursor: pointer;
}
.custom-color input::-webkit-color-swatch-wrapper {
  padding: 0;
}
.custom-color input::-webkit-color-swatch {
  border: none;
  border-radius: 50%;
}
</style>
