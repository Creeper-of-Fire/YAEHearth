import {afterEach, describe, expect, it} from 'vitest'
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {
    parseSequenceNumber,
    assemblePrompt,
    resolveWorkspacePrompt,
    type PromptFile,
} from './prompt-assembler'

// ---------------------------------------------------------------------------
// parseSequenceNumber
// ---------------------------------------------------------------------------

describe('parseSequenceNumber', () =>
{
    it('提取正数序号', () =>
    {
        expect(parseSequenceNumber('[0001]规则.md')).toBe(1)
        expect(parseSequenceNumber('[00]核心.md')).toBe(0)
        expect(parseSequenceNumber('[99999]备用.md')).toBe(99999)
    })

    it('提取负数序号', () =>
    {
        expect(parseSequenceNumber('[-1]结尾.md')).toBe(-1)
        expect(parseSequenceNumber('[-2]倒数第二.md')).toBe(-2)
    })

    it('无匹配返回 null', () =>
    {
        expect(parseSequenceNumber('无序号文件.md')).toBeNull()
        expect(parseSequenceNumber('[abc]非数字.md')).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// assemblePrompt（排序逻辑）
// ---------------------------------------------------------------------------

function pf(seq: number, depth: number, body: string, extra?: Partial<PromptFile>): PromptFile
{
    return {
        filePath: '',
        filename: `[${seq}].md`,
        sequence: seq,
        depth,
        body,
        frontmatter: {},
        ...extra,
    }
}

describe('assemblePrompt', () =>
{
    it('正数升序排列', () =>
    {
        const result = assemblePrompt([
            pf(3, 0, '第三'),
            pf(1, 0, '第一'),
            pf(2, 0, '第二'),
        ])
        expect(result.text).toBe('第一\n\n第二\n\n第三')
    })

    it('负数排在正数之后，升序（-1 最后）', () =>
    {
        const result = assemblePrompt([
            pf(-1, 0, '负一'),
            pf(1, 0, '正一'),
            pf(-2, 0, '负二'),
        ])
        expect(result.text).toBe('正一\n\n负二\n\n负一')
    })

    it('同序号内层（depth 小）优先', () =>
    {
        const result = assemblePrompt([
            pf(1, 1, '外层'),
            pf(1, 0, '内层'),
        ])
        expect(result.text).toBe('内层\n\n外层')
    })

    it('跳过 enabled: false 的文件', () =>
    {
        const result = assemblePrompt([
            pf(1, 0, '保留'),
            pf(2, 0, '禁用', {frontmatter: {enabled: false}}),
        ])
        expect(result.text).toBe('保留')
        expect(result.sources).toHaveLength(1)
    })

    it('跳过空正文文件', () =>
    {
        const result = assemblePrompt([
            pf(1, 0, '有内容'),
            pf(2, 0, ''),
        ])
        expect(result.text).toBe('有内容')
        expect(result.sources).toHaveLength(1)
    })

    it('sources 按排序顺序记录', () =>
    {
        const result = assemblePrompt([
            pf(2, 0, 'B'),
            pf(1, 0, 'A'),
        ])
        expect(result.sources.map(s => s.sequence)).toEqual([1, 2])
    })
})

// ---------------------------------------------------------------------------
// collectPromptFiles + resolveWorkspacePrompt（目录遍历）
// ---------------------------------------------------------------------------

describe('resolveWorkspacePrompt（目录遍历）', () =>
{
    let tmpRoot: string

    afterEach(() =>
    {
        if (tmpRoot) rmSync(tmpRoot, {recursive: true, force: true})
    })

    function makeDir(...segments: string[]): string
    {
        const dir = join(tmpRoot, ...segments)
        mkdirSync(dir, {recursive: true})
        return dir
    }

    function makeFile(dir: string, name: string, content: string): void
    {
        writeFileSync(join(dir, name), content, 'utf-8')
    }

    it('从 startDir 向上搜索到 contentRoot', () =>
    {
        tmpRoot = mkdtempSync(join(tmpdir(), 'pa-test-'))

        // content/system_prompts/
        const rootPrompts = makeDir('system_prompts')
        makeFile(rootPrompts, '[0100]全局规则.md', '全局')

        // content/scenes/system_prompts/
        const scenePrompts = makeDir('scenes', 'system_prompts')
        makeFile(scenePrompts, '[0050]场景规则.md', '场景')

        const startDir = join(tmpRoot, 'scenes')
        const result = resolveWorkspacePrompt(tmpRoot, startDir)

        // 内层 (scenes/system_prompts, depth=0) 的序号 50 先于外层 (depth=1) 的序号 100
        expect(result.text).toBe('场景\n\n全局')
    })

    it('无 system_prompts 目录时返回空', () =>
    {
        tmpRoot = mkdtempSync(join(tmpdir(), 'pa-test-'))
        const result = resolveWorkspacePrompt(tmpRoot, tmpRoot)
        expect(result.text).toBe('')
        expect(result.sources).toHaveLength(0)
    })

    it('忽略不带序号前缀的 .md 文件', () =>
    {
        tmpRoot = mkdtempSync(join(tmpdir(), 'pa-test-'))
        const promptDir = makeDir('system_prompts')
        makeFile(promptDir, '[0001]有效.md', '有效')
        makeFile(promptDir, '无效文件.md', '无效')

        const result = resolveWorkspacePrompt(tmpRoot, tmpRoot)
        expect(result.sources).toHaveLength(1)
        expect(result.text).toBe('有效')
    })

    it('支持 frontmatter enabled: false', () =>
    {
        tmpRoot = mkdtempSync(join(tmpdir(), 'pa-test-'))
        const promptDir = makeDir('system_prompts')
        makeFile(promptDir, '[0001]启用.md', '启用')
        makeFile(promptDir, '[0002]禁用.md', '---\nenabled: false\n---\n禁用')

        const result = resolveWorkspacePrompt(tmpRoot, tmpRoot)
        expect(result.text).toBe('启用')
    })
})
