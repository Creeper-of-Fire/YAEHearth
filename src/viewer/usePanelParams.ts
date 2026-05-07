import { inject, computed } from 'vue'
import { usePanelStore } from '@/stores/panel'
import type { ComputedRef } from 'vue'

export function usePanelParams() {
  const panelNameRef = inject<ComputedRef<'left' | 'center' | 'right'>>('panel-name')
  const store = usePanelStore()

  if (!panelNameRef) {
    throw new Error('usePanelParams() 必须在 <Viewer> 组件内调用')
  }

  const panelName = computed(() => panelNameRef.value)
  const params = computed(() => store[panelName.value].params as Readonly<Record<string, string>>)

  function navigate(view: string, extraParams?: Record<string, string>) {
    store.navigate(panelName.value, view, extraParams)
  }

  return { params, navigate, panelName }
}
