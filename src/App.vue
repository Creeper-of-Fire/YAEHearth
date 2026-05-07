<script setup lang="ts">
import { darkTheme } from 'naive-ui'
import type { GlobalThemeOverrides } from 'naive-ui'
import Viewer from '@/viewer/Viewer.vue'
import LogModal from './components/LogModal.vue'

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
    <div class="app-layout">
      <Viewer panel="left" class="panel-left" />
      <Viewer panel="center" class="panel-center" />
      <Viewer panel="right" class="panel-right" />
    </div>
    <LogModal />
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
  height: 100vh;
  background: #1e1e20;
}

.panel-left {
  background: #19191a;
  border-right: 1px solid #434347;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-center {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-right {
  background: #19191a;
  border-left: 1px solid #434347;
  overflow-y: auto;
  height: 100%;
}
</style>