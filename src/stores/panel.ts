import {defineStore} from 'pinia'
import {reactive} from 'vue'

export interface PanelState
{
    view: string
    params: Record<string, string>
}

export const usePanelStore = defineStore('panel', () =>
{
    const left = reactive<PanelState>({view: 'player', params: {}})
    const center = reactive<PanelState>({view: 'scene', params: {}})
    const right = reactive<PanelState>({view: 'char-list', params: {}})

    function navigate(panel: 'left' | 'center' | 'right', view: string, extraParams?: Record<string, string>)
    {
        const target = panel === 'left' ? left : panel === 'center' ? center : right
        target.view = view
        target.params = {...extraParams}
    }

    return {left, center, right, navigate}
})
