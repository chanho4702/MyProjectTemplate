import "@fontsource-variable/ibm-plex-sans";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createApiClient } from "@myprojecttemplate/api-client";
import { App } from "./App";
import { loadRuntimeConfig } from "./runtime-config";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("React root element was not found.");

const root = createRoot(rootElement);

async function bootstrap() {
  try {
    const runtimeConfig = await loadRuntimeConfig();
    const apiClient = createApiClient({ baseUrl: runtimeConfig.apiBaseUrl });

    root.render(
      <StrictMode>
        <App apiClient={apiClient} runtimeConfig={runtimeConfig} />
      </StrictMode>,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 설정 오류가 발생했습니다.";
    root.render(
      <StrictMode>
        <main className="bootstrap-failure">
          <p className="kicker">CONFIGURATION ERROR</p>
          <h1>화면을 시작하지 못했습니다.</h1>
          <p>{message}</p>
          <code>/app-config.json</code>
        </main>
      </StrictMode>,
    );
  }
}

void bootstrap();
