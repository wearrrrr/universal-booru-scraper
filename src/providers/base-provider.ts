export abstract class BaseProvider implements Provider {
  abstract readonly name: string;
  abstract readonly baseURL: string;
  readonly languages: string[] | string = "en";
  abstract loginDetails: LoginDetails;

  constructor(url: string) {
    try {
      new URL(url);
    } catch {
      throw new Error("Invalid URL!");
    }
  }

  abstract login(loginDetails: Partial<LoginDetails>): void;

  abstract search(query: string, ...args: any[]): Promise<IBaseRes<unknown>>;

  // Should take in an abstracted object (ie. MoebooruTagRequest) that can be converted to URL params for the provider
  // Promise<unknown> should eventually be refactored here into Promise<TagRes<MoebooruTagRes>> or similar
  abstract tags(...args: any | any[]): Promise<IBaseRes<unknown>>;

  // Should take in an abstracted object (ie. MoebooruUserRequest) that can be converted to URL params for the provider
  abstract users(...args: any | any[]): Promise<unknown>;

  abstract comments(...args: any | any[]): Promise<IBaseRes<unknown>>;

  get toString(): ProviderStats {
    return {
      name: this.name,
      baseURL: this.baseURL,
      languages: this.languages,
    };
  }
}
