import { useState, useCallback, useEffect } from "react";
import { ExtensionToWebviewMessage, AppSettings } from "../../types/messages";
import { useVSCode } from "./useVSCode";
import { ProviderType, ModelEntry } from "../../types/chat";

export function useSettings() {
  const { postMessage, onMessage } = useVSCode();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [hasApiKeys, setHasApiKeys] = useState<Record<ProviderType, boolean>>({
    anthropic: false,
    openai: false,
    "azure-openai": false,
    "azure-openai-custom": false,
    ollama: true,
    openrouter: false,
    google: false,
    custom: false,
  });
  const [connectionTestResult, setConnectionTestResult] = useState<{
    modelId: string;
    success: boolean;
    error?: string;
  } | null>(null);
  const [mcpStatus, setMcpStatus] = useState<{ name: string; status: "connected" | "disconnected" | "error"; toolCount: number }[]>([]);

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
            modelId: msg.modelId,
            success: msg.success,
            error: msg.error,
          });
          break;
        case "mcpStatus":
          setMcpStatus(msg.servers);
          break;
      }
    });
  }, [onMessage, postMessage]);

  const updateSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      setSettings((prev) => (prev ? { ...prev, ...partial } : prev));
      postMessage({ command: "updateSettings", settings: partial });
    },
    [postMessage]
  );

  const saveModel = useCallback(
    (entry: Omit<ModelEntry, "id" | "displayName">, apiKey?: string) => {
      postMessage({ command: "saveModel", entry, apiKey });
    },
    [postMessage]
  );

  const deleteModel = useCallback(
    (modelId: string) => {
      postMessage({ command: "deleteModel", modelId });
    },
    [postMessage]
  );

  const testConnection = useCallback(
    (modelId: string) => {
      setConnectionTestResult(null);
      postMessage({ command: "testConnection", modelId });
    },
    [postMessage]
  );

  const reorderModels = useCallback(
    (modelIds: string[]) => {
      postMessage({ command: "reorderModels", modelIds });
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
    mcpStatus,
    updateSettings,
    saveModel,
    deleteModel,
    reorderModels,
    testConnection,
    reconnectMcp,
  };
}
