/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  // 필요한 환경 변수를 여기에 추가
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
