import {afterEach, describe, expect, it} from 'vitest'
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {
    typeFromPath,
    parseContentFile,
    serializeContent,
    writeContentFile,
} from '@/features/server/parser'
import {readFileSync} from 'node:fs'

describe('typeFromPath', () =>
{
    it('识别 .chr 扩展名', () =>
    {
        expect(typeFromPath('/path/to/hero.chr')).toBe('characters')
    })

    it('识别 .scn 扩展名', () =>
    {
        expect(typeFromPath('/path/to/tavern.scn')).toBe('scenes')
    })

    it('识别 .itm 扩展名', () =>
    {
        expect(typeFromPath('/path/to/sword.itm')).toBe('items')
    })

    it('未知扩展名返回 undefined', () =>
    {
        expect(typeFromPath('/path/to/file.txt')).toBeUndefined()
        expect(typeFromPath('/path/to/file.md')).toBeUndefined()
    })
})

describe('parseContentFile', () =>
{
    let tmpDir: string

    afterEach(() =>
    {
        if (tmpDir) rmSync(tmpDir, {recursive: true, force: true})
    })

    it('解析含 frontmatter 的文件', () =>
    {
        tmpDir = mkdtempSync(join(tmpdir(), 'parser-test-'))
        const filePath = join(tmpDir, 'hero.chr')
        writeFileSync(filePath, '---\nname: 英雄\nage: 25\n---\n这是英雄的描述', 'utf-8')

        const result = parseContentFile(filePath)
        expect(result.id).toBe('hero')
        expect(result.frontmatter.name).toBe('英雄')
        expect(result.frontmatter.age).toBe(25)
        expect(result.body).toBe('这是英雄的描述')
    })

    it('解析无 frontmatter 的文件', () =>
    {
        tmpDir = mkdtempSync(join(tmpdir(), 'parser-test-'))
        const filePath = join(tmpDir, 'hero.chr')
        writeFileSync(filePath, '纯正文内容', 'utf-8')

        const result = parseContentFile(filePath)
        expect(result.id).toBe('hero')
        expect(result.body).toBe('纯正文内容')
    })

    it('未知扩展名的文件名用作 id', () =>
    {
        tmpDir = mkdtempSync(join(tmpdir(), 'parser-test-'))
        const filePath = join(tmpDir, 'unknown.txt')
        writeFileSync(filePath, '内容', 'utf-8')

        const result = parseContentFile(filePath)
        expect(result.id).toBe('unknown.txt')
    })

    it('frontmatter 中的 id 字段覆盖文件名', () =>
    {
        tmpDir = mkdtempSync(join(tmpdir(), 'parser-test-'))
        const filePath = join(tmpDir, 'hero.chr')
        writeFileSync(filePath, '---\nid: custom-id\n---\n内容', 'utf-8')

        const result = parseContentFile(filePath)
        expect(result.id).toBe('custom-id')
    })
})

describe('serializeContent', () =>
{
    it('序列化回 markdown + frontmatter', () =>
    {
        const result = serializeContent({
            id: 'test',
            frontmatter: {name: '测试', level: 5},
            body: '描述内容',
        })
        expect(result).toContain('name: 测试')
        expect(result).toContain('level: 5')
        expect(result).toContain('描述内容')
    })

    it('空 frontmatter 也正确序列化', () =>
    {
        const result = serializeContent({
            id: 'test',
            frontmatter: {},
            body: '只有正文',
        })
        expect(result).toContain('只有正文')
    })
})

describe('writeContentFile', () =>
{
    let tmpDir: string

    afterEach(() =>
    {
        if (tmpDir) rmSync(tmpDir, {recursive: true, force: true})
    })

    it('将内容写入文件并可读回', () =>
    {
        tmpDir = mkdtempSync(join(tmpdir(), 'parser-test-'))
        const filePath = join(tmpDir, 'out.chr')
        const parsed = {
            id: 'hero',
            frontmatter: {name: '英雄'},
            body: '英雄描述',
        }

        writeContentFile(filePath, parsed)

        const raw = readFileSync(filePath, 'utf-8')
        expect(raw).toContain('name: 英雄')
        expect(raw).toContain('英雄描述')
    })
})
