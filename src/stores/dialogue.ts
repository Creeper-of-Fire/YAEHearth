import {defineStore} from 'pinia'
import {computed, ref} from 'vue'
import {useGameStore} from '@/stores/game'
import {useLogStore} from '@/stores/log'
import {buildDialogueDynamic, buildMoodDynamic, StaticContext, SYSTEM_PROMPT} from '@/services/prompts'
import type {ChatMsg, UsageSnapshot} from '@/services/agent'
import {DialogueRequest, MoodRequest} from '@/services/agent'
import type {Character} from '@/types/game'

export const useDialogueStore = defineStore('dialogue', () =>
{
    const gameStore = useGameStore()
    const targetCharacterId = ref<string | null>(null)
    const busy = ref(false)
    const ctx = new StaticContext()

    const displayMessages = computed(() => ctx.displayMessages.value)

    const cumulativeUsage = ref({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cacheHitTokens: 0,
        cacheMissTokens: 0,
        turnCount: 0,
    })

    const cacheHitRate = computed(() =>
    {
        const total = cumulativeUsage.value.promptTokens
        return total === 0 ? 0 : cumulativeUsage.value.cacheHitTokens / total
    })

    function accumulateUsage(snapshot: UsageSnapshot | null)
    {
        if (!snapshot) return
        const c = cumulativeUsage.value
        c.promptTokens += snapshot.promptTokens
        c.completionTokens += snapshot.completionTokens
        c.totalTokens += snapshot.totalTokens
        c.cacheHitTokens += snapshot.cacheHitTokens
        c.cacheMissTokens += snapshot.cacheMissTokens
    }

    function resetUsage()
    {
        cumulativeUsage.value = {
            promptTokens: 0, completionTokens: 0, totalTokens: 0,
            cacheHitTokens: 0, cacheMissTokens: 0, turnCount: 0,
        }
    }

    function findTarget(charId: string): Character | undefined
    {
        return gameStore.scene.characters.find(c => c.id === charId)
    }

    function ensureCharacterCard(charId: string)
    {
        if (ctx.loadedCardIds.includes(charId)) return
        const char = findTarget(charId)
        if (!char) return
        ctx.append({
            type: 'char-card',
            view: computed(() =>
                `## 角色卡片：${char.name}\n身份：${char.role}\n外貌：${char.description}\n性格：${char.personality}`,
            ),
            charId,
            name: computed(() => char.name),
        })
    }

    function initDialogue(charId: string)
    {
        targetCharacterId.value = charId
        ctx.reset()
        resetUsage()
        ctx.append({type: 'system', text: SYSTEM_PROMPT})
        ctx.commit()
        ctx.append({
            type: 'scene',
            view: computed(() =>
                `## 场景设定\n地点：${gameStore.scene.location}\n时间：${gameStore.scene.timeOfDay}\n氛围：${gameStore.scene.atmosphere}`,
            ),
        })
        ctx.commit()
        const target = findTarget(charId)
        useLogStore().info(`对话目标: ${target?.name ?? '???'}`)
    }

    async function sendMessage(text: string)
    {
        if (busy.value || !targetCharacterId.value) return
        busy.value = true
        ensureCharacterCard(targetCharacterId.value)
        const log = useLogStore()
        const target = findTarget(targetCharacterId.value)
        const speakerName = target?.name ?? '???'

        ctx.append({type: 'player', text, name: '玩家'})
        log.info(`玩家: ${text.slice(0, 30)}`)

        try
        {
            ctx.commit()
            const staticMsgs = ctx.build()
            const dynamicMsgs = buildDialogueDynamic(target!, gameStore.scene.characters)
            const messages: ChatMsg[] = [...staticMsgs, ...dynamicMsgs]

            const dialogueResult = await new DialogueRequest()
                .withMessages(messages)
                .execute()

            accumulateUsage(dialogueResult.usage)
            let aiText = dialogueResult.text

            ctx.append({type: 'assistant', text: aiText, name: speakerName})

            const moodDynMsgs = buildMoodDynamic(target!, aiText)
            const moodMessages: ChatMsg[] = [...messages, ...moodDynMsgs]

            const moodResult = await new MoodRequest()
                .withMessages(moodMessages)
                .execute()

            accumulateUsage(moodResult.usage)
            cumulativeUsage.value.turnCount++

            if (target)
            {
                if (moodResult.mood) target.mood = moodResult.mood
                target.affection = Math.max(0, Math.min(5, target.affection + moodResult.affectionDelta))
            }

            log.info(`${speakerName}: ${aiText.slice(0, 40)}`)
            ctx.commit()
        } catch (e)
        {
            log.error(`Agent 调用失败: ${e}`)
            ctx.append({type: 'assistant', text: '（沉默）', name: speakerName})
            ctx.commit()
        } finally
        {
            busy.value = false
        }
    }

    function endConversation()
    {
        targetCharacterId.value = null
        ctx.reset()
        resetUsage()
        useLogStore().info('对话已结束')
    }

    return {
        targetCharacterId,
        busy,
        displayMessages,
        cumulativeUsage,
        cacheHitRate,
        initDialogue,
        sendMessage,
        endConversation,
    }
})
