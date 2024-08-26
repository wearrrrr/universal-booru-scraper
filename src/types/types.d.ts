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