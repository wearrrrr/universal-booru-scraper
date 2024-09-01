import { beforeAll } from "@jest/globals";
import providers from "@/providers";
import { MoebooruProvider } from "@/providers/moebooru";

let provider: MoebooruProvider;
beforeAll(() => {
  provider = new providers.Moebooru("https://konachan.net");
});

export { provider };
