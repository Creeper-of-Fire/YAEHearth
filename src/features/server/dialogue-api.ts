import type {IncomingMessage, ServerResponse} from 'node:http'
import {appendFileSync, mkdirSync} from 'node:fs'
import {join} from 'node:path'

function sendJson(res: ServerResponse, data: any): void
{
    res.writeHead(200, {'Content-Type': 'application/json'})
    res.end(JSON.stringify(data))
}

function sendError(res: ServerResponse, status: number, message: string): void
{
    res.writeHead(status, {'Content-Type': 'application/json'})
    res.end(JSON.stringify({error: message}))
}

function readBody(req: IncomingMessage): Promise<string>
{
    return new Promise((resolve, reject) =>
    {
        let body = ''
        req.on('data', (chunk: Buffer) => body += chunk.toString())
        req.on('end', () => resolve(body))
        req.on('error', reject)
    })
}

function isSafeFilename(name: string): boolean
{
    // 禁止路径穿越、路径分隔符、绝对路径
    if (name.includes('..')) return false
    if (name.includes('/') || name.includes('\\')) return false
    if (name === '.' || name === '') return false
    return true
}

export function dialogueApiMiddleware(dialoguesDir: string)
{
    return async (req: IncomingMessage, res: ServerResponse): Promise<void> =>
    {
        const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
        const path = url.pathname.replace(/^\/__dialogues\/?/, '')

        // POST /__dialogues/append
        if (req.method === 'POST' && path === 'append')
        {
            const body = await readBody(req)
            let payload: { file: string; record: Record<string, any> }
            try
            {
                payload = JSON.parse(body)
            } catch
            {
                return sendError(res, 400, 'Invalid JSON')
            }

            const {file, record} = payload
            if (!file || !isSafeFilename(file))
            {
                return sendError(res, 400, 'Invalid file name')
            }

            mkdirSync(dialoguesDir, {recursive: true})
            const filePath = join(dialoguesDir, file)
            const line = JSON.stringify(record) + '\n'
            appendFileSync(filePath, line, 'utf-8')

            return sendJson(res, {ok: true})
        }

        sendError(res, 404, 'Not found')
    }
}
