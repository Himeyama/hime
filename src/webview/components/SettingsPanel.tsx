import React, { useState } from "react";
import { Code2, X, Eye, EyeOff, Check, AlertCircle, RefreshCw, Trash2, Plug, ChevronUp, ChevronDown } from "lucide-react";
import { ProviderType, ModelEntry, PROVIDER_DISPLAY_NAMES } from "../../types/chat";
import { AppSettings } from "../../types/messages";
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
  connectionTestResult: { modelId: string; success: boolean; error?: string } | null;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onSaveModel: (entry: Omit<ModelEntry, "id" | "displayName">, apiKey?: string) => void;
  onDeleteModel: (modelId: string) => void;
  onReorderModels: (modelIds: string[]) => void;
  onTestConnection: (modelId: string) => void;
  onReconnectMcp: () => void;
  onOpenSettingsJson: () => void;
  onClose: () => void;
}

const PROVIDER_OPTIONS: { value: ProviderType; label: string }[] = [
  { value: "anthropic", label: PROVIDER_DISPLAY_NAMES.anthropic },
  { value: "openai", label: PROVIDER_DISPLAY_NAMES.openai },
  { value: "azure-openai", label: PROVIDER_DISPLAY_NAMES["azure-openai"] },
  { value: "azure-openai-custom", label: PROVIDER_DISPLAY_NAMES["azure-openai-custom"] },
  { value: "ollama", label: PROVIDER_DISPLAY_NAMES.ollama },
  { value: "openrouter", label: PROVIDER_DISPLAY_NAMES.openrouter },
  { value: "google", label: PROVIDER_DISPLAY_NAMES.google },
  { value: "custom", label: PROVIDER_DISPLAY_NAMES.custom },
];

export function SettingsPanel({
  settings,
  hasApiKeys,
  connectionTestResult,
  onUpdateSettings,
  onSaveModel,
  onDeleteModel,
  onReorderModels,
  onTestConnection,
  onReconnectMcp,
  onOpenSettingsJson,
  onClose,
}: SettingsPanelProps) {
  const [newProvider, setNewProvider] = useState<ProviderType>("anthropic");
  const [newModel, setNewModel] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [newEndpoint, setNewEndpoint] = useState("");
  const [newDeploymentName, setNewDeploymentName] = useState("");
  const [showNewApiKey, setShowNewApiKey] = useState(false);
  const [mcpJson, setMcpJson] = useState<string>(
    settings ? JSON.stringify(settings.mcpServers || {}, null, 2) : "{}"
  );
  const [mcpError, setMcpError] = useState<string | null>(null);

  if (!settings) return null;

  const needsEndpoint = newProvider === "azure-openai" || newProvider === "azure-openai-custom" || newProvider === "ollama" || newProvider === "custom";
  const isOllama = newProvider === "ollama";

  const handleSaveModel = () => {
    if (!newModel.trim()) return;
    onSaveModel(
      {
        provider: newProvider,
        model: newModel.trim(),
        endpoint: needsEndpoint ? (newEndpoint.trim() || undefined) : undefined,
        deploymentName: (newProvider === "azure-openai") ? (newDeploymentName.trim() || undefined) : undefined,
      },
      !isOllama && newApiKey.trim() ? newApiKey.trim() : undefined
    );
    setNewModel("");
    setNewApiKey("");
    setNewEndpoint("");
    setNewDeploymentName("");
  };

  const moveModel = (modelId: string, direction: -1 | 1) => {
    const ids = settings.models.map((m) => m.id);
    const idx = ids.indexOf(modelId);
    if (idx < 0) return;
    const next = idx + direction;
    if (next < 0 || next >= ids.length) return;
    [ids[idx], ids[next]] = [ids[next], ids[idx]];
    onReorderModels(ids);
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
      <div className="flex justify-between items-center mb-3 select-none">
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

      {/* モデル管理 */}
      <div className="space-y-3">
        <Label>モデルを追加</Label>

        {/* Row 1: プロバイダ + モデル名 */}
        <div className="flex gap-2">
          <Select value={newProvider} onValueChange={(v) => {
            setNewProvider(v as ProviderType);
            setNewEndpoint("");
            setNewDeploymentName("");
          }}>
            <SelectTrigger className="w-[140px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent sideOffset={4}>
              {PROVIDER_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="flex-1"
            placeholder="モデルID (例: claude-sonnet-4-6)"
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveModel(); }}
          />
        </div>

        {/* Row 2 (Azure): エンドポイント 3:1 デプロイメント名 */}
        {newProvider === "azure-openai" && (
          <div className="flex items-center gap-3">
            <Input
              className="flex-[3]"
              placeholder="エンドポイント URL"
              value={newEndpoint}
              onChange={(e) => setNewEndpoint(e.target.value)}
            />
            <Input
              className="flex-[1]"
              placeholder="デプロイメント名"
              value={newDeploymentName}
              onChange={(e) => setNewDeploymentName(e.target.value)}
            />
          </div>
        )}

        {/* Row 2 (Azure Custom / Ollama / Custom): エンドポイント */}
        {(newProvider === "azure-openai-custom" || newProvider === "ollama" || newProvider === "custom") && (
          <Input
            placeholder={newProvider === "ollama" ? "http://localhost:11434" : "エンドポイント URL"}
            value={newEndpoint}
            onChange={(e) => setNewEndpoint(e.target.value)}
          />
        )}

        {/* Row 3: API キー + 保存 */}
        <div className="flex gap-1 items-center">
          <Input
            type={showNewApiKey ? "text" : "password"}
            className="flex-1"
            placeholder={
              isOllama
                ? "API キー不要"
                : hasApiKeys[newProvider]
                ? "●●● (設定済み)"
                : "API キー"
            }
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.target.value)}
            disabled={isOllama}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveModel(); }}
          />
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowNewApiKey((v) => !v)}
            disabled={isOllama}
            title={showNewApiKey ? "非表示" : "表示"}
          >
            {showNewApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSaveModel}
            disabled={!newModel.trim()}
          >
            追加
          </Button>
        </div>

        {/* 登録済みモデル一覧 */}
        {settings.models.length > 0 && (
          <div className="space-y-1 mt-1">
            <Label className="text-muted-foreground">登録済みモデル</Label>
            {settings.models.map((entry, idx) => {
              const testResult = connectionTestResult?.modelId === entry.id ? connectionTestResult : null;
              return (
                <div key={entry.id} className="space-y-0.5">
                  <div className="flex items-center gap-1 py-1 px-2 rounded-md hover:bg-muted/40">
                    <span className="flex-1 text-xs truncate" title={entry.displayName}>
                      {entry.displayName}
                      {settings.defaultModelId === entry.id && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">(デフォルト)</span>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onTestConnection(entry.id)}
                      title="接続テスト"
                    >
                      <Plug className="h-3 w-3 text-muted-foreground" />
                    </Button>
                    <div className="flex flex-col shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => moveModel(entry.id, -1)}
                        disabled={idx === 0}
                        title="上へ"
                        className="h-3 w-5 text-muted-foreground/50 hover:text-foreground disabled:opacity-20"
                      >
                        <ChevronUp className="h-2.5 w-2.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => moveModel(entry.id, 1)}
                        disabled={idx === settings.models.length - 1}
                        title="下へ"
                        className="h-3 w-5 text-muted-foreground/50 hover:text-foreground disabled:opacity-20"
                      >
                        <ChevronDown className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onDeleteModel(entry.id)}
                      title="削除"
                      className="text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {testResult && (
                    <div
                      className={cn(
                        "text-[10px] px-2.5 py-1 rounded-md flex items-center gap-1 animate-fade-in",
                        testResult.success
                          ? "text-success bg-success/10"
                          : "text-destructive bg-destructive/10"
                      )}
                    >
                      {testResult.success ? (
                        <><Check className="h-3 w-3 shrink-0" /> 接続成功</>
                      ) : (
                        <><AlertCircle className="h-3 w-3 shrink-0" /> {testResult.error}</>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {settings.models.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-2 select-none">
            モデルが登録されていません
          </p>
        )}
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
            value={settings.fontFamily || "default"}
            onValueChange={(v) => onUpdateSettings({ fontFamily: v === "default" ? undefined : (v as "serif" | "sans-serif") })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent sideOffset={4}>
              <SelectItem value="default">VSCode 標準</SelectItem>
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
            <p className="text-[10px] text-destructive select-none">JSON Error: {mcpError}</p>
          )}
          <p className="text-[10px] text-muted-foreground select-none">
            MCP サーバーの設定を JSON 形式で入力してください。変更は自動的に保存されます。
          </p>
        </div>
      </div>
    </div>
  );
}
