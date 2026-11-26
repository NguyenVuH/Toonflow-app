import {describe,expect,test} from "bun:test";
import {renderChapter} from "../src/rendering";
import type {ChapterRenderManifest} from "../src/schemas/comic";
const base:ChapterRenderManifest={seriesId:"S1",chapterId:"CH1",title:"Chương Một",language:"vi",readingDirection:"ltr",dialogueSettings:{generationEnabled:true,preserveUserSuppliedWhenDisabled:true,renderMode:"overlay",maxBubbleCharacters:180},panels:[{panelId:"P1",order:0,imagePath:"assets/panel-1.png",width:1200,height:1600,dialogues:[{dialogueId:"D1",kind:"speech",source:"script",speakerEntityId:"CHAR_KAI",text:"Xin chào, chúng ta bắt đầu thôi!",readingOrder:0,bubble:{x:.05,y:.05,width:.55,height:.18}}]}],createdAt:"2026-11-26T00:00:00.000Z"};
describe("comic chapter rendering",()=>{
 test("renders Vietnamese dialogue in deterministic SVG and HTML",()=>{const out=renderChapter(base);expect(out.panels[0].svg).toContain("Xin chào, chúng ta bắt đầu thôi!");expect(out.html).toContain('lang="vi"');expect(out.manifestJson).toContain("CHAR_KAI");});
 test("rejects AI-generated dialogue when generation is disabled",()=>{const invalid={...base,dialogueSettings:{...base.dialogueSettings,generationEnabled:false},panels:[{...base.panels[0],dialogues:[{...base.panels[0].dialogues[0],source:"image_ai" as const}]}]};expect(()=>renderChapter(invalid)).toThrow("AI-generated dialogue is disabled");});
 test("rejects dialogue exceeding configured length",()=>{const invalid={...base,dialogueSettings:{...base.dialogueSettings,maxBubbleCharacters:10},panels:[{...base.panels[0],dialogues:[{...base.panels[0].dialogues[0],text:"This dialogue is far too long"}]}]};expect(()=>renderChapter(invalid)).toThrow("exceeds configured");});
});
