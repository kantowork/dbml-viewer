import * as vscode from 'vscode';
import * as path from 'path';
import { parseDbmlContent } from './parser';
import { renderHtmlDocument } from './renderer';

export class DbmlPreviewPanel {
  public static currentPanel: DbmlPreviewPanel | undefined;
  private static readonly viewType = 'dbmlPreview';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _documentUri: vscode.Uri;

  public static createOrShow(extensionUri: vscode.Uri, documentUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // Show beside active column if available
    const previewColumn = column ? column + 1 : vscode.ViewColumn.Two;

    if (DbmlPreviewPanel.currentPanel) {
      DbmlPreviewPanel.currentPanel._documentUri = documentUri;
      DbmlPreviewPanel.currentPanel._panel.reveal(previewColumn);
      DbmlPreviewPanel.currentPanel._update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      DbmlPreviewPanel.viewType,
      'DBML Viewer',
      previewColumn,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri]
      }
    );

    DbmlPreviewPanel.currentPanel = new DbmlPreviewPanel(panel, extensionUri, documentUri);
  }

  public static togglePreview(extensionUri: vscode.Uri, documentUri: vscode.Uri) {
    if (DbmlPreviewPanel.currentPanel) {
      DbmlPreviewPanel.currentPanel._panel.dispose();
    } else {
      DbmlPreviewPanel.createOrShow(extensionUri, documentUri);
    }
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, documentUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._documentUri = documentUri;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    vscode.workspace.onDidChangeTextDocument(
      e => {
        if (e.document.uri.toString() === this._documentUri.toString()) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    vscode.workspace.onDidSaveTextDocument(
      doc => {
        if (doc.uri.toString() === this._documentUri.toString()) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    vscode.workspace.onDidChangeConfiguration(
      e => {
        if (e.affectsConfiguration('dbmlPreview.theme') || e.affectsConfiguration('dbmlPreview.language')) {
          this._update();
        }
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    DbmlPreviewPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private async _update() {
    try {
      const document = await vscode.workspace.openTextDocument(this._documentUri);
      const text = document.getText();
      const fileName = path.basename(document.fileName);
      const theme = vscode.workspace.getConfiguration('dbmlPreview').get<string>('theme', 'system');
      const lang = vscode.workspace.getConfiguration('dbmlPreview').get<string>('language', 'auto');

      this._panel.title = `DBML Viewer: ${fileName}`;
      const parsed = parseDbmlContent(text, document.fileName);
      this._panel.webview.html = renderHtmlDocument(parsed, fileName, theme, lang);
    } catch (err) {
      this._panel.webview.html = `<html><body><h3>DBMLファイルの読み込み中にエラーが発生しました: ${String(err)}</h3></body></html>`;
    }
  }
}
