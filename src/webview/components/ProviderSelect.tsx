import React from "react";
import { ModelEntry } from "../../types/chat";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface ModelSelectProps {
  selectedModelId: string;
  models: ModelEntry[];
  onChange: (modelId: string) => void;
}

export function ModelSelect({ selectedModelId, models, onChange }: ModelSelectProps) {
  if (models.length === 0) {
    return (
      <span className="text-xs text-muted-foreground px-1 select-none">
        モデル未設定
      </span>
    );
  }

  return (
    <Select value={selectedModelId} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-[140px] max-w-[220px]">
        <SelectValue placeholder="モデルを選択" />
      </SelectTrigger>
      <SelectContent sideOffset={4}>
        {models.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
