/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_NODE_ENV: string
    readonly VITE_SERVER_PORT: number
    readonly VITE_SERVER_URL: string
    // Add other env variables here
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }