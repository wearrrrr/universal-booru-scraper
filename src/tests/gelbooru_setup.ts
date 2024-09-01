import { beforeAll } from "@jest/globals";
import providers from "@/providers";
import { GelbooruProvider } from "@/providers/gelbooru";

export let provider: GelbooruProvider;

beforeAll(() => {
  provider = new providers.Gelbooru("https://gelbooru.com");
});
