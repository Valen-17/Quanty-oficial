// Une los datos remotos con los que solo existen en local.
export function mergeRemoteWithLocalLegacy<T extends { id: string }>(
  remote: T[],
  current: T[],
  isRemoteEntityId: (id: string) => boolean,
): T[] {
  const localOnly = current.filter((item) => !isRemoteEntityId(item.id));
  return [...remote, ...localOnly];
}
