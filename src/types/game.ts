export interface Character {
  id: string
  name: string
  role: string
  description: string
  personality: string
  mood: string
  affection: number
}

export interface Message {
  speaker: string
  text: string
  timestamp: number
}

export interface SceneState {
  location: string
  timeOfDay: string
  atmosphere: string
  characters: Character[]
  selectedId: string | null
  dialogueHistory: Message[]
}

export interface AgentResponse {
  speaker: string
  text: string
  mood?: string | null
  affectionDelta: number
}

export function defaultScene(): SceneState {
  return {
    location: '暮色酒馆',
    timeOfDay: '夜晚',
    atmosphere: '温暖昏暗，壁炉噼啪作响，空气中弥漫着麦酒和烤肉的香气',
    characters: [
      {
        id: 'grum',
        name: '格鲁姆',
        role: '酒保',
        description: '一个壮实的矮人，胡须编成辫子，擦着杯子。',
        personality: '豪爽直率，喜欢讲冷笑话，对老顾客格外关照。说话带着矮人特有的粗犷。',
        mood: '平静',
        affection: 0,
      },
      {
        id: 'lila',
        name: '莉拉',
        role: '旅者',
        description: '一位年轻的人类女性，披着深绿斗篷，坐在角落的桌旁。',
        personality: '好奇心旺盛，健谈但有所保留。似乎在寻找什么人，偶尔流露出一丝忧虑。',
        mood: '平静',
        affection: 0,
      },
      {
        id: 'thomas',
        name: '老托马斯',
        role: '吟游诗人',
        description: '一个白发苍苍的老半精灵，怀抱一把旧鲁特琴。',
        personality: '博学多闻，喜欢用谜语和寓言代替直接回答。对镇上的传闻了如指掌。',
        mood: '平静',
        affection: 0,
      },
    ],
    selectedId: 'lila',
    dialogueHistory: [],
  }
}
