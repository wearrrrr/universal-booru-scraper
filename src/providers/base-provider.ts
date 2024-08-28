import { IBaseRes, LoginDetails } from "src/types/types";

export abstract class BaseProvider {

  abstract readonly name: string;
  abstract readonly baseURL: string;
  protected readonly languages: string[] | string = "en";
  abstract loginDetails: LoginDetails;

  abstract search(query: string, ...args: any[]): Promise<unknown>;

  // Should take in an abstracted object (ie. MoebooruTagRequest) that can be converted to URL params for the provider
  // Promise<unknown> should eventually be refactored here into Promise<TagRes<MoebooruTagRes>> or similar
  abstract tags(...args: any | any[]): Promise<IBaseRes<unknown>>;

  // Should take in an abstracted object (ie. MoebooruUserRequest) that can be converted to URL params for the provider
  abstract users(...args: any | any[]): Promise<unknown>;

  get toString(): ProviderStats {
    return {
      name: this.name,
      baseURL: this.baseURL,
      languages: this.languages,
    };
  }
}