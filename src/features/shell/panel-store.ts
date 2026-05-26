import {defineStore} from 'pinia'
import {reactive, shallowRef} from 'vue'

export interface PanelState
{
    view: string
    params: Record<string, string>
}

export const usePanelStore = defineStore('panel', () =>
{
    const left = reactive<PanelState>({view: 'player', params: {}})
    const center = reactive<PanelState>({view: 'scene', params: {}})
    const centerOverlay = shallowRef<PanelState | null>(null)
    const right = reactive<PanelState>({view: 'char-list', params: {}})

    function navigate(panel: 'left' | 'center' | 'right', view: string, extraParams?: Record<string, string>)
    {
        const target = panel === 'left' ? left : panel === 'center' ? center : right
        target.view = view
        target.params = {...extraParams}
    }

    function showOverlay(view: string, extraParams?: Record<string, string>)
    {
        centerOverlay.value = {view, params: {...extraParams}}
    }

    function clearOverlay()
    {
        centerOverlay.value = null
    }

    return {left, center, centerOverlay, right, navigate, showOverlay, clearOverlay}
})
