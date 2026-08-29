# Modelo de datos

Fuente de verdad: `packages/db/prisma/schema.prisma`. Este documento explica el
*porqué* y las formas de los criterios de alerta (JSON).

## Planos

### Plano público (compartido, sin `tenant_id`)

- **`boletines`** — una fila por edición del Boletín Judicial descargada.
  Estado del ciclo de ingesta (`PENDING → DOWNLOADED → PARSING → PARSED |
  FAILED`), llave S3 del PDF crudo, número y fecha.
- **`notices`** — aviso individual extraído de un boletín. Tabla base con lo
  común: `category`, `raw_text`, `page`, `published_at`, `expediente`,
  `despacho` y un `content_hash` estable para idempotencia. Cada aviso se
  especializa según su categoría en una de las tablas siguientes (relación 1:1).
- **`property_auctions`** — remate de bien inmueble.
- **`vehicle_auctions`** — remate de vehículo.
- **`deceased_persons`** — persona fallecida (proceso sucesorio).
- **`dissolved_companies`** — sociedad disuelta.

Búsqueda difusa: los campos de nombre y ubicación tienen índices GIN `pg_trgm`
para tolerar variaciones y errores tipográficos en las cédulas/nombres extraídos
por OCR.

### Plano de tenant (aislado por `tenant_id` + RLS)

- **`tenants`** — organización cliente (plan, estado, slug).
- **`users`** — usuario perteneciente a un tenant (mapeado a un `cognito_sub`).
- **`alerts`** — regla de alerta creada por un usuario, con `category`, `channel`
  y `criteria` (JSONB, validado por categoría en la app).
- **`alert_matches`** — coincidencia entre una alerta y un aviso; guarda el
  estado de notificación (`PENDING → SENT | FAILED`) para no re-notificar.
- **`saved_notices`** — avisos marcados/guardados por un usuario.

## Formas de `criteria` por categoría (JSONB)

Validadas con Zod en `@informes/shared` (`AlertCriteriaSchema`).

### Remate de propiedades (`PROPERTY_AUCTION`)
```jsonc
{
  "location": {
    "provincia": "San José",          // opcional
    "canton": "Escazú",               // opcional
    "distrito": "San Rafael"          // opcional
  },
  "price": { "min": 0, "max": 50000000, "currency": "CRC" }, // opcional
  "area":  { "min": 100, "max": 500 }                        // m², opcional
}
```

### Remate de vehículos (`VEHICLE_AUCTION`)
```jsonc
{
  "price": { "min": 0, "max": 8000000, "currency": "CRC" }, // opcional
  "brand": "Toyota",                                          // opcional
  "yearMin": 2015                                             // opcional
}
```

### Personas fallecidas (`DECEASED`)
```jsonc
{
  "cedula": "1-1234-5678",   // opcional (match exacto normalizado)
  "name": "Juan Pérez"       // opcional (match difuso pg_trgm)
}
```
> Debe venir al menos uno de `cedula` o `name`.

### Sociedades disueltas (`DISSOLVED_COMPANY`)
```jsonc
{
  "cedulaJuridica": "3-101-123456", // opcional (match exacto normalizado)
  "name": "Inversiones ACME S.A."   // opcional (match difuso pg_trgm)
}
```
> Debe venir al menos uno de `cedulaJuridica` o `name`.

## Normalización

- **Cédulas** (física y jurídica): se almacena el valor original y una versión
  normalizada `*_normalized` (solo dígitos) para comparaciones exactas robustas.
- **Montos:** `base_price` en la unidad menor (céntimos) + `currency` (`CRC`/`USD`).
- **Ubicación:** provincia/cantón/distrito como texto normalizado (sin acentos,
  vía `unaccent`) además del original.
- **Fechas:** `published_at` (del boletín) y fechas propias del aviso
  (`remate_date`, `fecha_defuncion`) en `timestamptz`.

## Idempotencia

`notices.content_hash = sha256(boletin_id || expediente || normalized_text)`.
El parser hace *upsert* por `content_hash`, de modo que reprocesar un boletín no
duplica avisos.
