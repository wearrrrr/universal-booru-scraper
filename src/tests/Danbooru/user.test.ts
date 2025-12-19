import { describe, expect, test } from "@jest/globals";
import { provider } from "../danbooru_setup";

describe("Danbooru User", () => {
  test("can fetch a user by ID", async () => {
    const users = await provider.user({ id: 1 });

    expect(Array.isArray(users.results)).toBe(true);
    expect(users.totalResults).toBeGreaterThan(0);

    const user = users.results[0];
    expect(user).toHaveProperty("id", 1);
    expect(user).toHaveProperty("name");
    expect(user).toHaveProperty("level");
  });
});
