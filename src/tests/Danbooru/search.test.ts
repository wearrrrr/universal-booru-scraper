import { describe, expect, test } from "@jest/globals";
import { provider } from "../danbooru_setup";

describe("Danbooru Search", () => {
  test("returns posts for a basic query", async () => {
    const search = await provider.search("hololive", {
      limit: 5,
    });

    expect(search.totalResults).toBeGreaterThan(0);

    const posts = Array.isArray(search.results)
      ? search.results
      : [search.results].filter(Boolean);

    expect(posts.length).toBeGreaterThan(0);
    expect(posts[0]).toHaveProperty("id");
  });
});
