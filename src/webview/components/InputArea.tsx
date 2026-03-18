import React, { useState, useRef, useCallback, useEffect } from "react";

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
    adjustHeight();
  }, [value, adjustHeight]);

  return (
    <div
      className={`relative flex flex-col bg-vsc-input-bg border rounded-xl transition-all duration-200 overflow-hidden ${
        isFocused ? "border-vsc-accent ring-1 ring-vsc-accent/20" : "border-vsc-input-border"
      }`}
    >
      <textarea
        ref={textareaRef}
        className="w-full bg-transparent text-vsc-input-fg px-4 py-3 font-vsc text-vsc resize-none outline-none placeholder:text-vsc-fg-secondary/50 min-h-[48px] leading-relaxed"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="メッセージを入力... (Shift+Enterで改行)"
        disabled={disabled}
        rows={1}
      />
      <div className="flex items-center justify-between px-3 pb-2.5">
        <div className="flex items-center gap-2">
          {/* Future slot for attachments or tools */}
        </div>
        <div className="flex items-center">
          {isStreaming ? (
            <button
              className="flex items-center justify-center bg-vsc-danger text-white border-none rounded-lg w-8 h-8 cursor-pointer transition-all duration-200 hover:opacity-90 active:scale-95 shadow-sm"
              onClick={onAbort}
              title="中止"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="3" width="10" height="10" rx="1.5" />
              </svg>
            </button>
          ) : (
            <button
              className="flex items-center justify-center bg-vsc-accent text-vsc-accent-fg border-none rounded-lg w-8 h-8 cursor-pointer disabled:opacity-30 disabled:grayscale disabled:cursor-default hover:opacity-90 active:scale-95 transition-all duration-200 shadow-sm"
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              title="送信"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
