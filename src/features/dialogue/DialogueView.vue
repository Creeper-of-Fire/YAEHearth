<script setup lang="ts">
import {computed, watch, onMounted} from 'vue'
import {useDialogueStore} from './store'
import {useGameStore} from '@/features/game/store'
import {usePanelParams} from '@/features/shell/usePanelParams'
import {usePanelStore} from '@/features/shell/panel-store'
import DialogueHeader from './DialogueHeader.vue'
import DialogueLog from './DialogueLog.vue'
import DialogueInput from './DialogueInput.vue'

const {params, navigate} = usePanelParams()
const panelStore = usePanelStore()
const dialogueStore = useDialogueStore()
const gameStore = useGameStore()

const characterId = computed(() => params.value.characterId)
const character = computed(() =>
    gameStore.characters.find(c => c.id === characterId.value) ?? null,
)

async function initOrSwitchDialogue(charId: string)
{
    await dialogueStore.initDialogue(charId)
}

onMounted(() =>
{
    if (characterId.value) initOrSwitchDialogue(characterId.value)
})

watch(characterId, (newId) =>
{
    if (newId) initOrSwitchDialogue(newId)
})

function send(text: string)
{
    dialogueStore.sendMessage(text)
}

function endConversation()
{
    dialogueStore.endConversation()
    panelStore.navigate('right', 'char-list')
    if (characterId.value)
    {
        navigate('scene')
    }
}
</script>

<template>
  <div class="dialogue-view">
    <DialogueHeader
        :character-name="character?.frontmatter.name ?? '???'"
        :turn-count="dialogueStore.cumulativeUsage.turnCount"
        :prompt-tokens="dialogueStore.cumulativeUsage.promptTokens"
        :completion-tokens="dialogueStore.cumulativeUsage.completionTokens"
        :cache-hit-rate="dialogueStore.cacheHitRate"
        @end="endConversation"
    />
    <DialogueLog
        :messages="dialogueStore.displayMessages"
        :busy="dialogueStore.busy"
    />
    <DialogueInput
        :busy="dialogueStore.busy"
        @send="send"
    />
  </div>
</template>

<style scoped>
.dialogue-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
