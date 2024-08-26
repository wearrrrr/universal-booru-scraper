import providers from "./providers";

const provider = new providers.Moebooru("https://konachan.net");
let data = await provider.search("nekomata_okayu", {
  questionable: false,
  explicit: false,
})
console.log(data)