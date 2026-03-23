import { useState, useCallback, useEffect } from "react";
import { ExtensionToWebviewMessage } from "../../types/messages";
import { useVSCode } from "./useVSCode";
import { ProviderType } from "../../types/chat";
import { AppSettings } from "../../types/messages";

export function useSettings() {
  const { postMessage, onMessage } = useVSCode();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [hasApiKeys, setHasApiKeys] = useState<Record<ProviderType, boolean>>({
    anthropic: false,
    openai: false,
    "azure-openai": false,
    ollama: false,
    openrouter: false,
  });
  const [connectionTestResult, setConnectionTestResult] = useState<{
    provider: ProviderType;
    success: boolean;
    error?: string;
  } | null>(null);
  const [models, setModels] = useState<Record<ProviderType, string[]>>({
    anthropic: [],
    openai: [],
    "azure-openai": [],
    ollama: [],
    openrouter: [],
  });
  const [mcpStatus, setMcpStatus] = useState<{ name: string; status: "connected" | "error"; toolCount: number }[]>([]);

  useEffect(() => {
    postMessage({ command: "getSettings" });
    postMessage({ command: "getMcpStatus" });

    return onMessage((msg: ExtensionToWebviewMessage) => {
      switch (msg.type) {
        case "settings":
          setSettings(msg.settings);
          setHasApiKeys(msg.hasApiKeys);
          break;
        case "connectionTestResult":
          setConnectionTestResult({
            provider: msg.provider,
            success: msg.success,
            error: msg.error,
          });
          break;
        case "modelList":
          setModels((prev) => ({ ...prev, [msg.provider]: msg.models }));
          break;
        case "mcpStatus":
          setMcpStatus(msg.servers);
          break;
      }
    });
  }, [onMessage, postMessage]);

  const updateSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      postMessage({ command: "updateSettings", settings: partial });
    },
    [postMessage]
  );

  const setApiKey = useCallback(
    (provider: ProviderType, apiKey: string) => {
      postMessage({ command: "setApiKey", provider, apiKey });
    },
    [postMessage]
  );

  const deleteApiKey = useCallback(
    (provider: ProviderType) => {
      postMessage({ command: "deleteApiKey", provider });
    },
    [postMessage]
  );

  const testConnection = useCallback(
    (provider: ProviderType) => {
      setConnectionTestResult(null);
      postMessage({ command: "testConnection", provider });
    },
    [postMessage]
  );

  const listModels = useCallback(
    (provider: ProviderType) => {
      postMessage({ command: "listModels", provider });
    },
    [postMessage]
  );

  const reconnectMcp = useCallback(() => {
    postMessage({ command: "reconnectMcp" });
  }, [postMessage]);

  return {
    settings,
    hasApiKeys,
    connectionTestResult,
    models,
    mcpStatus,
    updateSettings,
    setApiKey,
    deleteApiKey,
    testConnection,
    listModels,
    reconnectMcp,
  };
}
