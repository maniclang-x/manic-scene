import { useEffect, useRef, useState } from "react";
import type { ManicAsset, ManicAssetKind, ManicAssetProvider, ManicAssetScope, ResolvedManicAsset } from "../assets.js";

export function AssetBrowser({ provider, onChoose, onClose }: {
  provider: ManicAssetProvider;
  onChoose(asset: ManicAsset): void;
  onClose(): void;
}) {
  const [scope, setScope] = useState<ManicAssetScope>("library");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ManicAssetKind | "all">("all");
  const [assets, setAssets] = useState<ManicAsset[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(true), 140);
    return () => window.clearTimeout(timer);
  }, [scope, query, kind, provider]);

  async function load(reset: boolean) {
    const id = ++requestId.current;
    setLoading(true); setError("");
    try {
      const page = await provider.search({ scope, query, kind, cursor: reset ? null : nextCursor, limit: 48 });
      if (id !== requestId.current) return;
      setAssets((current) => reset ? page.assets : [...current, ...page.assets]);
      setNextCursor(page.nextCursor); setTotal(page.total);
    } catch (reason) {
      if (id === requestId.current) setError(reason instanceof Error ? reason.message : "Assets could not be loaded.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  async function upload(file: File | undefined) {
    if (!file || !provider.upload) return;
    setUploading(true); setError("");
    try {
      const asset = await provider.upload(file);
      setScope("project");
      onChoose(asset);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The asset could not be imported.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return <section className="mse-assets" aria-label="Assets">
    <header className="mse-assets-head">
      <div><span className="mse-eyebrow">ASSETS</span><strong>Library and project media</strong><small>Choose an asset; Canvas writes only its portable URI.</small></div>
      <button className="mse-vocabulary-close" onClick={onClose} aria-label="Close Assets">×</button>
    </header>
    <div className="mse-assets-controls">
      <div className="mse-assets-tabs" role="tablist">
        <button className={scope === "library" ? "active" : ""} onClick={() => setScope("library")}>Library</button>
        <button className={scope === "project" ? "active" : ""} onClick={() => setScope("project")}>Project</button>
      </div>
      <label className="mse-assets-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search icons, flags, artwork…" /></label>
      <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} aria-label="Asset type"><option value="all">All media</option><option value="image">Images</option><option value="svg">SVG</option><option value="model">3D models</option></select>
      {provider.upload && <><input ref={input} hidden type="file" accept=".png,.jpg,.jpeg,.svg,.obj,image/png,image/jpeg,image/svg+xml,model/obj,text/plain" onChange={(event) => void upload(event.target.files?.[0])} /><button className="mse-assets-upload" disabled={uploading} onClick={() => input.current?.click()}>{uploading ? "Importing…" : "＋ Upload"}</button></>}
    </div>
    <div className="mse-assets-count"><strong>{total.toLocaleString()}</strong> {scope === "library" ? "discoverable assets" : "project assets"}{loading && assets.length === 0 ? " · loading…" : ""}</div>
    {error && <p className="mse-assets-error">{error}</p>}
    <div className="mse-assets-grid">
      {assets.map((asset) => <button key={asset.uri} className="mse-asset-card" onClick={() => onChoose(asset)} title={`${asset.uri}${asset.warnings.length ? `\n${asset.warnings.join("\n")}` : ""}`}>
        <AssetPreview provider={provider} asset={asset} />
        <span><strong>{asset.title}</strong><small>{asset.kind === "model" ? `OBJ · ${asset.parts?.length ? `${asset.parts.length} parts` : "single mesh"}` : `${asset.kind.toUpperCase()} · ${asset.width && asset.height ? `${asset.width}×${asset.height}` : "native size"}`}</small></span>
        {asset.license?.attributionRequired && <b title={asset.license.attribution}>ATTR</b>}
      </button>)}
      {!loading && assets.length === 0 && <p className="mse-assets-empty">{scope === "project" ? "No project assets yet. Upload a PNG, JPEG, or SVG." : "No assets match this search."}</p>}
    </div>
    {nextCursor && <button className="mse-assets-more" disabled={loading} onClick={() => void load(false)}>{loading ? "Loading…" : "Load more"}</button>}
  </section>;
}

function AssetPreview({ provider, asset }: { provider: ManicAssetProvider; asset: ManicAsset }) {
  const target = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [resolved, setResolved] = useState<ResolvedManicAsset | null | undefined>(undefined);
  useEffect(() => {
    const node = target.current;
    if (!node || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setVisible(true); observer.disconnect();
    }, { rootMargin: "180px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let live = true;
    void provider.resolve(asset.uri).then((value) => { if (live) setResolved(value); }).catch(() => { if (live) setResolved(null); });
    return () => { live = false; };
  }, [provider, asset.uri, visible]);
  if (asset.kind === "model") return <span ref={target} className="mse-asset-thumb"><i>OBJ<br />3D</i></span>;
  return <span ref={target} className="mse-asset-thumb">{resolved ? <img src={resolved.previewUrl} alt="" loading="lazy" /> : <i>{resolved === undefined ? "…" : "×"}</i>}</span>;
}
