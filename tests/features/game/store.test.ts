import {describe, expect, it, beforeEach, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {useGameStore} from '@/features/game/store'
import {useContentStore} from '@/features/content/store'

// Mock ContentStore 的 entities
vi.mock('@/features/content/store', () => ({
    useContentStore: vi.fn(),
}))

function mockContentStore(entities: Array<{id: string; type: string; frontmatter: any; body: string}>)
{
    const map = new Map<string, any>()
    for (const e of entities)
    {
        map.set(`${e.type}/${e.id}`, e)
    }
    ;(useContentStore as ReturnType<typeof vi.fn>).mockReturnValue({
        getEntity: (type: string, id: string) => map.get(`${type}/${id}`),
    })
}

describe('useGameStore', () =>
{
    beforeEach(() =>
    {
        setActivePinia(createPinia())
    })

    it('默认 activeSceneId 为 tavern-night', () =>
    {
        mockContentStore([])
        const store = useGameStore()
        expect(store.activeSceneId).toBe('tavern-night')
    })

    it('activeScene 返回对应场景实体', () =>
    {
        const scene = {id: 'tavern-night', type: 'scenes', frontmatter: {characters: ['player']}, body: '酒馆场景'}
        mockContentStore([scene])
        const store = useGameStore()
        expect(store.activeScene).toEqual(scene)
    })

    it('characterIds 从场景 frontmatter 获取', () =>
    {
        const scene = {
            id: 'tavern-night',
            type: 'scenes',
            frontmatter: {characters: ['player', 'npc1']},
            body: '',
        }
        mockContentStore([scene])
        const store = useGameStore()
        expect(store.characterIds).toEqual(['player', 'npc1'])
    })

    it('characters 返回实际角色实体', () =>
    {
        const scene = {
            id: 'tavern-night',
            type: 'scenes',
            frontmatter: {characters: ['player', 'npc1']},
            body: '',
        }
        const player = {id: 'player', type: 'characters', frontmatter: {name: '玩家'}, body: ''}
        const npc = {id: 'npc1', type: 'characters', frontmatter: {name: 'NPC'}, body: ''}
        mockContentStore([scene, player, npc])
        const store = useGameStore()
        expect(store.characters).toHaveLength(2)
    })

    it('characters 过滤掉不存在的 id', () =>
    {
        const scene = {
            id: 'tavern-night',
            type: 'scenes',
            frontmatter: {characters: ['player', 'missing']},
            body: '',
        }
        const player = {id: 'player', type: 'characters', frontmatter: {name: '玩家'}, body: ''}
        mockContentStore([scene, player])
        const store = useGameStore()
        expect(store.characters).toHaveLength(1)
    })

    it('player 返回玩家角色实体', () =>
    {
        const player = {id: 'player', type: 'characters', frontmatter: {name: '玩家'}, body: ''}
        mockContentStore([player])
        const store = useGameStore()
        expect(store.player).toEqual(player)
    })

    it('characterIds 在无场景时返回空数组', () =>
    {
        // 不提供任何场景实体，activeScene 为 undefined
        mockContentStore([])
        const store = useGameStore()
        expect(store.characterIds).toEqual([])
    })

    it('resetScene 重置为默认场景', () =>
    {
        mockContentStore([])
        const store = useGameStore()
        store.activeSceneId = 'other-scene'
        store.resetScene()
        expect(store.activeSceneId).toBe('tavern-night')
    })
})
