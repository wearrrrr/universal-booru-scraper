import providers from "./providers";

const provider = new providers.Moebooru("https://konachan.net");


let tags = await provider.tags({
  name: "yakumo_ran",
});

console.log(tags);