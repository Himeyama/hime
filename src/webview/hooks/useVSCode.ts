import { WebviewToExtensionMessage, ExtensionToWebviewMessage } from "../../types/messages";
import { useCallback, useEffect, useRef } from "react";

interface VSCodeApi {
  postMessage(message: WebviewToExtensionMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeApi;

let vscodeApi: VSCodeApi | undefined;

function getVSCodeApi(): VSCodeApi {
  if (!vscodeApi) {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

export function useVSCode() {
  const api = useRef(getVSCodeApi());

  const postMessage = useCallback((message: WebviewToExtensionMessage) => {
    api.current.postMessage(message);
  }, []);

  const onMessage = useCallback((handler: (message: ExtensionToWebviewMessage) => void) => {
    const listener = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      handler(event.data);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  return { postMessage, onMessage, getState: api.current.getState.bind(api.current), setState: api.current.setState.bind(api.current) };
}
