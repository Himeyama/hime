import { useState, useEffect, useRef } from "react";
import { Check, Copy, Play, Code as CodeIcon } from "lucide-react";
import hljs from "highlight.js";
import mermaid from "mermaid";
import { Button } from "./ui/button";

interface CodeBlockProps {
  language: string;
  code: string;
}

function Mermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const isDark = document.body.classList.contains("vscode-dark") ||
                   document.body.classList.contains("vscode-high-contrast");

    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? "dark" : "default",
      securityLevel: "loose",
      fontFamily: "var(--vscode-editor-font-family)",
    });

    const renderMermaid = async () => {
      if (!ref.current) return;
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      try {
        const { svg } = await mermaid.render(id, code);
        if (isMounted) {
          setSvg(svg);
          setError(null);
        }
      } catch (err: any) {
        const errorElement = document.getElementById("d" + id);
        if (errorElement) errorElement.remove();
        console.error("Mermaid rendering failed:", err);
        if (isMounted) {
          setError("Mermaid diagram rendering failed. Please check your syntax.");
        }
      }
    };

    renderMermaid();
    return () => { isMounted = false; };
  }, [code]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-destructive/5 rounded-md border border-destructive/20 my-2">
        <div className="text-destructive font-semibold text-xs mb-1 flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Render Error
        </div>
        <div className="text-muted-foreground text-[11px] font-mono whitespace-pre-wrap text-center opacity-80">{error}</div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="flex justify-center p-4 bg-background/50 rounded-md overflow-x-auto shadow-inner"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const isMermaid = language?.toLowerCase() === "mermaid";
  const isHTML = language?.toLowerCase() === "html";

  useEffect(() => {
    if (!codeRef.current || isMermaid || (isHTML && showPreview)) return;

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
  }, [code, language, isMermaid, isHTML, showPreview]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 border border-border rounded-lg overflow-hidden shadow-sm bg-vsc-editor-bg">
      <div className="flex justify-between items-center px-3 py-1.5 bg-muted/40 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">
            {language || "text"}
          </span>
          {isHTML && (
            <div className="flex items-center bg-background/50 rounded-md p-0.5 border border-border/50 ml-2">
              <Button
                variant={showPreview ? "ghost" : "secondary"}
                size="sm"
                className="h-5 px-1.5 text-[9px] gap-1"
                onClick={() => setShowPreview(false)}
              >
                <CodeIcon className="h-2.5 w-2.5" />
                Code
              </Button>
              <Button
                variant={showPreview ? "secondary" : "ghost"}
                size="sm"
                className="h-5 px-1.5 text-[9px] gap-1"
                onClick={() => setShowPreview(true)}
              >
                <Play className="h-2.5 w-2.5" />
                Preview
              </Button>
            </div>
          )}
        </div>
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
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>

      {isMermaid ? (
        <div className="p-3 bg-transparent">
          <Mermaid code={code} />
        </div>
      ) : isHTML && showPreview ? (
        <iframe
          srcDoc={code}
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
          className="w-full border-0 block"
          style={{ height: "500px" }}
          title="HTML Preview"
        />
      ) : (
        <pre className="px-3 py-3 overflow-x-auto font-vsc-editor text-[13px] leading-snug m-0 scrollbar-thin bg-transparent">
          <code
            ref={codeRef}
            className={language ? `language-${language}` : ""}
          >
            {code}
          </code>
        </pre>
      )}
    </div>
  );
}
