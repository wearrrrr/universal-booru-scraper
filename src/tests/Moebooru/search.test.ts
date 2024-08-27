import { expect, test, describe } from "@jest/globals"
import { provider } from "../setup";

describe("Moebooru Search", () => {
  test("Can search Moebooru and get proper results back", async () => {
    let search = await provider.search("yakumo_ran", { 
      limit: 10
    });
    expect(search).toHaveProperty("posts");
    // If this passes then surely it's a valid post :clueless:
    expect(search.posts[0]).toHaveProperty("id");
    expect(search.posts.length).toBe(10);
  });
});