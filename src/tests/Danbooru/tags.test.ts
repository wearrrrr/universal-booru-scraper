import { describe, expect, test } from "@jest/globals";
import { provider } from "../danbooru_setup";

describe("Danbooru Tags", () => {
  test("returns metadata for a specific tag", async () => {
    const tags = await provider.tags("hololive", {
      limit: 1,
    });

    expect(Array.isArray(tags.results)).toBe(true);
    expect(tags.totalResults).toBeGreaterThan(0);

    const tag = tags.results[0];
    expect(tag).toHaveProperty("id");
    expect(tag).toHaveProperty("name", "hololive");
    expect(tag).toHaveProperty("post_count");
    expect(tag).toHaveProperty("category");
  });
});
