import { STAGES } from './stages'
import type { DesignSession, OptimizeResult, StageId } from './types'

export const OPTIMIZE_SYSTEM_PROMPT = `你是产品设计提示词编辑。用户会用对话描述一个产品。你要把对话整理成可直接交给生图模型的四段提示词。

只输出一个 JSON 对象，不要输出 Markdown，不要解释。格式如下：
{
  "productName": "简短中文产品名",
  "designBrief": "一段中文设计说明，包含用途、造型、材料、颜色、关键结构",
  "stages": [
    {"id": "sketch", "title": "草图", "prompt": ""},
    {"id": "render", "title": "效果图", "prompt": ""},
    {"id": "structure", "title": "结构图", "prompt": ""},
    {"id": "exploded", "title": "零件爆炸图", "prompt": ""}
  ]
}

提示词要求：
- prompt 使用英文，便于生图模型理解。
- 四个 prompt 描述同一个产品，造型、比例、材料、配色保持一致。
- sketch：黑白产品设计草图，多视角线稿，白底，铅笔或墨线，不要写实渲染，不要场景。
- render：单一产品的棚拍效果图，真实材质和光线，纯色或简洁背景，不要人物，不要文字水印。
- structure：技术结构图，白底黑线，展示装配关系和主要部件，可带简洁英文标注，不要写实渲染。
- exploded：零件爆炸图，白底，各零件沿装配轴分开，保留相对位置，可带简洁英文零件名，不要写实场景。
- 如果用户没有说明的细节，做合理且克制的设计假设，并写进 designBrief。
- 不要发明与用户描述冲突的品类。`

export function optimizeClosingMessage(): string {
  return '请根据以上对话输出 JSON。如果信息很少，也要给出完整四段，并在 designBrief 里标明假设。'
}

export function referencePrompt(session: DesignSession, stageId: StageId): string {
  const stage = session.stages.find((item) => item.id === stageId)
  const prompt = stage?.prompt.trim() ?? ''
  const brief = session.designBrief.trim()
  return [
    prompt,
    brief ? `Product brief: ${brief}` : '',
    'Use the attached reference image as the same product. Preserve identity, proportions, materials, and colors while producing this stage.'
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function fallbackPrompt(session: DesignSession, stageId: StageId): string {
  const index = STAGES.findIndex((stage) => stage.id === stageId)
  const stage = session.stages[index]
  const prior = session.stages.slice(0, index).filter((item) => item.prompt.trim())
  const guidance = STAGES[index]?.guidance ?? ''
  return [
    stage?.prompt.trim() ?? '',
    session.designBrief.trim() ? `Product brief: ${session.designBrief.trim()}` : '',
    prior.length
      ? `Keep the same product as the earlier design stages:\n${prior
          .map((item) => `- ${item.title}: ${item.prompt.trim()}`)
          .join('\n')}`
      : '',
    guidance ? `Stage direction: ${guidance}` : ''
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function summaryFromOptimize(result: OptimizeResult): string {
  return `已整理「${result.productName}」的设计说明，并写好四段提示词。可以在右侧修改后再生成。\n\n${result.designBrief}`
}
