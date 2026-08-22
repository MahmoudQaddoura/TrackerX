/**
 * Document workspace definitions.
 *
 * TrackerX stores the richer collection/category placement inside the existing
 * document description field. That keeps this workflow compatible with the
 * current API and database while milestone links use the API's real
 * `milestone_id` relationship.
 */
import type { DocumentCategory, DocumentMeta } from "@/types";

export type DocumentCollectionKey = "project" | "operations";
export type DocumentFolderKey =
  | "asset_inventory"
  | "technical_manual"
  | "software_manual"
  | "code_update"
  | "updates"
  | "credentials"
  | "testing"
  | "incidents"
  | "kpi"
  | "client_report"
  | "nodes";

export interface DocumentCollectionDefinition {
  key: DocumentCollectionKey;
  label: string;
  shortLabel: string;
  description: string;
}

export interface DocumentFolderDefinition {
  key: DocumentFolderKey;
  label: string;
  description: string;
}

export const DOCUMENT_COLLECTIONS: DocumentCollectionDefinition[] = [
  {
    key: "project",
    label: "Actual Project Documents",
    shortLabel: "Actual Project",
    description: "Delivery records, technical references, and project evidence.",
  },
  {
    key: "operations",
    label: "Maintenance & Support",
    shortLabel: "Maintenance & Support",
    description: "Service continuity, support, maintenance, and operational records.",
  },
];

const SHARED_FOLDERS = {
  asset_inventory: {
    key: "asset_inventory",
    label: "Asset Inventory",
    description: "Hardware, software, licenses, ownership, and supplier records.",
  },
  technical_manual: {
    key: "technical_manual",
    label: "Technical Manual",
    description: "Architecture, environments, deployment, configuration, and technical procedures.",
  },
  software_manual: {
    key: "software_manual",
    label: "Software Manual",
    description: "Application setup, user guidance, administration, and software procedures.",
  },
  credentials: {
    key: "credentials",
    label: "Credentials",
    description: "Account ownership, access handovers, and approved vault references.",
  },
  testing: {
    key: "testing",
    label: "Testing",
    description: "Test plans, QA results, acceptance evidence, and sign-offs.",
  },
  nodes: {
    key: "nodes",
    label: "Nodes",
    description: "Blockchain node configuration, RPC endpoints, networks, validators, health, and operational records.",
  },
} satisfies Partial<Record<DocumentFolderKey, DocumentFolderDefinition>>;

export const DOCUMENT_FOLDERS_BY_COLLECTION: Record<
  DocumentCollectionKey,
  DocumentFolderDefinition[]
> = {
  project: [
    SHARED_FOLDERS.asset_inventory,
    SHARED_FOLDERS.technical_manual,
    SHARED_FOLDERS.software_manual,
    {
      key: "code_update",
      label: "Code Update",
      description: "Source-code releases, change logs, patches, migration notes, and rollback plans.",
    },
    SHARED_FOLDERS.credentials,
    SHARED_FOLDERS.testing,
    SHARED_FOLDERS.nodes,
  ],
  operations: [
    SHARED_FOLDERS.asset_inventory,
    SHARED_FOLDERS.technical_manual,
    SHARED_FOLDERS.software_manual,
    {
      key: "updates",
      label: "Updates",
      description: "Maintenance releases, patches, change records, and operational updates.",
    },
    SHARED_FOLDERS.credentials,
    SHARED_FOLDERS.testing,
    {
      key: "incidents",
      label: "Incidents",
      description: "Incident reports, root-cause analysis, and corrective actions.",
    },
    {
      key: "kpi",
      label: "KPI",
      description: "Service targets, operational measures, trends, and KPI reports.",
    },
    {
      key: "client_report",
      label: "Client Report",
      description: "Client-facing service reports, summaries, recommendations, and sign-offs.",
    },
    SHARED_FOLDERS.nodes,
  ],
};

const PLACEMENT_PREFIX = "[trackerx-document]";
const PLACEMENT_PATTERN =
  /^\[trackerx-document\]\s+collection=(project|operations);\s+folder=([a-z_]+);/;

const STORAGE_CATEGORY_BY_FOLDER: Record<DocumentFolderKey, DocumentCategory> = {
  asset_inventory: "business",
  technical_manual: "technical",
  software_manual: "technical",
  code_update: "technical",
  updates: "technical",
  credentials: "technical",
  testing: "technical",
  incidents: "meeting_minutes",
  kpi: "business",
  client_report: "business",
  nodes: "technical",
};

export function getDocumentFolders(collection: DocumentCollectionKey): DocumentFolderDefinition[] {
  return DOCUMENT_FOLDERS_BY_COLLECTION[collection];
}

export function getDocumentFolder(
  collection: DocumentCollectionKey,
  folderKey: DocumentFolderKey,
): DocumentFolderDefinition | undefined {
  return getDocumentFolders(collection).find((folder) => folder.key === folderKey);
}

export function getStorageCategory(folder: DocumentFolderKey): DocumentCategory {
  return STORAGE_CATEGORY_BY_FOLDER[folder];
}

export function encodeDocumentPlacement(
  collection: DocumentCollectionKey,
  folder: DocumentFolderKey,
): string {
  return `${PLACEMENT_PREFIX} collection=${collection}; folder=${folder};`;
}

function normalizeLegacyFolder(
  collection: DocumentCollectionKey,
  folder: string,
): DocumentFolderKey {
  if (folder === "operations_server") return "technical_manual";
  if (folder === "notes") return "nodes";
  if (folder === "performance") return collection === "operations" ? "kpi" : "nodes";
  if (folder === "updates" && collection === "project") return "code_update";
  if (folder === "incidents" && collection === "project") return "nodes";

  const availableFolder = getDocumentFolders(collection).find((item) => item.key === folder);
  return availableFolder?.key ?? "nodes";
}

export function getDocumentPlacement(document: DocumentMeta): {
  collection: DocumentCollectionKey;
  folder: DocumentFolderKey;
} {
  const match = document.description?.match(PLACEMENT_PATTERN);
  if (match) {
    const collection = match[1] as DocumentCollectionKey;
    return { collection, folder: normalizeLegacyFolder(collection, match[2]) };
  }

  // Documents created before the workspace upgrade stay visible in the Actual
  // Project collection instead of disappearing.
  return { collection: "project", folder: "nodes" };
}
