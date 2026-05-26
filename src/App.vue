<script lang="ts" setup>
import type {GlobalThemeOverrides} from 'naive-ui'
import {darkTheme, NSpin} from 'naive-ui'
import Viewer from '@/features/shell/Viewer.vue'
import LogModal from '@/features/shell/LogModal.vue'
import {useContentStore} from '@/features/content/store'
import {onMounted, ref} from 'vue'

const contentStore = useContentStore()
const loading = ref(true)

onMounted(async () =>
{
  await contentStore.initialize()
  loading.value = false
})

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#6699cc',
    bodyColor: '#1e1e20',
    cardColor: '#19191a',
    borderColor: '#434347',
    textColor1: '#dddddd',
    textColor2: '#999999',
    textColor3: '#777777',
    inputColor: '#2a2a2a',
    placeholderColor: '#666666',
  },
  Menu: {
    color: '#19191a',
    itemTextColor: '#dddddd',
    itemTextColorActive: '#ffffff',
    itemColorActive: '#333333',
    borderRadius: '0px',
  },
  Input: {
    color: '#cccccc',
    textColor: '#111111',
  },
}
</script>

<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <div v-if="loading" class="loading-screen">
      <NSpin size="large"/>
      <span class="loading-text">正在加载内容...</span>
    </div>
    <div v-else class="app-layout">
      <Viewer class="panel-left" panel="left"/>
      <Viewer class="panel-center" panel="center"/>
      <Viewer class="panel-right" panel="right"/>
    </div>
    <LogModal/>
  </n-config-provider>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  overflow: hidden;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

.app-layout {
  display: grid;
  grid-template-columns: 280px 1fr 280px;
  grid-template-rows: 1fr;
  height: 100vh;
  background: #1e1e20;
}

.panel-left {
  background: #19191a;
  border-right: 1px solid #434347;
  overflow-y: auto;
}

.panel-center {
  overflow-y: auto;
}

.panel-right {
  background: #19191a;
  border-left: 1px solid #434347;
  overflow-y: auto;
}

.loading-screen {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.loading-text {
  color: #777777;
  font-size: 14px;
}
</style>