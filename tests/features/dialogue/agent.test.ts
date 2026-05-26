import {describe, expect, it, vi, beforeEach} from 'vitest'

// Mock OpenAI before importing agent
const {mockCreate} = vi.hoisted(() => ({
    mockCreate: vi.fn(),
}))

vi.mock('openai', () =>
{
    return {
        default: class
        {
            chat = {
                completions: {
                    create: mockCreate,
                },
            }
        },
    }
})

// Mock useLogStore
vi.mock('@/features/shell/log-store', () => ({
    useLogStore: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}))

import {DialogueRequest, EditorRequest} from '@/features/dialogue/agent'

describe('DialogueRequest', () =>
{
    beforeEach(() =>
    {
        mockCreate.mockReset()
    })

    describe('parseResponse', () =>
    {
        const req = new DialogueRequest()

        it('clears think tags', () =>
        {
            const input = '<think' + String.fromCharCode(62) + 'reasoning</think' + String.fromCharCode(62) + ' actual reply'
            expect(req.parseResponse(input)).toBe(' actual reply')
        })

        it('clears thought tags', () =>
        {
            expect(req.parseResponse('<thought>reasoning</thought>actual reply')).toBe('actual reply')
        })

        it('preserves text without tags', () =>
        {
            expect(req.parseResponse('no tags here')).toBe('no tags here')
        })

        it('empty returns default', () =>
        {
            expect(req.parseResponse('')).toBe('（沉默）')
        })

        it('normal text returned as-is', () =>
        {
            expect(req.parseResponse('hello world')).toBe('hello world')
        })
    })

    describe('execute', () =>
    {
        it('returns parsed response and usage', async () =>
        {
            mockCreate.mockResolvedValue({
                choices: [{message: {content: 'AI response'}}],
                usage: {
                    prompt_tokens: 100,
                    completion_tokens: 50,
                    total_tokens: 150,
                    prompt_cache_hit_tokens: 80,
                    prompt_cache_miss_tokens: 20,
                },
            })

            const req = new DialogueRequest()
            req.withMessages([{role: 'user', content: 'hello'}])
            const result = await req.execute()

            expect(result.text).toBe('AI response')
            expect(result.usage).toEqual({
                promptTokens: 100,
                completionTokens: 50,
                totalTokens: 150,
                cacheHitTokens: 80,
                cacheMissTokens: 20,
            })
        })

        it('handles null usage', async () =>
        {
            mockCreate.mockResolvedValue({
                choices: [{message: {content: 'response'}}],
                usage: undefined,
            })

            const req = new DialogueRequest()
            req.withMessages([{role: 'user', content: 'hello'}])
            const result = await req.execute()

            expect(result.text).toBe('response')
            expect(result.usage).toBeNull()
        })

        it('handles usage with null fields', async () =>
        {
            mockCreate.mockResolvedValue({
                choices: [{message: {content: 'response'}}],
                usage: {
                    prompt_tokens: null,
                    completion_tokens: null,
                    total_tokens: null,
                    prompt_cache_hit_tokens: null,
                    prompt_cache_miss_tokens: null,
                },
            })

            const req = new DialogueRequest()
            req.withMessages([{role: 'user', content: 'hello'}])
            const result = await req.execute()

            expect(result.usage).toEqual({
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                cacheHitTokens: 0,
                cacheMissTokens: 0,
            })
        })

        it('handles empty response', async () =>
        {
            mockCreate.mockResolvedValue({
                choices: [{message: {content: null}}],
                usage: undefined,
            })

            const req = new DialogueRequest()
            req.withMessages([{role: 'user', content: 'hello'}])
            const result = await req.execute()

            expect(result.text).toBe('（沉默）')
        })

        it('strips think tags from response', async () =>
        {
            const thinkContent = '<think' + String.fromCharCode(62) + 'reasoning</think' + String.fromCharCode(62)
            mockCreate.mockResolvedValue({
                choices: [{message: {content: thinkContent + 'clean response'}}],
                usage: undefined,
            })

            const req = new DialogueRequest()
            req.withMessages([{role: 'user', content: 'hello'}])
            const result = await req.execute()

            expect(result.text).toBe('clean response')
        })
    })
})

describe('EditorRequest', () =>
{
    beforeEach(() =>
    {
        mockCreate.mockReset()
    })

    describe('parseResponse', () =>
    {
        const req = new EditorRequest()

        it('parses valid JSON array', () =>
        {
            const ops = req.parseResponse('[{"op":"set-string","entity":"hero","path":"x","value":"v"}]')
            expect(ops).toHaveLength(1)
            expect(ops[0]).toEqual({
                op: 'set-string',
                entity: 'hero',
                path: 'x',
                value: 'v',
            })
        })

        it('parses adjust-number op', () =>
        {
            const ops = req.parseResponse('[{"op":"adjust-number","entity":"hero","path":"x","delta":-5}]')
            expect(ops).toHaveLength(1)
            expect(ops[0]).toEqual({
                op: 'adjust-number',
                entity: 'hero',
                path: 'x',
                delta: -5,
            })
        })

        it('parses push-to-list op', () =>
        {
            const ops = req.parseResponse('[{"op":"push-to-list","entity":"hero","path":"x","value":"v"}]')
            expect(ops).toHaveLength(1)
            expect(ops[0]).toEqual({
                op: 'push-to-list',
                entity: 'hero',
                path: 'x',
                value: 'v',
            })
        })

        it('extracts JSON from mixed text', () =>
        {
            const ops = req.parseResponse('text[{"op":"set-string","entity":"a","path":"x","value":"b"}]more')
            expect(ops).toHaveLength(1)
        })

        it('filters invalid items', () =>
        {
            const ops = req.parseResponse('[{"op":"unknown","entity":"a","path":"x"},{"op":"set-string","entity":"a","path":"x","value":"b"},null]')
            expect(ops).toHaveLength(1)
        })

        it('filters items missing required fields', () =>
        {
            expect(req.parseResponse('[{"op":"set-string","entity":"a","path":"x"}]')).toHaveLength(0)
            expect(req.parseResponse('[{"op":"adjust-number","entity":"a","path":"x","delta":"5"}]')).toHaveLength(0)
            expect(req.parseResponse('[{"op":"set-string","path":"x","value":"b"}]')).toHaveLength(0)
        })

        it('returns empty for non-JSON', () =>
        {
            expect(req.parseResponse('not JSON')).toHaveLength(0)
        })

        it('returns empty for non-array JSON', () =>
        {
            expect(req.parseResponse('{"key":"value"}')).toHaveLength(0)
        })

        it('returns empty for empty array', () =>
        {
            expect(req.parseResponse('[]')).toHaveLength(0)
        })
    })

    describe('execute', () =>
    {
        it('returns parsed operations', async () =>
        {
            mockCreate.mockResolvedValue({
                choices: [{message: {content: '[{"op":"set-string","entity":"hero","path":"x","value":"v"}]'}}],
                usage: {
                    prompt_tokens: 50,
                    completion_tokens: 10,
                    total_tokens: 60,
                    prompt_cache_hit_tokens: 0,
                    prompt_cache_miss_tokens: 50,
                },
            })

            const req = new EditorRequest()
            req.withMessages([{role: 'user', content: 'edit'}])
            const result = await req.execute()

            expect(result.operations).toHaveLength(1)
            expect(result.usage).toEqual({
                promptTokens: 50,
                completionTokens: 10,
                totalTokens: 60,
                cacheHitTokens: 0,
                cacheMissTokens: 50,
            })
        })

        it('handles API error gracefully', async () =>
        {
            mockCreate.mockRejectedValue(new Error('API error'))

            const req = new EditorRequest()
            req.withMessages([{role: 'user', content: 'edit'}])
            const result = await req.execute()

            expect(result.operations).toHaveLength(0)
            expect(result.usage).toBeNull()
        })

        it('handles null usage', async () =>
        {
            mockCreate.mockResolvedValue({
                choices: [{message: {content: '[]'}}],
                usage: undefined,
            })

            const req = new EditorRequest()
            req.withMessages([{role: 'user', content: 'edit'}])
            const result = await req.execute()

            expect(result.operations).toHaveLength(0)
            expect(result.usage).toBeNull()
        })
    })
})
