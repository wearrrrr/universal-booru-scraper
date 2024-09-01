export function objToURLParams(tagRequest: Partial<any>): string {
  let urlParams = Object.entries(tagRequest)
    .filter(([_, value]) => value !== null && value !== "")
    .map(([key, value]) => `&${key}=${value}`)
    .join("");
  return urlParams;
}
