import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import * as net from 'net';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.ico': 'image/x-icon'
};

export class PreviewServer {
  private server: http.Server | null = null;
  private port = 30081;
  private statusBarItem: vscode.StatusBarItem;
  private previewContent: string = '';
  private sockets: Set<net.Socket> = new Set();

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'hime.togglePreviewServer';
    this.updateStatusBar();
    this.statusBarItem.show();
  }

  public setPreviewContent(content: string) {
    this.previewContent = content;
  }

  public getPort(): number {
    return this.port;
  }

  public isRunning(): boolean {
    return this.server !== null;
  }

  public toggle() {
    if (this.server) {
      this.stop();
    } else {
      this.start();
    }
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        resolve();
        return;
      }

      const workspaceFolders = vscode.workspace.workspaceFolders;
      const rootPath = workspaceFolders?.[0]?.uri.fsPath ?? null;

      this.sockets.clear();

      this.server = http.createServer((req, res) => {
        if (!req.url) {
          res.writeHead(400);
          res.end();
          return;
        }

        const url = new URL(req.url, `http://localhost:${this.port}`);
        let urlPath = url.pathname;

        if (urlPath === '/hime-preview') {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(this.previewContent);
          return;
        }

        if (!rootPath) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }

        if (urlPath === '/') {
          urlPath = '/index.html';
        }

        let filePath = path.join(rootPath, urlPath);

        try {
          if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
              filePath = path.join(filePath, 'index.html');
            }
          }

          if (!fs.existsSync(filePath)) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';

          res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
          });
          const readStream = fs.createReadStream(filePath);
          readStream.pipe(res);
        } catch (err) {
          console.error('Preview server error:', err);
          res.writeHead(500);
          res.end('Internal Server Error');
        }
      });

      this.server.on('connection', (socket) => {
        this.sockets.add(socket);
        socket.on('close', () => {
          this.sockets.delete(socket);
        });
      });

      this.server.on('error', (e: any) => {
        if (e.code === 'EADDRINUSE') {
          vscode.window.showErrorMessage(`Port ${this.port} is already in use.`);
        } else {
          vscode.window.showErrorMessage(`Preview server error: ${e.message}`);
        }
        this.server = null;
        this.updateStatusBar();
        resolve();
      });

      this.server.listen(this.port, () => {
        vscode.window.showInformationMessage(`Preview server started on http://localhost:${this.port}`);
        this.updateStatusBar();
        resolve();
      });
    });
  }

  public stop() {
    if (this.server) {
      for (const socket of this.sockets) {
        socket.destroy();
      }
      this.sockets.clear();
      
      this.server.close(() => {
        this.server = null;
        vscode.window.showInformationMessage('Preview server stopped.');
        this.updateStatusBar();
      });
    }
  }

  private updateStatusBar() {
    if (this.server) {
      this.statusBarItem.text = `$(stop-circle) Port: ${this.port}`;
      this.statusBarItem.tooltip = 'Stop Preview Server';
    } else {
      this.statusBarItem.text = `$(play-circle) Start Server`;
      this.statusBarItem.tooltip = 'Start Preview Server';
    }
  }

  public dispose() {
    this.stop();
    this.statusBarItem.dispose();
  }
}
