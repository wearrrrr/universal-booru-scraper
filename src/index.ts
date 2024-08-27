import providers from "./providers";

const provider = new providers.Moebooru("https://konachan.net");
let search = await provider.search("nekomata_okayu", {
  questionable: false,
  explicit: false,
  limit: 25,
})
if (search.posts.length === 0) {
  throw new Error("No data returned from search!");
}

let tags = await provider.tags({
  name: "yakumo_ran",
});

console.log(tags);