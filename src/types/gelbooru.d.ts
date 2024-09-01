export namespace Gelbooru {
  // The tag parameter comes from the query parameter into the search function.
  export type SearchOpt = {
    page: number;
    limit: number;
    cid: number;
    id: number;
  };
}
