import { expect, test, describe } from "@jest/globals";
import { provider } from "../moebooru_setup";

describe("Moebooru Related Tags", () => {
  test("Can retrieve related tags from Moebooru", async () => {
    let tags = await provider.tags_related("yakumo_ran", "character");
    expect(tags).toBeDefined();
    expect(tags.results).toHaveProperty("yakumo_ran");
    expect(tags.totalResults).toBeGreaterThan(0);
  });
});
