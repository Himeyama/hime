import React, { useRef } from "react";

interface FileAttachmentProps {
  onAttach: (file: File) => void;
}

export function FileAttachment({ onAttach }: FileAttachmentProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAttach(file);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <button
        className="bg-transparent border-none text-vsc-fg cursor-pointer p-1 px-1.5 rounded hover:bg-vsc-bg-hover text-sm transition-colors"
        onClick={() => inputRef.current?.click()}
        title="ファイル添付"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M14 9.5V13a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13V9.5M11.5 4.5L8 1 4.5 4.5M8 1v9.5" />
        </svg>
      </button>
      <input ref={inputRef} type="file" className="hidden" onChange={handleChange} />
    </>
  );
}
