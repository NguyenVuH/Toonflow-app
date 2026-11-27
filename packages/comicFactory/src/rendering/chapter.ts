import { chapterRenderManifestSchema, type ChapterRenderManifest } from "../schemas/comic";
import { renderDialogueOverlay, type LetteringOptions } from "./lettering";

export type RenderedChapter = {
  seriesId: string;
  chapterId: string;
  title: string;
  language: string;
  panels: Array<{ panelId: string; order: number; svg: string; sourceImage: string }>;
  html: string;
  manifestJson: string;
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Render a responsive HTML chapter with image and transparent lettering as separate layers. */
export function renderChapter(input: ChapterRenderManifest, options: LetteringOptions = {}): RenderedChapter {
  const manifest = chapterRenderManifestSchema.parse(input);
  const panels = [...manifest.panels].sort((a, b) => a.order - b.order).map(panel => ({
    panelId: panel.panelId,
    order: panel.order,
    sourceImage: panel.imagePath,
    svg: renderDialogueOverlay(panel, { ...options, includeImage: false })
  }));

  const body = panels.map(panel => {
    const image = '<img class="panel-image" src="' + escapeHtml(panel.sourceImage) + '" alt="' + escapeHtml(panel.panelId) + '">';
    const overlay = panel.svg.replace("<svg ", '<svg class="panel-overlay" ');
    return '<section class="panel" data-panel-id="' + escapeHtml(panel.panelId) + '"><div class="panel-stage">' + image + overlay + "</div></section>";
  }).join("\n");

  const document = '<!doctype html><html lang="' + escapeHtml(manifest.language) + '"><head>' +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>" + escapeHtml(manifest.title) + "</title>" +
    '<style>html,body{margin:0;background:#171717;color:#fff;font-family:"Noto Sans","Noto Sans Vietnamese",Arial,sans-serif}' +
    '.chapter{max-width:1000px;margin:0 auto}.panel{margin:0 auto;line-height:0}' +
    '.panel-stage{position:relative;width:100%}.panel-image{display:block;width:100%;height:auto}' +
    '.panel-overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}' +
    '.chapter-title{padding:1rem;text-align:center}</style></head><body>' +
    '<main class="chapter"><h1 class="chapter-title">' + escapeHtml(manifest.title) + "</h1>" +
    body + "</main></body></html>";

  return {
    seriesId: manifest.seriesId,
    chapterId: manifest.chapterId,
    title: manifest.title,
    language: manifest.language,
    panels,
    html: document,
    manifestJson: JSON.stringify(manifest, null, 2)
  };
}
