import { Gelbooru } from "@/types/gelbooru";
import { BaseProvider } from "./base-provider";
import { IBaseRes, LoginDetails } from "@/types";
import { objToURLParams } from "@/util/obj-to-url-param";
import { handleResponse } from "@/util/response-handler";
import { checkXML, parseXML } from "@/util/xml-handler";

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
      if (!searchJson.post) {
        searchJson.post = searchJson;
      }
      return {
        results: searchJson,
        totalResults: searchJson.post.length,
      };
    });
  }

  override async tags(args: Partial<Gelbooru.TagOpt>): Promise<IBaseRes<Gelbooru.TagList>> {
    let url = `${this.baseURL}/index.php?page=dapi&s=tag&q=index&json=1${objToURLParams(args)}`;
    const tagFetch = await fetch(url);
    return handleResponse<Gelbooru.TagList>(tagFetch, url, async () => {
      let tagRes = await tagFetch.text();
      if (checkXML(tagRes)) {
        let convertedXML = this.convertXMLTagResToTagRes(parseXML(tagRes) as Gelbooru.XMLTagRes);
        if (convertedXML) {
          return {
            results: {
              tag: convertedXML.tag,
            },
            totalResults: convertedXML.tag.length,
            wasXML: true,
          };
        }
      }
      let tagJson = JSON.parse(tagRes) as Gelbooru.TagList;
      return {
        results: {
          tag: tagJson.tag,
        },
        totalResults: tagJson.tag.length,
      };
    });
  }

  users(args: any): Promise<any> {
    throw new Error("Method not implemented.");
  }

  convertXMLTagResToTagRes(xml: Gelbooru.XMLTagRes): Gelbooru.TagList {
    console.log(xml)
    const tags: Gelbooru.TagRes[] = [];

    for (let tag of xml.tags.children) {
      console.log(tag)
      tags.push({
        id: tag.tag.id,
        name: tag.tag.name,
        count: tag.tag.count,
        type: tag.tag.type,
        ambiguous: tag.tag.ambiguous,
      });
    }

    return {
      tag: tags,
    };
  };
}
