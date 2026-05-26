import {describe, expect, it, beforeEach, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import type {ContentEntity} from '@/shared/types'

// Create a shared mock instance so tests can control return values
const mockServiceInstance = {
    all: vi.fn().mockReturnValue([]),
    connect: vi.fn().mockResolvedValue(undefined),
    onChange: vi.fn(),
    get: vi.fn(),
    getByType: vi.fn().mockReturnValue([]),
    updateFrontmatter: vi.fn(),
}

vi.mock('@/features/content/service', () =>
{
    return {
        ContentService: class
        {
            all = mockServiceInstance.all
            connect = mockServiceInstance.connect
            onChange = mockServiceInstance.onChange
            get = mockServiceInstance.get
            getByType = mockServiceInstance.getByType
            updateFrontmatter = mockServiceInstance.updateFrontmatter
        },
    }
})

import {useContentStore} from '@/features/content/store'

describe('useContentStore', () =>
{
    let store: ReturnType<typeof useContentStore>

    beforeEach(() =>
    {
        vi.clearAllMocks()
        mockServiceInstance.all.mockReturnValue([])
        setActivePinia(createPinia())
        store = useContentStore()
    })

    it('初始 ready 为 false', () =>
    {
        expect(store.ready).toBe(false)
    })

    it('getEntity 从 entities map 查找', () =>
    {
        const entity: ContentEntity = {
            id: 'hero',
            type: 'characters',
            frontmatter: {},
            body: '',
        }
        store.entities.set('characters/hero', entity)

        expect(store.getEntity('characters', 'hero')).toEqual(entity)
        expect(store.getEntity('characters', 'missing')).toBeUndefined()
    })

    it('characters 计算属性过滤 characters 类型', () =>
    {
        store.entities.set('characters/hero', {
            id: 'hero', type: 'characters', frontmatter: {}, body: '',
        })
        store.entities.set('scenes/tavern', {
            id: 'tavern', type: 'scenes', frontmatter: {}, body: '',
        })

        expect(store.characters).toHaveLength(1)
        expect(store.characters[0].id).toBe('hero')
    })

    it('scenes 计算属性过滤 scenes 类型', () =>
    {
        store.entities.set('scenes/tavern', {
            id: 'tavern', type: 'scenes', frontmatter: {}, body: '',
        })
        store.entities.set('scenes/forest', {
            id: 'forest', type: 'scenes', frontmatter: {}, body: '',
        })

        expect(store.scenes).toHaveLength(2)
    })

    it('items 计算属性过滤 items 类型', () =>
    {
        store.entities.set('items/sword', {
            id: 'sword', type: 'items', frontmatter: {}, body: '',
        })

        expect(store.items).toHaveLength(1)
    })

    it('allOfType 按类型返回', () =>
    {
        store.entities.set('characters/a', {id: 'a', type: 'characters', frontmatter: {}, body: ''})
        store.entities.set('characters/b', {id: 'b', type: 'characters', frontmatter: {}, body: ''})
        store.entities.set('scenes/c', {id: 'c', type: 'scenes', frontmatter: {}, body: ''})

        expect(store.allOfType('characters')).toHaveLength(2)
    })

    it('initialize 同步 entities 并设置 ready', async () =>
    {
        const entities: ContentEntity[] = [
            {id: 'hero', type: 'characters', frontmatter: {name: '英雄'}, body: '描述'},
            {id: 'tavern', type: 'scenes', frontmatter: {}, body: '场景'},
        ]
        mockServiceInstance.all.mockReturnValue(entities)

        await store.initialize()

        expect(store.ready).toBe(true)
        expect(store.getEntity('characters', 'hero')).toBeDefined()
        expect(store.getEntity('scenes', 'tavern')).toBeDefined()
        expect(mockServiceInstance.onChange).toHaveBeenCalled()
        expect(mockServiceInstance.connect).toHaveBeenCalled()
    })

    it('updateFrontmatter 更新缓存中的实体', async () =>
    {
        store.entities.set('characters/hero', {
            id: 'hero', type: 'characters', frontmatter: {name: '旧名'}, body: '',
        })

        const updated: ContentEntity = {
            id: 'hero', type: 'characters', frontmatter: {name: '新名'}, body: '',
        }
        mockServiceInstance.updateFrontmatter.mockResolvedValue(updated)

        await store.updateFrontmatter('characters', 'hero', {name: '新名'})

        expect(mockServiceInstance.updateFrontmatter).toHaveBeenCalledWith('characters', 'hero', {name: '新名'})
        expect(store.getEntity('characters', 'hero')?.frontmatter.name).toBe('新名')
    })
})
