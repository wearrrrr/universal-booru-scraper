import { BaseProvider } from "./base-provider";
import { Danbooru } from "@lib/types/danbooru";
import { Language } from "@enum/Language";
import { handleResponse, objToURLParams, checkXML, parseXML, convertXMLDataToJSON } from "@util/utils";

function decodeTagSummary(data: string) {
    return data.trim()
        .split(" ")
        .filter(Boolean)
        .map((entry: string) => {
            const parts = entry.split("`");
            return {
                num_aliases: Number(parts[0]),
                tag: parts[1],
                aliases: parts[2] ? parts[2].split(" ") : []
            };
        });
}

function extractXMLCount(node: any): number | undefined {
    if (!node) return undefined;

    const attrs = node["@attributes"] ?? node;
    if (attrs?.count !== undefined) {
        const parsed = Number(attrs.count);
        return Number.isNaN(parsed) ? undefined : parsed;
    }

    if (node.posts) {
        const postAttrs = node.posts["@attributes"] ?? node.posts;
        if (postAttrs?.count !== undefined) {
            const parsed = Number(postAttrs.count);
            return Number.isNaN(parsed) ? undefined : parsed;
        }
    }

    return undefined;
}

export class YandereProvider extends BaseProvider {
  readonly name = "Yandere";
  readonly baseURL: string;
  readonly languages = [Language.English, Language.Japanese];
  autocompleteCache: { data: Yandere.TagSummary[] } | undefined;

  constructor(url?: string, opts?: { login?: LoginDetails }) {
    if (!url) url = "https://yande.re";
    super(url);

    this.baseURL = url;
    if (opts && opts.login) {
      this.login(opts.login);
    }
  }

  async prefetchAutocomplete() {
    const autocompleteFetch = await fetch("https://yande.re/tag/summary");
    const text = await autocompleteFetch.text();

    const autocompleteData = decodeTagSummary(text);
    this.autocompleteCache = { data: autocompleteData };
  }

  async autocomplete(query: string): Promise<IBaseRes<Yandere.TagSummary[]>> {
    if (this.autocompleteCache) {
      const autocompleteData = this.autocompleteCache.data;
      const q = query.toLowerCase();

      let filteredData = autocompleteData.filter(tag => {
        if (tag.tag && tag.tag.toLowerCase().includes(q))
          return true;

        return tag.aliases.some(alias =>
          alias.toLowerCase().includes(q)
        );
      });
      return {
        results: filteredData,
        totalResults: filteredData.length,
      };
    } else {
      await this.prefetchAutocomplete();
      return this.autocomplete(query);
    }
  }

  override async search(query: string, args?: Partial<Danbooru.SearchOpt>): Promise<IBaseRes<Danbooru.SearchRes>> {
    if (!this.loginDetails) {
      console.warn("Login details not provided! A lot of providers will not work...");
    }

    if (!args) args = {};

    // Use XML endpoint to expose richer data from yande.re.
    // Keep URL params from args and include auth params when present.
    const authParams = this.loginDetails ? `&api_key=${this.loginDetails?.api_key}&login=${this.loginDetails?.username}` : "";
    let url = `${this.baseURL}/post.xml?tags=${query}${objToURLParams(args)}${authParams}`;
    const searchFetch = await fetch(url);
    let searchResText = await searchFetch.text();
    return handleResponse<Danbooru.SearchRes>(searchFetch, url, () => {
      // If the response is XML, convert it to JSON using xml-handler utilities
      if (checkXML(searchResText)) {
        const convertedRoot = parseXML(searchResText);
        const converted = convertXMLDataToJSON(convertedRoot);

        // Robustly normalize posts from a variety of XML-to-JSON shapes that may occur.
        // Yandere's XML can present posts as:
        // - converted.post (array or single object)
        // - converted.posts.post (array or single)
        // - converted.posts (array)
        // - or under some other key that contains an array of items with `id` or `post_id`.
        let posts: any[] = [];

        if (converted) {
          // Common direct shape: <post>...</post> or <post><item/>...</post>
          if (Array.isArray((converted as any).post)) {
            posts = (converted as any).post;
          } else if ((converted as any).post) {
            posts = [(converted as any).post];
          }
          // Nested posts container: <posts><post>...</post></posts>
          else if ((converted as any).posts) {
            const p = (converted as any).posts;
            if (Array.isArray(p.post)) posts = p.post;
            else if (Array.isArray(p)) posts = p;
            else if (p.post) posts = [p.post];
          }
          // If not found yet, attempt to detect any array-like property that looks like posts
          if (posts.length === 0) {
            for (const key in converted) {
              if (!Object.prototype.hasOwnProperty.call(converted, key)) continue;
              const candidate = (converted as any)[key];
              if (Array.isArray(candidate) && candidate.length > 0) {
                const first = candidate[0];
                if (first && (first.id !== undefined || first.post_id !== undefined || first.file_url !== undefined || first.source !== undefined)) {
                  posts = candidate;
                  break;
                }
              }
            }
          }

          // Final fallback: if converted itself looks like a post object (has id), wrap it
          if (posts.length === 0 && converted && (converted as any).id !== undefined) {
            posts = [converted];
          }
        }

        const totalCount =
          extractXMLCount((convertedRoot as any)?.posts ?? convertedRoot) ??
          extractXMLCount((converted as any)?.posts ?? converted);

        // Ensure posts is an array and normalize to empty array if nothing found
        if (!Array.isArray(posts)) posts = posts ? [posts] : [];

        return {
          results: posts,
          totalResults: totalCount ?? posts.length,
          wasXML: true,
        };
      } else {
        // Fallback to JSON parsing for compatibility
        let searchJson = JSON.parse(searchResText);
        if (!searchJson.post) {
          searchJson.post = searchJson;
        }
        const jsonPosts = Array.isArray(searchJson.post) ? searchJson.post : [searchJson.post].filter(Boolean);
        const totalCount = extractXMLCount(searchJson);
        return {
          results: jsonPosts,
          totalResults: totalCount ?? jsonPosts.length,
        };
      }
    });
  }

  override async tags(args: Yandere.TagSearchOpt = {}): Promise<IBaseRes<Yandere.Tag[]>> {

    const serialized = objToURLParams(args);
    const url = `${this.baseURL}/tag.xml${serialized ? `?${serialized.slice(1)}` : ""}`;
    const response = await fetch(url);
    return handleResponse<Yandere.Tag[]>(response, url, async () => {
      const text = await response.text();

      // If XML, convert and extract <tag .../> attribute nodes to Yandere.Tag[]
      if (checkXML(text)) {
        const converted = convertXMLDataToJSON(parseXML(text));

        // Helper: find arrays of tag-like nodes in the converted object
        const findTagArray = (obj: any): any[] => {
          if (!obj) return [];
          // Common shape: <tags><tag .../></tags> => converted.tags.tag
          if (obj.tags && obj.tags.tag) {
            return Array.isArray(obj.tags.tag) ? obj.tags.tag : [obj.tags.tag];
          }
          // Some parsers return top-level tag array
          if (obj.tag) {
            return Array.isArray(obj.tag) ? obj.tag : [obj.tag];
          }
          // Fallback: look for any array whose items look like tag nodes (have id or name)
          for (const k in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
            const v = obj[k];
            if (Array.isArray(v) && v.length > 0) {
              const first = v[0];
              if (first && (first.id !== undefined || first.name !== undefined || (first['@attributes'] && first['@attributes'].id !== undefined))) {
                return v;
              }
            }
          }
          return [];
        };

        const rawTags = findTagArray(converted);

        // Map a single converted tag node (attributes or direct props) into Yandere.Tag
        const mapNodeToTag = (node: any): Yandere.Tag | null => {
          if (!node) return null;
          // Attributes may be under '@attributes' or on the node directly
          const attrs = (node['@attributes'] && typeof node['@attributes'] === 'object') ? node['@attributes'] : node;
          const idRaw = attrs.id ?? attrs['@id'];
          const nameRaw = attrs.name ?? attrs['@name'];
          if (idRaw === undefined || nameRaw === undefined) return null;
          const id = Number(idRaw);
          const name = String(nameRaw);
          const count = attrs.count !== undefined ? Number(attrs.count) : 0;
          const type = attrs.type !== undefined ? Number(attrs.type) : 0;
          const ambiguousRaw = attrs.ambiguous ?? attrs['@ambiguous'] ?? attrs.amb ?? "false";
          const ambiguous = String(ambiguousRaw) === 'true' || String(ambiguousRaw) === '1';
          return { id, name, count, type, ambiguous } as Yandere.Tag;
        };

        const normalized: Yandere.Tag[] = rawTags.map(mapNodeToTag).filter(Boolean) as Yandere.Tag[];

        return {
          results: normalized,
          totalResults: normalized.length,
          wasXML: true,
        };
      } else {
        // JSON fallback (old behavior)
        const results = (await JSON.parse(text)) as Yandere.Tag[];
        return {
          results,
          totalResults: results.length,
        };
      }
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
