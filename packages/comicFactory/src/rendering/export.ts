import type { RenderedChapter } from "./chapter";

export type ExportFormat="html"|"pdf"|"cbz"|"epub";
export type ExportArtifact={format:ExportFormat;fileName:string;mimeType:string;bytes:Uint8Array;sha256:string};
export type ExportAdapter=(input:{chapter:RenderedChapter;format:Exclude<ExportFormat,"html">;signal?:AbortSignal})=>Promise<Uint8Array>;

const mime:Record<ExportFormat,string>={html:"text/html; charset=utf-8",pdf:"application/pdf",cbz:"application/vnd.comicbook+zip",epub:"application/epub+zip"};

/** HTML export is built in. PDF/CBZ/EPUB require explicit deterministic host adapters. */
export async function exportRenderedChapter(input:{
 chapter:RenderedChapter;format:ExportFormat;adapter?:ExportAdapter;signal?:AbortSignal;
}):Promise<ExportArtifact>{
 input.signal?.throwIfAborted();
 let bytes:Uint8Array;
 if(input.format==="html")bytes=new TextEncoder().encode(input.chapter.html);
 else{
  if(!input.adapter)throw new Error(`No ${input.format.toUpperCase()} export adapter is registered`);
  bytes=await input.adapter({chapter:input.chapter,format:input.format,signal:input.signal});
  input.signal?.throwIfAborted();
  if(!(bytes instanceof Uint8Array)||bytes.byteLength===0)throw new Error("Export adapter returned an empty or invalid artifact");
  const signatures:Partial<Record<ExportFormat,number[]>>={pdf:[0x25,0x50,0x44,0x46],cbz:[0x50,0x4b,0x03,0x04],epub:[0x50,0x4b,0x03,0x04]};
  const signature=signatures[input.format]!;
  if(!signature.every((byte,index)=>bytes[index]===byte))throw new Error(`Export adapter returned invalid ${input.format.toUpperCase()} signature`);
 }
 const digest=await crypto.subtle.digest("SHA-256",new Uint8Array(bytes).buffer as ArrayBuffer);
 const sha256=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
 const safeTitle=input.chapter.title.normalize("NFC").replace(/[^\p{L}\p{N}_-]+/gu,"-").replace(/^-+|-+$/g,"").slice(0,80)||"chapter";
 return {format:input.format,fileName:`${safeTitle}.${input.format}`,mimeType:mime[input.format],bytes,sha256};
}
