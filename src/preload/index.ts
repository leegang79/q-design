import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { QDesignBridge } from '@shared/bridge'
import type { PublicState } from '@shared/types'

const api: QDesignBridge = {
  getState: () => ipcRenderer.invoke('state:get'),
  saveProfile: (input) => ipcRenderer.invoke('profile:save', input),
  deleteProfile: (id) => ipcRenderer.invoke('profile:delete', id),
  setActiveModels: (input) => ipcRenderer.invoke('models:active', input),
  testConnection: (input) => ipcRenderer.invoke('profile:test', input),
  createSession: () => ipcRenderer.invoke('session:create'),
  selectSession: (id) => ipcRenderer.invoke('session:select', id),
  deleteSession: (id) => ipcRenderer.invoke('session:delete', id),
  sendMessage: (sessionId, content) => ipcRenderer.invoke('chat:send', sessionId, content),
  optimizePrompts: (sessionId) => ipcRenderer.invoke('prompts:optimize', sessionId),
  updateStagePrompt: (sessionId, stageId, prompt) =>
    ipcRenderer.invoke('stage:prompt', sessionId, stageId, prompt),
  generateStage: (sessionId, stageId) => ipcRenderer.invoke('stage:generate', sessionId, stageId),
  generateAll: (sessionId) => ipcRenderer.invoke('stage:generate-all', sessionId),
  readImage: (relativePath) => ipcRenderer.invoke('image:read', relativePath),
  onState: (listener) => {
    const wrapped = (_event: IpcRendererEvent, state: PublicState) => listener(state)
    ipcRenderer.on('state:updated', wrapped)
    return () => ipcRenderer.removeListener('state:updated', wrapped)
  }
}

contextBridge.exposeInMainWorld('qdesign', api)
