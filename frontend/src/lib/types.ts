export type ID = number;

export interface Department { id: ID; name: string; slug: string; }
export interface Template {
    id: ID;
    name: string;
    slug: string;
    font_family: string;
    base_font_size_px: number;
    color_bg: string;
    color_text: string;
    color_text_strong: string;
    color_accent: string;
    header_html: string;
    foot_html: string;
}

export interface Tag {
    id: ID;
    name: string;
    slug: string;
    description?: string;
    linked_document?: ID | null;
    link_url?: string | null;
}

export interface Section { id: ID; order: number; header: string; body_md: string; document: ID; }
export interface ResourceLink { id: ID; order: number; title: string; url: string; note?: string; document: ID; }


export interface Document {
  id: ID; title: string; template?: ID | null;
  everyone: boolean; departments: ID[]; status: "draft" | "published" | "archived";
  last_reviewed?: string | null; review_interval_days: number;
  created_at: string; updated_at: string;
  tags: ID[];
  sections: Section[];
  links: ResourceLink[];
}

export interface RequirementsResponse {
  id: ID;
  title: string;
  tags: ID[];
  requirements: Array<{
    title: string;
    content_md: string;
    links: Array<{ title: string; url?: string; document_id?: ID }>;
    tag: string;
  }>;
}