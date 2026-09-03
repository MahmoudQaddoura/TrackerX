/** api/assets.ts — project asset registry and port-level network rules. */
import { api } from "@/lib/apiClient";
import type {
  AssetConnection,
  AssetConnectionStatus,
  AssetEnvironment,
  AssetMatrix,
  AssetPort,
  AssetProtocol,
  AssetStatus,
  ProjectAsset,
} from "@/types";

export interface AssetPayload {
  hostname: string;
  ip_address: string;
  environment: AssetEnvironment;
  purpose?: string | null;
  tier?: string | null;
  os?: string | null;
  cpu?: string | null;
  ram?: string | null;
  storage?: string | null;
  applications?: string | null;
  database?: string | null;
  services?: string | null;
  status: AssetStatus;
  notes?: string | null;
}

export interface AssetPortPayload {
  port: number;
  protocol: AssetProtocol;
  service: string;
  notes?: string | null;
}

export async function fetchAssets(
  projectId: number,
  environment?: AssetEnvironment,
  search?: string,
): Promise<ProjectAsset[]> {
  const { data } = await api.get<ProjectAsset[]>(`/projects/${projectId}/assets`, {
    params: { environment: environment || undefined, search: search || undefined },
  });
  return data;
}

export async function exportAssetInventoryPdf(projectId: number): Promise<Blob> {
  const { data } = await api.get<Blob>(`/projects/${projectId}/assets/export/pdf`, {
    responseType: "blob",
  });
  return data;
}

export async function createAsset(
  projectId: number,
  payload: AssetPayload,
): Promise<ProjectAsset> {
  const { data } = await api.post<ProjectAsset>(`/projects/${projectId}/assets`, payload);
  return data;
}

export async function updateAsset(
  assetId: number,
  payload: Partial<AssetPayload>,
): Promise<ProjectAsset> {
  const { data } = await api.put<ProjectAsset>(`/assets/${assetId}`, payload);
  return data;
}

export async function deleteAsset(assetId: number): Promise<void> {
  await api.delete(`/assets/${assetId}`);
}

export async function createAssetPort(
  assetId: number,
  payload: AssetPortPayload,
): Promise<AssetPort> {
  const { data } = await api.post<AssetPort>(`/assets/${assetId}/ports`, payload);
  return data;
}

export async function deleteAssetPort(portId: number): Promise<void> {
  await api.delete(`/asset-ports/${portId}`);
}

export async function fetchAssetMatrix(
  projectId: number,
  environment: AssetEnvironment,
): Promise<AssetMatrix> {
  const { data } = await api.get<AssetMatrix>(`/projects/${projectId}/asset-matrix`, {
    params: { environment },
  });
  return data;
}

export async function setAssetConnection(
  portId: number,
  sourceAssetId: number,
  status: AssetConnectionStatus,
): Promise<AssetConnection> {
  const { data } = await api.put<AssetConnection>(
    `/asset-ports/${portId}/connections/${sourceAssetId}`,
    { status },
  );
  return data;
}
