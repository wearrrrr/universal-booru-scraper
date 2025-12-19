import { BaseProvider } from "./base-provider";
import { Gelbooru } from "@lib/types/gelbooru";
import { Language } from "@enum/Language";
import { handleResponse, objToURLParams, checkXML, parseXML, convertXMLDataToJSON } from "@util/utils";

export class GelbooruProvider extends BaseProvider {
  readonly name = "Gelbooru";
  readonly baseURL: string;
  readonly languages = [Language.English, Language.Japanese];
  loginDetails: LoginDetails = {};

  constructor(url?: string, opts?: { login?: LoginDetails }) {
    if (!url) url = "https://gelbooru.com/";
    super(url);
    this.baseURL = url;
    if (opts && opts.login) {
      this.login(opts.login);
    }
  }

  override async search(query: string, args?: Partial<Gelbooru.SearchOpt>): Promise<IBaseRes<Gelbooru.SearchRes>> {
    if (!this.loginDetails) {
      console.warn("Login details not provided! A lot of providers will not work...");
    }

    if (!args) args = {};

    let url = `${this.baseURL}/index.php?page=dapi&s=post&q=index&json=1&tags=${query}${objToURLParams(args)}&api_key=${this.loginDetails?.api_key}&user_id=${this.loginDetails?.username}`;
    const searchFetch = await fetch(url);
    let searchRes = await searchFetch.text();
    return handleResponse<Gelbooru.SearchRes>(searchFetch, url, () => {
      let searchJson = JSON.parse(searchRes);
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

  async autocomplete(query: string): Promise<IBaseRes<Gelbooru.Tag[]>> {
    let url;
    if (this.loginDetails) {
      url = `${this.baseURL}/index.php?page=autocomplete2&term=${query}&type=tag_query&api_key=${this.loginDetails.api_key}&user_id=${this.loginDetails.username}`;
    } else {
      url = `${this.baseURL}/index.php?page=autocomplete2&term=${query}&type=tag_query`;
    }

    const autocompleteFetch = await fetch(url);
    let autocompleteRes = await autocompleteFetch.text();
    return handleResponse<Gelbooru.Tag[]>(autocompleteFetch, url, () => {
      let autocompleteJson = JSON.parse(autocompleteRes);
      return {
        results: autocompleteJson,
        totalResults: autocompleteJson.length,
      };
    });
  }

  override async tags(args: Partial<Gelbooru.TagOpt>): Promise<IBaseRes<Gelbooru.TagList>> {
    let url = `${this.baseURL}/index.php?page=dapi&s=tag&q=index&json=1${objToURLParams(args)}&api_key=${this.loginDetails?.api_key}&user_id=${this.loginDetails?.username}`;
    const tagFetch = await fetch(url);
    return handleResponse<Gelbooru.TagList>(tagFetch, url, async () => {
      let tagRes = await tagFetch.text();
      if (checkXML(tagRes)) {
        let convertedXML = convertXMLDataToJSON(parseXML(tagRes));
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
      if (!tagJson.tag) {
        return {
          results: {
            tag: [],
          },
          totalResults: 0,
        };
      }
      return {
        results: {
          tag: tagJson.tag,
        },
        totalResults: tagJson.tag.length,
      };
    });
  }

  user(args: any): Promise<any> {
    throw new Error("Method not implemented.");
  }

  async comments(id: string): Promise<IBaseRes<Gelbooru.CommentsRes>> {
    if (this.baseURL == "https://gelbooru.com") {
      console.warn("Comment API on gelbooru's end has been disabled because of abuse, I can't work with this!");

      return {
        results: {
          comments: [],
          apiDisabled: true,
        },
        totalResults: 0,
      };
    }

    const url = `${this.baseURL}/index.php?page=dapi&s=comment&q=index&post_id=${id}&api_key=${this.loginDetails?.api_key}&user_id=${this.loginDetails?.username}`;
    const data = await fetch(url);
    const text = await data.text();

    if (checkXML(text)) {
      const xml = convertXMLDataToJSON(parseXML(text)) as Gelbooru.CommentsRes;
      console.log(xml);
      return {
        results: xml,
        totalResults: xml.comments.length,
        wasXML: true,
      };
    } else {
      const json = JSON.parse(text);
      return {
        results: json,
        totalResults: json.length,
      };
    }
  }
}
