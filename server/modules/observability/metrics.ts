const counters = new Map<string, number>();
const gauges = new Map<string, number>();

export function incrementMetric(name: string, amount = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + amount);
}

export function setGauge(name: string, value: number): void {
  gauges.set(name, value);
}

export function collectMetrics() {
  return {
    counters: Object.fromEntries(counters.entries()),
    gauges: Object.fromEntries(gauges.entries()),
    timestamp: new Date().toISOString(),
  };
}

