import React, { useState, useEffect } from "react";
import { Settings, Plus } from "lucide-react";
import { ChatView } from "./components/ChatView";
import { ChatList } from "./components/ChatList";
import { SettingsPanel } from "./components/SettingsPanel";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { useChat } from "./hooks/useChat";
import { useSettings } from "./hooks/useSettings";
import { useVSCode } from "./hooks/useVSCode";
import { ProviderType } from "../types/chat";
import "highlight.js/styles/vs.css";
import "./styles/index.css";

export function App() {
  const chat = useChat();
  const settingsHook = useSettings();
  const { postMessage } = useVSCode();
  const [showSettings, setShowSettings] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>("anthropic");

  useEffect(() => {
    if (settingsHook.settings?.defaultProvider) {
      setSelectedProvider(settingsHook.settings.defaultProvider);
    }
  }, [settingsHook.settings?.defaultProvider]);

  const handleProviderChange = (provider: ProviderType) => {
    setSelectedProvider(provider);
    settingsHook.updateSettings({ defaultProvider: provider });
  };

  const mcpStatus = settingsHook.mcpStatus;
  const mcpTotal = mcpStatus.length;
  const mcpConnected = mcpStatus.filter((s) => s.status === "connected").length;
  const mcpBadgeVariant =
    mcpTotal === 0
      ? null
      : mcpConnected === mcpTotal
      ? "success"
      : mcpConnected === 0
      ? "destructive"
      : "secondary";

  const appFontClass = settingsHook.settings?.fontFamily === "sans-serif" ? "app-font-sans" : "app-font-serif";

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex justify-between items-center px-3 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-bold tracking-wide bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Hime
          </h1>
        </div>
        <div className="flex items-center gap-1">
          {mcpTotal > 0 && mcpBadgeVariant && (
            <Badge
              variant={mcpBadgeVariant as "success" | "destructive" | "secondary"}
              className="font-mono cursor-default"
              title={mcpStatus.map((s) => `${s.name}: ${s.status}`).join("\n")}
            >
              MCP {mcpConnected}/{mcpTotal}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowSettings(!showSettings)}
            title="設定"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={chat.createChat}
            title="新規チャット"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {showSettings ? (
        <SettingsPanel
          settings={settingsHook.settings}
          hasApiKeys={settingsHook.hasApiKeys}
          connectionTestResult={settingsHook.connectionTestResult}
          onUpdateSettings={settingsHook.updateSettings}
          onSetApiKey={settingsHook.setApiKey}
          onDeleteApiKey={settingsHook.deleteApiKey}
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
            selectedProvider={selectedProvider}
            onSendMessage={(content) => chat.sendMessage(content, selectedProvider)}
            onProviderChange={handleProviderChange}
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
