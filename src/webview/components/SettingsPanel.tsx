import React, { useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ProviderType } from "../../types/chat";
import { AppSettings, ProviderSettings } from "../../types/messages";

interface SettingsPanelProps {
  settings: AppSettings | null;
  hasApiKeys: Record<ProviderType, boolean>;
  connectionTestResult: { provider: ProviderType; success: boolean; error?: string } | null;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onSetApiKey: (provider: ProviderType, apiKey: string) => void;
  onDeleteApiKey: (provider: ProviderType) => void;
  onTestConnection: (provider: ProviderType) => void;
  onReconnectMcp: () => void;
  onOpenSettingsJson: () => void;
  onClose: () => void;
}

const PROVIDER_NAMES: Record<ProviderType, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  "azure-openai": "Azure OpenAI",
  ollama: "Ollama",
  openrouter: "OpenRouter",
};

export function SettingsPanel({
  settings,
  hasApiKeys,
  connectionTestResult,
  onUpdateSettings,
  onSetApiKey,
  onDeleteApiKey,
  onTestConnection,
  onReconnectMcp,
  onOpenSettingsJson,
  onClose,
}: SettingsPanelProps) {
  const [expandedProvider, setExpandedProvider] = useState<ProviderType | null>(null);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [mcpJson, setMcpJson] = useState<string>(
    settings ? JSON.stringify(settings.mcpServers || {}, null, 2) : "{}"
  );
  const [mcpError, setMcpError] = useState<string | null>(null);

  if (!settings) return null;

  const updateProviderSetting = (provider: ProviderType, key: keyof ProviderSettings, value: string) => {
    const current = settings.providers[provider];
    onUpdateSettings({
      providers: {
        ...settings.providers,
        [provider]: { ...current, [key]: value },
      },
    });
  };

  const handleSetApiKey = (provider: ProviderType) => {
    const key = apiKeyInputs[provider];
    if (key) {
      onSetApiKey(provider, key);
      setApiKeyInputs((prev) => ({ ...prev, [provider]: "" }));
    }
  };

  const handleMcpChange = (value: string) => {
    setMcpJson(value);
    try {
      const parsed = JSON.parse(value);
      setMcpError(null);
      onUpdateSettings({ mcpServers: parsed });
    } catch (e) {
      setMcpError((e as Error).message);
    }
  };

  return (
    <div className="border-b border-vsc-border bg-vsc-bg-secondary max-h-[60vh] overflow-y-auto p-3 scrollbar-thin animate-slide-down">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold">設定</h2>
        <div className="flex items-center gap-0.5">
          <button
            className="bg-transparent border-none text-vsc-fg-secondary cursor-pointer p-1 px-1.5 rounded hover:bg-vsc-bg-hover hover:text-vsc-fg transition-colors"
            onClick={onOpenSettingsJson}
            title="settings.json を開く"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 2.984V2h-.09c-.313 0-.616.062-.909.185a2.33 2.33 0 0 0-.775.53 2.23 2.23 0 0 0-.493.753v.001a3.542 3.542 0 0 0-.198.83v.002a6.08 6.08 0 0 0-.024.863c.012.29.018.58.018.869 0 .203-.04.393-.117.572v.001a1.504 1.504 0 0 1-.765.787 1.376 1.376 0 0 1-.558.115H2v.984h.09c.195 0 .38.04.556.121l.001.001c.178.078.329.184.455.318l.002.002c.13.13.233.285.307.465l.001.002c.078.18.117.368.117.566 0 .29-.006.58-.018.869-.012.296-.004.585.024.863v.002c.033.283.099.546.198.83v.001c.1.26.265.499.493.753a2.33 2.33 0 0 0 .775.53c.293.123.596.185.91.185H6v-.984h-.09c-.199 0-.387-.04-.562-.121a1.49 1.49 0 0 1-.457-.32 1.466 1.466 0 0 1-.297-.465 1.375 1.375 0 0 1-.116-.573c0-.228.003-.453.011-.674.008-.228.008-.45 0-.665a4.639 4.639 0 0 0-.055-.64 2.682 2.682 0 0 0-.168-.609A2.284 2.284 0 0 0 3.522 8a2.284 2.284 0 0 0 .744-.744c.084-.166.14-.348.168-.61.03-.219.048-.435.055-.64.008-.214.008-.436 0-.664A13.782 13.782 0 0 1 4.48 4.67c0-.206.04-.395.116-.573a1.466 1.466 0 0 1 .297-.465 1.49 1.49 0 0 1 .457-.32A1.376 1.376 0 0 1 5.91 3.19H6V2.984z" />
              <path d="M10 2.984V2h.09c.313 0 .616.062.909.185.293.123.557.303.775.53.228.254.393.493.493.753v.001c.1.284.165.547.198.83v.002c.028.278.036.567.024.863-.012.29-.018.58-.018.869 0 .203.04.393.117.572v.001a1.504 1.504 0 0 0 .765.787c.176.077.363.115.558.115H14v.984h-.09a1.376 1.376 0 0 0-.556.121l-.001.001a1.322 1.322 0 0 0-.455.318l-.002.002a1.466 1.466 0 0 0-.307.465l-.001.002a1.375 1.375 0 0 0-.117.566c0 .29.006.58.018.869.012.296.004.585-.024.863v.002a3.542 3.542 0 0 1-.198.83v.001a2.23 2.23 0 0 1-.493.753 2.33 2.33 0 0 1-.775.53 2.325 2.325 0 0 1-.91.185H10v-.984h.09c.199 0 .387-.04.562-.121a1.49 1.49 0 0 0 .457-.32c.13-.13.233-.285.297-.465.078-.18.116-.367.116-.573 0-.228-.003-.453-.011-.674a6.427 6.427 0 0 1 0-.665c.007-.219.025-.435.055-.64.028-.261.084-.443.168-.609A2.284 2.284 0 0 1 12.478 8a2.284 2.284 0 0 1-.744-.744 1.99 1.99 0 0 1-.168-.61 4.639 4.639 0 0 1-.055-.64 8.492 8.492 0 0 1 0-.664c.008-.221.011-.446.011-.674 0-.206-.038-.395-.116-.573a1.466 1.466 0 0 0-.297-.465 1.49 1.49 0 0 0-.457-.32 1.376 1.376 0 0 0-.562-.121H10V2.984z" />
            </svg>
          </button>
          <button
            className="bg-transparent border-none text-vsc-fg-secondary cursor-pointer p-1 px-1.5 rounded hover:bg-vsc-bg-hover hover:text-vsc-fg transition-colors"
            onClick={onClose}
            title="閉じる"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* プロバイダーセクション */}
      {(Object.keys(PROVIDER_NAMES) as ProviderType[]).map((provider) => (
        <Collapsible.Root
          key={provider}
          open={expandedProvider === provider}
          onOpenChange={(open) => setExpandedProvider(open ? provider : null)}
          className="mb-1"
        >
          <Collapsible.Trigger className="bg-transparent border-none text-vsc-fg cursor-pointer py-1.5 px-0 text-[13px] w-full text-left flex items-center gap-1.5 rounded hover:text-vsc-accent transition-colors select-none">
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="currentColor"
              className={`transition-transform duration-200 ${expandedProvider === provider ? "rotate-90" : ""}`}
            >
              <path d="M6 4l4 4-4 4" />
            </svg>
            <span className="font-medium">{PROVIDER_NAMES[provider]}</span>
          </Collapsible.Trigger>

          <Collapsible.Content className="pl-4 pb-2 pt-1 space-y-2.5 animate-slide-down">
            {/* APIキー */}
            {provider !== "ollama" && (
              <div>
                <label className="block text-xs text-vsc-fg-secondary mb-1">APIキー:</label>
                <div className="flex gap-1 items-center">
                  <input
                    type={showApiKey[provider] ? "text" : "password"}
                    className="flex-1 bg-vsc-input-bg text-vsc-input-fg border border-vsc-input-border rounded-md px-2 py-1 text-xs outline-none focus:border-vsc-accent transition-colors"
                    value={apiKeyInputs[provider] || ""}
                    onChange={(e) =>
                      setApiKeyInputs((prev) => ({ ...prev, [provider]: e.target.value }))
                    }
                    placeholder={hasApiKeys[provider] ? "•••••（設定済み）" : "APIキーを入力"}
                  />
                  <button
                    className="bg-transparent border-none text-vsc-fg cursor-pointer p-1 rounded hover:bg-vsc-bg-hover text-xs transition-colors"
                    onClick={() =>
                      setShowApiKey((prev) => ({ ...prev, [provider]: !prev[provider] }))
                    }
                    title={showApiKey[provider] ? "非表示" : "表示"}
                  >
                    {showApiKey[provider] ? (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z" />
                        <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299l.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z" />
                        <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.72 2.641-3.238l.708.709z" />
                        <path d="M13.646 14.354l-12-12 .708-.708 12 12-.708.708z" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" />
                        <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
                      </svg>
                    )}
                  </button>
                  <button
                    className="bg-transparent border border-vsc-border text-vsc-fg cursor-pointer px-2 py-1 rounded-md text-xs hover:bg-vsc-bg-hover transition-colors"
                    onClick={() => handleSetApiKey(provider)}
                  >
                    保存
                  </button>
                  {hasApiKeys[provider] && (
                    <button
                      className="bg-transparent border border-vsc-danger/50 text-vsc-danger cursor-pointer px-2 py-1 rounded-md text-xs hover:bg-vsc-danger/10 transition-colors"
                      onClick={() => onDeleteApiKey(provider)}
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* エンドポイント */}
            <div>
              <label className="block text-xs text-vsc-fg-secondary mb-1">エンドポイント:</label>
              <input
                type="text"
                className="w-full bg-vsc-input-bg text-vsc-input-fg border border-vsc-input-border rounded-md px-2 py-1 text-xs outline-none focus:border-vsc-accent transition-colors"
                value={settings.providers[provider]?.endpoint || ""}
                onChange={(e) => updateProviderSetting(provider, "endpoint", e.target.value)}
                placeholder="デフォルト"
              />
            </div>

            {/* デプロイメント名（Azure のみ） */}
            {provider === "azure-openai" && (
              <div>
                <label className="block text-xs text-vsc-fg-secondary mb-1">デプロイメント名:</label>
                <input
                  type="text"
                  className="w-full bg-vsc-input-bg text-vsc-input-fg border border-vsc-input-border rounded-md px-2 py-1 text-xs outline-none focus:border-vsc-accent transition-colors"
                  value={settings.providers[provider]?.deploymentName || ""}
                  onChange={(e) => updateProviderSetting(provider, "deploymentName", e.target.value)}
                />
              </div>
            )}

            {/* モデル */}
            <div>
              <label className="block text-xs text-vsc-fg-secondary mb-1">モデル:</label>
              <input
                type="text"
                className="w-full bg-vsc-input-bg text-vsc-input-fg border border-vsc-input-border rounded-md px-2 py-1 text-xs outline-none focus:border-vsc-accent transition-colors"
                value={settings.providers[provider]?.model || ""}
                onChange={(e) => updateProviderSetting(provider, "model", e.target.value)}
              />
            </div>

            {/* 接続テスト */}
            <button
              className="bg-transparent border border-vsc-border text-vsc-fg cursor-pointer px-2.5 py-1 rounded-md text-xs hover:bg-vsc-bg-hover transition-colors"
              onClick={() => onTestConnection(provider)}
            >
              接続テスト
            </button>
            {connectionTestResult?.provider === provider && (
              <div
                className={`text-xs mt-1 px-2.5 py-1.5 rounded-md animate-fade-in flex items-center gap-1.5 ${
                  connectionTestResult.success
                    ? "text-vsc-success bg-vsc-success/10"
                    : "text-vsc-danger bg-vsc-danger/10"
                }`}
              >
                {connectionTestResult.success ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                    </svg>
                    接続成功
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                    </svg>
                    {connectionTestResult.error}
                  </>
                )}
              </div>
            )}
          </Collapsible.Content>
        </Collapsible.Root>
      ))}

      {/* 共通設定 */}
      <div className="mt-3 pt-3 border-t border-vsc-border/50">
        <h3 className="text-[13px] font-semibold mb-2">共通設定</h3>
        <div>
          <label className="block text-xs text-vsc-fg-secondary mb-1">システムプロンプト:</label>
          <textarea
            className="w-full bg-vsc-input-bg text-vsc-input-fg border border-vsc-input-border rounded-md px-2 py-1.5 text-xs outline-none focus:border-vsc-accent transition-colors resize-y min-h-[60px]"
            value={settings.systemPrompt || ""}
            onChange={(e) => onUpdateSettings({ systemPrompt: e.target.value })}
            placeholder="カスタムシステムプロンプト"
            rows={4}
          />
        </div>

        <div className="mt-4">
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs text-vsc-fg-secondary">MCP Servers (JSON):</label>
            <button
              className="bg-transparent border border-vsc-border text-vsc-fg cursor-pointer px-1.5 py-0.5 rounded text-[10px] hover:bg-vsc-bg-hover transition-colors"
              onClick={onReconnectMcp}
              disabled={!!mcpError}
              title="MCP サーバーに再接続"
            >
              再接続
            </button>
          </div>
          <textarea
            className={`w-full bg-vsc-input-bg text-vsc-input-fg border ${
              mcpError ? "border-vsc-danger" : "border-vsc-input-border"
            } rounded-md px-2 py-1.5 text-[11px] font-mono outline-none focus:border-vsc-accent transition-colors resize-y min-h-[120px]`}
            value={mcpJson}
            onChange={(e) => handleMcpChange(e.target.value)}
            placeholder='{ "my-server": { "command": "node", "args": ["server.js"] } }'
            rows={8}
            spellCheck={false}
          />
          {mcpError && <div className="text-[10px] text-vsc-danger mt-1">JSON Error: {mcpError}</div>}
          <p className="text-[10px] text-vsc-fg-secondary mt-1">
            MCP サーバーの設定を JSON 形式で入力してください。変更は自動的に保存されます。
          </p>
        </div>
      </div>
    </div>
  );
}
