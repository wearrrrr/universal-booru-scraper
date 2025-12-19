import { expect, test, describe } from "@jest/globals";
import { provider } from "../moebooru_setup";

describe("Moebooru Search", () => {
  test("Can search Moebooru and get proper results back", async () => {
    let search = await provider.search("yakumo_ran", {
      limit: 10,
    });
    expect(search.results).toHaveProperty("posts");
    // If this passes then surely it's a valid post :clueless:
    expect(search.results.posts[0]).toHaveProperty("id");
    expect(search.totalResults).toBe(10);
  });
});
