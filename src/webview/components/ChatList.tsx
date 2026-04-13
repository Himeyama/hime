import React from "react";
import { X } from "lucide-react";
import { ChatMeta } from "../../types/chat";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

interface ChatListProps {
  chats: ChatMeta[];
  currentChatId: string | null;
  onSelect: (chatId: string) => void;
  onDelete: (chatId: string) => void;
}

export function ChatList({ chats, currentChatId, onSelect, onDelete }: ChatListProps) {
  return (
    <div className="border-b border-border max-h-[200px] overflow-y-auto scrollbar-thin animate-slide-down">
      {chats.length === 0 ? (
        <div className="py-4 px-3 text-center text-muted-foreground text-xs">
          チャットがありません
        </div>
      ) : (
        chats.map((chat) => (
          <div
            key={chat.id}
            className={cn(
              "group flex justify-between items-center px-3 py-2 cursor-pointer border-b border-border/50 transition-all duration-150 hover:bg-accent hover:text-accent-foreground",
              chat.id === currentChatId && "bg-muted border-l-2 border-l-primary"
            )}
            onClick={() => onSelect(chat.id)}
          >
            <div className="flex flex-col overflow-hidden min-w-0">
              <span className="text-[13px] overflow-hidden text-ellipsis whitespace-nowrap font-medium">
                {chat.title}
              </span>
              <span className="text-[11px] text-muted-foreground mt-0.5">
                {chat.messageCount}件 · {chat.provider}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all duration-150"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(chat.id);
              }}
              title="削除"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
