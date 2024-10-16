import { expect, test, describe } from "@jest/globals";
import { provider } from "../gelbooru_setup";

describe("Gelbooru Comments", () => {
  test("Can fetch comments based on a post ID", async () => {
    let search = await provider.comments("11073060", {
      limit: 10,
    });
    const comment = search.results.comments[0];    
    // @ts-ignore
    expect(search.results).toHaveProperty("comments");
    expect(comment).toHaveProperty("created_at");
    expect(comment).toHaveProperty("post_id");
    expect(comment).toHaveProperty("body");
    expect(comment).toHaveProperty("creator");
    expect(comment).toHaveProperty("id");
    expect(comment).toHaveProperty("creator_id");
  });
});