export namespace Gelbooru {

  // Represents the @attributes field in the JSON.
  export type Attributes = {
    limit: number,
    offset: number,
    count: number,
  }

  // The tag parameter comes from the query parameter into the search function.
  export type SearchOpt = {
    page: number;
    limit: number;
    cid: number;
    id: number;
  };

  export type SearchRes = {
    attributes: Attributes;
    post: Post[];
  }

  export interface Post {
    id: number;
    created_at: string;
    score: number;
    width: number;
    height: number;
    md5: string;
    directory: string;
    image: string;
    rating: string;
    source: string;
    change: number;
    owner: string;
    creator_id: number;
    parent_id: number;
    sample: number;
    preview_height: number;
    preview_width: number;
    tags: string;
    title: string;
    has_notes: string;
    has_comments: string;
    file_url: string;
    preview_url: string;
    sample_url: string;
    sample_height: number;
    sample_width: number;
    status: string;
    post_locked: number;
    has_children: string;
  }

  export type TagOpt = {
    id: string,
    limit: number,
    after_id: number,
    name: string,
    names: string,
    name_pattern: string,
    order: "ASC" | "DESC",
    orderby: "date" | "count" | "name",
  };

  export interface TagRes {
    id: number;
    name: string;
    count: number;
    type: number;
    ambiguous: number;
  }
}