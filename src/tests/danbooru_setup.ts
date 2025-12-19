import { beforeAll } from "@jest/globals";
import providers from "@/providers";
import { DanbooruProvider } from "@/providers/danbooru";
import "dotenv/config";

export let provider: DanbooruProvider;

beforeAll(() => {
  provider = new providers.Danbooru("https://danbooru.donmai.us");

  provider.login({
    username: process.env.DANBOORU_USERNAME,
    api_key: process.env.DANBOORU_API_KEY,
  });
});
