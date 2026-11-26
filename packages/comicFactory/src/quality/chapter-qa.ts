import { chapterRenderManifestSchema, type ChapterRenderManifest } from "../schemas/comic";

export type QAIssue={code:string;severity:"error"|"warning";message:string;panelId?:string;dialogueId?:string};
export type ChapterQAResult={passed:boolean;issues:QAIssue[];checkedPanels:number;checkedDialogues:number};
export type OCRAdapter=(input:{panelId:string;imagePath:string;expectedText:string[];language:string})=>Promise<{recognizedText:string[];confidence:number}>;

/** Deterministic preflight plus optional OCR cross-check. Vision/OCR adapters remain provider supplied. */
export async function validateChapterContent(input:ChapterRenderManifest,ocr?:OCRAdapter):Promise<ChapterQAResult>{
 const manifest=chapterRenderManifestSchema.parse(input);
 const issues:QAIssue[]=[];
 let dialogueCount=0;
 for(const panel of manifest.panels){
  const ordered=[...panel.dialogues].sort((a,b)=>a.readingOrder-b.readingOrder);
  const orders=new Set<number>();
  for(const d of ordered){
   dialogueCount++;
   if(orders.has(d.readingOrder))issues.push({code:"DIALOGUE_ORDER_DUPLICATE",severity:"error",message:"Dialogue reading order is duplicated",panelId:panel.panelId,dialogueId:d.dialogueId});
   orders.add(d.readingOrder);
   if(!manifest.dialogueSettings.generationEnabled&&d.source==="image_ai")issues.push({code:"DIALOGUE_DISABLED",severity:"error",message:"AI-generated dialogue is present while generation is disabled",panelId:panel.panelId,dialogueId:d.dialogueId});
   if(d.bubble&&(d.bubble.x+d.bubble.width>1||d.bubble.y+d.bubble.height>1))issues.push({code:"BUBBLE_OUT_OF_BOUNDS",severity:"error",message:"Dialogue bubble extends outside the panel",panelId:panel.panelId,dialogueId:d.dialogueId});
  }
  if(ocr&&ordered.length){
   try{
    const result=await ocr({panelId:panel.panelId,imagePath:panel.imagePath,expectedText:ordered.map(d=>d.text),language:manifest.language});
    if(!Number.isFinite(result.confidence)||result.confidence<0||result.confidence>1)issues.push({code:"OCR_INVALID_CONFIDENCE",severity:"error",message:"OCR returned an invalid confidence score",panelId:panel.panelId});
    const normalize=(s:string)=>s.normalize("NFC").toLocaleLowerCase(manifest.language).replace(/\s+/gu," ").trim();
    const recognized=result.recognizedText.map(normalize);
    for(const dialogue of ordered){
     if(!recognized.some(text=>text===normalize(dialogue.text)))issues.push({code:"OCR_TEXT_MISMATCH",severity:"warning",message:"Rendered text could not be confirmed by OCR",panelId:panel.panelId,dialogueId:dialogue.dialogueId});
    }
   }catch(error){
    issues.push({code:"OCR_UNAVAILABLE",severity:"warning",message:error instanceof Error?error.message:"OCR validation unavailable",panelId:panel.panelId});
   }
  }
 }
 return {passed:!issues.some(issue=>issue.severity==="error"),issues,checkedPanels:manifest.panels.length,checkedDialogues:dialogueCount};
}
