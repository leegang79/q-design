declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ELECTRON_RENDERER_URL?: string
    }
  }
}

export {}
