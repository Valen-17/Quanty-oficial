/**
 * Fusiona datos remotos (Supabase, fuente de verdad para UUID) con entidades
 * que solo existen en el persist local (ids que no pasan `isRemoteEntityId`).
 *
 * - Las filas devueltas por el servidor sustituyen/actualizan por id en `remote`.
 * - Las locales legacy se conservan hasta que el usuario las migre (p. ej. creando
 *   un registro remoto equivalente) o las elimine manualmente.
 *
 * Riesgo conocido: si el mismo concepto existía como local y luego como remoto
 * con ids distintos, pueden coexistir dos filas hasta limpieza manual.
 */
export function mergeRemoteWithLocalLegacy<T extends { id: string }>(
  remote: T[],
  current: T[],
  isRemoteEntityId: (id: string) => boolean,
): T[] {
  const localOnly = current.filter((item) => !isRemoteEntityId(item.id));
  return [...remote, ...localOnly];
}
