export const QUEUE_NAMES = {
  outbox: "pgkhata-outbox",
  billing: "pgkhata-billing",
  notifications: "pgkhata-notifications",
  backups: "pgkhata-backups",
} as const;

export type OutboxJob = { eventId: string };
