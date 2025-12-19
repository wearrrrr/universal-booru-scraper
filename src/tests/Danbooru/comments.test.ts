import { describe, expect, test } from "@jest/globals";
import { provider } from "../danbooru_setup";

describe("Danbooru Comments", () => {
  test("returns comments for a specific post", async () => {
    const comments = await provider.comments(1, { limit: 1 });

    expect(Array.isArray(comments.results)).toBe(true);
    expect(comments.results.length).toBeGreaterThan(0);

    const comment = comments.results[0];
    expect(comment).toHaveProperty("id");
    expect(comment).toHaveProperty("created_at");
    expect(comment).toHaveProperty("post_id");
    expect(comment).toHaveProperty("creator_id");
    expect(comment).toHaveProperty("body");
  });
});
