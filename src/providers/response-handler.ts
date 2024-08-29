export async function handleResponse(response: Response, url: string, successCB: Function): Promise<any> {
  switch (response.status) {
    case 200:
      return await successCB();
    case 403:
      throw new Error("403 Forbidden! Please check your URL and try again.");
    case 404:
      throw new Error("404 Not Found!");
    case 421:
      throw new Error("You are being throttled by the server. Please try again later!");
    case 424:
      throw new Error(`Invalid parameters! Query passed in: ${url}`);
    case 500:
      throw new Error("500 Internal Server Error! Please try again later.");
    case 503:
      throw new Error("503 Service Unavailable! Please try again later.");
  }
}