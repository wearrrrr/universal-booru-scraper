import { expect, test, describe } from "@jest/globals";
import { provider } from "../moebooru_setup";

describe("Moebooru User", () => {
  test("Can retrieve user from Moebooru", async () => {
    let user = await provider.user({
      name: "wearr",
      loginRequirement: false,
    });

    expect(user.results[0]).toHaveProperty("id");
    expect(user.results[0]).toHaveProperty("name");
    expect(user.results[0]).toHaveProperty("blacklisted_tags");
    expect(user.totalResults).toBeGreaterThan(0);
  });
});
