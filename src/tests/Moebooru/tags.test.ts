import { expect, test, describe } from "@jest/globals";
import { provider } from "../moebooru_setup";

describe("Moebooru Tags", () => {
  test("Can retrieve tags from Moebooru", async () => {
    let tags = await provider.tags({
      name: "yakumo_ran",
      limit: 10,
    });
    expect(tags.results[0]).toHaveProperty("id");
    expect(tags.results[0]).toHaveProperty("name");
    expect(tags.totalResults).toBeGreaterThan(0);
  });
});
