/** Check the HTTP status before treating a JSON response as successful data. */
export async function readApiResponse<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    const message = typeof data?.error === "string" && data.error.length < 220 && !/prisma|stack|SELECT |ECONN|\/src\//i.test(data.error) ? data.error : fallback;
    throw new Error(message);
  }
  return data as T;
}
