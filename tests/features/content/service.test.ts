import {describe, expect, it, vi, beforeEach} from 'vitest'
import {ContentService} from '@/features/content/service'
import type {ContentEvent} from '@/shared/types'

// Mock global fetch and EventSource
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

class MockEventSource
{
    onmessage: ((event: {data: string}) => void) | null = null
    static instances: MockEventSource[] = []

    constructor(public url: string)
    {
        MockEventSource.instances.push(this)
    }

    close()
    {
        this.onmessage = null
    }

    simulateEvent(data: ContentEvent)
    {
        this.onmessage?.({data: JSON.stringify(data)})
    }
}

vi.stubGlobal('EventSource', MockEventSource)

describe('ContentService', () =>
{
    let service: ContentService

    beforeEach(() =>
    {
        service = new ContentService()
        mockFetch.mockReset()
        MockEventSource.instances.length = 0
    })

    describe('connect', () =>
    {
        it('加载所有类型并建立 SSE', async () =>
        {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(['characters', 'scenes']),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        {id: 'hero', type: 'characters', frontmatter: {}, body: '角色描述'},
                    ]),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        {id: 'tavern', type: 'scenes', frontmatter: {}, body: '场景描述'},
                    ]),
                })

            await service.connect()

            expect(service.ready).toBe(true)
            expect(service.get('characters', 'hero')).toBeDefined()
            expect(service.get('scenes', 'tavern')).toBeDefined()
            expect(MockEventSource.instances).toHaveLength(1)
        })

        it('fetch 失败时抛出错误', async () =>
        {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: () => Promise.resolve({error: 'Internal'}),
            })

            await expect(service.connect()).rejects.toThrow('Content API 500: Internal')
        })
    })

    describe('disconnect', () =>
    {
        it('关闭 SSE 连接', async () =>
        {
            mockFetch
                .mockResolvedValueOnce({ok: true, json: () => Promise.resolve([])})

            await service.connect()
            service.disconnect()

            expect(service.ready).toBe(false)
        })
    })

    describe('get / all / getByType', () =>
    {
        it('get 返回单个实体', async () =>
        {
            mockFetch
                .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(['characters'])})
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        {id: 'hero', type: 'characters', frontmatter: {name: '英雄'}, body: ''},
                    ]),
                })

            await service.connect()

            const entity = service.get('characters', 'hero')
            expect(entity?.id).toBe('hero')
            expect(service.get('characters', 'missing')).toBeUndefined()
        })

        it('all 返回所有实体', async () =>
        {
            mockFetch
                .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(['characters'])})
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        {id: 'a', type: 'characters', frontmatter: {}, body: ''},
                        {id: 'b', type: 'characters', frontmatter: {}, body: ''},
                    ]),
                })

            await service.connect()
            expect(service.all()).toHaveLength(2)
        })

        it('getByType 按类型筛选', async () =>
        {
            mockFetch
                .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(['characters', 'scenes'])})
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        {id: 'hero', type: 'characters', frontmatter: {}, body: ''},
                    ]),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        {id: 'tavern', type: 'scenes', frontmatter: {}, body: ''},
                    ]),
                })

            await service.connect()
            expect(service.getByType('characters')).toHaveLength(1)
            expect(service.getByType('scenes')).toHaveLength(1)
            expect(service.getByType('items')).toHaveLength(0)
        })
    })

    describe('SSE 事件处理', () =>
    {
        it('add 事件添加实体到缓存', async () =>
        {
            mockFetch
                .mockResolvedValueOnce({ok: true, json: () => Promise.resolve([])})

            await service.connect()

            const es = MockEventSource.instances[0]
            es.simulateEvent({
                action: 'add',
                type: 'characters',
                id: 'new-char',
                entity: {id: 'new-char', type: 'characters', frontmatter: {name: '新角色'}, body: ''},
            })

            expect(service.get('characters', 'new-char')?.frontmatter.name).toBe('新角色')
        })

        it('change 事件更新缓存', async () =>
        {
            mockFetch
                .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(['characters'])})
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        {id: 'hero', type: 'characters', frontmatter: {name: '英雄'}, body: ''},
                    ]),
                })

            await service.connect()

            const es = MockEventSource.instances[0]
            es.simulateEvent({
                action: 'change',
                type: 'characters',
                id: 'hero',
                entity: {id: 'hero', type: 'characters', frontmatter: {name: '更新英雄'}, body: '新内容'},
            })

            expect(service.get('characters', 'hero')?.frontmatter.name).toBe('更新英雄')
        })

        it('delete 事件移除缓存', async () =>
        {
            mockFetch
                .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(['characters'])})
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        {id: 'hero', type: 'characters', frontmatter: {}, body: ''},
                    ]),
                })

            await service.connect()

            const es = MockEventSource.instances[0]
            es.simulateEvent({
                action: 'delete',
                type: 'characters',
                id: 'hero',
            })

            expect(service.get('characters', 'hero')).toBeUndefined()
        })

        it('通知 listeners', async () =>
        {
            mockFetch
                .mockResolvedValueOnce({ok: true, json: () => Promise.resolve([])})

            await service.connect()

            const events: ContentEvent[] = []
            service.onChange((e) => events.push(e))

            const es = MockEventSource.instances[0]
            es.simulateEvent({action: 'add', type: 'characters', id: 'x'})

            expect(events).toHaveLength(1)
            expect(events[0].id).toBe('x')
        })

        it('unsubscribe 停止通知', async () =>
        {
            mockFetch
                .mockResolvedValueOnce({ok: true, json: () => Promise.resolve([])})

            await service.connect()

            const events: ContentEvent[] = []
            const unsub = service.onChange((e) => events.push(e))
            unsub()

            const es = MockEventSource.instances[0]
            es.simulateEvent({action: 'add', type: 'characters', id: 'x'})

            expect(events).toHaveLength(0)
        })
    })

    describe('updateFrontmatter', () =>
    {
        it('乐观更新并发送到后端', async () =>
        {
            mockFetch
                .mockResolvedValueOnce({ok: true, json: () => Promise.resolve(['characters'])})
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve([
                        {id: 'hero', type: 'characters', frontmatter: {name: '英雄', hp: 100}, body: ''},
                    ]),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(
                        {id: 'hero', type: 'characters', frontmatter: {name: '英雄', hp: 80}, body: ''},
                    ),
                })

            await service.connect()
            const result = await service.updateFrontmatter('characters', 'hero', {hp: 80})

            expect(result.frontmatter.hp).toBe(80)
            expect(mockFetch).toHaveBeenLastCalledWith(
                '/__content/characters/hero',
                expect.objectContaining({method: 'PATCH'}),
            )
        })

        it('实体不存在时抛出错误', async () =>
        {
            mockFetch
                .mockResolvedValueOnce({ok: true, json: () => Promise.resolve([])})

            await service.connect()

            await expect(service.updateFrontmatter('characters', 'missing', {}))
                .rejects.toThrow('Entity characters/missing not found')
        })
    })
})
