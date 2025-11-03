

export type TileKind = "external" | "document" | "department" | "collection";

export type Tile = {
  id: string | number;
  title: string;
  kind: TileKind;

  // Optional fields depending on kind - external links, document, department, curated groups
  href?: string;
  documentId?: number;
  departmentSlug?: string;
  collectionSlug?: string;

  description?: string;
  icon?: string;
}