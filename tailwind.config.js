/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/webview/**/*.{tsx,ts}"],
  theme: {
    extend: {
      colors: {
        vsc: {
          bg: "var(--vscode-editor-background)",
          "bg-secondary": "var(--vscode-sideBar-background)",
          "bg-hover": "var(--vscode-list-hoverBackground)",
          "bg-active": "var(--vscode-list-activeSelectionBackground)",
          fg: "var(--vscode-editor-foreground)",
          "fg-secondary": "var(--vscode-descriptionForeground)",
          border: "var(--vscode-panel-border)",
          accent: "var(--vscode-button-background)",
          "accent-hover": "var(--vscode-button-hoverBackground)",
          "accent-fg": "var(--vscode-button-foreground)",
          "input-bg": "var(--vscode-input-background)",
          "input-fg": "var(--vscode-input-foreground)",
          "input-border": "var(--vscode-input-border)",
          danger: "var(--vscode-errorForeground)",
          success: "var(--vscode-testing-iconPassed)",
          "badge-bg": "var(--vscode-badge-background)",
          "badge-fg": "var(--vscode-badge-foreground)",
          scrollbar: "var(--vscode-scrollbarSlider-background)",
          "scrollbar-hover": "var(--vscode-scrollbarSlider-hoverBackground)",
        },
      },
      fontFamily: {
        vsc: "var(--vscode-font-family)",
        "vsc-editor": "var(--vscode-editor-font-family)",
      },
      fontSize: {
        vsc: "var(--vscode-font-size)",
      },
      animation: {
        blink: "blink 1s step-end infinite",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-down": "slideDown 0.2s ease-out",
        "pulse-subtle": "pulseSubtle 2s ease-in-out infinite",
        "collapsible-down": "collapsibleDown 0.2s ease-out",
        "collapsible-up": "collapsibleUp 0.15s ease-in",
        "select-in": "selectIn 0.15s ease-out",
      },
      keyframes: {
        blink: {
          "50%": { opacity: "0" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        collapsibleDown: {
          from: { height: "0", opacity: "0" },
          to: { height: "var(--radix-collapsible-content-height)", opacity: "1" },
        },
        collapsibleUp: {
          from: { height: "var(--radix-collapsible-content-height)", opacity: "1" },
          to: { height: "0", opacity: "0" },
        },
        selectIn: {
          from: { opacity: "0", transform: "translateY(-4px) scale(0.96)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
