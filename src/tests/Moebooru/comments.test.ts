import { expect, test, describe } from "@jest/globals";
import { provider } from "../moebooru_setup";

describe("Moebooru Comments", () => {
  test("Can retrieve moebooru comment from ID", async () => {
    let comment = await provider.comments({
        id: 190716
    });
    expect(comment.totalResults).toBeGreaterThan(0);
    if (comment.results[0]) {
        expect(comment.results[0]).toHaveProperty("id");
        expect(comment.results[0]).toHaveProperty("created_at");
        expect(comment.results[0]).toHaveProperty("creator");
        expect(comment.results[0]).toHaveProperty("creator_id");
        expect(comment.results[0]).toHaveProperty("body");
    } else {
        expect(comment.results).toHaveProperty("id");
        expect(comment.results).toHaveProperty("created_at");
        expect(comment.results).toHaveProperty("creator");
        expect(comment.results).toHaveProperty("creator_id");
        expect(comment.results).toHaveProperty("body");
    }

  });
});
