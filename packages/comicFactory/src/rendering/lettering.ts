import type { ComicPanel, DialogueRecord } from "../schemas/comic";
export type LetteringOptions={fontFamily?:string;fontSize?:number;padding?:number;bubbleFill?:string;bubbleStroke?:string;textFill?:string;maxLines?:number};
function xml(value:string):string{return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
function wrapText(value:string,max:number):string[]{const lines:string[]=[];let line="";for(const word of value.split(/\s+/u)){if(!line){line=word;continue;}if([...line,...(" "+word)].length<=max)line+=" "+word;else{lines.push(line);line=word;}}if(line)lines.push(line);return lines.length?lines:[""];}
export function renderDialogueOverlay(panel:ComicPanel,options:LetteringOptions={}):string{
 const font=options.fontFamily??"Noto Sans, Noto Sans Vietnamese, Arial, sans-serif";
 const size=options.fontSize??Math.max(18,Math.round(panel.width*0.026));
 const pad=options.padding??Math.max(10,Math.round(size*0.65));
 const fill=options.bubbleFill??"#fff",stroke=options.bubbleStroke??"#171717",textFill=options.textFill??"#111";
 const parts=[...panel.dialogues].sort((a,b)=>a.readingOrder-b.readingOrder).map((d:DialogueRecord)=>{
  const b=d.bubble??{x:0.05,y:0.05,width:0.42,height:0.2};
  const x=Math.round(b.x*panel.width),y=Math.round(b.y*panel.height),w=Math.round(b.width*panel.width),h=Math.round(b.height*panel.height);
  const lines=wrapText(d.text,Math.max(8,Math.floor((w-pad*2)/(size*0.56))));
  if(options.maxLines&&lines.length>options.maxLines)throw new Error("Dialogue "+d.dialogueId+" overflows its bubble");
  const lineHeight=Math.round(size*1.35);
  if(lines.length*lineHeight+pad*2>h)throw new Error("Dialogue "+d.dialogueId+" does not fit its bubble");
  const radius=d.kind==="thought"?Math.round(size*1.2):Math.round(size*0.65);
  const dash=d.kind==="thought"?' stroke-dasharray="5 4"':"";
  const tail=b.tailX!==undefined&&b.tailY!==undefined?'<path d="M '+(x+Math.round(w*.25))+' '+(y+h-2)+' L '+Math.round(b.tailX*panel.width)+' '+Math.round(b.tailY*panel.height)+' L '+(x+Math.round(w*.48))+' '+(y+h-2)+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="3"/>':"";
  const text=lines.map((line,i)=>'<text x="'+(x+w/2)+'" y="'+(y+pad+size+i*lineHeight)+'" text-anchor="middle" font-family="'+xml(font)+'" font-size="'+size+'" fill="'+textFill+'">'+xml(line)+'</text>').join("");
  const title=d.speakerEntityId?'<title>'+xml(d.speakerEntityId)+'</title>':"";
  return '<g data-dialogue-id="'+xml(d.dialogueId)+'">'+tail+'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+radius+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="3"'+dash+'/>'+title+text+'</g>';
 }).join("");
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+panel.width+'" height="'+panel.height+'" viewBox="0 0 '+panel.width+' '+panel.height+'"><image href="'+xml(panel.imagePath)+'" x="0" y="0" width="'+panel.width+'" height="'+panel.height+'" preserveAspectRatio="none"/>'+parts+'</svg>';
}
