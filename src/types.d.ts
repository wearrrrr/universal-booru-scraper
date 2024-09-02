export interface Provider {
  name: string;
  baseURL: string;
  languages: string | string[];
  loginDetails: LoginDetails;
  login(loginDetails: Partial<LoginDetails>): void;
  search(query: string, opts: any): Promise<any>;
  tags(...args: any | any[]): Promise<IBaseRes<any>>;
  toString: ProviderStats;
}

type ProviderStats = {
  name: string;
  baseURL: string;
  languages: string[] | string;
};

// https://github.com/consumet/consumet.ts/blob/c13c085583c31319e54c527da2dc3619eda7cd24/src/models/types.ts#L35
export interface ISearch<T> {
  currentPage?: number;
  hasNextPage?: boolean;
  totalPages?: number;
  /**
   * total results must include results from all pages
   */
  totalResults?: number;
  results: T[];
}

export interface IBaseRes<T> {
  results: T;
  totalResults: number;
  wasXML?: boolean;
}

export type LoginDetails = {
  username?: string;
  api_key?: string;
};
