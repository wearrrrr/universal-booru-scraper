import { BaseProvider } from "./base-provider";
import { IBaseRes, LoginDetails } from "@/types";

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
  search(query: string, ...args: any[]): Promise<IBaseRes<unknown>> {
    throw new Error("Method not implemented.");
  }
  tags(...args: any | any[]): Promise<IBaseRes<unknown>> {
    throw new Error("Method not implemented.");
  }
  users(...args: any | any[]): Promise<unknown> {
    throw new Error("Method not implemented.");
  }
}