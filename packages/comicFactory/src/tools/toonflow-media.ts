import { z } from "zod";
import { ToolRegistry, type RegisteredTool, type ToolExecutionContext } from "./registry";

export type ToonflowMediaBridge = {
  listModels(): Promise<Array<{providerId:string;providerLabel:string;modelId:string;label:string;type:"image"|"video"|"audio"}>>;
  generateImage(request: {
    providerId:string;modelId:string;prompt:string;other?:Record<string,unknown>;
    outputDirectory?:string;images?:Array<{path:string;mimeType:string}>;ratio?:string;size?:string;
  }, signal?:AbortSignal): Promise<Array<{path:string;mimeType:string;mediaType:"image"|"video"|"audio"}>>;
  generateAudio(request: {
    providerId:string;modelId:string;prompt:string;other?:Record<string,unknown>;outputDirectory?:string;
  }, signal?:AbortSignal): Promise<Array<{path:string;mimeType:string;mediaType:"image"|"video"|"audio"}>>;
};

const imageInput=z.object({
  providerId:z.string().min(1),modelId:z.string().min(1),prompt:z.string().min(1).max(12000),
  negativePrompt:z.array(z.string().min(1).max(500)).default([]),
  outputDirectory:z.string().min(1).max(4096),
  references:z.array(z.object({path:z.string().min(1).max(4096),mimeType:z.string().startsWith("image/")}).strict()).max(16).default([]),
  ratio:z.string().max(32).optional(),size:z.string().max(32).optional(),
  parameters:z.record(z.string(),z.json()).default({})
}).strict();
const imageOutput=z.object({files:z.array(z.object({path:z.string(),mimeType:z.string(),mediaType:z.literal("image")}).strict())}).strict();

export function registerToonflowMediaTools(registry:ToolRegistry,media:ToonflowMediaBridge):void{
  const imageTool:RegisteredTool<typeof imageInput,typeof imageOutput>={
    toolId:"comic.generate_image",version:1,
    description:"Generate a comic panel or canonical visual reference through Toonflow's configured media provider.",
    inputSchema:imageInput,outputSchema:imageOutput,requiredPermissions:["write_asset"],
    handler:async(input,context)=>{
      if(context.signal?.aborted)throw new Error("Image generation aborted");
      const models=await media.listModels();
      const model=models.find(item=>item.providerId===input.providerId&&item.modelId===input.modelId&&item.type==="image");
      if(!model)throw new Error("Selected image model is not available in Toonflow");
      const negative=[...new Set(input.negativePrompt.map(item=>item.trim()).filter(Boolean))];
      const files=await media.generateImage({
        providerId:input.providerId,modelId:input.modelId,prompt:input.prompt,
        outputDirectory:input.outputDirectory,images:input.references,
        ...(input.ratio?{ratio:input.ratio}:{}),...(input.size?{size:input.size}:{}),
        other:{...input.parameters,negativePrompt:negative}
      },context.signal);
      return {files:files.filter(file=>file.mediaType==="image")};
    }
  };
  registry.register(imageTool);
}
