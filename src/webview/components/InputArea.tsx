import React, { useState, useRef, useCallback, useEffect } from "react";
import { Send, Square } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

interface InputAreaProps {
  onSend: (content: string) => void;
  disabled: boolean;
  isStreaming: boolean;
  onAbort: () => void;
}

export function InputArea({ onSend, disabled, isStreaming, onAbort }: InputAreaProps) {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    const handleFillInput = (e: CustomEvent) => {
      const { content, submit } = e.detail;
      if (submit) {
        if (content && !disabled) {
          onSend(content);
          setValue("");
        } else {
          setValue(content);
        }
      } else {
        setValue(content);
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }
    };
    window.addEventListener("hime-fill-input" as any, handleFillInput);
    return () => window.removeEventListener("hime-fill-input" as any, handleFillInput);
  }, [onSend, disabled]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);
return (
  <div
    className={cn(
      "relative flex flex-col bg-input border border-input-border rounded transition-colors duration-200 overflow-hidden",
      isFocused && "border-ring"
    )}
  >
    <textarea
      ref={textareaRef}
      className="w-full bg-transparent text-foreground px-3 py-2.5 font-vsc text-vsc resize-none outline-none placeholder:text-muted-foreground/50 min-h-[42px] leading-relaxed"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="メッセージを入力... (Shift+Enterで改行)"
        disabled={disabled}
        rows={1}
      />
      <div className="flex items-center justify-end px-3 pb-2.5">
        {isStreaming ? (
          <Button
            variant="destructive"
            size="icon-xs"
            onClick={onAbort}
            title="中止"
          >
            <Square className="h-3 w-3" />
          </Button>
        ) : (
          <Button
            variant="default"
            size="icon-xs"
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            title="送信"
          >
            <Send className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
