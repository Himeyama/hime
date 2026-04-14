import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle } from "lucide-react";
import { Chat, ProviderType, ToolCall } from "../../types/chat";
import { MessageList } from "./MessageList";
import { InputArea } from "./InputArea";
import { ProviderSelect } from "./ProviderSelect";
import { Button } from "./ui/button";

interface ChatViewProps {
  className?: string;
  chat: Chat | null;
  isStreaming: boolean;
  streamingContent: string;
  streamingMessageId: string | null;
  streamingToolCalls?: ToolCall[];
  error: string | null;
  loadedContextFiles: string[] | null;
  skillsHelp: string | null;
  selectedProvider: ProviderType;
  onSendMessage: (content: string) => void;
  onProviderChange: (provider: ProviderType) => void;
  onClearContext: () => void;
  onCompressContext: () => void;
  onAbortStream: () => void;
  onDismissSkillsHelp: () => void;
}

export function ChatView({
  className,
  chat,
  isStreaming,
  streamingContent,
  streamingMessageId,
  streamingToolCalls,
  error,
  loadedContextFiles,
  skillsHelp,
  selectedProvider,
  onSendMessage,
  onProviderChange,
  onClearContext,
  onCompressContext,
  onAbortStream,
  onDismissSkillsHelp,
}: ChatViewProps) {
  if (!chat) {
    return (
      <div className={`flex items-center justify-center flex-1 text-muted-foreground px-6 ${className || ""}`}>
        <div className="text-center">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto mb-3 opacity-20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 36V12a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H14l-8 6z" />
            <circle cx="16" cy="21" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="24" cy="21" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="32" cy="21" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          <p className="text-sm">チャットを選択するか、新規チャットを作成してください</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* ツールバー */}
      <div className="flex items-center gap-1 px-3 py-1 border-b border-border select-none">
        <ProviderSelect selected={selectedProvider} onChange={onProviderChange} />
        <div className="flex-1" />
        <Button variant="ghost" size="icon-xs" onClick={onClearContext} title="Clear context">
          <span className="text-[10px] uppercase font-bold text-muted-foreground/60">Clr</span>
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={onCompressContext} title="Compress context">
          <span className="text-[10px] uppercase font-bold text-muted-foreground/60">Cmp</span>
        </Button>
      </div>

      {/* ドキュメント読み込み通知 */}
      {loadedContextFiles && loadedContextFiles.length > 0 && (
        <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-b border-border bg-muted/30 animate-fade-in text-center">
          {loadedContextFiles.join(", ")} を読み込みました
        </div>
      )}

      <MessageList
        className={className}
        messages={chat.messages}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        streamingMessageId={streamingMessageId}
        streamingToolCalls={streamingToolCalls}
      />

      {skillsHelp && (
        <div className="flex-1 overflow-y-auto px-4 py-4 animate-fade-in">
          <div className="max-w-3xl mx-auto">
            <div className="prose prose-sm text-foreground bg-muted/30 rounded-lg p-5 border border-border">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{skillsHelp}</ReactMarkdown>
            </div>
            <div className="flex justify-center mt-3">
              <Button variant="outline" size="sm" onClick={onDismissSkillsHelp}>
                閉じる
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive px-3 py-2 text-xs border-t border-destructive/30 animate-fade-in flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </div>
      )}

      {/* 入力エリア */}
      <div className="border-t border-border px-3 py-3 bg-background sticky bottom-0 z-10">
        <div className="max-w-4xl mx-auto">
          <InputArea
            onSend={onSendMessage}
            disabled={isStreaming}
            onAbort={onAbortStream}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    </div>
  );
}
