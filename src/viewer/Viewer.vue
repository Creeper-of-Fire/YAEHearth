<script lang="ts" setup>
import {computed, provide} from 'vue'
import {usePanelStore} from '@/stores/panel'
import {viewRegistry} from './registry'

const props = defineProps<{ panel: 'left' | 'center' | 'right' }>()
const store = usePanelStore()

const panelState = computed(() => store[props.panel])
const currentComponent = computed(() => viewRegistry[panelState.value.view])

provide('panel-name', computed(() => props.panel))
</script>

<template>
  <component
      :is="currentComponent"
      :key="`${panelState.view}:${panelState.params.characterId ?? ''}`"
  />
</template>
