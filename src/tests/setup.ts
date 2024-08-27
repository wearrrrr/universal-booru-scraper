import { beforeAll } from "@jest/globals";
import providers from "@/providers";

let provider = new providers.Moebooru("https://konachan.net");
beforeAll(() => {
  provider = new providers.Moebooru("https://konachan.net");
});

export { provider };