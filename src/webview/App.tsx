import React, { useState, useEffect } from "react";
import { Settings, Plus } from "lucide-react";
import { ChatView } from "./components/ChatView";
import { ChatList } from "./components/ChatList";
import { SettingsPanel } from "./components/SettingsPanel";
import { Button } from "./components/ui/button";
import { useChat } from "./hooks/useChat";
import { useSettings } from "./hooks/useSettings";
import { useVSCode } from "./hooks/useVSCode";
import { cn } from "./lib/utils";
import hljsLight from "highlight.js/styles/vs.css";
import hljsDark from "highlight.js/styles/vs2015.css";
import "./styles/index.css";

export function App() {
  const chat = useChat();
  const settingsHook = useSettings();
  const { postMessage } = useVSCode();
  const [showSettings, setShowSettings] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>("");

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.id = "hljs-theme";
    document.head.appendChild(styleEl);

    const updateTheme = () => {
      const dark =
        document.body.classList.contains("vscode-dark") ||
        document.body.classList.contains("vscode-high-contrast");
      styleEl.textContent = dark ? hljsDark : hljsLight;
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
      styleEl.remove();
    };
  }, []);

  useEffect(() => {
    if (settingsHook.settings?.defaultModelId) {
      setSelectedModelId(settingsHook.settings.defaultModelId);
    }
  }, [settingsHook.settings?.defaultModelId]);

  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId);
    settingsHook.updateSettings({ defaultModelId: modelId });
  };

  const models = settingsHook.settings?.models || [];

  const mcpStatus = settingsHook.mcpStatus;
  const mcpTotal = mcpStatus.length;
  const mcpConnected = mcpStatus.filter((s) => s.status === "connected").length;

  const appFontClass = settingsHook.settings?.fontFamily
    ? settingsHook.settings.fontFamily === "sans-serif"
      ? "app-font-sans"
      : "app-font-serif"
    : "";

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex justify-between items-center px-3 py-1.5 border-b border-border bg-background select-none">
        <div className="flex items-center gap-2">
          <h1 className="text-xs font-bold tracking-tight text-foreground/80">
            HIME
          </h1>
          {mcpTotal > 0 && (
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                mcpConnected === mcpTotal ? "bg-success" : mcpConnected === 0 ? "bg-destructive" : "bg-warning"
              )}
              title={`MCP: ${mcpConnected}/${mcpTotal} connected\n${mcpStatus.map((s) => `${s.name}: ${s.status}`).join("\n")}`}
            />
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={chat.createChat}
            title="New Chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {showSettings ? (
        <SettingsPanel
          settings={settingsHook.settings}
          hasApiKeys={settingsHook.hasApiKeys}
          connectionTestResult={settingsHook.connectionTestResult}
          onUpdateSettings={settingsHook.updateSettings}
          onSaveModel={settingsHook.saveModel}
          onDeleteModel={settingsHook.deleteModel}
          onReorderModels={settingsHook.reorderModels}
          onTestConnection={settingsHook.testConnection}
          onReconnectMcp={settingsHook.reconnectMcp}
          onOpenSettingsJson={() => postMessage({ command: "openSettingsJson" })}
          onClose={() => setShowSettings(false)}
        />
      ) : (
        <>
          <ChatList
            chats={chat.chats}
            currentChatId={chat.currentChat?.id || null}
            onSelect={chat.loadChat}
            onDelete={chat.deleteChat}
          />

          <ChatView
            className={appFontClass}
            chat={chat.currentChat}
            isStreaming={chat.isStreaming}
            streamingContent={chat.streamingContent}
            streamingMessageId={chat.streamingMessageId}
            streamingToolCalls={chat.streamingToolCalls}
            error={chat.error}
            loadedContextFiles={chat.loadedContextFiles}
            skillsHelp={chat.skillsHelp}
            selectedModelId={selectedModelId}
            models={models}
            onSendMessage={(content) => chat.sendMessage(content, selectedModelId)}
            onModelChange={handleModelChange}
            onClearContext={chat.clearContext}
            onCompressContext={chat.compressContext}
            onAbortStream={chat.abortStream}
            onDismissSkillsHelp={chat.dismissSkillsHelp}
          />
        </>
      )}
    </div>
  );
}
