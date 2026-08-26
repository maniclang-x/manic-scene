// Vector/scalar fields and complex-plane visualizations. Canvas uses bounded,
// deterministic samples; native Preview remains the formula/pixel authority.

import { argName, argNumber, argPoint, argString, escapeString, num, pt } from "../args.js";
import { evalExpr, type ExprNode } from "../expr.js";
import { registerEntity, type Box, type GeometryContext } from "../registry.js";
import { lexTokens, parseScript, type LetStatement, type Token } from "../script.js";
import type { ColorWheelEntity, DomainColorEntity, Point, ScalarFieldEntity, VectorFieldEntity, WarpEntity } from "../types.js";
import { baseEntity } from "./base.js";

export interface FieldArrow { id: string; from: Point; to: Point; magnitude: number; normalizedMagnitude: number; }
export interface ComplexSample { x: number; y: number; width: number; height: number; hue: number; lightness: number; }
export interface WarpLine { id: string; from: Point[]; to: Point[]; }
interface Complex { re: number; im: number; }

const NAMED_FIELDS: Record<string, [string, string]> = {
  radial:["x","y"],source:["x","y"],out:["x","y"],sink:["-x","-y"],attract:["-x","-y"],in:["-x","-y"],
  swirl:["-y","x"],rotational:["-y","x"],curl:["-y","x"],rotate:["-y","x"],saddle:["x","-y"],wave:["sin(y)","cos(x)"],
  shear:["y","0"],uniform:["1","0"],flow:["1","0"],spiral:["-y + 0.4*x","x + 0.4*y"],
};
const move=(e:{x:number;y:number},dx:number,dy:number)=>{e.x+=dx;e.y+=dy;};
const box=(x:number,y:number,w:number,h:number):Box=>({x:x-w/2,y:y-h/2,width:w,height:h});
const finite=(z:Complex)=>Number.isFinite(z.re)&&Number.isFinite(z.im);

function realFormula(source:string):ExprNode|null {
  try { const parsed=parseScript(`let __field_value = ${source};`); const stmt=parsed.statements[0] as LetStatement|undefined; return stmt?.kind==="let"?stmt.expr:null; } catch { return null; }
}
function realValue(node:ExprNode|null,x:number,y:number):number|null {
  if(!node)return null;
  try { const value=evalExpr(node,new Map([["x",x],["y",y],["p",0]])); return Number.isFinite(value)?value:null; } catch { return null; }
}

export function vectorFieldShape(entity:VectorFieldEntity):{arrows:FieldArrow[];issue:string|null;rows:number;columns:number}{
  const formulas=entity.formulaMode?[entity.uFormula,entity.vFormula]:NAMED_FIELDS[entity.namedField];
  if(!formulas)return{arrows:[],issue:`Unknown named field ${entity.namedField}.`,rows:0,columns:0};
  const u=realFormula(formulas[0]),v=realFormula(formulas[1]);
  if(!u||!v)return{arrows:[],issue:"Canvas could not evaluate the field formulas; Preview remains authoritative.",rows:0,columns:0};
  const columns=Math.max(2,Math.min(31,Math.round(entity.density??13))),rows=Math.max(2,Math.round(columns*entity.halfHeight/entity.halfWidth));
  const sx=2*entity.halfWidth/columns,sy=2*entity.halfHeight/rows,unit=entity.halfWidth/3,maxLength=Math.min(sx,sy)*.72;
  const raw:{id:string;from:Point;vx:number;vy:number;magnitude:number}[]=[];
  for(let row=0;row<rows;row+=1)for(let col=0;col<columns;col+=1){
    const from={x:entity.x-entity.halfWidth+sx*(col+.5),y:entity.y-entity.halfHeight+sy*(row+.5)};
    const mx=(from.x-entity.x)/unit,my=-(from.y-entity.y)/unit,vx=realValue(u,mx,my),vy=realValue(v,mx,my);
    if(vx===null||vy===null)continue;raw.push({id:`${entity.id}.a${row*columns+col}`,from,vx,vy,magnitude:Math.hypot(vx,vy)});
  }
  const max=Math.max(1e-6,...raw.map(a=>a.magnitude));
  return{arrows:raw.map(a=>{const t=Math.max(0,Math.min(1,a.magnitude/max)),len=maxLength*Math.sqrt(t),norm=a.magnitude||1;return{id:a.id,from:a.from,to:{x:a.from.x+a.vx/norm*len,y:a.from.y-a.vy/norm*len},magnitude:a.magnitude,normalizedMagnitude:t};}),issue:raw.length?null:"No finite field samples.",rows,columns};
}

// Small complex evaluator for useful authoring thumbnails. Unsupported native
// functions (notably zeta) deliberately return no samples and get a formula card.
const c=(re:number,im=0):Complex=>({re,im});
const add=(a:Complex,b:Complex)=>c(a.re+b.re,a.im+b.im),sub=(a:Complex,b:Complex)=>c(a.re-b.re,a.im-b.im);
const mul=(a:Complex,b:Complex)=>c(a.re*b.re-a.im*b.im,a.re*b.im+a.im*b.re);
const div=(a:Complex,b:Complex)=>{const d=b.re*b.re+b.im*b.im;return c((a.re*b.re+a.im*b.im)/d,(a.im*b.re-a.re*b.im)/d);};
const clog=(a:Complex)=>c(Math.log(Math.hypot(a.re,a.im)),Math.atan2(a.im,a.re));
const cexp=(a:Complex)=>{const e=Math.exp(a.re);return c(e*Math.cos(a.im),e*Math.sin(a.im));};
const pow=(a:Complex,b:Complex)=>cexp(mul(b,clog(a)));
const csin=(a:Complex)=>c(Math.sin(a.re)*Math.cosh(a.im),Math.cos(a.re)*Math.sinh(a.im));
const ccos=(a:Complex)=>c(Math.cos(a.re)*Math.cosh(a.im),-Math.sin(a.re)*Math.sinh(a.im));
const csinh=(a:Complex)=>c(Math.sinh(a.re)*Math.cos(a.im),Math.cosh(a.re)*Math.sin(a.im));
const ccosh=(a:Complex)=>c(Math.cosh(a.re)*Math.cos(a.im),Math.sinh(a.re)*Math.sin(a.im));
function complexCall(name:string,args:Complex[]):Complex|null{const a=args[0]??c(0);switch(name){case"sin":return csin(a);case"cos":return ccos(a);case"tan":return div(csin(a),ccos(a));case"sinh":return csinh(a);case"cosh":return ccosh(a);case"tanh":return div(csinh(a),ccosh(a));case"exp":return cexp(a);case"ln":case"log":return clog(a);case"sqrt":return pow(a,c(.5));case"conj":return c(a.re,-a.im);case"abs":return c(Math.hypot(a.re,a.im));case"re":return c(a.re);case"im":return c(a.im);default:return null;}}
class ComplexParser{index=0;constructor(readonly tokens:Token[],readonly z:Complex){}parse(min=0):Complex|null{let left=this.primary();if(!left)return null;for(;;){const t=this.tokens[this.index],power=t?.kind==="op"?({"+":[1,2],"-":[1,2],"*":[3,4],"/":[3,4],"^":[6,5]} as Record<string,[number,number]>)[t.text]:undefined;if(!power||power[0]<min)break;this.index+=1;const right=this.parse(power[1]);if(!right)return null;left=t.text==="+"?add(left,right):t.text==="-"?sub(left,right):t.text==="*"?mul(left,right):t.text==="/"?div(left,right):pow(left,right);}return left;}primary():Complex|null{const t=this.tokens[this.index];if(!t)return null;if(t.kind==="op"&&t.text==="-"){this.index+=1;const v=this.parse(5);return v?c(-v.re,-v.im):null;}if(t.kind==="number"){this.index+=1;return c(t.value??0);}if(t.kind==="punct"&&t.text==="("){this.index+=1;const v=this.parse();if(this.tokens[this.index]?.text!==")")return null;this.index+=1;return v;}if(t.kind!=="name")return null;this.index+=1;if(this.tokens[this.index]?.text==="("){this.index+=1;const args:Complex[]=[];while(this.tokens[this.index]?.text!==")"){const a=this.parse();if(!a)return null;args.push(a);if(this.tokens[this.index]?.text===",")this.index+=1;else break;}if(this.tokens[this.index]?.text!==")")return null;this.index+=1;return complexCall(t.text,args);}return t.text==="z"?this.z:t.text==="i"?c(0,1):t.text==="pi"?c(Math.PI):t.text==="tau"?c(Math.PI*2):t.text==="e"?c(Math.E):null;}}
function complexValue(formula:string,z:Complex):Complex|null{try{const parser=new ComplexParser(lexTokens(formula),z),value=parser.parse();return value&&parser.index===parser.tokens.length&&finite(value)?value:null;}catch{return null;}}

export function domainColorSamples(entity:DomainColorEntity,columns=28):ComplexSample[]{
  const cols=Math.max(8,Math.min(48,columns)),rows=Math.max(4,Math.round(cols*entity.height/entity.width)),cw=entity.width/cols,ch=entity.height/rows,range=entity.range??4,imag=range*entity.height/entity.width,out:ComplexSample[]=[];
  for(let row=0;row<rows;row+=1)for(let col=0;col<cols;col+=1){const re=-range+2*range*(col+.5)/cols,im=imag-2*imag*(row+.5)/rows,value=complexValue(entity.formula,c(re,im));if(!value)return[];const magnitude=Math.hypot(value.re,value.im),hue=Math.atan2(value.im,value.re)*180/Math.PI,lightness=Number.isFinite(magnitude)?magnitude/(1+magnitude):1;out.push({x:entity.x-entity.width/2+col*cw,y:entity.y-entity.height/2+row*ch,width:cw+.5,height:ch+.5,hue,lightness});}return out;
}

export function warpLines(entity:WarpEntity):{lines:WarpLine[];issue:string|null}{
  const range=Math.max(1,Math.min(8,entity.range??3)),span=Math.floor(range),resolution=Math.max(6,Math.min(120,Math.trunc(entity.resolution??28))),limit=range*2.5,lines:WarpLine[]=[];
  const screen=(z:Complex):Point=>({x:entity.x+z.re*entity.unit,y:entity.y-z.im*entity.unit});
  for(let k=-span;k<=span;k+=1){for(const axis of ["h","v"] as const){const from:Point[]=[],to:Point[]=[];for(let j=0;j<=resolution;j+=1){const t=-range+2*range*j/resolution,z=axis==="h"?c(t,k):c(k,t),value=complexValue(entity.formula,z);if(!value)return{lines:[],issue:"Canvas cannot sample this complex formula; Preview will render it."};from.push(screen(z));to.push(screen(c(Math.max(-limit,Math.min(limit,value.re)),Math.max(-limit,Math.min(limit,value.im)))));}lines.push({id:`${entity.id}.${axis}${k}`,from,to});}}
  return{lines,issue:null};
}

export function scalarFieldCard(entity:ScalarFieldEntity,ctx?:GeometryContext):Box{const siblings=ctx?.doc.entities.filter(e=>e.kind==="scalarfield")??[],index=Math.max(0,siblings.findIndex(e=>e.id===entity.id));return{x:18,y:18+index*58,width:300,height:46};}

registerEntity<ScalarFieldEntity>({kind:"scalarfield",ctor:"field",group:"Math",label:"Reusable scalar field",icon:"ƒ",order:42,authorOnly:true,movable:false,colorInCtor:true,fidelity:"semantic",hint:"Pure reusable f(x,y) declaration; Canvas shows an authoring card because native creates no drawable id",
  renameable:false,create:id=>({...baseEntity(id,"cyan"),kind:"scalarfield",formula:"sin(x) * exp(-0.2*(x*x + y*y))"}),parseArgs(stmt){const id=argName(stmt.args,0),formula=argString(stmt.args,1);return id&&formula!==null&&stmt.args.length===2?{...baseEntity(id,"cyan"),kind:"scalarfield",formula}:null;},ctorLine:e=>`field(${e.id}, "${escapeString(e.formula)}");`,extraLines:()=>[],modifiers:{},anchor(e,ctx){const b=scalarFieldCard(e,ctx);return{x:b.x+b.width/2,y:b.y+b.height/2};},translate(){},bounds:scalarFieldCard,handles:()=>[],dragHandle(){},fields:[{key:"formula",label:"f(x, y)",input:"textarea",hint:"Pure scalar formula. Rename the declaration and all formula call sites together in Source."}]});

registerEntity<VectorFieldEntity>({kind:"vectorfield",ctor:"arrowfield",aliases:["vectorfield"],group:"Math",label:"Vector field",icon:"⇢⁙",order:42.1,fidelity:"semantic",hint:"Bounded t=0 arrow lattice; Preview owns live parameter binding and exact samples",anchorArgIndex:1,
  create:(id,x,y)=>({...baseEntity(id,"cyan"),nativePaint:true,kind:"vectorfield",spelling:"vectorfield",x,y,halfWidth:260,halfHeight:160,formulaMode:true,namedField:"swirl",uFormula:"-y",vFormula:"x",density:13}),parseArgs(stmt){const id=argName(stmt.args,0),at=argPoint(stmt.args,1),hw=argNumber(stmt.args,2),hh=argNumber(stmt.args,3),named=argName(stmt.args,4),u=argString(stmt.args,4),v=argString(stmt.args,5);if(!id||!at||hw===null||hh===null)return null;if(named&&stmt.args.length>=5&&stmt.args.length<=6){const density=argNumber(stmt.args,5);if(stmt.args.length===6&&density===null)return null;return{...baseEntity(id,"cyan"),nativePaint:true,kind:"vectorfield",spelling:stmt.name as "arrowfield"|"vectorfield",x:at.x,y:at.y,halfWidth:hw,halfHeight:hh,formulaMode:false,namedField:named,uFormula:NAMED_FIELDS[named]?.[0]??"x",vFormula:NAMED_FIELDS[named]?.[1]??"y",density};}if(u!==null&&v!==null&&stmt.args.length>=6&&stmt.args.length<=7){const density=argNumber(stmt.args,6);if(stmt.args.length===7&&density===null)return null;return{...baseEntity(id,"cyan"),nativePaint:true,kind:"vectorfield",spelling:stmt.name as "arrowfield"|"vectorfield",x:at.x,y:at.y,halfWidth:hw,halfHeight:hh,formulaMode:true,namedField:"swirl",uFormula:u,vFormula:v,density};}return null;},ctorLine:e=>e.formulaMode?`${e.spelling}(${e.id}, ${pt(e.x,e.y)}, ${num(e.halfWidth)}, ${num(e.halfHeight)}, "${escapeString(e.uFormula)}", "${escapeString(e.vFormula)}"${e.density===null?"":`, ${num(e.density)}`});`:`${e.spelling}(${e.id}, ${pt(e.x,e.y)}, ${num(e.halfWidth)}, ${num(e.halfHeight)}, ${e.namedField}${e.density===null?"":`, ${num(e.density)}`});`,extraLines:()=>[],modifiers:{},referenceIds(e){const g=vectorFieldShape(e);return Array.from({length:g.rows*g.columns},(_,i)=>`${e.id}.a${i}`);},storyTargets(e){return this.referenceIds!(e).map(id=>({id,label:id,kind:"arrow"}));},anchor:e=>({x:e.x,y:e.y}),translate:move,bounds:e=>box(e.x,e.y,e.halfWidth*2,e.halfHeight*2),handles:e=>[{name:"size",x:e.x+e.halfWidth,y:e.y+e.halfHeight}],dragHandle(e,_h,px,py){e.halfWidth=Math.max(21,Math.abs(px-e.x));e.halfHeight=Math.max(21,Math.abs(py-e.y));},fields:[{key:"formulaMode",label:"Formula-authored",input:"checkbox",hint:"Off uses a native named field."},{key:"namedField",label:"Named field",input:"select",options:Object.keys(NAMED_FIELDS),visibleWhen:{key:"formulaMode",equals:false}},{key:"uFormula",label:"Horizontal u(x, y)",input:"textarea",visibleWhen:{key:"formulaMode",equals:true}},{key:"vFormula",label:"Vertical v(x, y)",input:"textarea",visibleWhen:{key:"formulaMode",equals:true}},{key:"halfWidth",label:"Half width",input:"number",min:21,step:10},{key:"halfHeight",label:"Half height",input:"number",min:21,step:10},{key:"density",label:"Columns",input:"number",nullable:true,min:2,max:31,step:1,hint:"Empty preserves native default 13."}]});

registerEntity<ColorWheelEntity>({kind:"colorwheel",ctor:"colorwheel",group:"Math",label:"Complex color wheel",icon:"◉",order:42.2,fidelity:"exact",hint:"Phase-to-hue and magnitude-to-lightness legend",anchorArgIndex:1,create:(id,x,y)=>({...baseEntity(id,"fg"),nativePaint:true,kind:"colorwheel",x,y,radius:80}),parseArgs(stmt){const id=argName(stmt.args,0),at=argPoint(stmt.args,1),radius=argNumber(stmt.args,2);return id&&at&&radius!==null&&stmt.args.length===3?{...baseEntity(id,"fg"),nativePaint:true,kind:"colorwheel",x:at.x,y:at.y,radius}:null;},ctorLine:e=>`colorwheel(${e.id}, ${pt(e.x,e.y)}, ${num(e.radius)});`,extraLines:()=>[],modifiers:{},anchor:e=>({x:e.x,y:e.y}),translate:move,bounds:e=>box(e.x,e.y,e.radius*2,e.radius*2),handles:e=>[{name:"radius",x:e.x+e.radius,y:e.y}],dragHandle(e,_h,px,py){e.radius=Math.max(1,Math.hypot(px-e.x,py-e.y));},fields:[{key:"radius",label:"Radius",input:"number",min:1,step:1}]});

registerEntity<DomainColorEntity>({kind:"domaincolor",ctor:"domaincolor",group:"Math",label:"Domain coloring",icon:"z→◫",order:42.3,fidelity:"semantic",hint:"Bounded complex-function thumbnail; Preview owns full-resolution pixels and zeta",anchorArgIndex:1,create:(id,x,y)=>({...baseEntity(id,"fg"),nativePaint:true,kind:"domaincolor",x,y,width:320,height:220,formula:"z*z + 1",range:null}),parseArgs(stmt){const id=argName(stmt.args,0),at=argPoint(stmt.args,1),w=argNumber(stmt.args,2),h=argNumber(stmt.args,3),formula=argString(stmt.args,4),range=argNumber(stmt.args,5);return id&&at&&w!==null&&h!==null&&formula!==null&&stmt.args.length>=5&&stmt.args.length<=6&&(stmt.args.length===5||range!==null)?{...baseEntity(id,"fg"),nativePaint:true,kind:"domaincolor",x:at.x,y:at.y,width:w,height:h,formula,range}:null;},ctorLine:e=>`domaincolor(${e.id}, ${pt(e.x,e.y)}, ${num(e.width)}, ${num(e.height)}, "${escapeString(e.formula)}"${e.range===null?"":`, ${num(e.range)}`});`,extraLines:()=>[],modifiers:{},anchor:e=>({x:e.x,y:e.y}),translate:move,bounds:e=>box(e.x,e.y,e.width,e.height),handles:e=>[{name:"size",x:e.x+e.width/2,y:e.y+e.height/2}],dragHandle(e,_h,px,py){e.width=Math.max(1,Math.abs(px-e.x)*2);e.height=Math.max(1,Math.abs(py-e.y)*2);},fields:[{key:"formula",label:"f(z)",input:"textarea"},{key:"width",label:"Width",input:"number",min:1,step:10},{key:"height",label:"Height",input:"number",min:1,step:10},{key:"range",label:"Real half-range",input:"number",nullable:true,step:.1,hint:"Empty preserves native default 4."}]});

registerEntity<WarpEntity>({kind:"warp",ctor:"warp",group:"Math",label:"Complex grid warp",icon:"▦⇝",order:42.4,fidelity:"semantic",hint:"Identity and sampled f(z) grid destinations; Preview owns the continuous morph",anchorArgIndex:1,create:(id,x,y)=>({...baseEntity(id,"cyan"),nativePaint:true,kind:"warp",x,y,unit:60,formula:"z*z",range:null,resolution:null}),parseArgs(stmt){const id=argName(stmt.args,0),at=argPoint(stmt.args,1),unit=argNumber(stmt.args,2),formula=argString(stmt.args,3),range=argNumber(stmt.args,4),resolution=argNumber(stmt.args,5);return id&&at&&unit!==null&&formula!==null&&stmt.args.length>=4&&stmt.args.length<=6&&(stmt.args.length<5||range!==null)&&(stmt.args.length<6||resolution!==null)?{...baseEntity(id,"cyan"),nativePaint:true,kind:"warp",x:at.x,y:at.y,unit,formula,range,resolution}:null;},ctorLine:e=>`warp(${e.id}, ${pt(e.x,e.y)}, ${num(e.unit)}, "${escapeString(e.formula)}"${e.range===null&&e.resolution===null?"":`, ${num(e.range??3)}`}${e.resolution===null?"":`, ${num(e.resolution)}`});`,extraLines:()=>[],modifiers:{},referenceIds(e){const span=Math.floor(Math.max(1,Math.min(8,e.range??3)));return Array.from({length:span*2+1},(_v,i)=>i-span).flatMap(k=>[`${e.id}.h${k}`,`${e.id}.v${k}`]);},storyTargets(e){return this.referenceIds!(e).map(id=>({id,label:id,kind:"line"}));},anchor:e=>({x:e.x,y:e.y}),translate:move,bounds(e){const range=Math.max(1,Math.min(8,e.range??3)),extent=e.unit*range*2.5;return box(e.x,e.y,extent*2,extent*2);},handles:e=>[{name:"unit",x:e.x+e.unit,y:e.y}],dragHandle(e,_h,px,py){e.unit=Math.max(1,Math.hypot(px-e.x,py-e.y));},fields:[{key:"formula",label:"f(z)",input:"textarea"},{key:"unit",label:"Pixels per complex unit",input:"number",min:1,step:1},{key:"range",label:"Half-range",input:"number",nullable:true,min:1,max:8,step:.1},{key:"resolution",label:"Samples per line",input:"number",nullable:true,min:6,max:120,step:1}]});
