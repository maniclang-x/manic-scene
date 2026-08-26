import { argName, argNumber, argString, escapeString, num } from "../args.js";
import type { CallStatement } from "../script.js";
import type { GridCellKind, GridEntity, GridOperation } from "../types.js";

export const GRID_CELL_KINDS=["open","wall","start","goal"] as const;
export function gridBaseExtras(){return{neighbors:"4" as const,operations:[] as GridOperation[]};}

export const gridModifiers={
  neighbors(e:GridEntity,stmt:CallStatement){const mode=argString(stmt.args,1);if((mode!=="4"&&mode!=="8")||stmt.args.length!==2)return false;e.neighbors=mode;return true;},
  setcell(e:GridEntity,stmt:CallStatement){const row=argNumber(stmt.args,1),col=argNumber(stmt.args,2),kind=argName(stmt.args,3) as GridCellKind|null;if(row===null||col===null||!kind||!GRID_CELL_KINDS.includes(kind)||stmt.args.length!==4)return false;e.operations.push({kind:"setcell",row:Math.trunc(row),col:Math.trunc(col),cellKind:kind});return true;},
  walls(e:GridEntity,stmt:CallStatement){const cells=argString(stmt.args,1);if(cells===null||stmt.args.length!==2)return false;e.operations.push({kind:"walls",cells});return true;},
  evolve(e:GridEntity,stmt:CallStatement){const rule=argString(stmt.args,1);if(rule===null||stmt.args.length!==2)return false;e.operations.push({kind:"evolve",rule});return true;},
  collapse(e:GridEntity,stmt:CallStatement){const tileset=argString(stmt.args,1),seed=argNumber(stmt.args,2);if(tileset===null||stmt.args.length>3||(stmt.args.length===3&&seed===null))return false;e.operations.push({kind:"collapse",tileset,seed});return true;},
};
export function gridExtraLines(e:GridEntity):string[]{return[...(e.neighbors!=="4"?[`neighbors(${e.id}, "${e.neighbors}");`]:[]),...e.operations.map(op=>op.kind==="setcell"?`setcell(${e.id}, ${op.row}, ${op.col}, ${op.cellKind});`:op.kind==="walls"?`walls(${e.id}, "${escapeString(op.cells)}");`:op.kind==="evolve"?`evolve(${e.id}, "${escapeString(op.rule)}");`:`collapse(${e.id}, "${escapeString(op.tileset)}"${op.seed===null?"":`, ${num(op.seed)}`});`)];}

function seedCells(e:GridEntity):GridCellKind[]{const cells=Array<GridCellKind>(e.rows*e.cols).fill("open"),rows=(e.seed??"").split(";");for(let r=0;r<e.rows;r++){const chars=(rows[r]??"").replaceAll(/\s+/gu,"");for(let c=0;c<e.cols;c++)cells[r*e.cols+c]=chars[c]==="#"?"wall":chars[c]==="@"?"start":chars[c]==="*"?"goal":"open";}return cells;}
function life(cells:GridCellKind[],rows:number,cols:number,rule:string):GridCellKind[]{const match=/B([0-8]*)\/S([0-8]*)/iu.exec(rule==="life"?"B3/S23":rule),birth=new Set([...(match?.[1]??"3")].map(Number)),survive=new Set([...(match?.[2]??"23")].map(Number));return cells.map((cell,index)=>{const r=Math.floor(index/cols),c=index%cols;let n=0;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if((dr||dc)&&r+dr>=0&&r+dr<rows&&c+dc>=0&&c+dc<cols&&cells[(r+dr)*cols+c+dc]==="wall")n++;return(cell==="wall"?survive:birth).has(n)?"wall":"open";});}
function hash(seed:number,index:number):number{let x=(Math.trunc(seed)^Math.imul(index+1,0x9e3779b1))>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;return(x>>>0)/4294967296;}
export function gridDesignCells(e:GridEntity):GridCellKind[]{let cells=seedCells(e);for(const op of e.operations){if(op.kind==="setcell"&&op.row>=0&&op.row<e.rows&&op.col>=0&&op.col<e.cols)cells[op.row*e.cols+op.col]=op.cellKind;else if(op.kind==="walls"){const nums=op.cells.split(/[\s,]+/u).map(Number).filter(Number.isFinite);for(let i=0;i+1<nums.length;i+=2){const r=Math.trunc(nums[i]),c=Math.trunc(nums[i+1]);if(r>=0&&r<e.rows&&c>=0&&c<e.cols)cells[r*e.cols+c]="wall";}}else if(op.kind==="evolve")cells=life(cells,e.rows,e.cols,op.rule);else if(op.kind==="collapse"){const p=op.tileset==="islands"?.42:.3;cells=cells.map((_v,i)=>hash(op.seed??1,i)<p?"wall":"open");}}return cells;}
export function gridOperationSummary(e:GridEntity):string{const evolves=e.operations.filter(op=>op.kind==="evolve").length,collapse=[...e.operations].reverse().find((op):op is Extract<GridOperation,{kind:"collapse"}>=>op.kind==="collapse");return collapse?`WFC ${collapse.tileset} · seed ${collapse.seed??1}`:evolves?`${evolves} CA generation${evolves===1?"":"s"}`:`${e.neighbors}-neighbor grid`;}
