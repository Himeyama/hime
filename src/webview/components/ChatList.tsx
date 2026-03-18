import React from "react";
import { ChatMeta } from "../../types/chat";

interface ChatListProps {
  chats: ChatMeta[];
  currentChatId: string | null;
  onSelect: (chatId: string) => void;
  onDelete: (chatId: string) => void;
}

export function ChatList({ chats, currentChatId, onSelect, onDelete }: ChatListProps) {
  return (
    <div className="border-b border-vsc-border max-h-[200px] overflow-y-auto scrollbar-thin animate-slide-down">
      {chats.length === 0 ? (
        <div className="py-4 px-3 text-center text-vsc-fg-secondary text-xs">
          チャットがありません
        </div>
      ) : (
        chats.map((chat) => (
          <div
            key={chat.id}
            className={`group flex justify-between items-center px-3 py-2 cursor-pointer border-b border-vsc-border/50 transition-all duration-150 hover:bg-vsc-bg-hover ${
              chat.id === currentChatId
                ? "bg-vsc-bg-active border-l-2 border-l-vsc-accent"
                : ""
            }`}
            onClick={() => onSelect(chat.id)}
          >
            <div className="flex flex-col overflow-hidden min-w-0">
              <span className="text-[13px] overflow-hidden text-ellipsis whitespace-nowrap font-medium">
                {chat.title}
              </span>
              <span className="text-[11px] text-vsc-fg-secondary mt-0.5">
                {chat.messageCount}件 · {chat.provider}
              </span>
            </div>
            <button
              className="bg-transparent border-none text-vsc-fg-secondary cursor-pointer p-1 text-xs opacity-0 group-hover:opacity-100 hover:text-vsc-danger transition-all duration-150 rounded hover:bg-vsc-bg-hover"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(chat.id);
              }}
              title="削除"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="4" y1="4" x2="12" y2="12" />
                <line x1="12" y1="4" x2="4" y2="12" />
              </svg>
            </button>
          </div>
        ))
      )}
    </div>
  );
}
