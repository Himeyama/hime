import React, { useEffect, useRef, useMemo } from "react";
import { Message, ToolCall } from "../../types/chat";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  className?: string;
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  streamingMessageId: string | null;
  streamingToolCalls?: ToolCall[];
}

export function MessageList({
  className,
  messages,
  isStreaming,
  streamingContent,
  streamingMessageId,
  streamingToolCalls,
}: MessageListProps) {
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  // Only show messages after the last context clear mark
  const visibleMessages = useMemo(() => {
    const lastClearIdx = messages.reduce(
      (idx, msg, i) => (msg.contextClearMark ? i : idx),
      -1
    );
    if (lastClearIdx < 0) return messages;
    return messages.slice(lastClearIdx + 1);
  }, [messages]);

  // ユーザーメッセージが追加されたときのみ、そのメッセージを上部へスクロール
  useEffect(() => {
    const lastMsg = visibleMessages[visibleMessages.length - 1];
    if (visibleMessages.length > prevLengthRef.current && lastMsg?.role === "user") {
      lastUserMsgRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    prevLengthRef.current = visibleMessages.length;
  }, [visibleMessages]);

  // 最後のユーザーメッセージのインデックスを特定
  const lastUserMsgIndex = visibleMessages.reduce(
    (idx, msg, i) => (msg.role === "user" ? i : idx),
    -1
  );

  return (
    <div className={`flex-1 overflow-y-auto scrollbar-thin scroll-smooth ${className || ""}`}>
      {visibleMessages.map((msg, index) => (
        <div key={msg.id} ref={index === lastUserMsgIndex ? lastUserMsgRef : undefined}>
          <MessageBubble
            message={msg}
            isStreaming={isStreaming && msg.id === streamingMessageId}
            streamingContent={msg.id === streamingMessageId ? streamingContent : undefined}
            streamingToolCalls={msg.id === streamingMessageId ? streamingToolCalls : undefined}
          />
        </div>
      ))}
      {isStreaming && streamingMessageId && !visibleMessages.some((m) => m.id === streamingMessageId) && (
        <MessageBubble
          message={{
            id: streamingMessageId,
            role: "assistant",
            content: "",
            timestamp: new Date().toISOString(),
          }}
          isStreaming={true}
          streamingContent={streamingContent}
          streamingToolCalls={streamingToolCalls}
        />
      )}
      <div className="h-4" />
    </div>
  );
}
