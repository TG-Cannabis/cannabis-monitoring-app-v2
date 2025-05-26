interface EnvConfig {
  apiUrl: string;
  wsUrl: string;
}

interface Window {
  env: EnvConfig;
}
