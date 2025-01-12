import providers from "./providers";
import "dotenv/config";


const provider = new providers.Moebooru("https://konachan.net/");

provider.login({
  username: process.env.MOEBOORU_USERNAME,
  api_key: process.env.MOEBOORU_API_KEY,
});

const user = await provider.user({
  id: 315784,
});

console.log(user.results, user.totalResults);
