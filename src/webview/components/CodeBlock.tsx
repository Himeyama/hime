import { useState, useEffect, useRef } from "react";
import { Check, Copy } from "lucide-react";
import hljs from "highlight.js";
import { Button } from "./ui/button";

interface CodeBlockProps {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!codeRef.current) return;

    codeRef.current.removeAttribute("data-highlighted");
    codeRef.current.textContent = code;

    const lang = language || "";
    if (lang && hljs.getLanguage(lang)) {
      hljs.highlightElement(codeRef.current);
    } else if (lang) {
      try {
        const result = hljs.highlightAuto(code);
        codeRef.current.innerHTML = result.value;
      } catch {
        // Leave as plain text
      }
    }
  }, [code, language]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 border border-border rounded-lg overflow-hidden shadow-sm">
      <div className="flex justify-between items-center px-3 py-1.5 bg-muted/40 text-[11px]">
        <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">
          {language || "text"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 px-2 text-[10px] gap-1 ${copied ? "text-success" : "text-muted-foreground"}`}
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              コピー済み
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
            </>
          )}
        </Button>
      </div>
      <pre className="px-3 py-3 overflow-x-auto font-vsc-editor text-[13px] leading-snug m-0 scrollbar-thin bg-transparent">
        <code
          ref={codeRef}
          className={language ? `language-${language}` : ""}
        >
          {code}
        </code>
      </pre>
    </div>
  );
}
