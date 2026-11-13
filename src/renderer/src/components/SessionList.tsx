import type { DesignSession } from '@shared/types'

type SessionListProps = {
  sessions: DesignSession[]
  activeSessionId: string | null
  disabled: boolean
  onCreate: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onOpenSettings: () => void
}

export function SessionList({
  sessions,
  activeSessionId,
  disabled,
  onCreate,
  onSelect,
  onDelete,
  onOpenSettings
}: SessionListProps) {
  return (
    <aside className="pane sidebar">
      <div className="brand">
        <p className="mark">Q Design</p>
        <p className="tagline">设计会话</p>
      </div>
      <button type="button" className="solid full" onClick={onCreate} disabled={disabled}>
        新建设计
      </button>
      <nav className="session-list" aria-label="设计会话">
        {sessions.map((session) => (
          <div key={session.id} className={session.id === activeSessionId ? 'session active' : 'session'}>
            <button type="button" className="session-open" onClick={() => onSelect(session.id)}>
              <strong>{session.title}</strong>
              <span>{formatTime(session.updatedAt)}</span>
            </button>
            <button
              type="button"
              className="text-button"
              disabled={disabled}
              onClick={() => onDelete(session.id)}
            >
              删除
            </button>
          </div>
        ))}
      </nav>
      <button type="button" className="ghost full sidebar-foot" onClick={onOpenSettings}>
        模型设置
      </button>
    </aside>
  )
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp)
}
