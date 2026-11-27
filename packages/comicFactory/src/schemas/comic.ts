import { z } from "zod";
export const dialogueRecordSchema=z.object({
 dialogueId:z.string().min(1).max(128),kind:z.enum(["speech","thought","narration","sfx","caption"]),
 source:z.enum(["user","script","image_ai"]),speakerEntityId:z.string().optional(),
 text:z.string().min(1).max(2000),readingOrder:z.number().int().nonnegative(),
 bubble:z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1),width:z.number().gt(0).max(1),height:z.number().gt(0).max(1),tailX:z.number().min(0).max(1).optional(),tailY:z.number().min(0).max(1).optional()}).strict().optional()
}).strict();
export const comicPanelSchema=z.object({panelId:z.string().min(1),order:z.number().int().nonnegative(),imagePath:z.string().min(1).max(4096),width:z.number().int().min(128).max(8192),height:z.number().int().min(128).max(8192),dialogues:z.array(dialogueRecordSchema).default([]),altText:z.string().max(2000).optional()}).strict();
export const chapterRenderManifestSchema=z.object({
 seriesId:z.string().min(1),chapterId:z.string().min(1),title:z.string().min(1).max(300),language:z.string().min(2).max(35).default("vi"),
 readingDirection:z.enum(["ltr","rtl","vertical"]).default("ltr"),
 dialogueSettings:z.object({generationEnabled:z.boolean(),preserveUserSuppliedWhenDisabled:z.boolean().default(true),renderMode:z.enum(["overlay","native","hybrid"]).default("overlay"),maxBubbleCharacters:z.number().int().min(10).max(1000).default(180)}).strict(),
 panels:z.array(comicPanelSchema).min(1),createdAt:z.string().datetime()
}).strict().superRefine((m,ctx)=>{
 const ids=new Set<string>();
 for(const p of m.panels){if(ids.has(p.panelId))ctx.addIssue({code:"custom",path:["panels"],message:"Duplicate panel ID: "+p.panelId});ids.add(p.panelId);
  for(const d of p.dialogues){if(!m.dialogueSettings.generationEnabled&&d.source==="image_ai")ctx.addIssue({code:"custom",path:["panels"],message:"AI-generated dialogue is disabled but image_ai dialogue exists"});if(d.text.length>m.dialogueSettings.maxBubbleCharacters&&d.kind!=="narration")ctx.addIssue({code:"custom",path:["panels"],message:"Dialogue "+d.dialogueId+" exceeds configured character limit"});}
 }
});
export type DialogueRecord=z.infer<typeof dialogueRecordSchema>;
export type ComicPanel=z.infer<typeof comicPanelSchema>;
export type ChapterRenderManifest=z.infer<typeof chapterRenderManifestSchema>;
