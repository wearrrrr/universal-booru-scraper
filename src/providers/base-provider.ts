export abstract class BaseProvider {

  abstract readonly name: string;
  abstract readonly baseURL: string;
  protected readonly languages: string[] | string = "en";

  abstract search(query: string, ...args: any[]): Promise<unknown>;

  abstract tags?(...args: any[]): Promise<unknown>;

  get toString(): ProviderStats {
    return {
      name: this.name,
      baseURL: this.baseURL,
      languages: this.languages,
    };
  }
}