// See https://danbooru.donmai.us/wiki_pages/help:api for the complete field reference.
export namespace Danbooru {
	type Timestamp = string;
	type Nullable<T> = T | null;

	export type Rating = "g" | "s" | "q" | "e";
	export type PageCursor = number | `a${number}` | `b${number}`;
	export type ResponseFormat = "json" | "xml" | "html";

	export interface SearchOpt {
		page?: PageCursor;
		limit?: number;
		tags?: string;
		random?: boolean;
		md5?: string;
		format?: ResponseFormat;
		only?: string;
		exclude?: string;
		search?: Partial<PostSearchFilters>;
	}

	export interface PostSearchFilters {
		id?: string;
		created_at?: string;
		updated_at?: string;
		uploader_id?: number | string;
		approver_id?: number | string;
		rating?: Rating | string;
		tag_count?: string;
		fav_count?: string;
		file_size?: string;
		file_type?: string;
		file_ext?: string;
		source?: string;
		mpixels?: string;
		duration?: string;
		width?: string;
		height?: string;
		status?: "pending" | "flagged" | "active" | "deleted" | string;
		has_children?: boolean;
		parent_id?: number | string;
		pools?: string;
		order?: PostSearchOrder;
	}

	export type PostSearchOrder =
		| "id"
		| "id_asc"
		| "id_desc"
		| "score"
		| "score_asc"
		| "score_desc"
		| "rating"
		| "rating_desc"
		| "comment_count"
		| "comment_bumped"
		| "note_count"
		| "fav_count"
		| "filesize"
		| "mpixels"
		| "landscape"
		| "portrait"
		| "duration"
		| "tag_count"
		| "change"
		| "curated"
		| "random"
		| "rank"
		| "custom";

	export type SearchRes = Post[];

	export interface Post {
		id: number;
		created_at: Timestamp;
		updated_at: Timestamp;
		uploader_id: number;
		approver_id: Nullable<number>;
		parent_id: Nullable<number>;
		pixiv_id: Nullable<number>;
		score: number;
		fav_count: number;
		tag_count: number;
		tag_count_general: number;
		tag_count_artist: number;
		tag_count_character: number;
		tag_count_copyright: number;
		tag_count_meta: number;
		source: Nullable<string>;
		md5: string;
		rating: Rating | null;
		image_width: number;
		image_height: number;
		file_size: number;
		file_ext: string;
		file_url?: string;
		large_file_url?: string;
		preview_file_url?: string;
		tag_string: string;
		tag_string_general: string;
		tag_string_artist: string;
		tag_string_character: string;
		tag_string_copyright: string;
		tag_string_meta: string;
		last_comment_bumped_at: Nullable<Timestamp>;
		last_commented_at: Nullable<Timestamp>;
		last_noted_at: Nullable<Timestamp>;
		has_children: boolean;
		has_visible_children: boolean;
		has_active_children: boolean;
		has_large: boolean;
		is_pending: boolean;
		is_flagged: boolean;
		is_deleted: boolean;
		is_banned: boolean;
		bit_flags: number;
		up_score: number;
		down_score: number;
		media_asset?: MediaAsset;
	}

	export interface MediaAsset {
		id: number;
		created_at: Timestamp;
		updated_at: Timestamp;
		md5: string;
		file_ext: string;
		file_size: number;
		image_width: number;
		image_height: number;
		duration: Nullable<number>;
		status: "active" | "processing" | "deleted" | string;
		file_key: string;
		is_public: boolean;
		pixel_hash: Nullable<string>;
		variants: MediaVariant[];
	}

	export interface MediaVariant {
		type: string;
		url: string;
		width: number;
		height: number;
		file_ext: string;
	}

	export type TagCategory = "0" | "1" | "3" | "4" | "5" | "manual";

  export interface AutocompleteEntry {
      label: string;
      value: string;
      count: string;
  }

	export interface Tag {
    id: number,
    name: string,
    post_count: number,
    category: TagCategory,
    created_at: Timestamp,
    updated_at: Timestamp,
    is_deprecated: boolean,
    words?: string[];
	}

	export interface TagSearchOpt {
		id?: number | string;
		name?: string;
		category?: TagCategory;
		limit?: number;
		post_count?: number | string;
		created_at?: Timestamp | string;
		updated_at?: Timestamp | string;
		is_deprecated?: boolean;
	}

	export type TagSearchOrder = "name" | "date" | "count" | "similarity";

	export interface Comment {
		id: number;
		created_at: Timestamp;
		updated_at: Timestamp;
		post_id: number;
		creator_id: number;
		updater_id: number;
		body: string;
		score: number;
		do_not_bump_post: boolean;
		is_deleted: boolean;
		is_sticky: boolean;
	}

	export interface CommentSearchOpt {
		limit?: number;
		page?: number;
		post_id?: number;
		creator_id?: number;
		updater_id?: number;
		id?: number;
		body_matches?: string;
		is_deleted?: boolean;
		order?: "id" | "score" | "recent" | "updated_at";
	}

	export interface User {
		id: number;
		created_at: Timestamp;
		name: string;
		inviter_id: Nullable<number>;
		level: number;
		level_string: string;
		is_deleted: boolean;
		is_banned: boolean;
		post_upload_count: number;
		post_update_count: number;
		note_update_count: number;
		wiki_page_version_count: number;
		artist_version_count: number;
		artist_commentary_version_count: number;
		pool_version_count: number;
		forum_post_count: number;
		comment_count: number;
		favorite_group_count: number;
		appeal_count: number;
		flag_count: number;
		positive_feedback_count: number;
		neutral_feedback_count: number;
		negative_feedback_count: number;
	}

	export interface UserSearchOpt {
		id?: number;
		name?: string;
		level?: number;
		order?: "name" | "created_at" | "post_upload_count" | "post_update_count" | "comment_count";
	}

	export interface AutocompleteItem {
		type: string;
		label: string;
		value: string;
		category: TagCategory;
		post_count: number;
		tag?: Tag;
		antecedent?: string;
	}

	export type AutocompleteResponse = AutocompleteItem[];
}
