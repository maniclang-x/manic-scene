// Schema-driven entity inspector: shared fields plus the entity definition's
// declared fields — onboarding a new kind never edits this file.

import { useMemo, useState } from "react";
import { appliedFeatures, applyVocabularyFeature, canvasAnnotations, catalogEntry, circuitParts, defaultTimerStyle, defFor, docSize, entriesForSurface, entityAnchor, entityReferences, featureControlId, isAuthorOnly, isFeatureName, PHYSICS_KINDS, referenceIds, sanitizeId, threePointReferences, timingPreset, translateEntity, vocabularyAvailability, type CircuitEntity, type ConditionalMeta, type FieldSpec, type GradientMode, type GridEntity, type MathPart, type PhysicsEntity, type RaceChartEntity, type SceneDoc, type SceneEntity, replaceEntityReference } from "../index.js";
import { ColorField } from "./ColorField.js";
import { LatexField } from "./LatexField.js";
import { VocabularyBrowser } from "./VocabularyBrowser.js";

interface InspectorProps {
  doc: SceneDoc;
  conditionals: readonly ConditionalMeta[];
  entity: SceneEntity | null;
  /** Entities temporarily faded on the canvas (view-only — never written to the file). */
  dimmed: ReadonlySet<string>;
  onSelect(id: string): void;
  onToggleDim(id: string): void;
  onChange(change: (entity: SceneEntity) => void): void;
  onRename(next: string): void;
  onDuplicate(): void;
  onRemove(): void;
  /** Host hook: open the source editor at a character offset. */
  onRevealSource?(offset: number): void;
}

function isEntity3(entity: SceneEntity): boolean {
  return ["camera3", "grid3", "line3", "arrow3", "curve3", "point3", "cloud3", "axes3", "frame3", "cube3", "sphere3", "prism3", "pyramid3", "midpoint3", "cross3", "link3", "model3", "assembly3", "extrude3", "revolve3", "tube3", "project3", "projectpath3", "surface3", "domainsurface", "param3", "implicit3", "heightmap3", "contour3", "slice3", "tangentplane3", "gradient3", "vectorfield3", "volume3", "trajectory3", "descend3", "linmap3", "eigen3", "collection3", "collection3data", "child3", "links3", "links3data", "pieces3", "ring3", "trail3", "historyplot3", "randomwalk3", "lsystem3", "tree3", "hilbert3"].includes(entity.kind);
}

export function Inspector({ doc, conditionals, entity, dimmed, onSelect, onToggleDim, onChange, onRename, onDuplicate, onRemove, onRevealSource }: InspectorProps) {
  const [featureMenu, setFeatureMenu] = useState<{ left: number; top: number } | null>(null);
  const [entityQuery, setEntityQuery] = useState("");
  const featureEntries = useMemo(() => entriesForSurface("feature"), []);
  const authorOnlyEntity = entity ? isAuthorOnly(entity) || entity.kind === "creator" || entity.kind === "figure" || entity.kind === "loupe" : false;
  const formulaPaintEntity = entity ? ["shader", "glsl", "ifs2", "mandelbrot"].includes(entity.kind) : false;
  const visibleRail = useMemo(() => {
    const entries = railEntries(doc, conditionals);
    const needle = entityQuery.trim().toLowerCase();
    return needle ? entries.filter((entry) => entry.label.toLowerCase().includes(needle) || entry.hint.toLowerCase().includes(needle)) : entries;
  }, [doc, conditionals, entityQuery]);

  function addFeature(name: string) {
    if (!entity || !isFeatureName(name)) return;
    onChange((draft) => { applyVocabularyFeature(draft, name, doc); });
    setFeatureMenu(null);
    window.requestAnimationFrame(() => document.getElementById(featureControlId(name))?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

  return (
    <aside className="mse-inspector">
      <div className="mse-inspector-heading">
        <span className="mse-eyebrow">INSPECTOR</span>
        <strong>{entity ? defFor(entity).label : "Nothing selected"}</strong>
      </div>

      {doc.entities.length > 0 && (
        <>
          {doc.entities.length > 8 && <input className="mse-entity-search" value={entityQuery} onChange={(event) => setEntityQuery(event.target.value)} placeholder={`Find ${doc.entities.length} entities…`} aria-label="Find entities" />}
          <div className="mse-entity-list" aria-label="Entities">
          {visibleRail.map((entry) => (
            <span key={entry.key} className={`mse-entity-chip${entry.ids.includes(entity?.id ?? "") ? " active" : ""}${dimmed.has(entry.ids[0]) ? " dimmed" : ""}${entry.locked ? " locked" : ""}`}>
              <button className="mse-entity-name" title={entry.hint} onClick={() => onSelect(entry.ids[0])}>
                {entry.label}
              </button>
              <button
                className="mse-entity-eye"
                title={dimmed.has(entry.ids[0]) ? "Undim on canvas" : "Dim on canvas (view only — the file is untouched)"}
                aria-label={`Toggle canvas dim for ${entry.label}`}
                onClick={() => { for (const id of entry.ids) onToggleDim(id); }}
              >
                {dimmed.has(entry.ids[0]) ? "◌" : "◉"}
              </button>
            </span>
          ))}
          {visibleRail.length === 0 && <small className="mse-entity-none">No matching entities.</small>}
          </div>
        </>
      )}

      {!entity && (
        <p className="mse-inspector-empty">Select an object on the canvas — or in the list above — to edit its meaning, placement, and style. Overlapping things? Dim what's in the way with ◉.</p>
      )}

      {entity && entity.origin !== "generated" && <AppliedFeatures entity={entity} />}

      {entity && entity.origin !== "generated" && (
        <div className="mse-add-feature">
          <button type="button" onClick={(event) => {
            if (featureMenu) { setFeatureMenu(null); return; }
            const rect = event.currentTarget.getBoundingClientRect();
            const width = 430;
            const height = 440;
            const left = rect.left >= width + 8 ? rect.left - width - 8 : Math.min(window.innerWidth - width - 8, rect.right + 8);
            const top = Math.max(8, Math.min(rect.top, window.innerHeight - height - 8));
            setFeatureMenu({ left: Math.max(8, left), top });
          }}>＋ Feature</button>
          {featureMenu && (
            <VocabularyBrowser
              title="Add a Feature"
              eyebrow={`INSPECTOR · ${entity.id}`}
              hint="Compatible features appear first. Applied features stay indexed above."
              entries={featureEntries}
              availability={(entry) => vocabularyAvailability(entry, doc, entity.id)}
              onChoose={(entry) => addFeature(entry.name)}
              onClose={() => setFeatureMenu(null)}
              variant="popover"
              style={{ left: featureMenu.left, top: featureMenu.top }}
              placeholder="Search styling, masking, camera, or 3D features…"
            />
          )}
        </div>
      )}

      {entity?.origin === "generated" && (
        <div className="mse-locked" role="status">
          <strong>Generated by a loop or macro</strong>
          <p>One expanded instance — it has no statement of its own. Edit the loop instead, or duplicate this instance as a literal.</p>
          <LockedFacts entity={entity} />
          <div className="mse-inspector-actions">
            {onRevealSource && entity.src && (
              <button className="mse-reveal" onClick={() => onRevealSource(entity.src!.start)}>
                ✎ Edit the loop in Source
              </button>
            )}
            <button onClick={onDuplicate}>Duplicate as literal</button>
          </div>
        </div>
      )}

      {entity?.origin === "computed" && (
        <p className="mse-vars-chip" role="status">
          ƒ uses variables — position edits keep the expressions (a drag writes <code>cx − 140</code>, not a bare number).
          {onRevealSource && entity.src && (
            <button className="mse-vars-jump" onClick={() => onRevealSource(entity.src!.start)}>view source</button>
          )}
        </p>
      )}

      {entity?.copyOf && (
        <p className="mse-vars-chip" role="status">
          ⧉ native copy of <code>{entity.copyOf}</code> — constructor geometry is snapshot-owned. Style it here; use Story motion to place or transform it.
        </p>
      )}

      {entity && <EntityConditionalOrigin entity={entity} conditionals={conditionals} onRevealSource={onRevealSource} />}

      {entity && <SemanticSummary doc={doc} entity={entity} onSelect={onSelect} />}

      {entity && entity.origin !== "generated" && (
        <>
          <label className="mse-field">
            <span>Name</span>
            <input
              value={entity.id}
              disabled={entity.origin === "computed" || defFor(entity).renameable === false}
              title={entity.origin === "computed" ? "Renaming a variable-driven entity could break beats inside loops — rename it in Source." : undefined}
              onChange={(event) => onRename(sanitizeId(event.target.value) || entity.id)}
              spellCheck={false}
            />
          </label>

          {!entity.copyOf && defFor(entity).movable !== false && <PositionFields doc={doc} entity={entity} onChange={onChange} />}

          {!entity.copyOf && defFor(entity).fields.filter((field) => fieldVisible(field, entity)).map((field) => (
            <Field key={field.key} field={field} entity={entity} doc={doc} template={doc.template} onChange={onChange} />
          ))}

          {!entity.copyOf && PHYSICS_KINDS.includes(entity.kind as never) && <PhysicsFeatureFields entity={entity as PhysicsEntity} onChange={onChange} />}
          {!entity.copyOf && entity.kind === "circuit" && <CircuitFeatureFields entity={entity} onChange={onChange} />}
          {!entity.copyOf && entity.kind === "grid" && <GridKitFields entity={entity} onChange={onChange} />}
          {!entity.copyOf && entity.kind === "racechart" && <RaceChartFields entity={entity} onChange={onChange} />}

          {!authorOnlyEntity && !formulaPaintEntity && <div className="mse-field">
            <span>Color</span>
            <ColorField
              value={entity.color}
              template={doc.template}
              onChange={(next) => next !== null && onChange((draft) => { draft.color = next; if (draft.nativePaint) draft.nativePaint = false; })}
            />
            {entity.hue && <small>hue({Math.round(entity.hue.deg)}°) overrides this color</small>}
          </div>}

          {!authorOnlyEntity && <SharedStyleFields entity={entity} onChange={onChange} />}
          {!authorOnlyEntity && <CompositionFields doc={doc} entity={entity} onChange={onChange} />}
          <MotionRelationFields doc={doc} entity={entity} onChange={onChange} />
          {!entity.copyOf && <PublishingFields doc={doc} entity={entity} onChange={onChange} />}
          {!entity.copyOf && <WorkflowFields doc={doc} entity={entity} onChange={onChange} />}
          {!authorOnlyEntity && <SharedFeatureFields entity={entity} onChange={onChange} />}
          {!authorOnlyEntity && <StateFields entity={entity} onChange={onChange} />}
          {!authorOnlyEntity && <Spatial3Fields doc={doc} entity={entity} onChange={onChange} />}

          {!authorOnlyEntity && <label className="mse-field">
            <span>Starts</span>
            <select value={entity.reveal} onChange={(event) => onChange((draft) => { draft.reveal = event.target.value as SceneEntity["reveal"]; })}>
              <option value="none">Visible from the start</option>
              <option value="fade">Hidden — shown with a fade</option>
              <option value="grow">Hidden — grows in from center</option>
            </select>
            <small>Hidden entities need a Show beat in the story.</small>
          </label>}

          {!authorOnlyEntity && <div className="mse-field-grid">
            <label className="mse-field">
              <span>Opacity</span>
              <input type="range" min={0.1} max={1} step={0.05} value={entity.opacity} onChange={(event) => onChange((draft) => { draft.opacity = Number(event.target.value); })} />
            </label>
            {!isEntity3(entity) && <label className="mse-field">
              <span>Rotation</span>
              <input type="number" value={entity.rotation} step={5} onChange={(event) => onChange((draft) => { draft.rotation = Number(event.target.value) || 0; })} />
            </label>}
          </div>}

          <div className="mse-inspector-actions">
            <button onClick={onDuplicate}>Duplicate</button>
            <button className="mse-danger" onClick={onRemove}>Remove</button>
          </div>
        </>
      )}
    </aside>
  );
}

function PhysicsFeatureFields({entity,onChange}:{entity:PhysicsEntity;onChange(change:(entity:SceneEntity)=>void):void}){
  const mutate=(change:(draft:PhysicsEntity)=>void)=>onChange(draft=>change(draft as PhysicsEntity));
  const views=(["phase","well","timegraph","energygraph"] as const);
  return <section className="mse-workflow" id="mse-physics-feature-controls"><strong>Physics views</strong><small>These declarations share the simulation name and follow its native playback.</small>
    {entity.kind==="gas"&&<>
      <div className="mse-field"><span>Species populations</span>{entity.species.map((species,index)=><div className="mse-field-grid" key={index}><input aria-label={`Species ${index+1} name`} value={species.name} onChange={event=>mutate(d=>{d.species[index].name=sanitizeId(event.target.value)||species.name;})}/><input aria-label={`Species ${index+1} weight`} type="number" step={.1} value={species.weight??""} placeholder="empty" onChange={event=>mutate(d=>{d.species[index].weight=event.target.value===""?null:Number(event.target.value);})}/><input aria-label={`Species ${index+1} colour`} value={species.color??""} placeholder="colour" onChange={event=>mutate(d=>{d.species[index].color=event.target.value.trim()||null;})}/><button type="button" onClick={()=>mutate(d=>{d.species.splice(index,1);})}>Remove</button></div>)}<button type="button" onClick={()=>mutate(d=>{d.species.push({name:`S${d.species.length+1}`,weight:1,color:"cyan"});})}>+ Species</button></div>
      <label className="mse-field"><span>Collision rules</span><textarea value={entity.rules.join("\n")} placeholder="A + B -> C + C when energy > 3" onChange={event=>mutate(d=>{d.rules=event.target.value.split("\n").map(v=>v.trim()).filter(Boolean);})}/><small>One native rule per line.</small></label>
      <div className="mse-field"><span>Live speed histogram</span><button type="button" onClick={()=>mutate(d=>{d.speeds=d.speeds?null:{x:d.x,y:d.y+300,size:null,p1:null,p2:null,p3:null,p4:null};})}>{entity.speeds?"Remove speed histogram":"+ Speed histogram"}</button>{entity.speeds&&<div className="mse-field-grid">{(["x","y","p1","p2","p3","p4","size"] as const).map((key,index)=><label key={key}><small>{["X","Y","Width","Height","Bins","Smoothing","V max"][index]}</small><input type="number" step={key==="x"||key==="y"?1:.1} value={entity.speeds?.[key]??""} onChange={event=>mutate(d=>{if(!d.speeds)return;const raw=event.target.value;if(key==="x"||key==="y")d.speeds[key]=raw===""?0:Number(raw);else d.speeds[key]=raw===""?null:Number(raw);})}/></label>)}</div>}</div>
    </>}
    {views.map((key,index)=>{const value=entity[key],label=["Phase portrait","Potential well","Time graph","Energy graph"][index];return <div className="mse-field" key={key}><span>{label}</span><button type="button" onClick={()=>mutate(d=>{d[key]=d[key]?null:{x:d.x+380,y:d.y+(index-1.5)*180,size:null};})}>{value?`Remove ${label}`:`+ ${label}`}</button>{value&&<div className="mse-field-grid">{(["x","y","size"] as const).map((field,i)=><label key={field}><small>{["X","Y","Size"][i]}</small><input type="number" value={value[field]??""} placeholder={field==="size"?"native":""} onChange={event=>mutate(d=>{const panel=d[key];if(!panel)return;const raw=event.target.value;if(field==="size")panel.size=raw===""?null:Number(raw);else panel[field]=raw===""?0:Number(raw);})}/></label>)}</div>}</div>;})}
  </section>;
}

function CircuitFeatureFields({entity,onChange}:{entity:CircuitEntity;onChange(change:(entity:SceneEntity)=>void):void}){
  const mutate=(change:(draft:CircuitEntity)=>void)=>onChange(draft=>change(draft as CircuitEntity));
  const parts=circuitParts(entity),names=parts.map(part=>part.name??`c${part.index}`);
  return <section className="mse-workflow" id="mse-circuit-feature-controls"><strong>Circuit measurements</strong><small>Canvas edits topology and measurement intent. Preview solves the circuit and supplies real readings, glow, dots, and waveforms.</small>
    <div className="mse-field"><span>Current presentation</span><button type="button" onClick={()=>mutate(d=>{d.currentStyle=d.currentStyle?null:{speed:1,shape:"circle",color:"gold",size:3};})}>{entity.currentStyle?"Remove current dots":"+ Current dots"}</button>{entity.currentStyle&&<div className="mse-field-grid"><label><small>Speed</small><input type="number" min={.05} max={20} step={.1} value={entity.currentStyle.speed} onChange={event=>mutate(d=>{if(d.currentStyle)d.currentStyle.speed=Number(event.target.value)||1;})}/></label><label><small>Shape</small><select value={entity.currentStyle.shape} onChange={event=>mutate(d=>{if(d.currentStyle)d.currentStyle.shape=event.target.value as "circle"|"square"|"diamond";})}><option>circle</option><option>square</option><option>diamond</option></select></label><label><small>Color</small><input value={entity.currentStyle.color} onChange={event=>mutate(d=>{if(d.currentStyle)d.currentStyle.color=event.target.value.trim()||"gold";})}/></label><label><small>Size</small><input type="number" min={1} max={20} step={1} value={entity.currentStyle.size} onChange={event=>mutate(d=>{if(d.currentStyle)d.currentStyle.size=Number(event.target.value)||3;})}/></label></div>}</div>
    <div className="mse-field"><span>Probes</span>{entity.probes.map((probe,index)=><div className="mse-field-grid" key={index}><label><small>Measure</small><select value={probe.at?"node":"part"} onChange={event=>mutate(d=>{const v=d.probes[index];if(event.target.value==="node"){v.at={x:0,y:0};v.part=null;}else{v.at=null;v.part=names[0]??"c0";}})}><option value="node">Node voltage</option><option value="part">Part current</option></select></label>{probe.at?<><label><small>Grid X</small><input type="number" value={probe.at.x} onChange={event=>mutate(d=>{if(d.probes[index].at)d.probes[index].at!.x=Number(event.target.value)||0;})}/></label><label><small>Grid Y</small><input type="number" value={probe.at.y} onChange={event=>mutate(d=>{if(d.probes[index].at)d.probes[index].at!.y=Number(event.target.value)||0;})}/></label></>:<label><small>Part</small><select value={probe.part??""} onChange={event=>mutate(d=>{d.probes[index].part=event.target.value;})}>{names.map(name=><option key={name}>{name}</option>)}</select></label>}<button type="button" onClick={()=>mutate(d=>{d.probes.splice(index,1);})}>Remove</button></div>)}<button type="button" onClick={()=>mutate(d=>{d.probes.push({at:{x:0,y:0},part:null,offset:{x:0,y:-30}});})}>+ Probe</button></div>
    <div className="mse-field"><span>Oscilloscope views</span>{entity.scopes.map((scope,index)=><div className="mse-field-grid" key={index}><label><small>Source</small><select value={scope.at?"node":"part"} onChange={event=>mutate(d=>{const v=d.scopes[index];if(event.target.value==="node"){v.at={x:0,y:0};v.part=null;}else{v.at=null;v.part=names[0]??"c0";}})}><option value="node">Node voltage</option><option value="part">Part current</option></select></label>{scope.at?<><label><small>Grid X</small><input type="number" value={scope.at.x} onChange={event=>mutate(d=>{if(d.scopes[index].at)d.scopes[index].at!.x=Number(event.target.value)||0;})}/></label><label><small>Grid Y</small><input type="number" value={scope.at.y} onChange={event=>mutate(d=>{if(d.scopes[index].at)d.scopes[index].at!.y=Number(event.target.value)||0;})}/></label></>:<label><small>Part</small><select value={scope.part??""} onChange={event=>mutate(d=>{d.scopes[index].part=event.target.value;})}>{names.map(name=><option key={name}>{name}</option>)}</select></label>}{(["x","y","width","height"] as const).map(key=><label key={key}><small>{key}</small><input type="number" value={scope[key]} onChange={event=>mutate(d=>{d.scopes[index][key]=Number(event.target.value)||0;})}/></label>)}<button type="button" onClick={()=>mutate(d=>{d.scopes.splice(index,1);})}>Remove</button></div>)}<button type="button" onClick={()=>mutate(d=>{d.scopes.push({at:{x:0,y:0},part:null,x:d.x+360,y:d.y,width:300,height:140});})}>+ Scope</button></div>
  </section>;
}

function GridKitFields({entity,onChange}:{entity:GridEntity;onChange(change:(entity:SceneEntity)=>void):void}){const mutate=(change:(draft:GridEntity)=>void)=>onChange(draft=>change(draft as GridEntity));return <section className="mse-workflow" id="mse-grid-kit-controls"><strong>Grid computation</strong><small>These declarations update the authored build-time state. Preview owns CA/WFC replay and pathfinding playback.</small><label className="mse-field"><span>Connectivity</span><select value={entity.neighbors} onChange={event=>mutate(d=>{d.neighbors=event.target.value as "4"|"8";})}><option value="4">4 directions</option><option value="8">8 directions</option></select></label><div className="mse-field"><span>Build operations</span>{entity.operations.map((op,index)=><div className="mse-field-grid" key={index}><strong>{op.kind}</strong>{op.kind==="setcell"?<><input aria-label="Row" type="number" value={op.row} onChange={event=>mutate(d=>{const v=d.operations[index];if(v.kind==="setcell")v.row=Math.trunc(Number(event.target.value)||0);})}/><input aria-label="Column" type="number" value={op.col} onChange={event=>mutate(d=>{const v=d.operations[index];if(v.kind==="setcell")v.col=Math.trunc(Number(event.target.value)||0);})}/><select value={op.cellKind} onChange={event=>mutate(d=>{const v=d.operations[index];if(v.kind==="setcell")v.cellKind=event.target.value as typeof v.cellKind;})}>{["open","wall","start","goal"].map(value=><option key={value}>{value}</option>)}</select></>:op.kind==="walls"?<input value={op.cells} onChange={event=>mutate(d=>{const v=d.operations[index];if(v.kind==="walls")v.cells=event.target.value;})}/>:op.kind==="evolve"?<input value={op.rule} onChange={event=>mutate(d=>{const v=d.operations[index];if(v.kind==="evolve")v.rule=event.target.value;})}/>:<><select value={op.tileset} onChange={event=>mutate(d=>{const v=d.operations[index];if(v.kind==="collapse")v.tileset=event.target.value;})}><option>maze</option><option>islands</option></select><input type="number" value={op.seed??""} placeholder="seed 1" onChange={event=>mutate(d=>{const v=d.operations[index];if(v.kind==="collapse")v.seed=event.target.value===""?null:Number(event.target.value);})}/></>}<button type="button" onClick={()=>mutate(d=>{d.operations.splice(index,1);})}>Remove</button></div>)}<div className="mse-field-grid"><button type="button" onClick={()=>mutate(d=>{d.operations.push({kind:"setcell",row:0,col:0,cellKind:"wall"});})}>+ Cell</button><button type="button" onClick={()=>mutate(d=>{d.operations.push({kind:"walls",cells:"0,0 0,1"});})}>+ Walls</button><button type="button" onClick={()=>mutate(d=>{d.operations.push({kind:"evolve",rule:"life"});})}>+ Evolve</button><button type="button" onClick={()=>mutate(d=>{d.operations.push({kind:"collapse",tileset:"maze",seed:1});})}>+ Collapse</button></div></div></section>;}

function RaceChartFields({entity,onChange}:{entity:RaceChartEntity;onChange(change:(entity:SceneEntity)=>void):void}){const mutate=(change:(draft:RaceChartEntity)=>void)=>onChange(draft=>change(draft as RaceChartEntity));return <section className="mse-workflow" id="mse-race-chart-controls"><strong>Race data</strong><small>Canvas shows the first period for composition. Preview interpolates ranks, values, axes, and history.</small><div className="mse-field"><span>Pasted data blocks</span>{entity.dataBlocks.map((block,index)=><div key={index}><textarea rows={5} value={block} onChange={event=>mutate(d=>{d.dataBlocks[index]=event.target.value;})}/><button type="button" onClick={()=>mutate(d=>{d.dataBlocks.splice(index,1);})}>Remove block</button></div>)}<button type="button" onClick={()=>mutate(d=>{d.dataBlocks.push("Alpha, 10, 20, 30\nBeta, 8, 24, 28");})}>+ Data block</button></div><div className="mse-field"><span>Individual series</span>{entity.series.map((row,index)=><div className="mse-field-grid" key={index}><input aria-label="Label" value={row.label} onChange={event=>mutate(d=>{d.series[index].label=event.target.value;})}/><input aria-label="Icon" value={row.icon??""} placeholder="optional icon" onChange={event=>mutate(d=>{d.series[index].icon=event.target.value.trim()||null;})}/><input aria-label="Values" value={row.values} onChange={event=>mutate(d=>{d.series[index].values=event.target.value;})}/><button type="button" onClick={()=>mutate(d=>{d.series.splice(index,1);})}>Remove</button></div>)}<button type="button" onClick={()=>mutate(d=>{d.series.push({label:`Series ${d.series.length+1}`,icon:null,values:"10 20 30"});})}>+ Series</button></div>{entity.layout==="bar"&&<><div className="mse-field"><span>Companion line</span><button type="button" onClick={()=>mutate(d=>{d.companion=d.companion?null:{label:"Total",values:null};})}>{entity.companion?"Remove companion":"+ Companion line"}</button>{entity.companion&&<div className="mse-field-grid"><input value={entity.companion.label} onChange={event=>mutate(d=>{if(d.companion)d.companion.label=event.target.value;})}/><input value={entity.companion.values??""} placeholder="empty = sum" onChange={event=>mutate(d=>{if(d.companion)d.companion.values=event.target.value.trim()||null;})}/></div>}</div><label className="mse-field mse-field-checkbox"><input type="checkbox" checked={entity.panel} onChange={event=>mutate(d=>{d.panel=event.target.checked;})}/><span>History panel</span></label></>}</section>;}

function MotionRelationFields({ doc, entity, onChange }: {
  doc: SceneDoc;
  entity: SceneEntity;
  onChange(change: (entity: SceneEntity) => void): void;
}) {
  const morphTargets = doc.entities.filter((candidate) => candidate.id !== entity.id && !isEntity3(candidate)
    && !["caption", "mathparts", "particles", "parameter"].includes(candidate.kind));
  const bindingTargets = doc.entities.filter((candidate) => candidate.id !== entity.id);
  if (!entity.morph2 && entity.kind !== "parameter") return null;
  return (
    <div className="mse-composition">
      {entity.morph2 && morphTargets.length > 0 && (
        <div className="mse-composition-group" id="mse-morph2-controls">
          <label className="mse-field-checkbox">
            <input type="checkbox" checked onChange={() => onChange((draft) => { delete draft.morph2; })} />
            <span>Sampled shape morph</span>
          </label>
          <div className="mse-field-grid">
            <label className="mse-field"><span>Target blueprint</span><select value={entity.morph2.target} onChange={(event) => onChange((draft) => { if (draft.morph2) draft.morph2.target = event.target.value; })}>{morphTargets.map((target) => <option key={target.id} value={target.id}>{target.id}</option>)}</select></label>
            <label className="mse-field"><span>Spin winding</span><input type="number" step={5} value={entity.morph2.spin ?? ""} placeholder="none" onChange={(event) => onChange((draft) => { if (draft.morph2) draft.morph2.spin = event.target.value === "" ? null : Number(event.target.value) || 0; })} /></label>
          </div>
          <small>Drive the prepared morph with a To beat using property <code>morph</code> and value 1.</small>
        </div>
      )}
      {entity.kind === "parameter" && (
        <div className="mse-composition-group" id="mse-parameter-bindings">
          <span>Live bindings</span>
          {entity.bindings.map((binding, index) => (
            <div className="mse-composition-group" key={`${index}-${binding.target}-${binding.property}`}>
              <div className="mse-field-grid">
                <label className="mse-field"><span>Target</span><select value={binding.target} onChange={(event) => onChange((draft) => { if (draft.kind === "parameter") draft.bindings[index].target = event.target.value; })}>{bindingTargets.map((target) => <option key={target.id} value={target.id}>{target.id}</option>)}</select></label>
                <label className="mse-field"><span>Property</span><input value={binding.property} spellCheck={false} onChange={(event) => onChange((draft) => { if (draft.kind === "parameter") draft.bindings[index].property = sanitizeId(event.target.value); })} /></label>
              </div>
              <label className="mse-field"><span>Mapping</span><select value={binding.formulas.length > 0 ? "formula" : "range"} onChange={(event) => onChange((draft) => {
                if (draft.kind !== "parameter") return;
                const item = draft.bindings[index];
                if (event.target.value === "formula") { item.formulas = ["p"]; item.from = null; item.to = null; }
                else { item.formulas = []; item.from = draft.min; item.to = draft.max; }
              })}><option value="formula">Formula using p</option><option value="range">Map to numeric range</option></select></label>
              {binding.formulas.length > 0 ? (
                <label className="mse-field"><span>Formula components</span><textarea value={binding.formulas.join("\n")} spellCheck={false} onChange={(event) => onChange((draft) => { if (draft.kind === "parameter") draft.bindings[index].formulas = event.target.value.split("\n").filter(Boolean); })} /><small>One component per line; ordinary bindings use one formula.</small></label>
              ) : (
                <div className="mse-field-grid">
                  <label className="mse-field"><span>From</span><input type="number" value={binding.from ?? 0} onChange={(event) => onChange((draft) => { if (draft.kind === "parameter") draft.bindings[index].from = Number(event.target.value) || 0; })} /></label>
                  <label className="mse-field"><span>To</span><input type="number" value={binding.to ?? 1} onChange={(event) => onChange((draft) => { if (draft.kind === "parameter") draft.bindings[index].to = Number(event.target.value) || 0; })} /></label>
                </div>
              )}
              <button type="button" className="mse-mini-action" onClick={() => onChange((draft) => { if (draft.kind === "parameter") draft.bindings.splice(index, 1); })}>Remove binding</button>
            </div>
          ))}
          <button type="button" className="mse-mini-action" disabled={bindingTargets.length === 0} onClick={() => onChange((draft) => {
            if (draft.kind === "parameter" && bindingTargets[0]) draft.bindings.push({ target: bindingTargets[0].id, property: "x", formulas: ["p"], from: null, to: null });
          })}>+ Binding</button>
          <small>Canvas shows the relationship; Preview evaluates formulas and generated-family components.</small>
        </div>
      )}
    </div>
  );
}

function PublishingFields({ doc, entity, onChange }: {
  doc: SceneDoc;
  entity: SceneEntity;
  onChange(change: (entity: SceneEntity) => void): void;
}) {
  if (entity.kind !== "creator") return null;
  const size = docSize(doc);
  return (
    <div className="mse-composition" id="mse-publishing-controls">
      <div className="mse-composition-group">
        <label className="mse-field"><span>Footer style</span><select value={entity.footer} onChange={(event) => onChange((draft) => { if (draft.kind === "creator") { draft.footer = event.target.value as typeof draft.footer; if (draft.footer === "none") draft.stickyFooter = false; } })}><option value="social">social</option><option value="compact">compact</option><option value="signature">signature</option><option value="none">none</option></select></label>
        <label className="mse-field-checkbox"><input type="checkbox" checked={entity.socials} onChange={(event) => onChange((draft) => { if (draft.kind === "creator") { draft.socials = event.target.checked; if (!event.target.checked) { draft.socialsAt = null; draft.stickyFooter = false; } } })} /><span>Responsive social footer</span></label>
        {entity.socials && <>
          {entity.footer === "none" && <small>The <code>socials</code> statement is preserved, but native Preview draws nothing while Footer style is <code>none</code>.</small>}
          {entity.footer !== "none" && <>
          <label className="mse-field"><span>Footer position</span><select value={entity.socialsAt ? "custom" : "responsive"} onChange={(event) => onChange((draft) => { if (draft.kind !== "creator") return; draft.socialsAt = event.target.value === "custom" ? { x: size.width / 2, y: size.height * .91 } : null; })}><option value="responsive">Responsive safe-area position</option><option value="custom">Custom position</option></select></label>
          {entity.socialsAt && <div className="mse-field-grid">
            <label className="mse-field"><span>Footer X</span><input type="number" value={entity.socialsAt.x} onChange={(event) => onChange((draft) => { if (draft.kind === "creator" && draft.socialsAt) draft.socialsAt.x = Number(event.target.value) || 0; })} /></label>
            <label className="mse-field"><span>Footer Y</span><input type="number" value={entity.socialsAt.y} onChange={(event) => onChange((draft) => { if (draft.kind === "creator" && draft.socialsAt) draft.socialsAt.y = Number(event.target.value) || 0; })} /></label>
          </div>}
          <label className="mse-field-checkbox"><input type="checkbox" checked={entity.stickyFooter} onChange={(event) => onChange((draft) => { if (draft.kind === "creator") draft.stickyFooter = event.target.checked; })} /><span>Pin footer to camera</span></label>
          </>}
        </>}
      </div>
      <div className="mse-composition-group">
        <label className="mse-field-checkbox"><input type="checkbox" checked={entity.endcard !== null} onChange={(event) => onChange((draft) => { if (draft.kind === "creator") { draft.endcard = event.target.checked ? { title: null, cta: null, safe: null } : null; if (!event.target.checked) draft.stickyEndcard = false; } })} /><span>Hidden creator end card</span></label>
        {entity.endcard && <>
          <label className="mse-field"><span>Title override</span><input value={entity.endcard.title ?? ""} placeholder={entity.displayName} onChange={(event) => onChange((draft) => { if (draft.kind === "creator" && draft.endcard) draft.endcard.title = event.target.value || null; })} /></label>
          <label className="mse-field"><span>CTA override</span><input value={entity.endcard.cta ?? ""} placeholder={entity.cta || "FOLLOW FOR MORE"} onChange={(event) => onChange((draft) => { if (draft.kind === "creator" && draft.endcard) draft.endcard.cta = event.target.value || null; })} /></label>
          <label className="mse-field"><span>Safe-area override</span><select value={entity.endcard.safe ?? "profile"} onChange={(event) => onChange((draft) => { if (draft.kind === "creator" && draft.endcard) draft.endcard.safe = event.target.value === "profile" ? null : event.target.value as NonNullable<typeof draft.endcard.safe>; })}><option value="profile">Use profile ({entity.safe})</option><option value="shorts">shorts</option><option value="reels">reels</option><option value="tiktok">tiktok</option><option value="clean">clean</option></select></label>
          <label className="mse-field-checkbox"><input type="checkbox" checked={entity.stickyEndcard} onChange={(event) => onChange((draft) => { if (draft.kind === "creator") draft.stickyEndcard = event.target.checked; })} /><span>Pin end card to camera</span></label>
          <small>Native parts start hidden. Add a Show beat targeting <code>{entity.id}.endcard</code>.</small>
        </>}
      </div>
    </div>
  );
}

function WorkflowFields({ doc, entity, onChange }: {
  doc: SceneDoc;
  entity: SceneEntity;
  onChange(change: (entity: SceneEntity) => void): void;
}) {
  if (entity.kind === "quiz") {
    const style = entity.timerStyle ?? defaultTimerStyle(entity.timerLook);
    return <div className="mse-composition" id="mse-quiz-controls">
      <div className="mse-composition-group">
        <span>Answer cards</span>
        {entity.options.map((option, index) => <div className="mse-composition-group" key={index}>
          <label className="mse-field"><span>{entity.labels === "numbers" ? index + 1 : String.fromCharCode(65 + index)} answer</span><textarea value={option.text} onChange={(event) => onChange((draft) => { if (draft.kind === "quiz") draft.options[index].text = event.target.value; })} /></label>
          <label className="mse-field-checkbox"><input type="radio" name={`${entity.id}-correct-answer`} checked={option.correct} onChange={() => onChange((draft) => { if (draft.kind === "quiz") draft.options.forEach((candidate, candidateIndex) => { candidate.correct = candidateIndex === index; }); })} /><span>Correct answer</span></label>
          <button type="button" className="mse-mini-action" disabled={entity.options.length <= 2} onClick={() => onChange((draft) => { if (draft.kind === "quiz") draft.options.splice(index, 1); })}>Remove answer</button>
        </div>)}
        <button type="button" className="mse-mini-action" disabled={entity.options.length >= (entity.layout === "stack" ? 4 : 6)} onClick={() => onChange((draft) => { if (draft.kind === "quiz") draft.options.push({ text: `Answer ${draft.options.length + 1}`, correct: false }); })}>+ Answer</button>
        <small>Native Run requires 2–6 answers and exactly one correct answer. Stack layout supports four.</small>
      </div>
      <div className="mse-composition-group">
        <label className="mse-field-checkbox"><input type="checkbox" checked={Boolean(entity.explanation)} onChange={(event) => onChange((draft) => { if (draft.kind === "quiz") { draft.explanation = event.target.checked ? "Explain why this answer is correct." : ""; if (!event.target.checked) draft.explanationSource = ""; } })} /><span>Answer explanation</span></label>
        {entity.explanation && <>
          <label className="mse-field"><span>Explanation</span><textarea value={entity.explanation} onChange={(event) => onChange((draft) => { if (draft.kind === "quiz") draft.explanation = event.target.value; })} /></label>
          <label className="mse-field"><span>Optional source</span><input value={entity.explanationSource} onChange={(event) => onChange((draft) => { if (draft.kind === "quiz") draft.explanationSource = event.target.value; })} /></label>
        </>}
      </div>
      <div className="mse-composition-group">
        <label className="mse-field-checkbox"><input type="checkbox" checked={entity.timing !== null} onChange={(event) => onChange((draft) => { if (draft.kind === "quiz") draft.timing = event.target.checked ? timingPreset(draft.pace) : null; })} /><span>Custom quiz timing</span></label>
        {entity.timing && <>
          <label className="mse-field"><span>Timing preset</span><select value={entity.timing.pace} onChange={(event) => onChange((draft) => { if (draft.kind === "quiz" && draft.timing) draft.timing = timingPreset(event.target.value as typeof draft.timing.pace); })}><option value="quick">quick</option><option value="balanced">balanced</option><option value="calm">calm</option><option value="dramatic">dramatic</option></select></label>
          <div className="mse-field-grid">
            {(["ask", "options", "think", "reveal", "hold", "stagger"] as const).map((key) => <label className="mse-field" key={key}><span>{key}</span><input type="number" min={key === "options" || key === "think" ? .05 : 0} step={key === "stagger" ? .01 : .1} value={entity.timing![key]} onChange={(event) => onChange((draft) => { if (draft.kind === "quiz" && draft.timing) draft.timing[key] = Math.max(key === "options" || key === "think" ? .05 : 0, Number(event.target.value) || 0); })} /></label>)}
          </div>
        </>}
      </div>
      <TimerStyleFields template={doc.template} style={style} optional={entity.timerStyle === null} onToggle={(enabled) => onChange((draft) => { if (draft.kind === "quiz") draft.timerStyle = enabled ? defaultTimerStyle(draft.timerLook) : null; })} onChange={(key, value) => onChange((draft) => { if (draft.kind === "quiz") { draft.timerStyle ??= defaultTimerStyle(draft.timerLook); Object.assign(draft.timerStyle, { [key]: value }); } })} />
    </div>;
  }
  if (entity.kind === "timing") return <div className="mse-composition" id="mse-timing-controls">
    <div className="mse-composition-group">
      <span>Named phases</span>
      {entity.phases.map((phase, index) => <div className="mse-field-grid" key={index}>
        <label className="mse-field"><span>Phase</span><input value={phase.name} spellCheck={false} onChange={(event) => onChange((draft) => {
          if (draft.kind !== "timing") return;
          const base = sanitizeId(event.target.value).toLowerCase() || `phase${index + 1}`;
          let name = base, suffix = 2;
          while (draft.phases.some((candidate, at) => at !== index && candidate.name === name)) name = `${base}${suffix++}`;
          draft.phases[index].name = name;
        })} /></label>
        <label className="mse-field"><span>Seconds</span><input type="number" min={.05} step={.1} value={phase.duration} onChange={(event) => onChange((draft) => { if (draft.kind === "timing") draft.phases[index].duration = Math.max(.05, Number(event.target.value) || .05); })} /></label>
        <button type="button" className="mse-mini-action" disabled={entity.phases.length <= 1} onClick={() => onChange((draft) => { if (draft.kind === "timing") draft.phases.splice(index, 1); })}>Remove</button>
      </div>)}
      <button type="button" className="mse-mini-action" disabled={entity.phases.length >= 32} onClick={() => onChange((draft) => { if (draft.kind === "timing") draft.phases.push({ name: `phase${draft.phases.length + 1}`, duration: 1 }); })}>+ Phase</button>
    </div>
    <TimerStyleFields template={doc.template} style={entity.timerStyle} onChange={(key, value) => onChange((draft) => { if (draft.kind === "timing") Object.assign(draft.timerStyle, { [key]: value }); })} />
  </div>;
  if (entity.kind === "countdown") return <div className="mse-composition" id="mse-countdown-controls"><TimerStyleFields template={doc.template} style={entity.timerStyle} onChange={(key, value) => onChange((draft) => { if (draft.kind === "countdown") Object.assign(draft.timerStyle, { [key]: value }); })} /></div>;
  return null;
}

function TimerStyleFields({ template, style, optional = false, onToggle, onChange }: {
  template: SceneDoc["template"];
  style: ReturnType<typeof defaultTimerStyle>;
  optional?: boolean;
  onToggle?(enabled: boolean): void;
  onChange(key: keyof ReturnType<typeof defaultTimerStyle>, value: string | number | null): void;
}) {
  return <div className="mse-composition-group">
    {optional && <label className="mse-field-checkbox"><input type="checkbox" checked={false} onChange={(event) => onToggle?.(event.target.checked)} /><span>Custom timer styling</span></label>}
    {!optional && <>
      <div className="mse-field-grid">
        <label className="mse-field"><span>Look</span><select value={style.look} onChange={(event) => onChange("look", event.target.value)}>{["ring", "bar", "number", "segments", "ticks", "pulse", "none"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="mse-field"><span>Position</span><select value={style.position} onChange={(event) => onChange("position", event.target.value)}>{["auto", "header", "media", "below"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="mse-field"><span>Number</span><select value={style.number} onChange={(event) => onChange("number", event.target.value)}>{["inside", "outside", "none"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="mse-field"><span>Direction</span><select value={style.direction} onChange={(event) => onChange("direction", event.target.value)}><option>drain</option><option>fill</option></select></label>
        <label className="mse-field"><span>Finish</span><select value={style.finish} onChange={(event) => onChange("finish", event.target.value)}>{["fade", "hold", "flash", "pulse"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="mse-field"><span>Font</span><select value={style.font} onChange={(event) => onChange("font", event.target.value)}><option>mono</option><option>display</option></select></label>
        <label className="mse-field"><span>Size</span><input type="number" min={.5} max={2} step={.05} value={style.size} onChange={(event) => onChange("size", Math.max(.5, Math.min(2, Number(event.target.value) || 1)))} /></label>
        <label className="mse-field"><span>Thickness</span><input type="number" min={.4} max={3} step={.1} value={style.thickness} onChange={(event) => onChange("thickness", Math.max(.4, Math.min(3, Number(event.target.value) || 1)))} /></label>
      </div>
      <label className="mse-field"><span>Timer label</span><input value={style.label} onChange={(event) => onChange("label", event.target.value)} /></label>
      <div className="mse-field"><span>Timer color</span><ColorField value={style.color} template={template} onChange={(value) => onChange("color", value)} /></div>
      <div className="mse-field"><span>Track color</span><ColorField value={style.track} template={template} onChange={(value) => onChange("track", value)} /></div>
      {onToggle && <button type="button" className="mse-mini-action" onClick={() => onToggle(false)}>Use constructor timer defaults</button>}
    </>}
  </div>;
}

function SharedStyleFields({ entity, onChange }: {
  entity: SceneEntity;
  onChange(change: (entity: SceneEntity) => void): void;
}) {
  if (!entity.hue && entity.z === undefined && !entity.tags?.length) return null;
  return (
    <div className="mse-composition" id="mse-shared-style-controls">
      {entity.hue && (
        <div className="mse-composition-group">
          <label className="mse-field-checkbox"><input type="checkbox" checked onChange={() => onChange((draft) => { draft.hue = null; })} /><span>Hue override</span></label>
          <label className="mse-field"><span>Hue degrees</span><input type="range" min={0} max={360} step={1} value={entity.hue.deg} onChange={(event) => onChange((draft) => { if (draft.hue) draft.hue.deg = Number(event.target.value); })} /><small>{Math.round(entity.hue.deg)}°</small></label>
        </div>
      )}
      {entity.z !== undefined && (
        <div className="mse-composition-group">
          <label className="mse-field-checkbox"><input type="checkbox" checked onChange={() => onChange((draft) => { delete draft.z; })} /><span>Explicit draw layer</span></label>
          <label className="mse-field"><span>Layer</span><input type="number" step={1} value={entity.z} onChange={(event) => onChange((draft) => { draft.z = Number(event.target.value) || 0; })} /><small>Higher values draw on top.</small></label>
        </div>
      )}
      {entity.tags && entity.tags.length > 0 && (
        <label className="mse-field">
          <span>Group tags</span>
          <input value={entity.tags.join(" ")} onChange={(event) => onChange((draft) => { draft.tags = [...new Set(event.target.value.split(/\s+/u).map(sanitizeId).filter(Boolean))]; })} spellCheck={false} />
          <small>Space-separated names that verbs can target together.</small>
        </label>
      )}
    </div>
  );
}

function CompositionFields({ doc, entity, onChange }: {
  doc: SceneDoc;
  entity: SceneEntity;
  onChange(change: (entity: SceneEntity) => void): void;
}) {
  const fillGradient = ["circle", "rect", "dot", "polygon", "particles", "circle2", "boolean", "hull2", "band", "sector", "annulus"].includes(entity.kind);
  const pathGradient = ["line", "arrow", "link", "framebox", "brace", "bracelabel", "bracetext", "support", "axes", "coords", "segment", "vector", "ellipse", "circle2", "anglemark", "rightangle", "plot", "deriv", "accum", "tangent", "lsystem", "invertpath", "reflectpath", "polarpath", "hull2", "svg", "arc"].includes(entity.kind);
  const genericGradient = entity.kind === "repeat";
  const textLike = entity.kind === "text" || entity.kind === "label";
  const clipMask = !["caption", "mathparts", "particles"].includes(entity.kind) && !isEntity3(entity);
  const regions = doc.entities.filter((candidate) => candidate.id !== entity.id && !entityReferences(candidate).includes(entity.id));
  const cropMode = entity.mask ? "mask" : entity.clip ? "clip" : "none";
  const cropRegion = entity.mask ?? entity.clip ?? regions[0]?.id ?? "";
  const setGradient = (change: (gradient: NonNullable<SceneEntity["gradient"]>) => void) => onChange((draft) => {
    if (!draft.gradient) draft.gradient = { stops: ["cyan", "magenta"], mode: fillGradient || genericGradient ? "linear" : "along", angle: fillGradient || genericGradient ? 90 : 0 };
    change(draft.gradient);
  });

  return (
    <div className="mse-composition">
      {(fillGradient || pathGradient || genericGradient) && entity.gradient && (
        <div className="mse-field" id="mse-gradient-controls">
          <span>Gradient</span>
          <label className="mse-field-checkbox">
            <input
              type="checkbox"
              checked={entity.gradient !== undefined}
              onChange={(event) => onChange((draft) => {
                if (event.target.checked) draft.gradient = { stops: ["cyan", "magenta"], mode: fillGradient || genericGradient ? "linear" : "along", angle: fillGradient || genericGradient ? 90 : 0 };
                else delete draft.gradient;
              })}
            />
            <span>Use multi-stop paint</span>
          </label>
          {entity.gradient && (
            <>
              {entity.gradient.stops.map((stop, index) => (
                <div className="mse-gradient-stop" key={index}>
                  <ColorField value={stop} template={doc.template} onChange={(next) => next !== null && setGradient((gradient) => { gradient.stops[index] = next; })} />
                  <button type="button" disabled={entity.gradient!.stops.length <= 2} onClick={() => setGradient((gradient) => { gradient.stops.splice(index, 1); })}>−</button>
                </div>
              ))}
              <button className="mse-mini-action" type="button" onClick={() => setGradient((gradient) => { gradient.stops.push("gold"); })}>+ Color stop</button>
              <label className="mse-field">
                <span>Gradient mode</span>
                <select value={entity.gradient.mode} onChange={(event) => setGradient((gradient) => { gradient.mode = event.target.value as GradientMode; })}>
                  <option value="auto">Engine automatic</option>
                  <option value="linear">Linear angle</option>
                  {fillGradient && <option value="radial">Radial fill</option>}
                  {pathGradient && <option value="along">Along stroke</option>}
                  {pathGradient && <option value="curvature">By curvature</option>}
                  {pathGradient && <option value="speed" disabled={entity.gradient.mode !== "speed"}>By true speed · trajectory only</option>}
                </select>
              </label>
              {entity.gradient.mode === "linear" && (
                <label className="mse-field">
                  <span>Angle</span>
                  <input type="number" value={entity.gradient.angle} step={5} onChange={(event) => setGradient((gradient) => { gradient.angle = Number(event.target.value) || 0; })} />
                </label>
              )}
              {entity.gradient.mode === "curvature" && <small>The canvas sketches this along the stroke; Manic Preview computes the real curvature.</small>}
              {entity.gradient.mode === "speed" && <small>Canvas shows the palette and a ⚡ semantic marker. Manic Preview computes true local speed from a time-sampled trajectory.</small>}
            </>
          )}
        </div>
      )}

      {textLike && (entity.plate !== undefined || entity.cursor === true) && (
        <div id="mse-text-composition-controls" className="mse-composition-group">
          <label className="mse-field-checkbox">
            <input type="checkbox" checked={entity.plate !== undefined} onChange={(event) => onChange((draft) => { if (event.target.checked) draft.plate = 0.55; else delete draft.plate; })} />
            <span>Readable background plate</span>
          </label>
          {entity.plate !== undefined && (
            <label className="mse-field">
              <span>Plate opacity</span>
              <input type="range" min={0} max={1} step={0.05} value={entity.plate} onChange={(event) => onChange((draft) => { draft.plate = Number(event.target.value); })} />
              <small>{entity.plate.toFixed(2)}</small>
            </label>
          )}
          <label className="mse-field-checkbox">
            <input type="checkbox" checked={entity.cursor === true} onChange={(event) => onChange((draft) => { if (event.target.checked) draft.cursor = true; else delete draft.cursor; })} />
            <span>Typewriter cursor</span>
          </label>
        </div>
      )}

      {clipMask && regions.length > 0 && cropMode !== "none" && (
        <div className="mse-field-grid" id="mse-crop-controls">
          <label className="mse-field">
            <span>Crop</span>
            <select value={cropMode} onChange={(event) => onChange((draft) => {
              const mode = event.target.value;
              delete draft.clip; delete draft.mask;
              if (mode === "clip") draft.clip = cropRegion;
              if (mode === "mask") draft.mask = cropRegion;
            })}>
              <option value="none">None</option>
              <option value="clip">Rectangular clip</option>
              <option value="mask">Shape mask</option>
            </select>
          </label>
          <label className="mse-field">
            <span>Region</span>
            <select value={cropRegion} onChange={(event) => onChange((draft) => { if (draft.mask) draft.mask = event.target.value; else if (draft.clip) draft.clip = event.target.value; })}>
              {regions.map((region) => <option key={region.id} value={region.id}>{region.id}</option>)}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

function SharedFeatureFields({ entity, onChange }: {
  entity: SceneEntity;
  onChange(change: (entity: SceneEntity) => void): void;
}) {
  if (entity.glow === undefined && !entity.sticky && entity.dashed === undefined) return null;
  return (
    <div className="mse-composition" id="mse-shared-feature-controls">
      {entity.glow !== undefined && (
        <div className="mse-composition-group">
          <label className="mse-field-checkbox">
            <input type="checkbox" checked onChange={() => onChange((draft) => { delete draft.glow; })} />
            <span>Glow</span>
          </label>
          <label className="mse-field">
            <span>Glow amount</span>
            <input type="range" min={0} max={40} step={1} value={entity.glow} onChange={(event) => onChange((draft) => { draft.glow = Number(event.target.value); })} />
            <small>{entity.glow}</small>
          </label>
        </div>
      )}
      {entity.sticky && (
        <label className="mse-field-checkbox">
          <input type="checkbox" checked onChange={() => onChange((draft) => { delete draft.sticky; })} />
          <span>Screen pinned through camera motion</span>
        </label>
      )}
      {entity.dashed && (
        <div className="mse-composition-group">
          <label className="mse-field-checkbox">
            <input type="checkbox" checked onChange={() => onChange((draft) => { delete draft.dashed; })} />
            <span>Dashed stroke</span>
          </label>
          <div className="mse-field-grid">
            <label className="mse-field"><span>Dash</span><input type="number" min={0} placeholder="engine" value={entity.dashed.dash ?? ""} onChange={(event) => onChange((draft) => { if (draft.dashed) draft.dashed.dash = event.target.value === "" ? null : Math.max(0, Number(event.target.value) || 0); })} /></label>
            <label className="mse-field"><span>Gap</span><input type="number" min={0} placeholder="engine" value={entity.dashed.gap ?? ""} onChange={(event) => onChange((draft) => { if (draft.dashed) draft.dashed.gap = event.target.value === "" ? null : Math.max(0, Number(event.target.value) || 0); })} /></label>
          </div>
        </div>
      )}
    </div>
  );
}

function StateFields({ entity, onChange }: {
  entity: SceneEntity;
  onChange(change: (entity: SceneEntity) => void): void;
}) {
  if (!entity.savedState) return null;
  return (
    <div className="mse-composition" id="mse-state-controls">
      <div className="mse-composition-group">
        <label className="mse-field-checkbox">
          <input type="checkbox" checked onChange={() => onChange((draft) => { delete draft.savedState; })} />
          <span>Saved transform and style state</span>
        </label>
        <small>A Restore beat returns position, scale, rotation, colour, and opacity to this constructor-time snapshot. Preview owns the exact state transition.</small>
      </div>
    </div>
  );
}

function Spatial3Fields({ doc, entity, onChange }: {
  doc: SceneDoc;
  entity: SceneEntity;
  onChange(change: (entity: SceneEntity) => void): void;
}) {
  const path3 = ["line3", "arrow3", "curve3", "link3", "cube3", "sphere3", "prism3", "pyramid3", "midpoint3", "point3", "model3", "extrude3", "revolve3", "tube3", "project3", "projectpath3", "surface3", "domainsurface", "param3", "implicit3", "heightmap3", "contour3", "slice3", "tangentplane3", "gradient3", "vectorfield3", "trajectory3", "descend3", "linmap3", "collection3", "collection3data", "child3", "links3", "links3data", "ring3", "trail3", "historyplot3", "randomwalk3", "lsystem3", "hilbert3"].includes(entity.kind);
  const finishCapable = isEntity3(entity) && !["camera3", "axes3", "frame3", "cross3", "assembly3", "volume3", "eigen3", "pieces3", "tree3"].includes(entity.kind);
  const followable = isEntity3(entity) && !["camera3", "axes3", "frame3", "cross3", "assembly3", "volume3", "eigen3", "pieces3", "tree3"].includes(entity.kind);
  const morphable3 = entity.kind === "curve3";
  const pinnable = ["text", "equation", "label"].includes(entity.kind) && doc.entities.some((candidate) => candidate.kind === "camera3");
  const morphTargets = morphable3 ? doc.entities.filter((candidate) => candidate.id !== entity.id && candidate.kind === "curve3") : [];
  const pinTargets = threePointReferences(doc);
  const followTargets = followable ? threePointReferences(doc).filter((target) => target !== entity.id) : [];
  const thickApplied = path3 && (entity.thickness3 ?? 0) !== 0;
  if (!thickApplied && !entity.finish3 && !entity.morph3 && !entity.pin3 && !entity.follow3) return null;
  return (
    <div className="mse-composition" id="mse-spatial3-controls">
      {thickApplied && (
        <div className="mse-composition-group">
          <label className="mse-field-checkbox"><input type="checkbox" checked onChange={() => onChange((draft) => { draft.thickness3 = 0; })} /><span>3D thickness</span></label>
          <label className="mse-field">
            <span>World-space tube radius</span>
            <input type="number" min={.001} step={.005} value={entity.thickness3 ?? .02} onChange={(event) => onChange((draft) => { draft.thickness3 = Math.max(.001, Number(event.target.value) || .001); })} />
          </label>
        </div>
      )}
      {finishCapable && entity.finish3 && (
        <div className="mse-composition-group">
          <label className="mse-field-checkbox"><input type="checkbox" checked onChange={() => onChange((draft) => { delete draft.finish3; })} /><span>Native 3D material finish</span></label>
          <div className="mse-field-grid">
            <label className="mse-field"><span>Shading</span><select value={entity.finish3.shading} onChange={(event) => onChange((draft) => { if (!draft.finish3) return; draft.finish3.shading = event.target.value as "flat" | "smooth"; if (!draft.finish3.keys.includes("shading")) draft.finish3.keys.push("shading"); })}><option value="flat">Flat</option><option value="smooth">Smooth</option></select></label>
            <label className="mse-field"><span>Material</span><select value={entity.finish3.material} onChange={(event) => onChange((draft) => { if (!draft.finish3) return; draft.finish3.material = event.target.value as "matte" | "metal" | "glass"; if (!draft.finish3.keys.includes("material")) draft.finish3.keys.push("material"); })}><option value="matte">Matte</option><option value="metal">Metal</option><option value="glass">Glass</option></select></label>
            <label className="mse-field"><span>Texture</span><select value={entity.finish3.texture} onChange={(event) => onChange((draft) => { if (!draft.finish3) return; draft.finish3.texture = event.target.value as "solid" | "checker" | "stripes"; if (!draft.finish3.keys.includes("texture")) draft.finish3.keys.push("texture"); })}><option value="solid">Solid</option><option value="checker">Checker</option><option value="stripes">Stripes</option></select></label>
            <label className="mse-field"><span>Texture scale</span><input type="number" min={.25} max={32} step={.25} value={entity.finish3.textureScale} onChange={(event) => onChange((draft) => { if (!draft.finish3) return; draft.finish3.textureScale = Math.max(.25, Math.min(32, Number(event.target.value) || .25)); if (!draft.finish3.keys.includes("scale")) draft.finish3.keys.push("scale"); })} /></label>
          </div>
          <div className="mse-field-grid">
            {(["mesh", "wire", "depth", "shadow"] as const).map((key) => <label className="mse-field" key={key}><span>{key[0].toUpperCase() + key.slice(1)}</span><input type="number" min={0} max={1} step={.05} value={entity.finish3?.[key] ?? 0} onChange={(event) => onChange((draft) => { if (!draft.finish3) return; draft.finish3[key] = Math.max(0, Math.min(1, Number(event.target.value) || 0)); if (!draft.finish3.keys.includes(key)) draft.finish3.keys.push(key); })} /></label>)}
          </div>
          <small>Canvas marks material and wireframe intent. Native Preview owns lighting, texture, depth, shadows, and final pixels.</small>
        </div>
      )}
      {morphable3 && morphTargets.length > 0 && entity.morph3 && (
        <div className="mse-composition-group">
          <label className="mse-field-checkbox">
            <input type="checkbox" checked={entity.morph3 !== undefined} onChange={(event) => onChange((draft) => { if (event.target.checked) draft.morph3 = { target: morphTargets[0].id, spin: null }; else delete draft.morph3; })} />
            <span>Sample-compatible 3D morph</span>
          </label>
          {entity.morph3 && <div className="mse-field-grid">
            <label className="mse-field"><span>Target</span><select value={entity.morph3.target} onChange={(event) => onChange((draft) => { if (draft.morph3) draft.morph3.target = event.target.value; })}>{morphTargets.map((target) => <option key={target.id} value={target.id}>{target.id}</option>)}</select></label>
            <label className="mse-field"><span>Spin</span><input type="number" step={5} value={entity.morph3.spin ?? ""} placeholder="none" onChange={(event) => onChange((draft) => { if (draft.morph3) draft.morph3.spin = event.target.value === "" ? null : Number(event.target.value) || 0; })} /></label>
          </div>}
        </div>
      )}
      {followable && entity.follow3 && (
        <div className="mse-composition-group">
          <label className="mse-field-checkbox"><input type="checkbox" checked onChange={() => onChange((draft) => { delete draft.follow3; })} /><span>Persistent 3D follow relationship</span></label>
          <label className="mse-field"><span>World target</span><select value={entity.follow3.target} onChange={(event) => onChange((draft) => { if (draft.follow3) draft.follow3.target = event.target.value; })}>{followTargets.map((target) => <option key={target} value={target}>{target}</option>)}</select></label>
          <Point3Inputs label="World offset" value={entity.follow3.offset} onSet={(axis, value) => onChange((draft) => { if (draft.follow3) draft.follow3.offset[axis] = value; })} />
          <small>Canvas preserves and annotates the relationship. Preview resolves the target position continuously during playback.</small>
        </div>
      )}
      {pinnable && entity.pin3 && (
        <div className="mse-composition-group">
          <label className="mse-field-checkbox">
            <input type="checkbox" checked={entity.pin3 !== undefined} onChange={(event) => onChange((draft) => { if (event.target.checked) draft.pin3 = { at: { x: 0, y: 0, z: 0 }, target: null, offset: { x: 0, y: -24 }, worldHeight: null, form: "pin3" }; else delete draft.pin3; })} />
            <span>Follow a 3D world point</span>
          </label>
          {entity.pin3 && <>
            <div className="mse-field-grid"><label className="mse-field"><span>Native form</span><select value={entity.pin3.form} onChange={(event) => onChange((draft) => { if (draft.pin3) { draft.pin3.form = event.target.value as "pin3" | "label3"; if (draft.pin3.form === "label3") draft.pin3.offset = { x: 0, y: 0 }; } })}><option value="pin3">Pinned overlay</option><option value="label3">Depth-scaled label</option></select></label><label className="mse-field"><span>Target type</span><select value={entity.pin3.target ? "entity" : "point"} onChange={(event) => onChange((draft) => { if (!draft.pin3) return; if (event.target.value === "entity") { draft.pin3.target = pinTargets[0] ?? null; draft.pin3.at = null; } else { draft.pin3.target = null; draft.pin3.at = { x: 0, y: 0, z: 0 }; } })}><option value="point">World coordinates</option><option value="entity" disabled={pinTargets.length === 0}>3D entity</option></select></label></div>
            {entity.pin3.target ? <label className="mse-field"><span>3D target</span><select value={entity.pin3.target} onChange={(event) => onChange((draft) => { if (draft.pin3) draft.pin3.target = event.target.value; })}>{pinTargets.map((target) => <option key={target} value={target}>{target}</option>)}</select></label> : entity.pin3.at && <Point3Inputs label="World point" value={entity.pin3.at} onSet={(axis, value) => onChange((draft) => { if (draft.pin3?.at) draft.pin3.at[axis] = value; })} />}
            {entity.pin3.form === "pin3" ? <div className="mse-field-grid">
              <label className="mse-field"><span>Screen offset X</span><input type="number" value={entity.pin3.offset.x} onChange={(event) => onChange((draft) => { if (draft.pin3) draft.pin3.offset.x = Number(event.target.value) || 0; })} /></label>
              <label className="mse-field"><span>Screen offset Y</span><input type="number" value={entity.pin3.offset.y} onChange={(event) => onChange((draft) => { if (draft.pin3) draft.pin3.offset.y = Number(event.target.value) || 0; })} /></label>
            </div> : <label className="mse-field"><span>World text height</span><input type="number" min={.001} step={.01} value={entity.pin3.worldHeight ?? ""} placeholder="native screen size" onChange={(event) => onChange((draft) => { if (draft.pin3) draft.pin3.worldHeight = event.target.value === "" ? null : Math.max(.001, Number(event.target.value) || .001); })} /></label>}
          </>}
        </div>
      )}
    </div>
  );
}

function Point3Inputs({ label, value, onSet }: { label: string; value: { x: number; y: number; z: number }; onSet(axis: "x" | "y" | "z", value: number): void }) {
  return <div className="mse-field"><span>{label}</span><div className="mse-point3-grid">{(["x", "y", "z"] as const).map((axis) => <label key={axis}><small>{axis}</small><input type="number" step={.1} value={value[axis]} onChange={(event) => onSet(axis, Number(event.target.value) || 0)} /></label>)}</div></div>;
}

function PointInputs({ label, value, onSet }: { label: string; value: { x: number; y: number }; onSet(axis: "x" | "y", value: number): void }) {
  return <div className="mse-field"><span>{label}</span><div className="mse-point3-grid">{(["x", "y"] as const).map((axis) => <label key={axis}><small>{axis}</small><input type="number" step={.1} value={value[axis]} onChange={(event) => onSet(axis, Number(event.target.value) || 0)} /></label>)}</div></div>;
}

function AppliedFeatures({ entity }: { entity: SceneEntity }) {
  const features = appliedFeatures(entity);
  if (features.length === 0) return null;
  const reveal = (controlId: string) => {
    const control = document.getElementById(controlId);
    control?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const input = control?.querySelector<HTMLElement>("select, input, button");
    input?.focus({ preventScroll: true });
  };
  return (
    <section className="mse-applied" aria-label="Applied features">
      <strong>Applied</strong>
      <div>
        {features.map((feature) => (
          <button type="button" key={`${feature.id}-${feature.detail}`} onClick={() => reveal(feature.controlId)}>
            <span>{feature.label}</span>
            <small>{feature.detail}</small>
            <b>Edit</b>
          </button>
        ))}
      </div>
    </section>
  );
}

function SemanticSummary({ doc, entity, onSelect }: { doc: SceneDoc; entity: SceneEntity; onSelect(id: string): void }) {
  const annotations = canvasAnnotations(entity, doc).filter((annotation) => annotation.id !== "computed" && annotation.id !== "generated");
  if (annotations.length === 0) return null;
  return (
    <section className="mse-semantics" aria-label="Canvas meaning">
      <div className="mse-semantics-heading">
        <strong>Canvas meaning</strong>
        <span>Preview is pixel truth</span>
      </div>
      {annotations.map((annotation) => (
        <article className={`mse-semantic-note ${annotation.tone}`} key={annotation.id}>
          <div>
            <strong>{annotation.icon} {annotation.label}</strong>
            <span>{annotation.representation === "exact" ? "Shown on Canvas" : "Semantic guide"}</span>
          </div>
          <p>{annotation.detail}</p>
          {annotation.refs.length > 0 && (
            <div className="mse-semantic-refs">
              {annotation.refs.map((ref) => {
                const owner = doc.entities.find((candidate) => candidate.id === ref || candidate.tags?.includes(ref) || referenceIds(candidate).includes(ref));
                return owner
                  ? <button type="button" key={ref} onClick={() => onSelect(owner.id)}>Show {ref}</button>
                  : <span key={ref}>Missing: {ref}</span>;
              })}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

function PositionFields({ doc, entity, onChange }: {
  doc: SceneDoc;
  entity: SceneEntity;
  onChange(change: (entity: SceneEntity) => void): void;
}) {
  const anchor = entityAnchor(entity, doc);
  const move = (x: number, y: number) => onChange((draft) => {
    const at = entityAnchor(draft, doc);
    if (draft.pin3) {
      draft.pin3.offset.x += x - at.x;
      draft.pin3.offset.y += y - at.y;
    } else translateEntity(draft, x - at.x, y - at.y);
  });
  return (
    <div className="mse-field-grid">
      <label className="mse-field">
        <span>X</span>
        <input type="number" value={Math.round(anchor.x)} onChange={(event) => move(Number(event.target.value) || 0, anchor.y)} />
      </label>
      <label className="mse-field">
        <span>Y</span>
        <input type="number" value={Math.round(anchor.y)} onChange={(event) => move(anchor.x, Number(event.target.value) || 0)} />
      </label>
    </div>
  );
}

/** Read-only evaluated values for a locked entity. */
function LockedFacts({ entity }: { entity: SceneEntity }) {
  const anchor = entityAnchor(entity);
  const box = defFor(entity).bounds(entity);
  const facts: [string, string][] = [
    ["kind", entity.kind],
    ["at", `${Math.round(anchor.x)}, ${Math.round(anchor.y)}`],
    ["size", `${Math.round(box.width)} × ${Math.round(box.height)}`],
    ["color", entity.hue ? `hue(${Math.round(entity.hue.deg)}°)` : entity.color],
  ];
  if (entity.tags?.length) facts.push(["tags", entity.tags.join(" ")]);
  return (
    <dl className="mse-facts">
      {facts.map(([key, value]) => (
        <div key={key}><dt>{key}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}

interface RailEntry { key: string; label: string; hint: string; ids: string[]; locked: boolean; }

/** Rail entries: literal/computed entities individually; generated ones grouped by their loop id pattern. */
function railEntries(doc: SceneDoc, conditionals: readonly ConditionalMeta[]): RailEntry[] {
  const entries: RailEntry[] = [];
  const groups = new Map<string, RailEntry>();
  for (const entity of doc.entities) {
    if (entity.origin === "generated") {
      const key = `gen:${entity.genKey ?? entity.id}`;
      const existing = groups.get(key);
      if (existing) {
        existing.ids.push(entity.id);
        existing.label = `${entity.genKey ?? entity.id} ×${existing.ids.length}`;
        continue;
      }
      const conditions = conditionalLabels(entity.id, conditionals);
      const entry: RailEntry = { key, label: entity.genKey ?? entity.id, hint: `Generated by a loop — locked${conditions ? ` · ${conditions}` : ""}`, ids: [entity.id], locked: true };
      groups.set(key, entry);
      entries.push(entry);
      continue;
    }
    entries.push({
      key: entity.id,
      label: entity.id,
      hint: `${entity.origin === "computed" ? `${entity.id} (${entity.kind}) — variable-positioned, locked` : `Select ${entity.id} (${entity.kind})`}${conditionalLabels(entity.id, conditionals) ? ` · ${conditionalLabels(entity.id, conditionals)}` : ""}`,
      ids: [entity.id],
      locked: entity.origin === "computed",
    });
  }
  return entries;
}

function conditionalLabels(entityId: string, conditionals: readonly ConditionalMeta[]): string {
  return conditionals.flatMap((conditional) => conditional.branches
    .filter((branch) => branch.entityIds.includes(entityId))
    .map((branch) => `if ${branch.condition ?? "else"}`)).join(" · ");
}

function EntityConditionalOrigin({ entity, conditionals, onRevealSource }: {
  entity: SceneEntity;
  conditionals: readonly ConditionalMeta[];
  onRevealSource?(offset: number): void;
}) {
  const origins = conditionals.flatMap((conditional) => conditional.branches.flatMap((branch) => branch.entityIds.includes(entity.id) ? [{ conditional, branch }] : []));
  if (origins.length === 0) return null;
  return (
    <div className="mse-entity-condition" role="status">
      <strong>⑂ Conditional result</strong>
      {origins.map(({ conditional, branch }) => (
        <div key={`${conditional.id}:${branch.kind}:${branch.condition ?? "else"}`}>
          <code>{branch.condition ?? "else"}</code>
          <span>{conditional.evaluations === 1 ? "active on this Canvas" : `${branch.selected}/${conditional.evaluations} generated evaluations`}</span>
          {onRevealSource && <button onClick={() => onRevealSource(branch.conditionSpan?.start ?? conditional.span.start)}>source</button>}
        </div>
      ))}
    </div>
  );
}

function Field({ field, entity, doc, template, onChange }: {
  field: FieldSpec;
  entity: SceneEntity;
  doc: SceneDoc;
  template: SceneDoc["template"];
  onChange(change: (entity: SceneEntity) => void): void;
}) {
  const record = entity as unknown as Record<string, unknown>;
  const value = record[field.key];
  const reservedParameters = new Set(["w", "h", "cx", "cy", "pi", "tau", "e", "inf"]);
  const safeNumericParameters = (candidate: SceneEntity, includeAuthored = false) => {
    const authored = includeAuthored ? new Set([String(record.xParam ?? ""), String(record.yParam ?? "")]) : new Set<string>();
    return (catalogEntry(defFor(candidate).ctor)?.params ?? [])
      .filter((param) => param.ty === "num" && !reservedParameters.has(param.name) && (!param.optional || authored.has(param.name)))
      .map((param) => param.name);
  };

  function set(next: unknown) {
    onChange((draft) => {
      const draftRecord = draft as unknown as Record<string, unknown>;
      if (draft.kind === "parameter" && typeof next === "number") {
        const epsilon = typeof field.step === "number" && field.step > 0 ? field.step : .001;
        if (field.key === "value") {
          draft.value = Math.max(draft.min, Math.min(draft.max, next));
          return;
        }
        if (field.key === "min") {
          draft.min = Math.min(next, draft.max - epsilon);
          draft.value = Math.max(draft.min, draft.value);
          return;
        }
        if (field.key === "max") {
          draft.max = Math.max(next, draft.min + epsilon);
          draft.value = Math.min(draft.max, draft.value);
          return;
        }
      }
      if (typeof next === "number") {
        let bounded = next;
        if (typeof field.min === "number") bounded = Math.max(field.min, bounded);
        if (typeof field.max === "number") bounded = Math.min(field.max, bounded);
        next = bounded;
      }
      draftRecord[field.key] = next;
    });
  }

  switch (field.input) {
    case "point": {
      const point = (value && typeof value === "object" ? value : { x: 0, y: 0 }) as { x: number; y: number };
      return <PointInputs label={field.label} value={point} onSet={(axis, next) => set({ ...point, [axis]: next })} />;
    }
    case "point-list": {
      const points = (Array.isArray(value) ? value : []) as { x: number; y: number }[];
      return <div className="mse-field"><span>{field.label}</span><div className="mse-composition-group">
        {points.map((point, index) => <div key={index} className="mse-field-grid">
          <label className="mse-field"><span>x{index}</span><input type="number" step={.1} value={point.x} onChange={(event) => set(points.map((candidate, at) => at === index ? { ...candidate, x: Number(event.target.value) || 0 } : candidate))} /></label>
          <label className="mse-field"><span>y{index}</span><input type="number" step={.1} value={point.y} onChange={(event) => set(points.map((candidate, at) => at === index ? { ...candidate, y: Number(event.target.value) || 0 } : candidate))} /></label>
          <button type="button" className="mse-mini-action" disabled={field.readonly || points.length <= (field.minItems ?? 0)} onClick={() => set(points.filter((_candidate, at) => at !== index))}>Remove</button>
        </div>)}
        <button type="button" className="mse-mini-action" disabled={field.readonly} onClick={() => { const last = points.at(-1) ?? { x: 0, y: 0 }; set([...points, { x: last.x + 80, y: last.y }]); }}>+ Point</button>
      </div>{field.hint && <small>{field.hint}</small>}</div>;
    }
    case "point3": {
      const point = (value && typeof value === "object" ? value : { x: 0, y: 0, z: 0 }) as { x: number; y: number; z: number };
      return <Point3Inputs label={field.label} value={point} onSet={(axis, next) => set({ ...point, [axis]: next })} />;
    }
    case "entity": {
      const ownerIndex = doc.entities.indexOf(entity);
      const ids = doc.entities
        .filter((candidate, index) => candidate.id !== entity.id
          && (!field.referencesEarlierOnly || index < ownerIndex)
          && (!field.entityKinds || field.entityKinds.includes(candidate.kind))
          && (!field.entityMinNumericParams || safeNumericParameters(candidate).length >= field.entityMinNumericParams))
        .flatMap((candidate) => [
          ...(field.childrenOnlyKinds?.includes(candidate.kind) ? [] : [candidate.id]),
          ...(field.includeTags ? candidate.tags ?? [] : []),
          ...(field.includeChildren ? referenceIds(candidate) : []),
        ]);
      const options = [...new Set(ids)];
      return (
        <label className="mse-field">
          <span>{field.label}</span>
          <select
            value={String(value ?? "")}
            disabled={field.readonly}
            onChange={(event) => {
              const next = event.target.value;
              onChange((draft) => {
                const previous = (draft as unknown as Record<string, unknown>)[field.key];
                if (typeof previous === "string") replaceEntityReference(draft, previous, next);
                if ((draft as unknown as Record<string, unknown>)[field.key] !== next) {
                  (draft as unknown as Record<string, unknown>)[field.key] = next;
                }
                if (field.resetParameterKeys?.length) {
                  const source = doc.entities.find((candidate) => candidate.id === next);
                  const parameters = source ? safeNumericParameters(source) : [];
                  field.resetParameterKeys.forEach((key, index) => { (draft as unknown as Record<string, unknown>)[key] = parameters[index] ?? ""; });
                }
              });
            }}
          >
            {!options.includes(String(value ?? "")) && <option value={String(value ?? "")}>{String(value ?? "")}</option>}
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          {field.hint && <small>{field.hint}</small>}
        </label>
      );
    }
    case "entities": {
      const ownerIndex = doc.entities.indexOf(entity);
      const ids = doc.entities
        .filter((candidate, index) => candidate.id !== entity.id
          && (!field.referencesEarlierOnly || index < ownerIndex)
          && (!field.entityKinds || field.entityKinds.includes(candidate.kind)))
        .flatMap((candidate) => [
          ...(field.childrenOnlyKinds?.includes(candidate.kind) ? [] : [candidate.id]),
          ...(field.includeTags ? candidate.tags ?? [] : []),
          ...(field.includeChildren ? referenceIds(candidate) : []),
        ]);
      const options = [...new Set(ids)], selected = Array.isArray(value) ? value.map(String) : [];
      return (
        <div className="mse-field">
          <span>{field.label}</span>
          <div className="mse-composition-group">
            {options.map((option) => {
              const checked = selected.includes(option);
              return <label className="mse-field-checkbox" key={option}>
                <input type="checkbox" checked={checked} disabled={field.readonly || (checked && selected.length <= (field.minItems ?? 0))} onChange={(event) => {
                  const next = event.target.checked ? [...selected, option] : selected.filter((item) => item !== option);
                  set([...new Set(next)]);
                }} />
                <span>{option}</span>
              </label>;
            })}
            {selected.filter((item) => !options.includes(item)).map((item) => <label className="mse-field-checkbox" key={item}>
              <input type="checkbox" checked disabled={field.readonly || selected.length <= (field.minItems ?? 0)} onChange={() => set(selected.filter((candidate) => candidate !== item))} />
              <span>{item} · unresolved</span>
            </label>)}
          </div>
          {field.hint && <small>{field.hint}</small>}
        </div>
      );
    }
    case "parameter": {
      const sourceKey = field.parameterSourceKey ?? "template";
      const sourceId = String(record[sourceKey] ?? "");
      const source = doc.entities.find((candidate) => candidate.id === sourceId);
      const options = source
        ? safeNumericParameters(source, true)
        : [];
      const current = String(value ?? "");
      return (
        <label className="mse-field">
          <span>{field.label}</span>
          <select value={current} disabled={field.readonly || options.length === 0} onChange={(event) => set(event.target.value)}>
            {!options.includes(current) && <option value={current}>{current || "unresolved"}</option>}
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <small>{field.hint ?? (source ? `Numeric parameters exposed by ${sourceId}.` : "Choose a template first.")}</small>
        </label>
      );
    }
    case "latex-list": {
      const parts = (Array.isArray(value) ? value : []) as MathPart[];
      const update = (index: number, latex: string) => set(parts.map((part, at) => at === index ? { ...part, latex } : part));
      return (
        <div className="mse-field">
          <span>{field.label}</span>
          {parts.map((part, index) => (
            <div key={index}>
              <LatexField value={part.latex} onChange={(next) => update(index, next)} />
            </div>
          ))}
          {field.hint && <small>{field.hint}</small>}
        </div>
      );
    }
    case "textarea":
      return (
        <label className="mse-field">
          <span>{field.label}</span>
          <textarea value={String(value ?? "")} onChange={(event) => set(field.nullable && event.target.value === "" ? null : event.target.value)} />
          {field.hint && <small>{field.hint}</small>}
        </label>
      );
    case "text":
      return (
        <label className="mse-field">
          <span>{field.label}</span>
          <input value={String(value ?? "")} placeholder={field.nullable ? "none" : undefined} onChange={(event) => set(field.nullable && event.target.value === "" ? null : event.target.value)} />
          {field.hint && <small>{field.hint}</small>}
        </label>
      );
    case "range":
      return (
        <label className="mse-field">
          <span>{field.label}</span>
          <input
            type="range" min={field.min} max={field.max} step={field.step}
            value={Number(value ?? field.min ?? 0)}
            onChange={(event) => set(Number(event.target.value))}
          />
          <small>{String(value ?? "")}{typeof value === "number" ? (field.unit ?? "px") : ""}</small>
        </label>
      );
    case "number":
      return (
        <label className="mse-field">
          <span>{field.label}</span>
          <input
            type="number" min={field.min} max={field.max} step={field.step}
            value={value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value)) ? "" : Number(value)}
            placeholder={typeof value === "number" && !Number.isFinite(value) ? (value > 0 ? "+∞" : "−∞") : field.nullable ? "engine default" : undefined}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw === "" && field.nullable) return set(null);
              set(Number(raw) || 0);
            }}
          />
          {field.hint && <small>{field.hint}</small>}
        </label>
      );
    case "select":
      return (
        <label className="mse-field">
          <span>{field.label}</span>
          <select value={String(value ?? "")} onChange={(event) => set(event.target.value)}>
            {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      );
    case "latex":
      return (
        <div className="mse-field">
          <span>{field.label}</span>
          <LatexField value={String(value ?? "")} onChange={(next) => set(next)} />
        </div>
      );
    case "color":
      return (
        <div className="mse-field">
          <span>{field.label}</span>
          <ColorField
            value={value === null || value === undefined ? null : String(value)}
            template={template}
            nullable={field.nullable}
            onChange={(next) => set(next)}
          />
        </div>
      );
    case "checkbox":
      return (
        <label className="mse-field mse-field-checkbox">
          <input type="checkbox" checked={Boolean(value)} onChange={(event) => set(event.target.checked)} />
          <span>{field.label}</span>
        </label>
      );
  }
}

function fieldVisible(field: FieldSpec, entity: SceneEntity): boolean {
  if (!field.visibleWhen) return true;
  const value = (entity as unknown as Record<string, unknown>)[field.visibleWhen.key];
  const expected = Array.isArray(field.visibleWhen.equals) ? field.visibleWhen.equals : [field.visibleWhen.equals];
  return expected.includes(value);
}
