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
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {session ? (
        <StageBoard
          session={session}
          notice={notice}
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
        <section className="pane work">
          {notice ? <p className="notice">{notice}</p> : null}
          <p className="empty-copy">还没有设计会话。</p>
        </section>
      )}
      {session ? (
        <ChatPanel
          session={session}
          profiles={state.profiles.filter((profile) => profile.kind === 'chat')}
          activeChatProfileId={state.activeChatProfileId}
          busy={busyHere && state.busyAction === 'optimize'}
          locked={state.busySessionId !== null}
          onSelectModel={(chatProfileId) =>
            void commit(() =>
              window.qdesign.setActiveModels({
                chatProfileId,
                imageProfileId: state.activeImageProfileId
              })
            )
          }
          onSend={(content) => void commit(() => window.qdesign.sendMessage(session.id, content))}
          onOptimize={() => void commit(() => window.qdesign.optimizePrompts(session.id))}
        />
      ) : (
        <aside className="pane drawer" />
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

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : '操作失败'
  return raw.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
}
