import { Gelbooru } from "@/types/gelbooru";
import { BaseProvider } from "./base-provider";
import { IBaseRes, LoginDetails } from "@/types";
import { objToURLParams } from "@/util/obj-to-url-param";
import { handleResponse } from "@/util/response-handler";

export class GelbooruProvider extends BaseProvider {
  readonly name = "Gelbooru";
  readonly baseURL: string;
  readonly languages = ["en"];
  loginDetails: LoginDetails = {};

  constructor(url: string, opts?: { login?: LoginDetails }) {
    super(url);
    url = url.replace(/\/$/, "");
    this.baseURL = url;
    if (opts && opts.login) {
      this.login(opts.login);
    }
  }

  login(loginDetails: Partial<LoginDetails>): void {
    throw new Error("Method not implemented.");
  }

  override async search(query: string, args: Partial<Gelbooru.SearchOpt>): Promise<IBaseRes<Gelbooru.SearchRes>> {
    let url = `${this.baseURL}/index.php?page=dapi&s=post&q=index&json=1&tags=${query}${objToURLParams(args)}`;
    const searchFetch = await fetch(url);
    let searchJson = await searchFetch.json();
    return handleResponse<Gelbooru.SearchRes>(searchFetch, url, () => {
      // I hate having to do this, please gelbooru don't put @s in your json :sob:
      searchJson["attributes"] = searchJson["@attributes"];
      delete searchJson["@attributes"];
      return {
        results: searchJson,
        totalResults: searchJson.post.length,
      };
    });
  }

  override async tags(args: Partial<Gelbooru.TagOpt>): Promise<IBaseRes<any>> {
    let url = `${this.baseURL}/index.php?page=dapi&s=tag&q=index&json=1${objToURLParams(args)}`;
    const tagFetch = await fetch(url);
    return handleResponse(tagFetch, url, async () => {
      const tagJson = await tagFetch.json();
      return {
        results: tagJson,
        totalResults: tagJson.tag.length,
      };
    });
  }

  users(args: any): Promise<any> {
    throw new Error("Method not implemented.");
  }
}
