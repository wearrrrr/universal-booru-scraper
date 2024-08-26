import { BaseProvider } from "./base-provider";
import { handleResponse } from "./response-handler";

const DEFAULT_SEARCH_OPTS: MoebooruSearchOpt = {
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

  constructor(url: string) {
    super();
    if (!URL.canParse(url)) {
      throw new Error(`Invalid URL! URL Provided: ${url}`);
    }
    url = url.replace(/\/$/, "");
    this.baseURL = url;
  }

  override async search(query: string, opts?: Partial<MoebooruSearchOpt>): Promise<any> {
      opts = { ...DEFAULT_SEARCH_OPTS, ...opts };
      if (!query) throw new Error("Query is required");
      if (opts.limit && opts.limit > 100) throw new Error("Limit must be less than 100");
      const url = `${this.baseURL}/post.json?tags=${query}&limit=${opts.limit}&page=${opts.page}`;
      const searchFetch = await fetch(url);
      return handleResponse(searchFetch, url, async () => {
        const searchJson = await searchFetch.json();
        // Map search results to MoebooruPost type, remove explicit and questionable posts if disallowed by options
        let removed = 0;
        searchJson.map((post: MoebooruPost) => {
  
          if (!opts.questionable && post.rating === "q") {
            delete searchJson[searchJson.indexOf(post)];
            removed++;
          }
          if (!opts.explicit && post.rating === "e") {
            delete searchJson[searchJson.indexOf(post)];
            removed++;
          }
        });
        return {
          posts: searchJson,
          removed: removed,
        };
      })
  }

  override async tags(...args: any[]): Promise<unknown> {
    throw new Error("Method not implemented.");
  }

}