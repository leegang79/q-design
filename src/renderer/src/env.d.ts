/// <reference types="vite/client" />

import type { QDesignBridge } from '@shared/bridge'

declare global {
  interface Window {
    qdesign: QDesignBridge
  }
}

export {}
