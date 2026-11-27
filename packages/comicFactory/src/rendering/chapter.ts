import { chapterRenderManifestSchema, type ChapterRenderManifest } from "../schemas/comic";
import { renderDialogueOverlay, type LetteringOptions } from "./lettering";
export type RenderedChapter={seriesId:string;chapterId:string;title:string;language:string;panels:Array<{panelId:string;order:number;svg:string;sourceImage:string}>;html:string;manifestJson:string};
function html(value:string):string{return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
export function renderChapter(input:ChapterRenderManifest,options:LetteringOptions={}):RenderedChapter{
 const m=chapterRenderManifestSchema.parse(input);
 const panels=[...m.panels].sort((a,b)=>a.order-b.order).map(p=>({panelId:p.panelId,order:p.order,sourceImage:p.imagePath,svg:renderDialogueOverlay(p,{...options,includeImage:false})}));
 const body=panels.map(p=>'<section class="panel" data-panel-id="'+html(p.panelId)+'"><div class="panel-stage"><img class="panel-image" src="'+html(p.sourceImage)+'" alt="'+html(p.panelId)+'">'+p.svg.replace("<svg ","<svg class=\\"panel-overlay\\" ")+'</div></section>').join("\n");
 const document='<!doctype html><html lang="'+html(m.language)+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+html(m.title)+'</title><style>html,body{margin:0;background:#171717;color:#fff;font-family:"Noto Sans","Noto Sans Vietnamese",Arial,sans-serif}.chapter{max-width:1000px;margin:0 auto}.panel{margin:0 auto;line-height:0}.panel-stage{position:relative;width:100%}.panel-image{display:block;width:100%;height:auto}.panel-overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.chapter-title{padding:1rem;text-align:center}</style></head><body><main class="chapter"><h1 class="chapter-title">'+html(m.title)+'</h1>'+body+'</main></body></html>';
 return {seriesId:m.seriesId,chapterId:m.chapterId,title:m.title,language:m.language,panels,html:document,manifestJson:JSON.stringify(m,null,2)};
}
