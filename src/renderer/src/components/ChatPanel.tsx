import { useEffect, useRef, useState } from 'react'
import type { DesignSession } from '@shared/types'

type ChatPanelProps = {
  session: DesignSession
  busy: boolean
  locked: boolean
  onSend: (content: string) => void
  onOptimize: () => void
}

export function ChatPanel({ session, busy, locked, onSend, onOptimize }: ChatPanelProps) {
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
    <section className="chat">
      <div className="thread" ref={threadRef}>
        {session.messages.length === 0 ? (
          <div className="starter">
            <p>描述想设计的产品。可以分几条补充造型、材料和结构。</p>
            <p>写完后点「优化提示词」，聊天模型会整理出四段可编辑的生图提示词。</p>
          </div>
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
  )
}
