import { beforeAll } from "@jest/globals";
import providers from "@lib/providers";
import { GelbooruProvider } from "@lib/providers/gelbooru";
import "dotenv/config";

export let provider: GelbooruProvider;

beforeAll(() => {
  provider = new providers.Gelbooru("https://gelbooru.com");

  provider.login({
    username: process.env.GELBOORU_USERNAME,
    api_key: process.env.GELBOORU_API_KEY,
  });
});
