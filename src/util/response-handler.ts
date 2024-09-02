import { IBaseRes } from "@/types";

export async function handleResponse<T>(response: Response, url: string, successCB: () => Promise<IBaseRes<T>> | IBaseRes<T>): Promise<IBaseRes<T>> {
  switch (response.status) {
    case 200:
      return await successCB();
    case 400:
      throw new Error(`400 Bad Request! Attempted URL: ${url}`);
    case 403:
      throw new Error(`403 Forbidden! Attempted URL: ${url}`);
    case 404:
      throw new Error(`404 Not Found! Attempted URL: ${url}`);
    case 410:
      throw new Error(`410 Gone! This usually means you've hit the pagination limit. Attempted URL: ${url}`);
    case 421:
      throw new Error("You are being throttled by the server. Please try again later!");
    case 424:
      throw new Error(`Invalid parameters! Query passed in: ${url}`);
    case 500:
      throw new Error("500 Internal Server Error! Please try again later.");
    case 503:
      throw new Error("503 Service Unavailable! Please try again later.");
    default:
      throw new Error(`Unknown error occurred! Status: ${response.status}`);
  }
}
