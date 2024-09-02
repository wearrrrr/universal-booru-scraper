import { expect, test, describe } from "@jest/globals";
import { provider } from "../gelbooru_setup";

describe("Gelbooru Tags", () => {
  test("Can get tags from Gelbooru", async () => {
    let tags = await provider.tags({
      name: "yakumo_ran",
      limit: 10,
    });
    expect(tags.results).toHaveProperty("tag");
    expect(tags.totalResults).toBeGreaterThan(0);
    console.log(tags.results)
  });
});