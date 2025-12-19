import { describe, expect, test } from "@jest/globals";
import { provider } from "../danbooru_setup";

describe("Danbooru Autocomplete", () => {
  test("returns tag suggestions for a query fragment", async () => {
    const autocomplete = await provider.autocomplete("holo");

    expect(autocomplete.totalResults).toBeGreaterThan(0);
    expect(Array.isArray(autocomplete.results)).toBe(true);

    const first = autocomplete.results[0];
    expect(first).toHaveProperty("label");
    expect(first).toHaveProperty("value");
    expect(first).toHaveProperty("category");
    expect(first).toHaveProperty("post_count");
  });
});
