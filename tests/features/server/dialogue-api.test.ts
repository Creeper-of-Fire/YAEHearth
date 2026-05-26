import {afterEach, describe, expect, it, beforeEach, vi} from 'vitest'
import {mkdtempSync, rmSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {dialogueApiMiddleware} from '@/features/server/dialogue-api'

function mockRequest(url: string, method = 'GET', body?: string)
{
    const req: any = {
        method,
        url,
        headers: {host: 'localhost'},
        on: vi.fn(),
    }

    if (body)
    {
        req.on = vi.fn((event: string, fn: Function) =>
        {
            if (event === 'data') fn(Buffer.from(body))
            if (event === 'end') fn()
        })
    } else
    {
        req.on = vi.fn((event: string, fn: Function) =>
        {
            if (event === 'end') fn()
        })
    }

    return req
}

function mockResponse()
{
    const res: any = {
        writeHead: vi.fn(),
        end: vi.fn(),
        _getData(): any
        {
            const calls = this.end.mock.calls
            if (calls.length > 0)
            {
                try
                {
                    return JSON.parse(calls[0][0])
                } catch
                {
                    return calls[0][0]
                }
            }
            return null
        },
        _getStatus(): number
        {
            const calls = this.writeHead.mock.calls
            return calls.length > 0 ? calls[0][0] : 0
        },
    }
    return res
}

describe('dialogueApiMiddleware', () =>
{
    let tmpDir: string
    let middleware: ReturnType<typeof dialogueApiMiddleware>

    beforeEach(() =>
    {
        tmpDir = mkdtempSync(join(tmpdir(), 'dialogue-test-'))
        middleware = dialogueApiMiddleware(tmpDir)
    })

    afterEach(() =>
    {
        rmSync(tmpDir, {recursive: true, force: true})
    })

    it('POST /append 追加记录到 jsonl 文件', async () =>
    {
        const record = {ts: '2024-01-01T00:00:00Z', type: 'player', text: '你好'}
        const req = mockRequest('/__dialogues/append', 'POST', JSON.stringify({
            file: 'test.jsonl',
            record,
        }))
        const res = mockResponse()
        await middleware(req as any, res as any)

        expect(res._getStatus()).toBe(200)

        const content = readFileSync(join(tmpDir, 'test.jsonl'), 'utf-8')
        expect(content).toContain('你好')
    })

    it('POST /append 追加多条记录', async () =>
    {
        const file = 'multi.jsonl'

        for (let i = 0; i < 3; i++)
        {
            const req = mockRequest('/__dialogues/append', 'POST', JSON.stringify({
                file,
                record: {ts: `2024-01-01T00:0${i}:00Z`, type: 'player', text: `消息${i}`},
            }))
            const res = mockResponse()
            await middleware(req as any, res as any)
        }

        const content = readFileSync(join(tmpDir, file), 'utf-8')
        const lines = content.trim().split('\n')
        expect(lines).toHaveLength(3)
    })

    it('POST /append 无效 JSON 返回 400', async () =>
    {
        const req = mockRequest('/__dialogues/append', 'POST', 'not-json')
        const res = mockResponse()
        await middleware(req as any, res as any)

        expect(res._getStatus()).toBe(400)
    })

    it('POST /append 危险文件名返回 400', async () =>
    {
        const req = mockRequest('/__dialogues/append', 'POST', JSON.stringify({
            file: '../../../etc/passwd',
            record: {ts: 'x', type: 'x', text: 'x'},
        }))
        const res = mockResponse()
        await middleware(req as any, res as any)

        expect(res._getStatus()).toBe(400)
    })

    it('POST /append 空文件名返回 400', async () =>
    {
        const req = mockRequest('/__dialogues/append', 'POST', JSON.stringify({
            file: '',
            record: {ts: 'x', type: 'x', text: 'x'},
        }))
        const res = mockResponse()
        await middleware(req as any, res as any)

        expect(res._getStatus()).toBe(400)
    })

    it('POST /append 含路径分隔符返回 400', async () =>
    {
        const req = mockRequest('/__dialogues/append', 'POST', JSON.stringify({
            file: 'sub/dir/file.jsonl',
            record: {ts: 'x', type: 'x', text: 'x'},
        }))
        const res = mockResponse()
        await middleware(req as any, res as any)

        expect(res._getStatus()).toBe(400)
    })

    it('未知路由返回 404', async () =>
    {
        const req = mockRequest('/__dialogues/unknown')
        const res = mockResponse()
        await middleware(req as any, res as any)

        expect(res._getStatus()).toBe(404)
    })

    it('非 POST 请求返回 404', async () =>
    {
        const req = mockRequest('/__dialogues/append', 'GET')
        const res = mockResponse()
        await middleware(req as any, res as any)

        expect(res._getStatus()).toBe(404)
    })
})
