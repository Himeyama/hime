import React from "react";
import { Attachment } from "../../types/chat";

interface ImagePreviewProps {
  attachment: Attachment;
}

export function ImagePreview({ attachment }: ImagePreviewProps) {
  if (!attachment.base64) return null;

  return (
    <div className="my-2">
      <img
        src={`data:${attachment.mimeType};base64,${attachment.base64}`}
        alt={attachment.name}
        className="max-w-full max-h-[300px] rounded-lg shadow-md"
      />
      <span className="block text-[11px] text-vsc-fg-secondary/70 mt-1">
        {attachment.name}
      </span>
    </div>
  );
}
