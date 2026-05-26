import matter from 'gray-matter'
import {dirname, join, normalize, resolve} from 'node:path'
import {readdirSync, readFileSync, statSync} from 'node:fs'

export interface PromptFile
{
    filePath: string
    sequence: number
    filename: string
    depth: number
    body: string
    frontmatter: Record<string, any>
}

export interface AssembledPrompt
{
    text: string
    sources: Array<{ filename: string; sequence: number; depth: number }>
}

const SEQ_RE = /^\[(-?\d+)\]/

/** 从文件名中提取序号，如 `[0001]规则.md` → 1 */
export function parseSequenceNumber(filename: string): number | null
{
    const m = SEQ_RE.exec(filename)
    return m ? parseInt(m[1], 10) : null
}

/** 排序键：正数在前升序，负数在后升序（-1 最后） */
function sortKey(seq: number): [number, number]
{
    return seq >= 0 ? [0, seq] : [1, seq]
}

/** 从 startDir 向上遍历到 contentRoot，收集 folderName 子目录中的 .md 文件 */
export function collectPromptFiles(
    contentRoot: string,
    startDir: string,
    folderName: string,
): PromptFile[]
{
    const root = normalize(resolve(contentRoot))
    const start = normalize(resolve(startDir))
    const files: PromptFile[] = []

    let current = start
    let depth = 0

    while (true)
    {
        const promptDir = join(current, folderName)
        const stat = statSync(promptDir, {throwIfNoEntry: false})
        if (stat?.isDirectory())
        {
            for (const file of readdirSync(promptDir))
            {
                const seq = parseSequenceNumber(file)
                if (seq === null) continue

                const filePath = join(promptDir, file)
                if (!statSync(filePath, {throwIfNoEntry: false})?.isFile()) continue
                if (!file.endsWith('.md')) continue

                const raw = readFileSync(filePath, 'utf-8')
                const {data, content} = matter(raw)

                files.push({
                    filePath,
                    sequence: seq,
                    filename: file,
                    depth,
                    body: content,
                    frontmatter: data,
                })
            }
        }

        if (normalize(current) === root) break
        const parent = dirname(current)
        if (normalize(parent) === normalize(current)) break
        current = parent
        depth++
    }

    return files
}

/** 排序并拼装提示词文件 */
export function assemblePrompt(files: PromptFile[]): AssembledPrompt
{
    const filtered = files.filter(f =>
        f.body.length > 0 && f.frontmatter.enabled !== false,
    )

    filtered.sort((a, b) =>
    {
        const ka = sortKey(a.sequence)
        const kb = sortKey(b.sequence)
        if (ka[0] !== kb[0]) return ka[0] - kb[0]
        if (ka[1] !== kb[1]) return ka[1] - kb[1]
        return a.depth - b.depth
    })

    return {
        text: filtered.map(f => f.body).join('\n\n'),
        sources: filtered.map(f => ({
            filename: f.filename,
            sequence: f.sequence,
            depth: f.depth,
        })),
    }
}

/** 顶层入口：发现、收集、排序、拼装 */
export function resolveWorkspacePrompt(
    contentRoot: string,
    startDir: string,
    options?: { folderName?: string },
): AssembledPrompt
{
    const folderName = options?.folderName ?? 'system_prompts'
    const files = collectPromptFiles(contentRoot, startDir, folderName)
    return assemblePrompt(files)
}
