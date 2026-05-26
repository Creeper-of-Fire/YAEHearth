<script lang="ts" setup>
import {computed, provide} from 'vue'
import {usePanelStore} from './panel-store'
import {viewRegistry} from './registry'

const props = defineProps<{ panel: 'left' | 'center' | 'right' }>()
const store = usePanelStore()

const panelState = computed(() => store[props.panel])

const activeState = computed(() =>
    props.panel === 'center' && store.centerOverlay
        ? store.centerOverlay
        : panelState.value,
)

const currentComponent = computed(() => viewRegistry[activeState.value.view])

provide('panel-name', computed(() => props.panel))
</script>

<template>
  <component
      :is="currentComponent"
      :key="`${activeState.view}:${activeState.params.entityId ?? ''}`"
  />
</template>
