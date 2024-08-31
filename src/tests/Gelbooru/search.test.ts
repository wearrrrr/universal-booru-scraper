import { expect, test, describe } from "@jest/globals"
import { provider } from "../gelbooru_setup";

describe("Gelbooru Search", () => {
  test("Can search Gelbooru and get proper results back", async () => {
    let search = await provider.search("yakumo_ran", { 
      limit: 10
    });
    expect(search.results).toHaveProperty("post");
    // If this passes then surely it's a valid post :clueless:
    expect(search.results.post[0]).toHaveProperty("id");
    expect(search.totalResults).toBe(10);
  });
});