import React from "react";
import { Trash2 } from "lucide-react";
import { ChatMeta } from "../../types/chat";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { cn } from "../lib/utils";

interface ChatListProps {
  chats: ChatMeta[];
  currentChatId: string | null;
  onSelect: (chatId: string) => void;
  onDelete: (chatId: string) => void;
}

export function ChatList({ chats, currentChatId, onSelect, onDelete }: ChatListProps) {
  // Check if currentChatId actually exists in the chats list
  const currentChatExists = chats.some((c) => c.id === currentChatId);
  const effectiveValue = currentChatExists ? (currentChatId || undefined) : undefined;

  return (
    <div className="flex items-center gap-2 p-2 border-b border-border bg-card animate-slide-down">
      <Select
        value={effectiveValue}
        onValueChange={onSelect}
        disabled={chats.length === 0}
      >
        <SelectTrigger className="flex-1 min-w-0 h-8 text-xs font-medium bg-background border-border/50">
          <SelectValue placeholder={chats.length === 0 ? "チャットがありません" : "チャットを選択..."} />
        </SelectTrigger>
        <SelectContent sideOffset={4} className="max-w-[300px]">
          {chats.map((chat) => (
            <SelectItem key={chat.id} value={chat.id} className="text-xs">
              <div className="flex items-center justify-between w-full gap-4">
                <span className="truncate">{chat.title}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {chat.messageCount}件
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => currentChatId && onDelete(currentChatId)}
        disabled={!currentChatId || chats.length === 0}
        title="現在のチャットを削除"
        className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
