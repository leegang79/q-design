import type { StageId, StageState } from './types'

export type StageDefinition = {
  id: StageId
  title: string
  guidance: string
}

export const STAGES: StageDefinition[] = [
  {
    id: 'sketch',
    title: '草图',
    guidance:
      'Black-and-white product design sketch, orthographic and three-quarter line drawings, white background, pencil or ink lines, no photoreal rendering, no scene.'
  },
  {
    id: 'render',
    title: '效果图',
    guidance:
      'Studio product render of one object, realistic materials and lighting, plain background, no people, no watermark, no text.'
  },
  {
    id: 'structure',
    title: '结构图',
    guidance:
      'Technical structure diagram, white background, black lines, show assembly relationships and major parts, short English callouts, no photoreal rendering.'
  },
  {
    id: 'exploded',
    title: '零件爆炸图',
    guidance:
      'Exploded parts diagram, white background, parts separated along the assembly axes while keeping their relative positions, short English part labels, no lifestyle scene.'
  }
]

export function createEmptyStages(): StageState[] {
  return STAGES.map((stage) => ({
    id: stage.id,
    title: stage.title,
    prompt: '',
    imagePath: null,
    status: 'idle',
    error: null
  }))
}

export function stageIndex(id: StageId): number {
  return STAGES.findIndex((stage) => stage.id === id)
}
