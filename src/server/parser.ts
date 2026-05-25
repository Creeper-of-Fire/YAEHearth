import matter from 'gray-matter'
import {readFileSync, writeFileSync} from 'node:fs'
import {basename} from 'node:path'

export interface ParsedContent
{
    id: string
    frontmatter: Record<string, any>
    body: string
}

/** 文件扩展名 → 内容类型映射 */
const EXT_TO_TYPE: Record<string, string> = {
    '.chr': 'characters',
    '.scn': 'scenes',
    '.itm': 'items',
}

/** 从文件路径推导内容类型 */
export function typeFromPath(filePath: string): string | undefined
{
    for (const [ext, type] of Object.entries(EXT_TO_TYPE))
    {
        if (filePath.endsWith(ext)) return type
    }
    return undefined
}

/** 从文件路径推导 id（去扩展名的文件名） */
function idFromPath(filePath: string): string
{
    const name = basename(filePath)
    for (const ext of Object.keys(EXT_TO_TYPE))
    {
        if (name.endsWith(ext)) return name.slice(0, -ext.length)
    }
    return name
}

/** 解析内容文件 */
export function parseContentFile(filePath: string): ParsedContent
{
    const raw = readFileSync(filePath, 'utf-8')
    const {data, content} = matter(raw)
    const id = data.id ?? idFromPath(filePath)
    return {id, frontmatter: data, body: content}
}

/** 序列化回 markdown + frontmatter 字符串 */
export function serializeContent(parsed: ParsedContent): string
{
    return matter.stringify(parsed.body, parsed.frontmatter)
}

/** 将解析结果写回文件 */
export function writeContentFile(filePath: string, parsed: ParsedContent): void
{
    writeFileSync(filePath, serializeContent(parsed), 'utf-8')
}
