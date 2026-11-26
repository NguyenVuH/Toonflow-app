import {describe,expect,test} from "bun:test";
import {validateChapterContent} from "../src/quality";
import {exportRenderedChapter} from "../src/rendering/export";
import {renderChapter} from "../src/rendering";
import type {ChapterRenderManifest} from "../src/schemas/comic";
const base:ChapterRenderManifest={seriesId:"S1",chapterId:"C1",title:"Chương tiếng Việt",language:"vi",readingDirection:"ltr",dialogueSettings:{generationEnabled:true,preserveUserSuppliedWhenDisabled:true,renderMode:"overlay",maxBubbleCharacters:100},panels:[{panelId:"P1",order:0,imagePath:"assets/p1.png",width:1000,height:1400,dialogues:[{dialogueId:"D1",kind:"speech",source:"script",text:"Xin chào",readingOrder:0,bubble:{x:.1,y:.1,width:.5,height:.2}}]}],createdAt:"2026-11-26T00:00:00.000Z"};
describe("chapter QA",()=>{
 test("accepts in-bounds Vietnamese dialogue and checks OCR",async()=>{const result=await validateChapterContent(base,async input=>({recognizedText:input.expectedText,confidence:.99}));expect(result.passed).toBe(true);expect(result.checkedDialogues).toBe(1);});
 test("flags bubble outside panel",async()=>{const invalid={...base,panels:[{...base.panels[0],dialogues:[{...base.panels[0].dialogues[0],bubble:{x:.8,y:.8,width:.4,height:.4}}]}]};const result=await validateChapterContent(invalid);expect(result.passed).toBe(false);expect(result.issues[0].code).toBe("BUBBLE_OUT_OF_BOUNDS");});
 test("reports OCR mismatch without silently changing text",async()=>{const result=await validateChapterContent(base,async()=>({recognizedText:["Xin chao"],confidence:.8}));expect(result.passed).toBe(true);expect(result.issues[0].code).toBe("OCR_TEXT_MISMATCH");});
});
describe("chapter export",()=>{
 test("exports HTML with Vietnamese title and reproducible hash",async()=>{const rendered=renderChapter(base);const file=await exportRenderedChapter({chapter:rendered,format:"html"});expect(file.fileName).toContain("Chương-tiếng-Việt");expect(file.sha256).toHaveLength(64);});
 test("requires a valid host adapter for PDF",async()=>{const rendered=renderChapter(base);await expect(exportRenderedChapter({chapter:rendered,format:"pdf",adapter:async()=>new Uint8Array([1,2,3])})).rejects.toThrow("invalid PDF signature");});
});
