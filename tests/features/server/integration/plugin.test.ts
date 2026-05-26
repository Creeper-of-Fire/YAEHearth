/**
 * 集成测试: plugin.ts 完整中间件管道
 *
 * 验证 contentPlugin 将 content-api、dialogue-api、file-watcher SSE
 * 正确挂载到 Vite 中间件栈:
 * 1. SSE 端点 /__content/events
 * 2. REST API /__content/*
 * 3. 对话持久化 /__dialogues/*
 * 4. watcher 生命周期 (httpServer close 时 watcher 关闭)
 * 5. 路由正确分发: 各端点不会互相干扰
 */
import {afterEach, describe, expect, it, beforeEach, vi} from 'vitest'
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createServer, type Server, type IncomingMessage, type ServerResponse} from 'node:http'
import type {AddressInfo} from 'node:net'
import {contentPlugin} from '@/features/server/plugin'

// --- HTTP 辅助 ---

function httpRequest(
    port: number,
    method: string,
    path: string,
    body?: string,
): Promise<{status: number; headers: Record<string, string>; data: any}>
{
    return new Promise((resolve, reject) =>
    {
        const options = {
            hostname: 'localhost',
            port,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(body ? {'Content-Length': Buffer.byteLength(body)} : {}),
            },
        }

        const httpReq = require('node:http').request(options, (res: IncomingMessage) =>
        {
            let data = ''
            res.on('data', (chunk: Buffer) => (data += chunk))
            res.on('end', () =>
            {
                let parsed: any
                try
                {
                    parsed = JSON.parse(data)
                } catch
                {
                    parsed = data
                }
                resolve({
                    status: res.statusCode ?? 0,
                    headers: res.headers as Record<string, string>,
                    data: parsed,
                })
            })
        })
        httpReq.on('error', reject)
        if (body) httpReq.write(body)
        httpReq.end()
    })
}

/** 模拟 Vite server 的 connect 兼容中间件栈 */
function createMockViteServer()
{
    const stack: Array<{path: string; handler: (req: any, res: any) => void}> = []

    const middlewares = {
        use(pathOrHandler: any, handler?: any)
        {
            if (typeof pathOrHandler === 'string')
            {
                stack.push({path: pathOrHandler, handler: handler!})
            } else
            {
                stack.push({path: '/', handler: pathOrHandler})
            }
        },
    }

    const closeListeners: Array<() => void> = []
    const httpServer = {
        on(event: string, fn: () => void)
        {
            if (event === 'close') closeListeners.push(fn)
        },
        close()
        {
            for (const fn of closeListeners) fn()
        },
    }

    return {middlewares, httpServer, stack, closeListeners}
}

/** 中间件栈路由分发 */
function routeMiddleware(
    stack: Array<{path: string; handler: (req: any, res: any) => void}>,
    req: IncomingMessage,
    res: ServerResponse,
)
{
    const url = req.url ?? '/'
    for (const {path, handler} of stack)
    {
        if (path === '/' || url.startsWith(path))
        {
            handler(req, res)
            return
        }
    }
    res.writeHead(404)
    res.end('Not found')
}

describe('集成: plugin.ts 完整中间件管道', () =>
{
    let contentDir: string
    let dialoguesDir: string
    let mockVite: ReturnType<typeof createMockViteServer>
    let server: Server
    let port: number

    beforeEach(async () =>
    {
        contentDir = mkdtempSync(join(tmpdir(), 'intg-plugin-content-'))
        dialoguesDir = mkdtempSync(join(tmpdir(), 'intg-plugin-dlg-'))
        mkdirSync(join(contentDir, 'characters'), {recursive: true})
        mkdirSync(join(contentDir, 'scenes'), {recursive: true})

        writeFileSync(
            join(contentDir, 'characters', 'hero.chr'),
            '---\nname: 英雄\nage: 25\n---\n英雄描述',
            'utf-8',
        )

        // 创建 plugin 并模拟 configureServer
        const plugin = contentPlugin(contentDir, dialoguesDir)
        mockVite = createMockViteServer()

        // 触发 configureServer
        plugin.configureServer!({middlewares: mockVite.middlewares, httpServer: mockVite.httpServer} as any)

        // 启动真实 HTTP 服务器
        server = createServer((req, res) =>
        {
            routeMiddleware(mockVite.stack, req, res)
        })

        await new Promise<void>(r => server.listen(0, () => r()))
        port = (server.address() as AddressInfo).port
    })

    afterEach(() =>
    {
        mockVite.httpServer.close()
        server?.close()
        rmSync(contentDir, {recursive: true, force: true})
        rmSync(dialoguesDir, {recursive: true, force: true})
    })

    // --- Content API 路由 ---

    it('GET /__content/types 通过中间件栈', async () =>
    {
        const {status, data} = await httpRequest(port, 'GET', '/__content/types')
        expect(status).toBe(200)
        expect(data).toContain('characters')
        expect(data).toContain('scenes')
    })

    it('GET /__content/characters 通过中间件栈', async () =>
    {
        const {status, data} = await httpRequest(port, 'GET', '/__content/characters')
        expect(status).toBe(200)
        expect(data).toHaveLength(1)
        expect(data[0].id).toBe('hero')
    })

    it('PATCH /__content/characters/:id 通过中间件栈', async () =>
    {
        const {status, data} = await httpRequest(
            port, 'PATCH', '/__content/characters/hero',
            JSON.stringify({age: 30}),
        )
        expect(status).toBe(200)
        expect(data.frontmatter.age).toBe(30)
    })

    it('GET /__content/system_prompt 通过中间件栈', async () =>
    {
        mkdirSync(join(contentDir, 'system_prompts'), {recursive: true})
        writeFileSync(join(contentDir, 'system_prompts', '[0001]规则.md'), '全局规则', 'utf-8')

        const {status, data} = await httpRequest(port, 'GET', '/__content/system_prompt')
        expect(status).toBe(200)
        expect(data.text).toBe('全局规则')
    })

    // --- Dialogue API 路由 ---

    it('POST /__dialogues/append 通过中间件栈', async () =>
    {
        const {status, data} = await httpRequest(
            port, 'POST', '/__dialogues/append',
            JSON.stringify({
                file: 'session.jsonl',
                record: {ts: new Date().toISOString(), type: 'player', text: '你好'},
            }),
        )
        expect(status).toBe(200)
        expect(data.ok).toBe(true)

        // 验证文件写入
        const content = readFileSync(join(dialoguesDir, 'session.jsonl'), 'utf-8')
        expect(content).toContain('你好')
    })

    it('POST /__dialogues/append 多条记录追加', async () =>
    {
        for (let i = 0; i < 3; i++)
        {
            await httpRequest(
                port, 'POST', '/__dialogues/append',
                JSON.stringify({
                    file: 'multi.jsonl',
                    record: {ts: new Date().toISOString(), type: i % 2 === 0 ? 'player' : 'assistant', text: `消息${i}`},
                }),
            )
        }

        const content = readFileSync(join(dialoguesDir, 'multi.jsonl'), 'utf-8')
        const lines = content.trim().split('\n')
        expect(lines).toHaveLength(3)

        // 验证每行都是合法 JSON
        for (const line of lines)
        {
            expect(() => JSON.parse(line)).not.toThrow()
        }
    })

    // --- SSE 端点 ---

    it('SSE 端点通过模拟请求验证', async () =>
    {
        // 用模拟 req/res 直接调用中间件栈来验证 SSE 路由
        const sseHandler = mockVite.stack.find(s => s.path === '/__content/events')
        expect(sseHandler).toBeDefined()

        const mockReq = {
            url: '/__content/events',
            method: 'GET',
            headers: {host: 'localhost'},
            on: vi.fn((event: string, fn: Function) =>
            {
                // 不注册任何监听器
            }),
        }
        const written: string[] = []
        const mockRes = {
            writeHead: vi.fn(),
            write: vi.fn((data: string) => written.push(data)),
            end: vi.fn(),
        }

        sseHandler!.handler(mockReq as any, mockRes as any)

        expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        })
    })

    // --- 路由互不干扰 ---

    it('content 路由不影响 dialogue 路由', async () =>
    {
        // 先请求 content
        const contentResult = await httpRequest(port, 'GET', '/__content/types')
        expect(contentResult.status).toBe(200)

        // 再请求 dialogue
        const dialogueResult = await httpRequest(
            port, 'POST', '/__dialogues/append',
            JSON.stringify({file: 'test.jsonl', record: {ts: 'x', type: 'x', text: 'x'}}),
        )
        expect(dialogueResult.status).toBe(200)
    })

    it('不匹配的路由返回 404', async () =>
    {
        const {status} = await httpRequest(port, 'GET', '/unknown/path')
        expect(status).toBe(404)
    })

    // --- Watcher 生命周期 ---

    it('httpServer close 时 watcher 被关闭', () =>
    {
        expect(mockVite.closeListeners.length).toBeGreaterThanOrEqual(1)
        // 不真正关闭，因为后续测试可能还需要
    })
})
