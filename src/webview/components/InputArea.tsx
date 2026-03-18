import React, { useState, useRef, useCallback } from "react";

interface InputAreaProps {
  onSend: (content: string) => void;
  disabled: boolean;
  isStreaming: boolean;
  onAbort: () => void;
}

export function InputArea({ onSend, disabled, isStreaming, onAbort }: InputAreaProps) {
  const [value, setValue] = useState("");
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

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
    }
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        className="w-full bg-vsc-input-bg text-vsc-input-fg border border-vsc-input-border rounded-lg px-3 py-2 pb-10 font-vsc text-vsc resize-none max-h-[200px] outline-none focus:border-vsc-accent focus:accent-glow transition-all duration-200 placeholder:text-vsc-fg-secondary/50"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="メッセージを入力..."
        disabled={disabled}
        rows={5}
      />
      <div className="absolute bottom-0 right-1 mb-1">
        {isStreaming ? (
          <button
            className="bg-vsc-danger text-white border-none rounded-lg p-1.5 cursor-pointer transition-all duration-200 hover:opacity-90 active:scale-95"
            onClick={onAbort}
            title="中止"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="2" width="10" height="10" rx="1.5" />
            </svg>
          </button>
        ) : (
          <button
            className="bg-vsc-accent text-vsc-accent-fg border-none rounded-lg p-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-default hover:opacity-90 active:scale-95 transition-all duration-200"
            onClick={handleSend}
            disabled={!value.trim()}
            title="送信"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.724 1.053a.5.5 0 0 1 .54-.067l12 6a.5.5 0 0 1 0 .894l-12 6A.5.5 0 0 1 1.5 13.5v-4.379l6.776-1.121L1.5 6.879V2.5a.5.5 0 0 1 .224-.447z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
