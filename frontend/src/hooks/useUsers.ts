/** hooks/useUsers.ts — admin account list + creation. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createUser, fetchUsers, type UserCreatePayload } from "@/api/users";

export function useUsers(enabled = true) {
  return useQuery({ queryKey: ["users"], queryFn: fetchUsers, enabled });
}

export function useUserMutations() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (p: UserCreatePayload) => createUser(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
  return { create };
}
