import { useEffect, useRef, useState } from 'react'
import type { DesignSession, PublicProfile, StageId, StageState } from '@shared/types'

type StageBoardProps = {
  session: DesignSession
  notice: string | null
  profiles: PublicProfile[]
  activeImageProfileId: string | null
  busy: boolean
  locked: boolean
  onSelectModel: (id: string | null) => void
  onPrompt: (stageId: StageId, prompt: string) => Promise<unknown>
  onGenerate: (stageId: StageId) => Promise<void>
  onGenerateAll: () => Promise<void>
}

export function StageBoard({
  session,
  notice,
  profiles,
  activeImageProfileId,
  busy,
  locked,
  onSelectModel,
  onPrompt,
  onGenerate,
  onGenerateAll
}: StageBoardProps) {
  const drafts = useRef(new Map<StageId, string>())
  const editing = useRef(false)
  const followed = useRef<StageId | null>(null)
  const imageProfiles = profiles.filter((profile) => profile.kind === 'image')
  const [activeId, setActiveId] = useState<StageId>('sketch')
  const [preview, setPreview] = useState<string | null>(null)
  const stage = session.stages.find((item) => item.id === activeId) ?? session.stages[0]

  useEffect(() => {
    drafts.current = new Map(session.stages.map((item) => [item.id, item.prompt]))
    followed.current = null
    setActiveId('sketch')
  }, [session.id])

  useEffect(() => {
    for (const item of session.stages) {
      if (item.id === activeId && editing.current) continue
      drafts.current.set(item.id, item.prompt)
    }
    const running = session.stages.find((item) => item.status === 'generating')
    if (running && running.id !== followed.current) {
      followed.current = running.id
      setActiveId(running.id)
    }
    if (!running) followed.current = null
  }, [session.stages, activeId])

  function remember(stageId: StageId, prompt: string) {
    drafts.current.set(stageId, prompt)
  }

  async function flush(stageId: StageId): Promise<void> {
    const current = session.stages.find((item) => item.id === stageId)
    const draft = drafts.current.get(stageId)
    if (current && draft !== undefined && draft !== current.prompt) {
      await onPrompt(stageId, draft)
    }
  }

  async function flushAll(): Promise<void> {
    for (const item of session.stages) await flush(item.id)
  }

  return (
    <section className="pane work">
      <header className="work-head">
        <h1>{session.productName || session.title}</h1>
        <div className="work-tools">
          <label className="model-select">
            <select
              aria-label="生图模型"
              value={activeImageProfileId ?? ''}
              onChange={(event) => onSelectModel(event.target.value || null)}
            >
              <option value="">{imageProfiles.length ? '未选择' : '尚未配置'}</option>
              {imageProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="ghost"
            disabled={locked}
            onClick={() => {
              void flushAll().then(onGenerateAll)
            }}
          >
            {busy ? '生成中…' : '全部生成'}
          </button>
        </div>
      </header>
      <div className="tabs" role="tablist">
        {session.stages.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === stage.id}
            className={item.id === stage.id ? 'tab on' : 'tab'}
            onClick={() => {
              void flush(stage.id)
              setActiveId(item.id)
            }}
          >
            {item.title}
            <i className={`dot ${item.status}`} />
          </button>
        ))}
      </div>
      {notice ? <p className="notice">{notice}</p> : null}
      {session.boardError ? <p className="banner error">{session.boardError}</p> : null}
      {session.designBrief ? <p className="brief">{session.designBrief}</p> : null}
      <StageView
        key={`${session.id}-${stage.id}`}
        stage={stage}
        locked={locked}
        onDraft={(prompt) => remember(stage.id, prompt)}
        onEditing={(value) => {
          editing.current = value
        }}
        onPersist={(prompt) => onPrompt(stage.id, prompt)}
        onPreview={setPreview}
        onGenerate={async () => {
          await flushAll()
          await onGenerate(stage.id)
        }}
      />
      {preview ? (
        <button type="button" className="lightbox" onClick={() => setPreview(null)}>
          <img src={preview} alt="设计图预览" />
        </button>
      ) : null}
    </section>
  )
}

function StageView({
  stage,
  locked,
  onDraft,
  onEditing,
  onPersist,
  onPreview,
  onGenerate
}: {
  stage: StageState
  locked: boolean
  onDraft: (prompt: string) => void
  onEditing: (value: boolean) => void
  onPersist: (prompt: string) => Promise<unknown>
  onPreview: (src: string) => void
  onGenerate: () => Promise<void>
}) {
  const [prompt, setPrompt] = useState(stage.prompt)
  const focused = useRef(false)
  const image = useImage(stage.imagePath)

  useEffect(() => {
    if (!focused.current) {
      setPrompt(stage.prompt)
      onDraft(stage.prompt)
    }
  }, [stage.prompt, stage.id])

  return (
    <>
      <button
        type="button"
        className={image ? 'preview filled' : 'preview'}
        onClick={() => image && onPreview(image)}
        disabled={!image}
      >
        {image ? (
          <img src={image} alt={stage.title} />
        ) : (
          <span className="preview-empty">
            <strong>{stage.title}</strong>
            <span>{stage.status === 'generating' ? '正在生成…' : '还没有图'}</span>
          </span>
        )}
      </button>
      <label className="prompt-box">
        <span className="pane-label">{stage.title}提示词</span>
        <textarea
          value={prompt}
          aria-label={`${stage.title}提示词`}
          placeholder="优化提示词后会填入这里，也可以直接写。"
          onFocus={() => {
            focused.current = true
            onEditing(true)
          }}
          onBlur={() => {
            focused.current = false
            onEditing(false)
            if (prompt !== stage.prompt) void onPersist(prompt)
          }}
          onChange={(event) => {
            setPrompt(event.target.value)
            onDraft(event.target.value)
          }}
        />
      </label>
      {stage.error ? <p className="stage-error">{stage.error}</p> : null}
      <button type="button" className="solid" disabled={locked} onClick={() => void onGenerate()}>
        {stage.status === 'generating' ? '生成中…' : stage.imagePath ? `重新生成${stage.title}` : `生成${stage.title}`}
      </button>
    </>
  )
}

function useImage(relativePath: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!relativePath) {
      setUrl(null)
      return
    }
    let cancelled = false
    window.qdesign
      .readImage(relativePath)
      .then((dataUrl) => {
        if (!cancelled) setUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [relativePath])
  return url
}
