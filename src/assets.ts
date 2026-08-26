/** Host-neutral asset discovery and resolution contract.
 *
 * Scene source contains only stable `asset:` URIs. A host may resolve those
 * from a local filesystem, an authenticated HTTP endpoint, R2, or another
 * store without exposing that implementation to the scene document.
 */

export type ManicAssetKind = "image" | "svg" | "model";
export type ManicAssetScope = "library" | "project";

export interface ManicAssetLicense {
  id: string;
  name: string;
  attributionRequired: boolean;
  attribution?: string;
}

export interface ManicAsset {
  uri: string;
  kind: ManicAssetKind;
  scope: ManicAssetScope;
  mediaType: string;
  title: string;
  category: string[];
  keywords: string[];
  byteSize: number;
  sha256: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  /** Sanitized OBJ o/g names. Multiple parts select assembly3 in the Canvas picker. */
  parts?: string[];
  themeable: boolean;
  license: ManicAssetLicense | null;
  warnings: string[];
}

export interface ResolvedManicAsset extends ManicAsset {
  /** Browser-displayable URL. Never write this host-specific value to source. */
  previewUrl: string;
}

export interface ManicAssetSearch {
  scope: ManicAssetScope;
  query?: string;
  kind?: ManicAssetKind | "all";
  cursor?: string | null;
  limit?: number;
}

export interface ManicAssetPage {
  assets: ManicAsset[];
  nextCursor: string | null;
  total: number;
}

export interface ManicAssetProvider {
  /** Resolve any URI already present in source, including UI-hidden assets. */
  resolve(uri: string): Promise<ResolvedManicAsset | null>;
  /** Search the host's discoverable Library or mutable Project catalogue. */
  search(request: ManicAssetSearch): Promise<ManicAssetPage>;
  /** Optional mutable-project capability. */
  upload?(file: File): Promise<ManicAsset>;
}
