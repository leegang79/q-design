export type ModelKind = 'chat' | 'image'

export type Protocol = 'openai-chat' | 'openai-image' | 'gemini-image' | 'bfl-image' | 'dashscope-image'

export type StageId = 'sketch' | 'render' | 'structure' | 'exploded'

export type StageStatus = 'idle' | 'generating' | 'done' | 'error'

export type BusyAction = 'optimize' | 'generate'

export type ModelProfile = {
  id: string
  name: string
  kind: ModelKind
  protocol: Protocol
  baseUrl: string
  apiKey: string
  model: string
}

export type PublicProfile = {
  id: string
  name: string
  kind: ModelKind
  protocol: Protocol
  baseUrl: string
  apiKeyMasked: string
  hasApiKey: boolean
  model: string
}

export type ProfileInput = {
  id?: string
  name: string
  kind: ModelKind
  protocol: Protocol
  baseUrl: string
  apiKey: string
  model: string
}

export type ChatRole = 'user' | 'assistant'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: number
}

export type StageState = {
  id: StageId
  title: string
  prompt: string
  imagePath: string | null
  status: StageStatus
  error: string | null
}

export type DesignSession = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
  productName: string
  designBrief: string
  optimizeError: string | null
  boardError: string | null
  stages: StageState[]
}

export type PersistedState = {
  profiles: ModelProfile[]
  activeChatProfileId: string | null
  activeImageProfileId: string | null
  sessions: DesignSession[]
  activeSessionId: string | null
}

export type PublicSession = Omit<DesignSession, never>

export type PublicState = {
  profiles: PublicProfile[]
  activeChatProfileId: string | null
  activeImageProfileId: string | null
  sessions: PublicSession[]
  activeSessionId: string | null
  busySessionId: string | null
  busyAction: BusyAction | null
}

export type OptimizeStage = {
  id: StageId
  title: string
  prompt: string
}

export type OptimizeResult = {
  productName: string
  designBrief: string
  stages: OptimizeStage[]
}

export type ConnectionTestResult = {
  ok: boolean
  message: string
}
