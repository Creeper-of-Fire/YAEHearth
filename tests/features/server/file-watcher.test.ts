import {afterEach, describe, expect, it, vi, beforeEach} from 'vitest'
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {startWatcher, sseMiddleware} from '@/features/server/file-watcher'
import type {WatcherEvent} from '@/features/server/file-watcher'

describe('startWatcher', () =>
{
    let tmpDir: string
    let watcher: ReturnType<typeof startWatcher>

    beforeEach(() =>
    {
        tmpDir = mkdtempSync(join(tmpdir(), 'watcher-test-'))
    })

    afterEach(() =>
    {
        watcher?.close()
        rmSync(tmpDir, {recursive: true, force: true})
    })

    it('监听内容文件变化事件', async () =>
    {
        mkdirSync(join(tmpDir, 'characters'), {recursive: true})
        const filePath = join(tmpDir, 'characters', 'hero.chr')
        writeFileSync(filePath, '---\nname: 英雄\n---\n描述', 'utf-8')

        watcher = startWatcher(tmpDir)

        await new Promise(r => setTimeout(r, 1000))

        const events: WatcherEvent[] = []
        watcher.onEvent((e) => events.push(e))

        // 修改文件内容触发 change
        writeFileSync(filePath, '---\nname: 英雄V2\n---\n新描述', 'utf-8')

        await new Promise(r => setTimeout(r, 2000))

        expect(events.length).toBeGreaterThanOrEqual(1)
    })

    it('监听 system_prompts 目录的文件变化', async () =>
    {
        mkdirSync(join(tmpDir, 'system_prompts'), {recursive: true})
        const filePath = join(tmpDir, 'system_prompts', '[0001]规则.md')
        writeFileSync(filePath, '规则内容', 'utf-8')

        watcher = startWatcher(tmpDir)

        await new Promise(r => setTimeout(r, 1000))

        const events: WatcherEvent[] = []
        watcher.onEvent((e) => events.push(e))

        writeFileSync(filePath, '新规则内容', 'utf-8')

        await new Promise(r => setTimeout(r, 2000))

        expect(events.length).toBeGreaterThanOrEqual(1)
    })

    it('监听文件删除事件', async () =>
    {
        mkdirSync(join(tmpDir, 'characters'), {recursive: true})
        const filePath = join(tmpDir, 'characters', 'temp.chr')
        writeFileSync(filePath, '---\n---\n临时', 'utf-8')

        watcher = startWatcher(tmpDir)

        await new Promise(r => setTimeout(r, 1000))

        const events: WatcherEvent[] = []
        watcher.onEvent((e) => events.push(e))

        unlinkSync(filePath)

        await new Promise(r => setTimeout(r, 2000))

        const deleteEvent = events.find(e => e.action === 'delete')
        expect(deleteEvent).toBeDefined()
        expect(deleteEvent!.type).toBe('characters')
    })

    it('writeTimestamps 可用于防抖', () =>
    {
        watcher = startWatcher(tmpDir)
        const now = Date.now()
        watcher.writeTimestamps.set('/test.txt', now)

        expect(watcher.writeTimestamps.get('/test.txt')).toBe(now)
    })

    it('unsubscribe 移除监听', async () =>
    {
        mkdirSync(join(tmpDir, 'characters'), {recursive: true})
        const filePath = join(tmpDir, 'characters', 'test.chr')
        writeFileSync(filePath, '---\n---\n内容', 'utf-8')

        watcher = startWatcher(tmpDir)
        await new Promise(r => setTimeout(r, 1000))

        const events: WatcherEvent[] = []
        const unsub = watcher.onEvent((e) => events.push(e))
        unsub()

        writeFileSync(filePath, '---\n---\n更新', 'utf-8')

        await new Promise(r => setTimeout(r, 2000))

        expect(events).toHaveLength(0)
    })
})

describe('sseMiddleware', () =>
{
    it('设置 SSE 响应头', () =>
    {
        const mockWatcher = {
            writeTimestamps: new Map(),
            onEvent: vi.fn(() => () =>
            {
            }),
            close: vi.fn(),
        }

        const req = {
            on: vi.fn(),
        }
        const res = {
            writeHead: vi.fn(),
            write: vi.fn(),
            end: vi.fn(),
        }
        const middleware = sseMiddleware(mockWatcher as any)
        middleware(req as any, res as any)

        expect(res.writeHead).toHaveBeenCalledWith(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        })
    })

    it('事件触发时写入 SSE 数据', () =>
    {
        let capturedFn: Function | null = null
        const mockWatcher = {
            writeTimestamps: new Map(),
            onEvent: vi.fn((fn: Function) =>
            {
                capturedFn = fn
                return () =>
                {
                }
            }),
            close: vi.fn(),
        }

        const req = {
            on: vi.fn(),
        }
        const res = {
            writeHead: vi.fn(),
            write: vi.fn(),
            end: vi.fn(),
        }
        const middleware = sseMiddleware(mockWatcher as any)
        middleware(req as any, res as any)

        // 模拟事件
        capturedFn!({
            action: 'add',
            type: 'characters',
            id: 'hero',
        })

        expect(res.write).toHaveBeenCalledWith(
            `data: ${JSON.stringify({action: 'add', type: 'characters', id: 'hero'})}\n\n`,
        )
    })

    it('请求关闭时取消订阅', () =>
    {
        const unsub = vi.fn()
        const mockWatcher = {
            writeTimestamps: new Map(),
            onEvent: vi.fn(() => unsub),
            close: vi.fn(),
        }

        const req = {
            on: vi.fn(),
        }
        const res = {
            writeHead: vi.fn(),
            write: vi.fn(),
            end: vi.fn(),
        }
        const middleware = sseMiddleware(mockWatcher as any)
        middleware(req as any, res as any)

        // 模拟 req close 事件
        const closeCall = req.on.mock.calls.find((c: string[]) => c[0] === 'close')
        expect(closeCall).toBeDefined()
        closeCall[1]()
        expect(unsub).toHaveBeenCalled()
    })
})
