/** lib/documentFolders.ts — the three fixed document categories/folders. */
import type { DocumentCategory } from "@/types";

export const DOCUMENT_FOLDERS: { key: DocumentCategory; label: string; description: string }[] = [
  { key: "technical", label: "Technical Documentation", description: "Specs, diagrams, design docs" },
  { key: "meeting_minutes", label: "Meeting Minutes", description: "Notes and action items" },
  { key: "business", label: "Business Documents", description: "Proposals, contracts, reports" },
];
