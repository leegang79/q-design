import type { ConnectionTestResult, ProfileInput, PublicState } from './types'

export type QDesignBridge = {
  getState: () => Promise<PublicState>
  saveProfile: (input: ProfileInput) => Promise<PublicState>
  deleteProfile: (id: string) => Promise<PublicState>
  setActiveModels: (input: {
    chatProfileId: string | null
    imageProfileId: string | null
  }) => Promise<PublicState>
  testConnection: (input: ProfileInput) => Promise<ConnectionTestResult>
  createSession: () => Promise<PublicState>
  selectSession: (id: string) => Promise<PublicState>
  deleteSession: (id: string) => Promise<PublicState>
  sendMessage: (sessionId: string, content: string) => Promise<PublicState>
  optimizePrompts: (sessionId: string) => Promise<PublicState>
  updateStagePrompt: (sessionId: string, stageId: string, prompt: string) => Promise<PublicState>
  generateStage: (sessionId: string, stageId: string) => Promise<PublicState>
  generateAll: (sessionId: string) => Promise<PublicState>
  readImage: (relativePath: string) => Promise<string>
  onState: (listener: (state: PublicState) => void) => () => void
}
