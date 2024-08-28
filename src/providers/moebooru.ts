import { LoginDetails, IBaseRes } from 'src/types/types';
import { BaseProvider } from "./base-provider";
import { handleResponse } from "./response-handler";
import type { Moebooru } from "src/types/moebooru";

const DEFAULT_SEARCH_OPTS: Moebooru.SearchOpt = {
  page: 1,
  limit: 100,
  // By default, all content is included, any other content is *opt out*.
  questionable: true,
  explicit: true,
}

export class MoebooruProvider extends BaseProvider {
  readonly name = "Moebooru";
  readonly baseURL;
  readonly languages = ["en", "ja"];
  loginDetails: LoginDetails = {};

  constructor(url: string, login?: LoginDetails) {
    super();
    try {
      new URL(url);
    } catch {
      throw new Error("Invalid URL!");
    }
    url = url.replace(/\/$/, "");
    this.baseURL = url;
    this.loginDetails = login || {};
  }

  override async search(query: string, opts: Partial<Moebooru.SearchOpt>): Promise<Moebooru.SearchRes> {
      opts = { ...DEFAULT_SEARCH_OPTS, ...opts };
      if (!query) throw new Error("Query is required");
      if (opts.limit && opts.limit > 100) throw new Error("Limit must be less than 100");
      const url = `${this.baseURL}/post.json?tags=${query}&limit=${opts.limit}&page=${opts.page}`;
      const searchFetch = await fetch(url);
      return handleResponse(searchFetch, url, async () => {
        const searchJson = await searchFetch.json() as Moebooru.Post[];
        // Map search results to MoebooruPost type, remove explicit and questionable posts if disallowed by options
        let filtered = 0;
        searchJson.map((post: Moebooru.Post) => {
          let index = searchJson.indexOf(post);
          if (!opts.questionable && post.rating === "q") {
            delete searchJson[index];
            filtered++;
          }
          if (!opts.explicit && post.rating === "e") {
            delete searchJson[index];
            filtered++;
          }
        });
        return {
          posts: searchJson,
          filtered: filtered,
        };
      })
  }

  override async tags(args: Partial<Moebooru.TagRequest>): Promise<IBaseRes<Moebooru.TagResponse[]>> {
    const url = `${this.baseURL}/tag.json?${this.objToURLParams(args)}`;
    const tagsFetch = await fetch(url);
    return handleResponse(tagsFetch, url, async () => {
      const tagsJson = await tagsFetch.json() as Moebooru.TagResponse[];
      return {
        results: tagsJson,
        totalResults: tagsJson.length,
      };
    });
  }

  async tags_related(tag: string, type?: Moebooru.TagType): Promise<IBaseRes<Moebooru.RelatedTag>> {
    let url = `${this.baseURL}/tag/related.json?tags=${tag}`;
    if (type) {
      url += `&type=${type}`;
    }
    const relatedFetch = await fetch(url);
    return handleResponse(relatedFetch, url, async () => {
      const res = await relatedFetch.json() as Moebooru.RelatedTag[];
      return {
        results: res,
        totalResults: res.length,
      };
    });
  }

  override async users(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  objToURLParams(tagRequest: Partial<Moebooru.TagRequest>): string {
    let urlParams = Object.entries(tagRequest)
    .filter(([_, value]) => value !== null && value !== '')
    .map(([key, value]) => `&${key}=${value}`)
    .join('');
    return urlParams;
  }



}