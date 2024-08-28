import { expect, test, describe } from "@jest/globals"
import { provider } from "../setup";

describe("Moebooru Tags", () => {
  test("Can retrieve related tags from Moebooru", async () => {
    let tags = await provider.tags_related("yakumo_ran", "character");
    expect(tags).toBeDefined();
    expect(tags.results).toHaveProperty("yakumo_ran");
    expect(tags.results.yakumo_ran.length).toBeGreaterThan(0);
  });
})