import React from "react";
import * as Select from "@radix-ui/react-select";
import { ProviderType } from "../../types/chat";

interface ProviderSelectProps {
  selected: ProviderType;
  onChange: (provider: ProviderType) => void;
}

const PROVIDERS: { value: ProviderType; label: string }[] = [
  { value: "anthropic", label: "Claude" },
  { value: "openai", label: "OpenAI" },
  { value: "azure-openai", label: "Azure OpenAI" },
  { value: "ollama", label: "Ollama" },
];

export function ProviderSelect({ selected, onChange }: ProviderSelectProps) {
  return (
    <Select.Root value={selected} onValueChange={(v) => onChange(v as ProviderType)}>
      <Select.Trigger className="inline-flex items-center gap-1.5 bg-vsc-input-bg text-vsc-input-fg border border-vsc-input-border rounded-md px-2.5 py-1 text-xs outline-none cursor-pointer hover:border-vsc-accent/50 focus:border-vsc-accent transition-colors select-none">
        <Select.Value />
        <Select.Icon>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.427 6.427a.75.75 0 0 1 1.06-.073L8 8.578l2.513-2.224a.75.75 0 1 1 .994 1.125l-3 2.653a.75.75 0 0 1-.994 0l-3-2.653a.75.75 0 0 1-.086-1.052z" />
          </svg>
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="bg-vsc-bg-secondary border border-vsc-border rounded-lg shadow-lg overflow-hidden z-50"
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport className="p-1">
            {PROVIDERS.map((p) => (
              <Select.Item
                key={p.value}
                value={p.value}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-vsc-fg rounded-md cursor-pointer outline-none select-none data-[highlighted]:bg-vsc-bg-hover data-[state=checked]:text-vsc-accent transition-colors"
              >
                <Select.ItemIndicator className="w-3">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                  </svg>
                </Select.ItemIndicator>
                <Select.ItemText>{p.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
