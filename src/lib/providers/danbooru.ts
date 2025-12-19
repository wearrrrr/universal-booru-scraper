import { BaseProvider } from "./base-provider";
import { Language } from "@enum/Language";
import { Danbooru } from "@lib/types/danbooru";
import { handleResponse, objToURLParams } from "@util/utils";

import * as cheerio from 'cheerio';

export class DanbooruProvider extends BaseProvider {
  readonly name = "Danbooru";
  readonly baseURL: string;
  readonly languages = [Language.English, Language.Japanese];

  constructor(url?: string, opts?: { login?: LoginDetails }) {
    if (!url) url = "https://danbooru.donmai.us";
    super(url);

    this.baseURL = url;
    if (opts && opts.login) {
      this.login(opts.login);
    }
  }

  async autocomplete(query: string): Promise<IBaseRes<Danbooru.Tag[]>> {
    let url;
    if (this.loginDetails) {
      url = `${this.baseURL}/autocomplete?&search%5Bquery%5D=${query}&search%5Btype%5D=tag_query&version=3&limit=20&format=json&api_key=${this.loginDetails.api_key}&login=${this.loginDetails.username}`;
    } else {
      url = `${this.baseURL}/autocomplete?&search%5Bquery%5D=${query}&search%5Btype%5D=tag_query&version=3&limit=20&format=json`;
    }

    const autocompleteFetch = await fetch(url);

    return handleResponse<Danbooru.Tag[]>(autocompleteFetch, url, async () => {
      let autocompleteJson = JSON.parse(await autocompleteFetch.text());
      return {
        results: autocompleteJson,
        totalResults: autocompleteJson.length,
      };
    });
  }

  override async search(query: string, args?: Partial<Danbooru.SearchOpt>): Promise<IBaseRes<Danbooru.SearchRes>> {
    if (!this.loginDetails) {
      console.warn("Login details not provided! A lot of providers will not work...");
    }

    if (!args) args = {};

    const url = `${this.baseURL}/posts.json?tags=${query}&json=1${objToURLParams(args)}&api_key=${this.loginDetails?.api_key}&login=${this.loginDetails?.username}`;
    const searchFetch = await fetch(url);
    let searchRes = await searchFetch.text();
    return handleResponse<Danbooru.SearchRes>(searchFetch, url, () => {
      const searchJson = JSON.parse(searchRes);
      return {
        results: searchJson,
        totalResults: searchJson.length,
      };
    });
  }

  override async tags(query: string, args: (Partial<Danbooru.TagSearchOpt>) = {}): Promise<IBaseRes<Danbooru.Tag[]>> {
    const url = `${this.baseURL}/tags.json?search[name_matches]=${query}&json=1${objToURLParams(args)}&api_key=${this.loginDetails?.api_key}&login=${this.loginDetails?.username}`;
    const response = await fetch(url);
    return handleResponse<Danbooru.Tag[]>(response, url, async () => {
      const results = (await response.json()) as Danbooru.Tag[];
      return {
        results,
        totalResults: results.length,
      };
    });
  }

  override async user(args: Partial<Danbooru.UserSearchOpt> = {}): Promise<IBaseRes<Danbooru.User[]>> {
    const allowDirectLookup =
      args.id !== undefined && args.name === undefined && args.order === undefined && args.level === undefined;

    if (allowDirectLookup && args.id !== undefined) {
      const authParams: Record<string, unknown> = {};
      if (this.loginDetails?.username) authParams["login"] = this.loginDetails.username;
      if (this.loginDetails?.api_key) authParams["api_key"] = this.loginDetails.api_key;
      const serializedAuth = objToURLParams(authParams);
      const url = `${this.baseURL}/users/${args.id}.json${serializedAuth ? `?${serializedAuth.slice(1)}` : ""}`;
      const response = await fetch(url);
      return handleResponse<Danbooru.User[]>(response, url, async () => {
        const user = (await response.json()) as Danbooru.User;
        return {
          results: [user],
          totalResults: 1,
        };
      });
    }

    const params: Record<string, unknown> = {};
    if (args.id !== undefined) params["search[id]"] = args.id;
    if (args.name) params["search[name_matches]"] = args.name;
    if (args.level !== undefined) params["search[level]"] = args.level;
    if (args.order) params["search[order]"] = args.order;
    if (this.loginDetails?.username) params["login"] = this.loginDetails.username;
    if (this.loginDetails?.api_key) params["api_key"] = this.loginDetails.api_key;

    const serialized = objToURLParams(params);
    const url = `${this.baseURL}/users.json${serialized ? `?${serialized.slice(1)}` : ""}`;
    const response = await fetch(url);
    return handleResponse<Danbooru.User[]>(response, url, async () => {
      const results = (await response.json()) as Danbooru.User[];
      return {
        results,
        totalResults: results.length,
      };
    });
  }

  override async comments(postId: string | number, opts?: { limit?: number; page?: number }): Promise<IBaseRes<Danbooru.Comment[]>> {
    const params: Record<string, unknown> = {
      "search[post_id]": postId,
      limit: opts?.limit ?? 20,
      page: opts?.page,
    };

    if (this.loginDetails?.username) params["login"] = this.loginDetails.username;
    if (this.loginDetails?.api_key) params["api_key"] = this.loginDetails.api_key;

    const serialized = objToURLParams(params);
    const url = `${this.baseURL}/comments.json${serialized ? `?${serialized.slice(1)}` : ""}`;
    const response = await fetch(url);
    const text = await response.text();

    return handleResponse<Danbooru.Comment[]>(response, url, () => {
      const json = JSON.parse(text) as Danbooru.Comment[];
      return {
        results: json,
        totalResults: json.length,
      };
    });
  }
}
