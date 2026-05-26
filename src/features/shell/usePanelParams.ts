import type {ComputedRef, InjectionKey} from 'vue'
import {computed, inject} from 'vue'
import {usePanelStore} from './panel-store'

export const panelNameKey: InjectionKey<ComputedRef<'left' | 'center' | 'right'>> = Symbol('panel-name')

export function usePanelParams()
{
    const panelName = inject(panelNameKey)
    const store = usePanelStore()

    if (!panelName)
    {
        throw new Error('usePanelParams() 必须在 <Viewer> 组件内调用')
    }

    const params = computed(() =>
    {
        if (panelName.value === 'center' && store.centerOverlay)
        {
            return store.centerOverlay.params as Readonly<Record<string, string>>
        }
        return store[panelName.value].params as Readonly<Record<string, string>>
    })

    function navigate(view: string, extraParams?: Record<string, string>)
    {
        store.navigate(panelName.value, view, extraParams)
    }

    return {params, navigate, panelName}
}
