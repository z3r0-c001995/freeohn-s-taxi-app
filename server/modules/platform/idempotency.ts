import { platformStore } from "./store";

export async function withIdempotency<T>(
  action: string,
  key: string | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  if (!key) {
    return operation();
  }

  const existing = platformStore.getIdempotency(action, key);
  if (existing) {
    return existing.response as T;
  }

  const response = await operation();
  platformStore.saveIdempotency({
    action,
    key,
    response,
    createdAt: new Date().toISOString(),
  });
  return response;
}

