// Circuit kit. Canvas is a topology editor and semantic schematic; Preview is
// authoritative for MNA, nonlinear/transient solving, readings, glow and dots.

import { argName, argNumber, argPoint, argString, escapeString, num, pt } from "../args.js";
import { registerEntity, type Box, type StoryTargetSpec } from "../registry.js";
import type { CallStatement } from "../script.js";
import type { CircuitEntity, CircuitProbe, CircuitScope, Point, VirtualChildStyle } from "../types.js";
import { baseEntity } from "./base.js";

export interface CircuitPart { index:number; kind:string; p1:Point; p2:Point; name:string|null; value:string|null }
export interface CircuitGeometry { parts:CircuitPart[]; junctions:Point[]; bounds:Box; warning:string|null }
const CAP=400;

function tokens(line:string):string[]{return line.replace(/#.*$/u,"").trim().split(/\s+/u).filter(Boolean);}
export function circuitParts(entity:CircuitEntity):CircuitPart[]{
  const out:CircuitPart[]=[];
  for(const line of entity.netlist.split(/\r?\n/u)){
    if(out.length>=CAP)break;const t=tokens(line);if(!t.length)continue;
    const kind=t[0], ground=kind==="ground";if(t.length<(ground?3:5))continue;
    const nums=t.slice(1,ground?3:5).map(Number);if(nums.some(v=>!Number.isFinite(v)))continue;
    const options=new Map(t.slice(ground?3:5).map(v=>{const at=v.indexOf("=");return at<0?[v,""]:[v.slice(0,at),v.slice(at+1)];}));
    const p1={x:nums[0],y:nums[1]},p2=ground?{x:nums[0],y:nums[1]+.7}:{x:nums[2],y:nums[3]};
    const value=["r","v","c","l","i","f"].map(k=>options.get(k)).find(Boolean)??null;
    out.push({index:out.length,kind,p1,p2,name:options.get("name")??null,value});
  }
  return out;
}
function pointKey(p:Point):string{return`${p.x},${p.y}`;}
function screen(entity:CircuitEntity,p:Point,parts:CircuitPart[]):Point{
  const xs=parts.flatMap(v=>[v.p1.x,v.p2.x]),ys=parts.flatMap(v=>[v.p1.y,v.p2.y]);
  const loX=Math.min(...xs,0),hiX=Math.max(...xs,0),loY=Math.min(...ys,0),hiY=Math.max(...ys,0);
  return{x:entity.x-(hiX-loX)*entity.unit/2-loX*entity.unit+p.x*entity.unit,y:entity.y-(hiY-loY)*entity.unit/2-loY*entity.unit+p.y*entity.unit};
}
export function circuitGeometry(entity:CircuitEntity):CircuitGeometry{
  const parts=circuitParts(entity);if(!parts.length)return{parts:[],junctions:[],bounds:{x:entity.x-180,y:entity.y-90,width:360,height:180},warning:"Enter a native circuit netlist"};
  const degree=new Map<string,{p:Point;n:number}>();for(const part of parts)if(part.kind!=="ground")for(const p of [part.p1,part.p2]){const key=pointKey(p),v=degree.get(key);degree.set(key,{p,n:(v?.n??0)+1});}
  const pts=parts.flatMap(v=>[screen(entity,v.p1,parts),screen(entity,v.p2,parts)]),xs=pts.map(v=>v.x),ys=pts.map(v=>v.y);
  return{parts,junctions:[...degree.values()].filter(v=>v.n>=3).map(v=>screen(entity,v.p,parts)),bounds:{x:Math.min(...xs)-36,y:Math.min(...ys)-44,width:Math.max(...xs)-Math.min(...xs)+72,height:Math.max(...ys)-Math.min(...ys)+88},warning:parts.length>=CAP?`Canvas samples the first ${CAP} parts; Preview renders all.`:null};
}
export function circuitScreenPoint(entity:CircuitEntity,p:Point):Point{return screen(entity,p,circuitParts(entity));}
export function circuitPartAnchor(entity:CircuitEntity,part:string):Point|null{const parts=circuitParts(entity),found=parts.find(v=>v.name===part||`c${v.index}`===part);if(!found)return null;const a=screen(entity,found.p1,parts),b=screen(entity,found.p2,parts);return{x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
function circuitNodeAt(parts:CircuitPart[],point:Point):number|null{
  const keys=[...new Set(parts.flatMap(part=>part.kind==="ground"?[pointKey(part.p1)]:[pointKey(part.p1),pointKey(part.p2)]))],parent=new Map(keys.map(key=>[key,key]));
  const find=(key:string):string=>{const up=parent.get(key)??key;if(up===key)return key;const root=find(up);parent.set(key,root);return root;};
  const join=(a:string,b:string)=>{const ra=find(a),rb=find(b);if(ra!==rb)parent.set(rb,ra);};
  for(const part of parts)if(part.kind==="wire")join(pointKey(part.p1),pointKey(part.p2));
  const ground=parts.find(part=>part.kind==="ground")?.p1??parts.find(part=>part.kind.includes("voltage"))?.p1??parts[0]?.p1;if(!ground)return null;
  const numbers=new Map<string,number>([[find(pointKey(ground)),0]]);let next=1;
  for(const key of [...keys].sort((a,b)=>{const [ax,ay]=a.split(",").map(Number),[bx,by]=b.split(",").map(Number);return ax-bx||ay-by;})){const root=find(key);if(!numbers.has(root))numbers.set(root,next++);}
  return numbers.get(find(pointKey(point)))??null;
}
function childStyle(e:CircuitEntity,ref:string):VirtualChildStyle{return e.childStyles[ref]??(e.childStyles[ref]={});}
function applyChild(e:CircuitEntity,ref:string,stmt:CallStatement):boolean{const style=childStyle(e,ref);if(stmt.name==="color"){const v=argName(stmt.args,1);if(!v)return false;style.color=v;return true;}if(stmt.name==="opacity"){const v=argNumber(stmt.args,1);if(v===null)return false;style.opacity=v;return true;}if(stmt.name==="hidden"){style.reveal=argName(stmt.args,1)==="center"?"grow":"fade";return true;}if(stmt.name==="untraced"){style.untraced=true;return true;}return false;}
function childLines(styles:Record<string,VirtualChildStyle>):string[]{return Object.entries(styles).flatMap(([ref,s])=>[...(s.color?[`color(${ref}, ${s.color});`]:[]),...(s.opacity!==undefined?[`opacity(${ref}, ${num(s.opacity)});`]:[]),...(s.reveal?[`hidden(${ref}${s.reveal==="grow"?", center":""});`]:[]),...(s.untraced?[`untraced(${ref});`]:[])]);}
function probe(stmt:CallStatement):CircuitProbe|null{if(stmt.args.length<2||stmt.args.length>3)return null;const at=argPoint(stmt.args,1),part=at?null:argName(stmt.args,1),offset=argPoint(stmt.args,2);if(!at&&!part||stmt.args.length===3&&!offset)return null;return{at,part,offset};}
function scope(stmt:CallStatement):CircuitScope|null{if(stmt.args.length<3||stmt.args.length>5)return null;const at=argPoint(stmt.args,1),part=at?null:argName(stmt.args,1),center=argPoint(stmt.args,2),w=argNumber(stmt.args,3),h=argNumber(stmt.args,4);if((!at&&!part)||!center||(stmt.args.length>3&&w===null)||(stmt.args.length>4&&h===null))return null;return{at,part,x:center.x,y:center.y,width:w??300,height:h??140};}
function location(v:{at:Point|null;part:string|null}):string{return v.at?pt(v.at.x,v.at.y):v.part??"part";}
function refs(e:CircuitEntity):string[]{const parts=circuitParts(e),base=["parts","nodes","labels","charge","glow","probes","scopes"].map(v=>`${e.id}.${v}`),component=parts.flatMap(v=>[`${e.id}.c${v.index}`,`${e.id}.c${v.index}.value`,...(v.name?[`${e.id}.${v.name}`]:[]),`${e.id}.${v.kind}s`]),probes=e.probes.flatMap((v,i)=>{const key=v.part?`i${v.part}`:`v${v.at?circuitNodeAt(parts,v.at)??i:i}`;return[`${e.id}.${key}`,`${e.id}.${key}.at`];}),scopes=e.scopes.flatMap((v,i)=>{const key=v.part?`i${v.part}`:`v${v.at?circuitNodeAt(parts,v.at)??i:i}`,root=`${e.id}.scope.${key}`;return[`${root}.curve`,`${root}.frame`,`${root}.sweep`,`${root}.vscale`,`${root}.tscale`,`${root}.zero`];});return[...base,...component,...probes,...scopes];}

registerEntity<CircuitEntity>({kind:"circuit",ctor:"circuit",group:"Circuit",label:"Circuit",icon:"⏚",order:108,fidelity:"semantic",hint:"Editable netlist schematic; Preview owns solving and electrical playback",anchorArgIndex:1,
  create(id,x,y){return{...baseEntity(id,"cyan"),nativePaint:true,kind:"circuit",x,y,netlist:"dc-voltage 0 3 0 0 v=5 name=V1\nresistor 0 0 4 0 r=1k name=R1\nwire 4 0 4 3\nwire 4 3 0 3",unit:46,labels:true,build:.35,currentStyle:null,probes:[],scopes:[],childStyles:{}};},
  parseArgs(stmt){const id=argName(stmt.args,0),at=argPoint(stmt.args,1),netlist=argString(stmt.args,2),unit=argNumber(stmt.args,3),labels=argNumber(stmt.args,4),build=argNumber(stmt.args,5);if(!id||!at||netlist===null||stmt.args.length<3||stmt.args.length>6||(stmt.args.length>3&&unit===null)||(stmt.args.length>4&&labels===null)||(stmt.args.length>5&&build===null))return null;return{...baseEntity(id,"cyan"),nativePaint:true,kind:"circuit",x:at.x,y:at.y,netlist,unit:unit??46,labels:(labels??1)>.5,build:build??.35,currentStyle:null,probes:[],scopes:[],childStyles:{}};},
  ctorLine(e){return`circuit(${e.id}, ${pt(e.x,e.y)}, \`${e.netlist.replaceAll("`","\\`")}\`, ${num(e.unit)}, ${e.labels?1:0}, ${num(e.build)});`;},
  extraLines(e){return[...(e.currentStyle?[`current(${e.id}, ${num(e.currentStyle.speed)}, ${e.currentStyle.shape}, ${e.currentStyle.color}, ${num(e.currentStyle.size)});`]:[]),...e.probes.map(v=>`probe(${e.id}, ${location(v)}${v.offset?`, ${pt(v.offset.x,v.offset.y)}`:""});`),...e.scopes.map(v=>`scope(${e.id}, ${location(v)}, ${pt(v.x,v.y)}, ${num(v.width)}, ${num(v.height)});`),...childLines(e.childStyles)];},
  modifiers:{current(e,stmt){const speed=argNumber(stmt.args,1),shape=argName(stmt.args,2),color=argName(stmt.args,3),size=argNumber(stmt.args,4);if(stmt.args.length>5||(stmt.args.length>1&&speed===null)||(stmt.args.length>2&&!shape)||(stmt.args.length>3&&!color)||(stmt.args.length>4&&size===null))return false;if(shape&&!(["circle","square","diamond"] as string[]).includes(shape))return false;e.currentStyle={speed:speed??1,shape:(shape??"circle") as "circle"|"square"|"diamond",color:color??"gold",size:size??3};return true;},probe(e,stmt){const v=probe(stmt);if(!v)return false;e.probes.push(v);return true;},scope(e,stmt){const v=scope(stmt);if(!v)return false;e.scopes.push(v);return true;}},
  anchor:e=>({x:e.x,y:e.y}),translate(e,dx,dy){e.x+=dx;e.y+=dy;for(const scope of e.scopes){scope.x+=dx;scope.y+=dy;}},bounds:e=>circuitGeometry(e).bounds,handles:()=>[],dragHandle(){},fields:[{key:"netlist",label:"Circuit netlist",input:"textarea",hint:"One native component per line; geometry defines topology."},{key:"unit",label:"Grid unit",input:"number",min:12,max:200,step:1},{key:"labels",label:"Value labels",input:"checkbox"},{key:"build",label:"Build share",input:"number",min:0,max:.9,step:.05}],references:()=>[],replaceReference(){},referenceIds:refs,storyTargets(e){return refs(e).map((id):StoryTargetSpec=>({id,label:id,kind:id.includes("label")||id.includes("probe")?"text":id.includes("nodes")?"dot":"line"}));},referenceBounds(e,ref){if(ref.startsWith(`${e.id}.scope.`)){const s=e.scopes[0];return s?{x:s.x-s.width/2,y:s.y-s.height/2,width:s.width,height:s.height}:null;}const part=ref.split(".").at(-1)??"",anchor=circuitPartAnchor(e,part);return anchor?{x:anchor.x-35,y:anchor.y-25,width:70,height:50}:circuitGeometry(e).bounds;},applyReferenceModifier:applyChild,
});

export function circuitChildStyle(entity:CircuitEntity,ref:string):VirtualChildStyle{return entity.childStyles[ref]??{};}
