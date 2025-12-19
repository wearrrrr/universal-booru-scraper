import { beforeAll } from "@jest/globals";
import providers from "@lib/providers";
import { MoebooruProvider } from "@lib/providers/moebooru";

let provider: MoebooruProvider;
beforeAll(() => {
  provider = new providers.Moebooru("https://konachan.net");
});

export { provider };
