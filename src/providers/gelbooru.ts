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

  override async search(query: string, args: Partial<Gelbooru.SearchOpt>): Promise<IBaseRes<any>> {
    let url = `${this.baseURL}/index.php?page=dapi&s=post&q=index&json=1&tags=${query}${objToURLParams(args)}`;
    const searchFetch = await fetch(url);
    return handleResponse(searchFetch, url, async () => {
      const searchJson = await searchFetch.json();
      return {
        results: searchJson,
        totalResults: searchJson.post.length,
      };
    });
  }
  tags(args: any): Promise<IBaseRes<any>> {
    throw new Error("Method not implemented.");
  }
  users(args: any): Promise<any> {
    throw new Error("Method not implemented.");
  }
}