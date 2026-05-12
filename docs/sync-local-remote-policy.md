# Política local vs remoto (Quanty)

## Fuente de verdad

- **Supabase** es la fuente de verdad para entidades con **id UUID** (v4) creadas o sincronizadas desde el servidor.
- **Persist local** (Zustand + `localStorage` con clave por usuario) actúa como **caché y colchón offline**: conserva estado entre sesiones y permite trabajo sin red hasta que falle una operación remota explícita.

## Sincronización (`sync*FromRemote`)

Tras cada bootstrap o llamada manual a sync, los módulos híbridos aplican la **misma regla**:

1. Se obtiene la lista **activa** desde el repositorio (respeta RLS y soft delete en servidor).
2. Se **fusiona** con las filas locales cuyo `id` **no** se considera “remoto” (no es UUID v4 según `isRemote*Id` del módulo).
3. El resultado es `[...remoto, ...soloLocal]`.

Implementación compartida: `src/lib/merge-remote-with-local-legacy.ts`.

### Módulos afectados

| Módulo       | Detector legacy         | Store                                                                  |
| ------------ | ----------------------- | ---------------------------------------------------------------------- |
| Clientes     | `isRemoteClientId`      | `syncClientsFromRemote`                                                |
| Productos    | `isRemoteProductId`     | `syncProductsFromRemote`                                               |
| Cotizaciones | `isRemoteQuoteId`       | `syncQuotesFromRemote` (+ `counter` recalculado con folios fusionados) |
| Gastos       | `isRemoteExpenseId`     | `syncExpensesFromRemote`                                               |
| Agenda       | `isRemoteAgendaEventId` | `syncAgendaFromRemote`                                                 |

## Entidades legacy

- **Definición:** cualquier registro cuyo `id` **no** cumple el patrón UUID remoto (p. ej. `c-173…`, `ev-173…`, `e-173…`).
- **Origen:** creación **solo local** (sin sesión, error de red, o fallback tras fallo remoto).
- **Persistencia:** se guardan en el mismo slice persistido que los remotos; **no se pierden** al hacer sync exitoso.

## Migración automática a remoto

**No implementada** de forma masiva: migrar en bloque implicaría crear duplicados en servidor o heurísticas frágiles (nombre, folio, etc.). La app confía en que el usuario:

- cree nuevos registros vía flujo remoto (`*OnRemote`), o
- edite/elimine el legacy manualmente.

## Riesgos residuales

1. **Duplicados lógicos:** el mismo concepto puede existir como fila local y otra remota con distintos ids hasta que el usuario limpie.
2. **Referencias cruzadas:** una cotización local puede apuntar a `productId` local; los remotos esperan UUID de producto — los flujos UI ya priorizan remoto cuando aplica.
3. **Sync fallido:** si el servidor no responde, la lista no se actualiza; los datos locales (incl. legacy) siguen visibles.
4. **Cambio de cuenta:** el persist está **scoped por `user_id`**; no se mezclan datos entre cuentas en el mismo navegador, salvo bugs de sesión ajenos a esta política.

## Bootstrap

`rehydrateThenBootstrapRemoteModules` ejecuta los sync en paralelo; cada uno aplica el merge anterior sin reinyectar seeds: el estado inicial remoto viene solo de Supabase + merge con lo ya hidratado del persist del usuario actual.
