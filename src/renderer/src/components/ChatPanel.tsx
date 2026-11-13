import { useEffect, useRef, useState } from 'react'
import type { DesignSession, PublicProfile } from '@shared/types'

type ChatPanelProps = {
  session: DesignSession
  profiles: PublicProfile[]
  activeChatProfileId: string | null
  busy: boolean
  locked: boolean
  onSelectModel: (id: string | null) => void
  onSend: (content: string) => void
  onOptimize: () => void
}

export function ChatPanel({
  session,
  profiles,
  activeChatProfileId,
  busy,
  locked,
  onSelectModel,
  onSend,
  onOptimize
}: ChatPanelProps) {
  const [draft, setDraft] = useState('')
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const thread = threadRef.current
    if (!thread) return
    thread.scrollTop = thread.scrollHeight
  }, [session.messages, session.optimizeError, busy])

  function send() {
    const content = draft.trim()
    if (!content || locked) return
    onSend(content)
    setDraft('')
  }

  return (
    <aside className="pane drawer">
      <header className="drawer-head">
        <h2>对话</h2>
        <label className="model-select">
          <select
            aria-label="聊天模型"
            value={activeChatProfileId ?? ''}
            onChange={(event) => onSelectModel(event.target.value || null)}
          >
            <option value="">{profiles.length ? '未选择' : '尚未配置'}</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      <section className="chat">
      <div className="thread" ref={threadRef}>
        {session.messages.length === 0 ? (
          <p className="starter">描述产品。写完后点「优化提示词」。</p>
        ) : (
          session.messages.map((message) => (
            <article key={message.id} className={message.role === 'user' ? 'bubble user' : 'bubble assistant'}>
              <span>{message.role === 'user' ? '你' : '整理'}</span>
              <p>{message.content}</p>
            </article>
          ))
        )}
        {busy ? <p className="pending">正在根据对话整理四段提示词…</p> : null}
      </div>
      {session.optimizeError ? <p className="banner error">{session.optimizeError}</p> : null}
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault()
          send()
        }}
      >
        <textarea
          value={draft}
          placeholder="例如：一只可单手打开的露营咖啡手磨，胡桃木握柄，不锈钢磨芯，要能看到内部结构。"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send()
            }
          }}
        />
        <div className="composer-actions">
          <button type="button" className="solid" disabled={locked || !session.messages.some((message) => message.role === 'user')} onClick={onOptimize}>
            {busy ? '整理中…' : '优化提示词'}
          </button>
          <button type="submit" className="ghost" disabled={locked || !draft.trim()}>
            发送
          </button>
        </div>
      </form>
      </section>
    </aside>
  )
}
