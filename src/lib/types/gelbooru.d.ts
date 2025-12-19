import { GelbooruRating } from "@/enum/Rating";

export namespace Gelbooru {

  // Represents the @attributes field in the JSON.
  export type Attributes = {
    limit: number,
    offset: number,
    count: number,
  }

  // The tag parameter comes from the query parameter into the search function.
  export type SearchOpt = {
    pid: number;
    limit: number;
    cid: number;
    id: number;
  };

  export type Tag = {
    type: string,
    label: string,
    value: string,
    post_count: string,
    category: string
  }

  // This is due to the fact that there are two *slightly* different versions of the post object.
  export type Post = Post0_2 | Post0_3;

  export type SearchRes = {
    // Use attributes instead, this exists to prevent type errors.
    "@attributes"?: Attributes;
    attributes?: Attributes;
    post?: Post[];
    wasXML: boolean;
  }

  export interface PostBase {
    id: number;
    score: number;
    width: number;
    height: number;
    image: string;
    rating: GelbooruRating;
    source: string;
    change: number;
    owner: string;
    creator_id: number;
    parent_id: number;
    tags: string;
    has_notes: string;
    file_url: string;
    preview_url: string;
    sample_url: string;
    sample_height: number;
    sample_width: number;
    status: string;
  }

  export interface Post0_2 extends PostBase {
    hash: string;
    sample: boolean;
    directory: string;
  }

  export interface Post0_3 extends PostBase {
    md5: string;
    sample: number;
    created_at: string;
    directory: number;
    preview_height: number;
    preview_width: number;
    title: string;
    post_locked: number;
    has_comments: string;
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

  export interface TagList {
    tag: TagRes[];
  }

  interface Comment {
    created_at: string;
    post_id: string;
    body: string;
    creator: string;
    id: string;
    creator_id: string;
  }

  export interface CommentsRes {
    comments: Comment[];
    apiDisabled?: boolean;
  }
}
