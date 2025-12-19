import { expect, test, describe } from "@jest/globals";
import { provider } from "../gelbooru_setup";

describe("Gelbooru Tags", () => {
  test("Can get tags from Gelbooru", async () => {
    let tags = await provider.tags({
      name: "yakumo_ran",
      limit: 10,
    });
    const tag = tags.results.tag[0];
    expect(tags.results).toHaveProperty("tag");
    expect(tag).toHaveProperty("type");
    expect(tag).toHaveProperty("count");
    expect(tag).toHaveProperty("name");
    expect(tag.name).toBe("yakumo_ran");
    expect(tag).toHaveProperty("ambiguous");
    expect(tag).toHaveProperty("id");
    expect(tags.totalResults).toBeGreaterThan(0);
  });
});
