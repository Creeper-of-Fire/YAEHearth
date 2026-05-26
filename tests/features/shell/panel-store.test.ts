import {describe, expect, it, beforeEach} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {usePanelStore} from '@/features/shell/panel-store'

describe('usePanelStore', () =>
{
    beforeEach(() =>
    {
        setActivePinia(createPinia())
    })

    it('初始状态正确', () =>
    {
        const store = usePanelStore()
        expect(store.left.view).toBe('player')
        expect(store.center.view).toBe('scene')
        expect(store.right.view).toBe('char-list')
    })

    it('navigate 更新面板视图', () =>
    {
        const store = usePanelStore()
        store.navigate('left', 'char-detail', {id: 'npc1'})
        expect(store.left.view).toBe('char-detail')
        expect(store.left.params).toEqual({id: 'npc1'})
    })

    it('navigate 不带参数时 params 为空', () =>
    {
        const store = usePanelStore()
        store.navigate('center', 'scene')
        expect(store.center.view).toBe('scene')
        expect(store.center.params).toEqual({})
    })

    it('navigate 操作不同面板互不影响', () =>
    {
        const store = usePanelStore()
        store.navigate('left', 'scene')
        store.navigate('right', 'dialogue')

        expect(store.left.view).toBe('scene')
        expect(store.center.view).toBe('scene') // 未改变
        expect(store.right.view).toBe('dialogue')
    })
})
