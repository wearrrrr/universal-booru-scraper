export namespace Moebooru {
  export type SearchOpt = {
    page: number;
    limit: number;
    questionable: boolean;
    explicit: boolean;
  };
  export type SearchRes = {
    posts: Post[];
    filtered: number;
  };
  export type Post = {
    id: number;
    // Technically should be an array, but moebooru return one big string with tags separated by spaces
    tags: string;
    // Unix timestamp
    created_at: string;
    creator_id: string;
    author: string;
    change: number;
    // URL to the original image
    source: string;
    score: number;
    md5: string;
    file_size: number;
    // URL as stored on the moebooru server
    file_url: string;
    is_shown_in_index: boolean;
    preview_url: string;
    preview_width: number;
    preview_height: number;
    actual_preview_width: number;
    actual_preview_height: number;
    sample_url: string;
    sample_width: number;
    sample_height: number;
    sample_file_size: number;
    jpeg_url: string;
    jpeg_width: number;
    jpeg_height: number;
    jpeg_file_size: number;
    // Rating: Safe, Questionable, Explicit
    rating: "s" | "q" | "e";
    has_children: boolean;
    parent_id: number | null;
    status: "active" | "flagged" | "pending" | "deleted";
    width: number;
    height: number;
    is_held: boolean;
    frames_pending_string: string;
    frames_pending: string[];
    frames_string: string;
    frames: string[];
  };
  export type TagRequest = {
    limit: number;
    page: number;
    order: "date" | "count" | "name";
    id: number;
    after_id: number;
    name: string;
  };

  export type TagResponse = {
    id: number;
    name: string;
    count: number;
    type: 0 | 1 | 3 | 4;
    ambiguous: boolean;
  };

  export type RelatedTag = {
    [key: string]: TagResponse[];
  };
  export type TagType = "general" | "artist" | "copyright" | "character";

  export type UserQuery = {
    id: number;
    name: string;
    loginRequirement: boolean;
  };

  export type UserResponse = {
    name: string;
    blacklisted_tags: string[];
    id: string;
  };

  type CommentOpt = {
    post_id: string | number;
    id: string | number;
  }

  type Comment = {
    id: number;
    created_at: string;
    creator: string;
    creator_id: number;
    body: string;
  }
}
