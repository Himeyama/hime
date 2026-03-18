import { useState, useCallback, useEffect, useRef } from "react";
import { Chat, Message, ProviderType, ChatMeta } from "../../types/chat";
import { ExtensionToWebviewMessage } from "../../types/messages";
import { useVSCode } from "./useVSCode";

export function useChat() {
  const { postMessage, onMessage } = useVSCode();
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedContextFiles, setLoadedContextFiles] = useState<string[] | null>(null);

  // Keep a ref to currentChat.id so the message handler always sees the latest value
  const currentChatIdRef = useRef<string | null>(null);
  currentChatIdRef.current = currentChat?.id ?? null;

  useEffect(() => {
    return onMessage((msg: ExtensionToWebviewMessage) => {
      const chatId = currentChatIdRef.current;

      switch (msg.type) {
        case "chatListUpdate":
          setChats(msg.chats);
          break;
        case "chatLoaded":
          setCurrentChat(msg.chat);
          break;
        case "chatCreated":
          setCurrentChat(msg.chat);
          break;
        case "token":
          if (msg.chatId === chatId) {
            setIsStreaming(true);
            setStreamingMessageId(msg.messageId);
            setStreamingContent((prev) => prev + msg.content);
          }
          break;
        case "streamEnd":
          if (msg.chatId === chatId) {
            setIsStreaming(false);
            setStreamingContent("");
            setStreamingMessageId(null);
            setCurrentChat((prev) => {
              if (!prev) return prev;
              const existingIdx = prev.messages.findIndex((m) => m.id === msg.messageId);
              if (existingIdx >= 0) {
                const updated = [...prev.messages];
                updated[existingIdx] = { ...updated[existingIdx], content: msg.fullContent };
                return { ...prev, messages: updated };
              }
              // If not found, add it
              return {
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    id: msg.messageId,
                    role: "assistant" as const,
                    content: msg.fullContent,
                    timestamp: new Date().toISOString(),
                  },
                ],
              };
            });
          }
          break;
        case "toolCall":
          if (msg.chatId === chatId) {
            setCurrentChat((prev) => {
              if (!prev) return prev;
              const existingIdx = prev.messages.findIndex((m) => m.id === msg.messageId);
              if (existingIdx >= 0) {
                const updated = [...prev.messages];
                const msgToUpdate = updated[existingIdx];
                const toolCalls = [...(msgToUpdate.toolCalls || []), msg.toolCall];
                updated[existingIdx] = { ...msgToUpdate, toolCalls };
                return { ...prev, messages: updated };
              }
              // If message doesn't exist yet (very rare race condition), we might skip or add placeholder
              return prev;
            });
          }
          break;
        case "toolResult":
          if (msg.chatId === chatId) {
            setCurrentChat((prev) => {
              if (!prev) return prev;
              const updatedMessages = prev.messages.map((m) => {
                if (m.id === msg.messageId && m.toolCalls) {
                  const toolCalls = m.toolCalls.map((tc) =>
                    tc.id === msg.toolCallId
                      ? { ...tc, status: "completed" as const, result: msg.result }
                      : tc
                  );
                  return { ...m, toolCalls };
                }
                return m;
              });
              return { ...prev, messages: updatedMessages };
            });
          }
          break;
        case "projectContextLoaded":
          setLoadedContextFiles(msg.files);
          break;
        case "error":
          if (msg.chatId === chatId) {
            setError(msg.error);
            setIsStreaming(false);
            setStreamingContent("");
          }
          break;
      }
    });
  }, [onMessage]);

  const sendMessage = useCallback(
    (content: string, provider: ProviderType) => {
      if (!currentChat) return;
      setError(null);
      const userMessageId = crypto.randomUUID();
      const assistantMessageId = crypto.randomUUID(); // Predetermine ID if possible or wait for first token

      const userMessage: Message = {
        id: userMessageId,
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };

      setCurrentChat((prev) =>
        prev ? { ...prev, messages: [...prev.messages, userMessage] } : prev
      );

      postMessage({
        command: "sendMessage",
        chatId: currentChat.id,
        content,
        provider,
      });
    },
    [currentChat, postMessage]
  );

  const createChat = useCallback(() => {
    postMessage({ command: "createChat" });
  }, [postMessage]);

  const loadChat = useCallback(
    (chatId: string) => {
      postMessage({ command: "loadChat", chatId });
    },
    [postMessage]
  );

  const deleteChat = useCallback(
    (chatId: string) => {
      postMessage({ command: "deleteChat", chatId });
      if (currentChat?.id === chatId) {
        setCurrentChat(null);
      }
    },
    [postMessage, currentChat]
  );

  const clearContext = useCallback(() => {
    if (!currentChat) return;
    postMessage({ command: "clearContext", chatId: currentChat.id });
  }, [currentChat, postMessage]);

  const compressContext = useCallback(() => {
    if (!currentChat) return;
    postMessage({ command: "compressContext", chatId: currentChat.id });
  }, [currentChat, postMessage]);

  const abortStream = useCallback(() => {
    postMessage({ command: "abortStream" });
  }, [postMessage]);

  const addReaction = useCallback(
    (messageId: string, reaction: "thumbsUp" | "thumbsDown") => {
      if (!currentChat) return;
      postMessage({ command: "addReaction", chatId: currentChat.id, messageId, reaction });
      setCurrentChat((prev) => {
        if (!prev) return prev;
        const messages = prev.messages.map((m) => {
          if (m.id === messageId) {
            const reactions = m.reactions || [];
            const existing = reactions.findIndex((r) => r.type === reaction);
            if (existing >= 0) {
              return { ...m, reactions: reactions.filter((_, i) => i !== existing) };
            }
            return { ...m, reactions: [...reactions, { type: reaction, messageId }] };
          }
          return m;
        });
        return { ...prev, messages };
      });
    },
    [currentChat, postMessage]
  );

  return {
    chats,
    currentChat,
    isStreaming,
    streamingContent,
    streamingMessageId,
    error,
    loadedContextFiles,
    sendMessage,
    createChat,
    loadChat,
    deleteChat,
    clearContext,
    compressContext,
    abortStream,
    addReaction,
  };
}
