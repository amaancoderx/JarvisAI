import { Firestore } from "@google-cloud/firestore";

let db: Firestore | null = null;
/** Firestore in the project, using Cloud Run's own identity. Off when not on Google Cloud. */
export function firestore(): Firestore | null {
  if (!process.env.VERTEX_PROJECT && !process.env.FIRESTORE_PROJECT) return null;
  db ??= new Firestore({ projectId: process.env.FIRESTORE_PROJECT || process.env.VERTEX_PROJECT, ignoreUndefinedProperties: true });
  return db;
}
