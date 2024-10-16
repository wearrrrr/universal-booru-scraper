import { BaseProvider } from "./base-provider";
import { handleResponse } from "@util/response-handler";
import { Language } from "@enum/Language";
import { Rating } from "@enum/Rating";
import { Moebooru } from "@/types/moebooru";
import { objToURLParams } from "@/util/obj-to-url-param";

const DEFAULT_SEARCH_OPTS: Moebooru.SearchOpt = {
  page: 1,
  limit: 100,
  // By default, all content is included, any other content is *opt out*.
  questionable: true,
  explicit: true,
};

export class MoebooruProvider extends BaseProvider {
  readonly name = "Moebooru";
  readonly baseURL;
  readonly languages = [Language.English, Language.Japanese];
  loginDetails: LoginDetails = {};

  /**
   * @param url The base URL of the moebooru site
   * @param opts Options and extra details for the provider, generally optional for basic usage
   */
  constructor(url: string, opts?: { login?: LoginDetails }) {
    super(url);
    url = url.replace(/\/$/, "");
    this.baseURL = url;
    if (opts && opts.login) {
      this.login(opts.login);
    }
  }

  /**
   * Set the login details for the provider
   * @param loginDetails The login details
   * @returns void
   */
  login(loginDetails: Partial<LoginDetails>): void {
    this.loginDetails = loginDetails;
  }

  /**
   * Search for posts on the loaded site.
   * @param query The search query
   * @param opts The search options
   * @returns An object containing the search results and the total number of results.
   */
  override async search(query: string, opts: Partial<Moebooru.SearchOpt>): Promise<IBaseRes<Moebooru.SearchRes>> {
    opts = { ...DEFAULT_SEARCH_OPTS, ...opts };
    if (!query) throw new Error("Query is required");
    if (opts.limit && opts.limit > 100) throw new Error("Limit must be less than 100");
    const url = `${this.baseURL}/post.json?tags=${query}&limit=${opts.limit}&page=${opts.page}`;
    const searchFetch = await fetch(url);
    return handleResponse(searchFetch, url, async () => {
      const searchJson = (await searchFetch.json()) as Moebooru.Post[];
      // Map search results, remove explicit and questionable posts if disallowed by options
      let filtered = 0;
      searchJson.map((post: Moebooru.Post) => {
        let index = searchJson.indexOf(post);
        if (!opts.questionable && post.rating === Rating.Questionable) {
          delete searchJson[index];
          filtered++;
        }
        if (!opts.explicit && post.rating === Rating.Explicit) {
          delete searchJson[index];
          filtered++;
        }
      });
      return {
        results: {
          posts: searchJson,
          filtered: filtered,
        },
        totalResults: searchJson.length,
      };
    });
  }

  /**
   * Get tags based args.name or args.id
   * @param args Arguments to be sent to the API.
   * @returns An object containing the tags and the total number of results.
   */
  override async tags(args: Partial<Moebooru.TagRequest>): Promise<IBaseRes<Moebooru.TagResponse[]>> {
    const url = `${this.baseURL}/tag.json?${objToURLParams(args)}`;
    const tagsFetch = await fetch(url);
    return handleResponse(tagsFetch, url, async () => {
      const tagsJson = (await tagsFetch.json()) as Moebooru.TagResponse[];
      return {
        results: tagsJson,
        totalResults: tagsJson.length,
      };
    });
  }

  /**
   * Get related tags based on the input
   * @param tag The tag to find related tags for
   * @param type The type of tag to find related tags for
   * @returns An object containing related tags, and the total number of results.
   */
  async tags_related(tag: string, type?: Moebooru.TagType): Promise<IBaseRes<Moebooru.RelatedTag>> {
    let url = `${this.baseURL}/tag/related.json?tags=${tag}`;
    if (type) {
      url += `&type=${type}`;
    }
    const relatedFetch = await fetch(url);
    return handleResponse(relatedFetch, url, async () => {
      const res = await relatedFetch.json();
      return {
        results: res,
        totalResults: res[tag].length,
      };
    });
  }

  /**
   * Get user(s) based on args.name or args.id
   * @param args Arguments to be sent to the API.
   * @returns An object containing the user(s) and the total number of results.
   */
  override async users(args: Partial<Moebooru.UserQuery>): Promise<IBaseRes<Moebooru.UserResponse[]>> {
    if (args.loginRequirement != false) {
      if (!this.loginDetails.username && !this.loginDetails.api_key) {
        throw new Error("You must be logged in to perform this action! Call login(username, api_key) first.");
      }
    }
    let url = `${this.baseURL}/user.json?login=${this.loginDetails.username}&password_hash=${this.loginDetails.api_key}`;
    // else if is used here because id and name are mutually exclusive, you shouldn't search by name and id at the same time.
    if (args.id) {
      url += `&id=${args.id}`;
    } else if (args.name) {
      url += `&name=${args.name}`;
    }

    const userFetch = await fetch(url);
    return handleResponse(userFetch, url, async () => {
      const userJson = (await userFetch.json()) as Moebooru.UserResponse[];
      return {
        results: userJson,
        totalResults: userJson.length,
      };
    });
  }

  comments(...args: any | any[]): Promise<IBaseRes<unknown>> {
    throw new Error("Method not implemented.");
  }
}
