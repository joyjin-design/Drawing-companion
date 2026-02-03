export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}
