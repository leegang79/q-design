import { useState } from 'react'
import { MODEL_PRESETS, protocolLabel, protocolsForKind } from '@shared/presets'
import type { ModelKind, ProfileInput, Protocol, PublicState } from '@shared/types'

type SettingsPanelProps = {
  state: PublicState
  onClose: () => void
  onCommit: (work: () => Promise<PublicState>) => Promise<void>
}

const EMPTY_DRAFT: ProfileInput = {
  name: '',
  kind: 'chat',
  protocol: 'openai-chat',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: ''
}

export function SettingsPanel({ state, onClose, onCommit }: SettingsPanelProps) {
  const [draft, setDraft] = useState<ProfileInput>(EMPTY_DRAFT)
  const [editing, setEditing] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function applyPreset(presetId: string) {
    const preset = MODEL_PRESETS.find((item) => item.id === presetId)
    if (!preset) return
    setDraft((current) => ({
      ...current,
      name: preset.label,
      kind: preset.kind,
      protocol: preset.protocol,
      baseUrl: preset.baseUrl,
      model: preset.model
    }))
    setTestMessage(null)
    setFormError(null)
  }

  function editProfile(id: string) {
    const profile = state.profiles.find((item) => item.id === id)
    if (!profile) return
    setEditing(true)
    setDraft({
      id: profile.id,
      name: profile.name,
      kind: profile.kind,
      protocol: profile.protocol,
      baseUrl: profile.baseUrl,
      apiKey: '',
      model: profile.model
    })
    setTestMessage(null)
    setFormError(null)
  }

  function updateKind(kind: ModelKind) {
    const protocols = protocolsForKind(kind)
    setDraft((current) => ({
      ...current,
      kind,
      protocol: protocols.includes(current.protocol) ? current.protocol : protocols[0]
    }))
  }

  async function save() {
    try {
      const next = await window.qdesign.saveProfile(draft)
      setFormError(null)
      setTestMessage(null)
      setEditing(false)
      setDraft(EMPTY_DRAFT)
      await onCommit(async () => next)
    } catch (error) {
      setFormError(error instanceof Error ? cleanError(error.message) : '保存失败')
    }
  }

  async function test() {
    setTesting(true)
    setTestMessage(null)
    try {
      const result = await window.qdesign.testConnection(draft)
      setTestMessage(result.message)
    } catch (error) {
      setTestMessage(error instanceof Error ? cleanError(error.message) : '测试失败')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <section className="sheet" role="dialog" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="sheet-head">
          <div>
            <p className="eyebrow">本地配置</p>
            <h2 id="settings-title">模型设置</h2>
          </div>
          <button type="button" className="ghost" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="sheet-grid">
          <div className="profile-list">
            {state.profiles.length === 0 ? <p className="hint">还没有模型。从右侧预设开始添加。</p> : null}
            {state.profiles.map((profile) => {
              const active =
                profile.id === state.activeChatProfileId || profile.id === state.activeImageProfileId
              return (
                <article key={profile.id} className="profile-row">
                  <div>
                    <strong>{profile.name}</strong>
                    <span>
                      {profile.kind === 'chat' ? '聊天' : '生图'} · {protocolLabel(profile.protocol)}
                      {active ? ' · 当前' : ''}
                    </span>
                    <span>{profile.model}</span>
                    <span>{profile.hasApiKey ? profile.apiKeyMasked : '未填写密钥'}</span>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="text-button" onClick={() => editProfile(profile.id)}>
                      编辑
                    </button>
                    <button
                      type="button"
                      className="text-button danger"
                      onClick={() => void onCommit(() => window.qdesign.deleteProfile(profile.id))}
                    >
                      删除
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
          <form
            className="profile-form"
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <p className="eyebrow">{editing ? '编辑配置' : '新建配置'}</p>
            <label>
              从预设填入
              <select value="" onChange={(event) => applyPreset(event.target.value)}>
                <option value="">选择预设</option>
                {MODEL_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label} · {preset.hint}
                  </option>
                ))}
              </select>
            </label>
            <label>
              名称
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>
            <label>
              用途
              <select value={draft.kind} onChange={(event) => updateKind(event.target.value as ModelKind)}>
                <option value="chat">聊天，用来优化提示词</option>
                <option value="image">生图</option>
              </select>
            </label>
            <label>
              协议
              <select
                value={draft.protocol}
                onChange={(event) => setDraft({ ...draft, protocol: event.target.value as Protocol })}
              >
                {protocolsForKind(draft.kind).map((protocol) => (
                  <option key={protocol} value={protocol}>
                    {protocolLabel(protocol)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Base URL
              <input
                value={draft.baseUrl}
                onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
              />
            </label>
            <label>
              模型名
              <input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} />
            </label>
            <label>
              API Key
              <input
                type="password"
                value={draft.apiKey}
                placeholder={editing ? '已保存的密钥留空则不修改' : ''}
                onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
                autoComplete="off"
              />
            </label>
            {formError ? <p className="banner error">{formError}</p> : null}
            {testMessage ? <p className="banner">{testMessage}</p> : null}
            <div className="composer-actions">
              <button type="submit" className="solid">
                保存配置
              </button>
              <button type="button" className="ghost" disabled={testing} onClick={() => void test()}>
                {testing ? '测试中…' : '测试连接'}
              </button>
              {editing ? (
                <button type="button" className="text-button" onClick={resetDraft}>
                  改为新建
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </section>
    </div>
  )

  function resetDraft() {
    setEditing(false)
    setDraft(EMPTY_DRAFT)
    setTestMessage(null)
    setFormError(null)
  }
}

function cleanError(message: string): string {
  return message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
}
