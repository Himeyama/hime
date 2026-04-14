import React, { useState } from "react";
import { Code2, X, Eye, EyeOff, Check, AlertCircle, RefreshCw } from "lucide-react";
import { ProviderType } from "../../types/chat";
import { AppSettings, ProviderSettings } from "../../types/messages";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Separator } from "./ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { cn } from "../lib/utils";

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
  google: "Google Gemini",
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
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>("anthropic");
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
    <div className="flex-1 bg-card overflow-y-auto p-3 scrollbar-thin animate-slide-down">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-foreground">設定</h2>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-xs" onClick={onOpenSettingsJson} title="settings.json を開く">
            <Code2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={onClose} title="閉じる">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* プロバイダーセクション */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>プロバイダー設定</Label>
          <Select value={selectedProvider} onValueChange={(v) => setSelectedProvider(v as ProviderType)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent sideOffset={4}>
              {(Object.keys(PROVIDER_NAMES) as ProviderType[]).map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {PROVIDER_NAMES[provider]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2.5 animate-fade-in">
          {/* APIキー */}
          {selectedProvider !== "ollama" && (
            <div className="space-y-1">
              <Label>
                {selectedProvider === "google" ? "API キー (Gemini Developer API 用)" : "APIキー"}
              </Label>
              <div className="flex gap-1 items-center">
                <Input
                  type={showApiKey[selectedProvider] ? "text" : "password"}
                  className="flex-1"
                  value={apiKeyInputs[selectedProvider] || ""}
                  onChange={(e) =>
                    setApiKeyInputs((prev) => ({ ...prev, [selectedProvider]: e.target.value }))
                  }
                  placeholder={hasApiKeys[selectedProvider] ? "•••••（設定済み）" : "APIキーを入力"}
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() =>
                    setShowApiKey((prev) => ({ ...prev, [selectedProvider]: !prev[selectedProvider] }))
                  }
                  title={showApiKey[selectedProvider] ? "非表示" : "表示"}
                >
                  {showApiKey[selectedProvider] ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSetApiKey(selectedProvider)}
                >
                  保存
                </Button>
                {hasApiKeys[selectedProvider] && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => onDeleteApiKey(selectedProvider)}
                  >
                    削除
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* エンドポイント / プロジェクト ID */}
          <div className="space-y-1">
            <Label>
              {selectedProvider === "google" ? "プロジェクト ID (Vertex AI 用)" : "エンドポイント"}
            </Label>
            <Input
              type="text"
              value={settings.providers[selectedProvider]?.endpoint || ""}
              onChange={(e) => updateProviderSetting(selectedProvider, "endpoint", e.target.value)}
              placeholder="デフォルト"
            />
          </div>

          {/* デプロイメント名（Azure）/ リージョン（Google） */}
          {(selectedProvider === "azure-openai" || selectedProvider === "google") && (
            <div className="space-y-1">
              <Label>
                {selectedProvider === "google" ? "リージョン (Vertex AI 用)" : "デプロイメント名"}
              </Label>
              <Input
                type="text"
                value={settings.providers[selectedProvider]?.deploymentName || ""}
                onChange={(e) => updateProviderSetting(selectedProvider, "deploymentName", e.target.value)}
              />
            </div>
          )}

          {/* モデル */}
          <div className="space-y-1">
            <Label>モデル</Label>
            <Input
              type="text"
              value={settings.providers[selectedProvider]?.model || ""}
              onChange={(e) => updateProviderSetting(selectedProvider, "model", e.target.value)}
            />
          </div>

          {/* 接続テスト */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onTestConnection(selectedProvider)}
          >
            接続テスト
          </Button>

          {connectionTestResult?.provider === selectedProvider && (
            <div
              className={cn(
                "text-xs px-2.5 py-1.5 rounded-md animate-fade-in flex items-center gap-1.5",
                connectionTestResult.success
                  ? "text-success bg-success/10"
                  : "text-destructive bg-destructive/10"
              )}
            >
              {connectionTestResult.success ? (
                <>
                  <Check className="h-3 w-3 shrink-0" />
                  接続成功
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {connectionTestResult.error}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <Separator className="my-4" />

      {/* 共通設定 */}
      <div className="space-y-4">
        <h3 className="text-[13px] font-semibold text-foreground">共通設定</h3>

        <div className="space-y-1">
          <Label>システムプロンプト</Label>
          <Textarea
            value={settings.systemPrompt || ""}
            onChange={(e) => onUpdateSettings({ systemPrompt: e.target.value })}
            placeholder="カスタムシステムプロンプト"
            rows={4}
            className="min-h-[60px]"
          />
        </div>

        <div className="space-y-1">
          <Label>フォント設定</Label>
          <Select
            value={settings.fontFamily || "serif"}
            onValueChange={(v) => onUpdateSettings({ fontFamily: v as "serif" | "sans-serif" })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent sideOffset={4}>
              <SelectItem value="sans-serif">サンセリフ</SelectItem>
              <SelectItem value="serif">セリフ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="auto-load-files"
            checked={settings.autoLoadProjectFiles !== false}
            onCheckedChange={(checked) => onUpdateSettings({ autoLoadProjectFiles: checked })}
          />
          <Label htmlFor="auto-load-files" className="cursor-pointer">
            CLAUDE.md / AGENTS.md / README.md を自動読み込み
          </Label>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Label>MCP Servers (JSON)</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={onReconnectMcp}
              disabled={!!mcpError}
              title="MCP サーバーに再接続"
              className="h-6 px-2 text-[10px]"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              再接続
            </Button>
          </div>
          <Textarea
            className={cn(
              "min-h-[120px] font-mono text-[11px]",
              mcpError && "border-destructive focus:border-destructive"
            )}
            value={mcpJson}
            onChange={(e) => handleMcpChange(e.target.value)}
            placeholder='{ 
  "my-server": { "command": "node", "args": ["server.js"] },
  "drawio-local": { "command": "npx", "args": ["-y", "drawio-mcp-server"] },
  "sse-server": { "url": "https://mcp.example.com/sse" }
}'
            rows={8}
            spellCheck={false}
          />
          {mcpError && (
            <p className="text-[10px] text-destructive">JSON Error: {mcpError}</p>
          )}
          <p className="text-[10px] text-muted-foreground">
            MCP サーバーの設定を JSON 形式で入力してください。変更は自動的に保存されます。
          </p>
        </div>
      </div>
    </div>
  );
}
