import { useEffect, useState } from 'react'
import type { PublicState } from '@shared/types'
import { ChatPanel } from './components/ChatPanel'
import { SessionList } from './components/SessionList'
import { SettingsPanel } from './components/SettingsPanel'
import { StageBoard } from './components/StageBoard'
import './styles.css'

export function App() {
  const [state, setState] = useState<PublicState | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!window.qdesign) {
      setNotice('应用接口没有加载')
      return
    }
    const stop = window.qdesign.onState(setState)
    window.qdesign.getState().then(setState).catch((error: unknown) => setNotice(errorMessage(error)))
    return stop
  }, [])

  async function commit(work: () => Promise<PublicState>): Promise<void> {
    try {
      setNotice(null)
      setState(await work())
    } catch (error) {
      setNotice(errorMessage(error))
    }
  }

  if (!state) {
    return <div className="boot">{notice ?? '正在打开 Q Design…'}</div>
  }

  const session = state.sessions.find((item) => item.id === state.activeSessionId) ?? null
  const busyHere = Boolean(session && state.busySessionId === session.id)

  return (
    <div className="app">
      <SessionList
        sessions={state.sessions}
        activeSessionId={state.activeSessionId}
        disabled={state.busySessionId !== null}
        onCreate={() => void commit(() => window.qdesign.createSession())}
        onSelect={(id) => void commit(() => window.qdesign.selectSession(id))}
        onDelete={(id) => void commit(() => window.qdesign.deleteSession(id))}
      />
      <main className="workspace">
        <header className="topbar">
          <ModelMenu
            label="聊天模型"
            value={state.activeChatProfileId}
            options={state.profiles.filter((profile) => profile.kind === 'chat')}
            onChange={(chatProfileId) =>
              void commit(() =>
                window.qdesign.setActiveModels({
                  chatProfileId,
                  imageProfileId: state.activeImageProfileId
                })
              )
            }
          />
          <button type="button" className="ghost" onClick={() => setSettingsOpen(true)}>
            模型设置
          </button>
        </header>
        {notice ? <p className="notice">{notice}</p> : null}
        {session ? (
          <ChatPanel
            session={session}
            busy={busyHere && state.busyAction === 'optimize'}
            locked={state.busySessionId !== null}
            onSend={(content) => void commit(() => window.qdesign.sendMessage(session.id, content))}
            onOptimize={() => void commit(() => window.qdesign.optimizePrompts(session.id))}
          />
        ) : (
          <p className="empty-copy">还没有设计会话。</p>
        )}
      </main>
      {session ? (
        <StageBoard
          session={session}
          profiles={state.profiles}
          activeImageProfileId={state.activeImageProfileId}
          busy={busyHere && state.busyAction === 'generate'}
          locked={state.busySessionId !== null}
          onSelectModel={(imageProfileId) =>
            void commit(() =>
              window.qdesign.setActiveModels({
                chatProfileId: state.activeChatProfileId,
                imageProfileId
              })
            )
          }
          onPrompt={(stageId, prompt) => window.qdesign.updateStagePrompt(session.id, stageId, prompt)}
          onGenerate={(stageId) => commit(() => window.qdesign.generateStage(session.id, stageId))}
          onGenerateAll={() => commit(() => window.qdesign.generateAll(session.id))}
        />
      ) : (
        <aside className="board" />
      )}
      {settingsOpen ? (
        <SettingsPanel
          state={state}
          onClose={() => setSettingsOpen(false)}
          onCommit={commit}
        />
      ) : null}
    </div>
  )
}

function ModelMenu({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string | null
  options: PublicState['profiles']
  onChange: (id: string | null) => void
}) {
  return (
    <label className="model-select">
      <span>{label}</span>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">{options.length ? '未选择' : '尚未配置'}</option>
        {options.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name} · {profile.model}
          </option>
        ))}
      </select>
    </label>
  )
}

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : '操作失败'
  return raw.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
}
