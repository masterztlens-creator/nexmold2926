import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { invariant } from "../constitution/invariants.js";
import { InMemoryFoundationStore } from "./store.js";
import type { AggregateType, FoundationRecord, FoundationStore } from "./types.js";

export class JsonlFoundationStore implements FoundationStore {
  private readonly memory = new InMemoryFoundationStore();
  private loaded = false;

  constructor(private readonly filePath: string) {}

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (!existsSync(this.filePath)) return;
    const text = readFileSync(this.filePath, "utf8");
    for (const line of text.split(/\r?\n/).filter(Boolean)) {
      const record = JSON.parse(line) as FoundationRecord;
      this.replay(record);
    }
    this.memory.verifyChain();
  }

  private replay(record: FoundationRecord): void {
    const { recordId: _recordId, ...input } = record;
    const rebuilt = this.memory.append(input as Omit<FoundationRecord, "recordId" | "fingerprint" | "recordedAt"> & { recordedAt?: string });
    invariant(rebuilt.recordId === record.recordId && rebuilt.fingerprint === record.fingerprint, "V8_FOUNDATION_PERSISTED_RECORD_INVALID", `Persisted record ${record.recordId} failed integrity validation.`);
  }

  append<T>(record: Omit<FoundationRecord<T>, "recordId" | "fingerprint" | "recordedAt">): FoundationRecord<T> {
    this.load();
    mkdirSync(dirname(this.filePath), { recursive: true });
    const created = this.memory.append(record);
    appendFileSync(this.filePath, `${JSON.stringify(created)}\n`, { encoding: "utf8", flag: "a" });
    return created;
  }

  get<T>(aggregateType: AggregateType, aggregateId: string, version?: number): FoundationRecord<T> | null {
    this.load();
    return this.memory.get<T>(aggregateType, aggregateId, version);
  }

  history(aggregateType: AggregateType, aggregateId: string): readonly FoundationRecord[] {
    this.load();
    return this.memory.history(aggregateType, aggregateId);
  }

  auditTrail(): readonly FoundationRecord[] {
    this.load();
    return this.memory.auditTrail();
  }

  verifyChain(): void {
    this.load();
    this.memory.verifyChain();
  }
}
