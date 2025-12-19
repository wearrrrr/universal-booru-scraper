import { beforeAll } from "@jest/globals";
import providers from "@/providers";
import { GelbooruProvider } from "@/providers/gelbooru";
import "dotenv/config";

export let provider: GelbooruProvider;

beforeAll(() => {
  provider = new providers.Gelbooru("https://gelbooru.com");

  provider.login({
    username: process.env.GELBOORU_USERNAME,
    api_key: process.env.GELBOORU_API_KEY,
  });
});
