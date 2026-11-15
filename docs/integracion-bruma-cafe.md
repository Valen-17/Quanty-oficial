# Integración Quanty ↔ Bruma Café

Contrato de la API REST que Quanty expone para que una tienda externa (Bruma Café) envíe su catálogo de productos y sus contactos. Ambos equipos solo comparten este contrato; cada uno escribe su propio código.

## Flujo

1. En Quanty, el usuario abre **Configuración → Integraciones**, escribe un nombre y pulsa **Generar clave**. La clave (`qk_…`) se muestra una sola vez.
2. En Bruma Café, el usuario pega la clave en su interfaz. Bruma la guarda en `localStorage` del navegador; la clave nunca se sube al repositorio.
3. Bruma envía sus productos y contactos con `POST` al endpoint.
4. En Quanty, el usuario pulsa **Traer datos importados** (o recarga) y los ve en Inventario y Clientes.

Quanty solo guarda el hash SHA-256 de la clave. Cada clave pertenece a un usuario y solo escribe en sus datos. Revocar la clave en Configuración la desactiva de inmediato.

## Endpoint

| Campo       | Valor                                                    |
| ----------- | -------------------------------------------------------- |
| URL base    | `https://dnhpjwyaotdyhpialqlk.supabase.co/functions/v1`  |
| Endpoint    | `/catalog-import`                                        |
| Métodos     | `GET` (probar la clave), `POST` (importar)               |
| Encabezados | `x-api-key: qk_…` y `Content-Type: application/json`     |
| CORS        | Abierto a cualquier origen (la autorización es la clave) |
| Límites     | Cuerpo de máximo 1 MB y máximo 500 elementos por lista   |

## Probar la clave

```http
GET /functions/v1/catalog-import
x-api-key: qk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Respuesta `200`:

```json
{ "ok": true }
```

## Importar

```http
POST /functions/v1/catalog-import
x-api-key: qk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

```json
{
  "source": "bruma-cafe",
  "productos": [
    {
      "id": 1,
      "nombre": "Sierra Dulce",
      "precio": 42000,
      "cantidad": 12,
      "categoria": "Grano",
      "imagen": "https://usuario.github.io/bruma-cafe/assets/sierra-dulce.jpg"
    }
  ],
  "contactos": [
    {
      "id": "0b6f1c8e-6a7d-4d0b-9c1e-2f3a4b5c6d7e",
      "nombre": "Laura Gómez",
      "email": "laura@example.com",
      "telefono": "3001234567"
    }
  ]
}
```

### Campos

**Raíz**

| Campo       | Tipo    | Obligatorio    | Regla                                                              |
| ----------- | ------- | -------------- | ------------------------------------------------------------------ |
| `source`    | string  | No             | Minúsculas, números y guiones, máximo 40. Por defecto `bruma-cafe` |
| `productos` | arreglo | Uno de los dos | Máximo 500                                                         |
| `contactos` | arreglo | Uno de los dos | Máximo 500                                                         |

**Producto** (mismos nombres que el modelo de Bruma Café)

| Campo         | Tipo            | Obligatorio | Regla                                           | Destino en Quanty          |
| ------------- | --------------- | ----------- | ----------------------------------------------- | -------------------------- |
| `id`          | número o string | Sí          | 1 a 64 caracteres, único en el envío            | Identificador externo      |
| `nombre`      | string          | Sí          | 2 a 80 caracteres                               | Nombre                     |
| `precio`      | número          | Sí          | Mayor que 0, en pesos colombianos               | Precio                     |
| `cantidad`    | entero          | Sí          | 0 a 999999                                      | Unidades en stock          |
| `categoria`   | string          | No          | Máximo 40                                       | Descripción `Categoría: …` |
| `descripcion` | string          | No          | Máximo 240; si viene, reemplaza la de categoría | Descripción                |
| `imagen`      | string          | No          | URL absoluta `http` o `https`                   | Imagen                     |

Las imágenes de Bruma son rutas relativas (`assets/…`). Antes de enviarlas hay que convertirlas en URL absolutas, por ejemplo con `new URL(producto.imagen, location.href).href`, y el sitio debe estar publicado para que Quanty pueda mostrarlas.

**Contacto**

| Campo      | Tipo   | Obligatorio | Regla             | Destino en Quanty     |
| ---------- | ------ | ----------- | ----------------- | --------------------- |
| `id`       | string | Sí          | 1 a 64 caracteres | Identificador externo |
| `nombre`   | string | Sí          | 2 a 80 caracteres | Nombre                |
| `email`    | string | No          | Correo válido     | Correo                |
| `telefono` | string | No          | Máximo 30         | Teléfono              |
| `empresa`  | string | No          | Máximo 80         | Empresa               |
| `notas`    | string | No          | Máximo 280        | Notas                 |

### Comportamiento

- Si un elemento con el mismo `source` e `id` ya existe en Quanty, se **actualiza**; si no, se **crea**. Enviar el mismo catálogo dos veces no duplica nada.
- Los productos nuevos reciben un umbral de stock bajo de 5 unidades, que el usuario puede cambiar en Quanty.
- Un elemento inválido no detiene el envío: se omite y se informa en `skipped`.

### Respuesta `200`

```json
{
  "source": "bruma-cafe",
  "productos": {
    "received": 6,
    "created": 5,
    "updated": 0,
    "skipped": [{ "externalId": "4", "reason": "precio debe ser un número mayor que 0" }]
  },
  "contactos": { "received": 1, "created": 1, "updated": 0, "skipped": [] }
}
```

### Errores

| Código | Cuándo                                                                | Cuerpo                                 |
| ------ | --------------------------------------------------------------------- | -------------------------------------- |
| `400`  | JSON inválido, `source` inválido, listas vacías o que no son arreglos | `{ "error": "…" }`                     |
| `401`  | Falta la clave, tiene formato inválido o fue revocada                 | `{ "error": "Clave de API inválida" }` |
| `405`  | Método distinto de `GET`, `POST` u `OPTIONS`                          | `{ "error": "Método no permitido" }`   |
| `413`  | Cuerpo mayor de 1 MB o más de 500 elementos                           | `{ "error": "…" }`                     |
| `500`  | Error interno                                                         | `{ "error": "Error interno" }`         |

## Ejemplo con curl

```bash
curl -X POST "https://dnhpjwyaotdyhpialqlk.supabase.co/functions/v1/catalog-import" \
  -H "x-api-key: qk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"source":"bruma-cafe","productos":[{"id":1,"nombre":"Sierra Dulce","precio":42000,"cantidad":12,"categoria":"Grano"}]}'
```

## Archivos en Quanty

- `supabase/functions/catalog-import/index.ts`: endpoint.
- `supabase/migrations/*_catalog_import_api_keys.sql`: tabla `api_keys` y columnas `external_source` / `external_id`.
- `src/repositories/apiKeys.repository.ts`: generación (en el navegador), listado y revocación de claves.
- `src/components/quanty/ApiKeysPanel.tsx`: panel de Integraciones en Configuración.
