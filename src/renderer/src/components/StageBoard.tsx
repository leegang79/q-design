import { useEffect, useRef, useState } from 'react'
import type { DesignSession, PublicProfile, StageId, StageState } from '@shared/types'

type StageBoardProps = {
  session: DesignSession
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
  const imageProfiles = profiles.filter((profile) => profile.kind === 'image')
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    drafts.current = new Map(session.stages.map((stage) => [stage.id, stage.prompt]))
  }, [session.id])

  async function flushPrompts(): Promise<void> {
    for (const stage of session.stages) {
      const draft = drafts.current.get(stage.id)
      if (draft !== undefined && draft !== stage.prompt) {
        await onPrompt(stage.id, draft)
      }
    }
  }

  return (
    <aside className="board">
      <header className="topbar">
        <label className="model-select">
          <span>生图模型</span>
          <select
            value={activeImageProfileId ?? ''}
            onChange={(event) => onSelectModel(event.target.value || null)}
          >
            <option value="">{imageProfiles.length ? '未选择' : '尚未配置'}</option>
            {imageProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} · {profile.model}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="board-body">
        <div className="board-intro">
          <div>
            <p className="eyebrow">设计说明</p>
            <p>{session.designBrief || '优化提示词后，这里会显示统一的产品说明。已生成的图会保留，直到你再次生成。'}</p>
          </div>
          <button
            type="button"
            className="solid"
            disabled={locked}
            onClick={() => {
              void flushPrompts().then(onGenerateAll)
            }}
          >
            {busy ? '生成中…' : '全部生成'}
          </button>
        </div>
        {session.boardError ? <p className="banner error">{session.boardError}</p> : null}
        <p className="hint">后一阶段会把已生成的前序图片作为参考。接口不支持参考图时，会改用带设计说明的纯文本提示词。</p>
        {session.stages.map((stage, index) => (
          <StageCard
            key={`${session.id}-${stage.id}`}
            index={index}
            stage={stage}
            locked={locked}
            onDraft={(prompt) => drafts.current.set(stage.id, prompt)}
            onPersist={(prompt) => onPrompt(stage.id, prompt)}
            onPreview={setPreview}
            onGenerate={async () => {
              await flushPrompts()
              await onGenerate(stage.id)
            }}
          />
        ))}
      </div>
      {preview ? (
        <button type="button" className="lightbox" onClick={() => setPreview(null)}>
          <img src={preview} alt="设计图预览" />
        </button>
      ) : null}
    </aside>
  )
}

function StageCard({
  index,
  stage,
  locked,
  onDraft,
  onPersist,
  onPreview,
  onGenerate
}: {
  index: number
  stage: StageState
  locked: boolean
  onDraft: (prompt: string) => void
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
    <article className="stage-card">
      <header>
        <div>
          <p className="eyebrow">0{index + 1}</p>
          <h2>{stage.title}</h2>
        </div>
        <span className={`status ${stage.status}`}>{statusLabel(stage)}</span>
      </header>
      <button
        type="button"
        className={image ? 'thumb filled' : 'thumb'}
        onClick={() => image && onPreview(image)}
        disabled={!image}
      >
        {image ? <img src={image} alt={stage.title} /> : <span>等待生成</span>}
      </button>
      <textarea
        value={prompt}
        aria-label={`${stage.title}提示词`}
        placeholder="优化提示词后会填入这里，也可以直接写。"
        onFocus={() => {
          focused.current = true
        }}
        onBlur={() => {
          focused.current = false
          if (prompt !== stage.prompt) void onPersist(prompt)
        }}
        onChange={(event) => {
          setPrompt(event.target.value)
          onDraft(event.target.value)
        }}
      />
      {stage.error ? <p className="stage-error">{stage.error}</p> : null}
      <button type="button" className="ghost full" disabled={locked} onClick={() => void onGenerate()}>
        {stage.status === 'generating' ? '生成中…' : stage.imagePath ? '重新生成' : '生成'}
      </button>
    </article>
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

function statusLabel(stage: StageState): string {
  if (stage.status === 'generating') return '生成中'
  if (stage.status === 'done') return '已生成'
  if (stage.status === 'error') return '失败'
  return '未生成'
}
