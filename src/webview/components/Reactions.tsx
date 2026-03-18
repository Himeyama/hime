import React from "react";
import { Reaction } from "../../types/chat";

interface ReactionsProps {
  reactions: Reaction[];
  messageId: string;
  onAddReaction: (messageId: string, reaction: "thumbsUp" | "thumbsDown") => void;
}

export function Reactions({ reactions, messageId, onAddReaction }: ReactionsProps) {
  const hasThumbsUp = reactions.some((r) => r.type === "thumbsUp");
  const hasThumbsDown = reactions.some((r) => r.type === "thumbsDown");

  return (
    <div className="flex gap-1 mt-2">
      <button
        className={`bg-transparent border cursor-pointer px-2 py-0.5 rounded-full text-sm transition-all duration-200 ${
          hasThumbsUp
            ? "opacity-100 border-vsc-accent bg-vsc-accent/10 shadow-sm"
            : "opacity-40 border-transparent hover:opacity-80 hover:bg-vsc-bg-hover"
        }`}
        onClick={() => onAddReaction(messageId, "thumbsUp")}
      >
        👍
      </button>
      <button
        className={`bg-transparent border cursor-pointer px-2 py-0.5 rounded-full text-sm transition-all duration-200 ${
          hasThumbsDown
            ? "opacity-100 border-vsc-danger bg-vsc-danger/10 shadow-sm"
            : "opacity-40 border-transparent hover:opacity-80 hover:bg-vsc-bg-hover"
        }`}
        onClick={() => onAddReaction(messageId, "thumbsDown")}
      >
        👎
      </button>
    </div>
  );
}
