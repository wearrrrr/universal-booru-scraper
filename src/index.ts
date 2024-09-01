import providers from "./providers";

const provider = new providers.Moebooru("https://konachan.net/");

provider.login({
  username: "wearr",
  api_key: "i7RU56UMvEnK1r-fGjWWew",
});

const user = await provider.users({
  id: 315784,
});
console.log(user.results);
