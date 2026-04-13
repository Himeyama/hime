import React from "react";
import { ProviderType } from "../../types/chat";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface ProviderSelectProps {
  selected: ProviderType;
  onChange: (provider: ProviderType) => void;
}

const PROVIDERS: { value: ProviderType; label: string }[] = [
  { value: "anthropic", label: "Claude" },
  { value: "openai", label: "OpenAI" },
  { value: "azure-openai", label: "Azure OpenAI" },
  { value: "ollama", label: "Ollama" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "google", label: "Google Gemini" },
];

export function ProviderSelect({ selected, onChange }: ProviderSelectProps) {
  return (
    <Select value={selected} onValueChange={(v) => onChange(v as ProviderType)}>
      <SelectTrigger className="w-auto min-w-[110px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent sideOffset={4}>
        {PROVIDERS.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
