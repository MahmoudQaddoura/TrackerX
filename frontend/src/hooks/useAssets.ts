/** hooks/useAssets.ts — project asset registry queries and mutations. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAsset,
  createAssetPort,
  deleteAsset,
  deleteAssetPort,
  fetchAssetMatrix,
  fetchAssets,
  setAssetConnection,
  updateAsset,
  type AssetPayload,
  type AssetPortPayload,
} from "@/api/assets";
import type { AssetConnectionStatus, AssetEnvironment } from "@/types";

export function useAssets(
  projectId: number,
  environment?: AssetEnvironment,
  search?: string,
) {
  return useQuery({
    queryKey: ["assets", projectId, environment ?? "all", search ?? ""],
    queryFn: () => fetchAssets(projectId, environment, search),
  });
}

export function useAssetMatrix(projectId: number, environment: AssetEnvironment) {
  return useQuery({
    queryKey: ["asset-matrix", projectId, environment],
    queryFn: () => fetchAssetMatrix(projectId, environment),
  });
}

export function useAssetMutations(projectId: number) {
  const queryClient = useQueryClient();
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["assets", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["asset-matrix", projectId] }),
    ]);
  };

  return {
    createAsset: useMutation({
      mutationFn: (payload: AssetPayload) => createAsset(projectId, payload),
      onSuccess: invalidate,
    }),
    updateAsset: useMutation({
      mutationFn: ({ id, payload }: { id: number; payload: Partial<AssetPayload> }) =>
        updateAsset(id, payload),
      onSuccess: invalidate,
    }),
    deleteAsset: useMutation({ mutationFn: deleteAsset, onSuccess: invalidate }),
    createPort: useMutation({
      mutationFn: ({ assetId, payload }: { assetId: number; payload: AssetPortPayload }) =>
        createAssetPort(assetId, payload),
      onSuccess: invalidate,
    }),
    deletePort: useMutation({ mutationFn: deleteAssetPort, onSuccess: invalidate }),
    setConnection: useMutation({
      mutationFn: ({
        portId,
        sourceAssetId,
        status,
      }: {
        portId: number;
        sourceAssetId: number;
        status: AssetConnectionStatus;
      }) => setAssetConnection(portId, sourceAssetId, status),
      onSuccess: invalidate,
    }),
  };
}
