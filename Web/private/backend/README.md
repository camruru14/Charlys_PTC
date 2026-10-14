# Backend del panel (Industrias Charly)

## Datos de prueba: `scripts/reset-and-seed.js`

Respalda toda la base, borra los datos de operación y carga datos ficticios coherentes desde el
**1 de enero de 2026** hasta hoy (hora de El Salvador): empleados con asistencia, clientes de la tienda,
~1,800 pedidos con su recorrido completo (ventas, fabricación, inventario, rutas y entregas), Finanzas
(planilla, gastos, pendientes, presupuestos) y contadores.

Se corre desde `Web/private/backend` (donde está el `.env`):

| Comando | Qué hace |
| --- | --- |
| `node scripts/reset-and-seed.js` | Muestra la ayuda. |
| `node scripts/reset-and-seed.js --dry-run` | Genera todo en memoria e imprime el resumen y los chequeos de coherencia. No escribe nada. |
| `node scripts/reset-and-seed.js --backup` | Solo exporta todas las colecciones a `scripts/backups/<fecha-hora>/<coleccion>.json` (EJSON canónico, un documento por línea). |
| `CONFIRM_RESET=BORRAR-TODO node scripts/reset-and-seed.js --backup --apply` | Respalda, verifica el respaldo, borra y siembra en una sola transacción, y repite los chequeos leyendo la base. En PowerShell: `$env:CONFIRM_RESET="BORRAR-TODO"; node scripts/reset-and-seed.js --backup --apply`. |

Opciones: `--seed=2026` (misma semilla = mismos datos) y `--now=<fecha ISO>` para reproducir una
simulación exacta. `--apply` exige `--backup` en la misma corrida y `CONFIRM_RESET`; si falta algo no
toca nada. Antes de borrar comprueba que la tienda (`Web/public/backend`) use la misma base.

**Se conserva:** administradores (`isAdministrator`), vehículos, catálogo, categorías de gasto (solo se
les agregan presupuestos), bodegas, líneas de producción, `CompanySettings` y `WorkSchedule`.
**Se borra:** empleados no administradores, pedidos, `CustomerOrder`, transacciones, inventario, lotes,
lotes diarios, rutas, novedades, contadores, clientes, pagos y recuperaciones de contraseña. Se usa
`deleteMany` (nunca `drop`), así que los índices se conservan. No toca Cloudinary.

Las contraseñas generadas de empleados y clientes quedan solo en `scripts/seed-output/*.csv`
(ignorado por git); nunca se imprimen.

### Restaurar un respaldo

```
CONFIRM_RESTORE=RESTAURAR node scripts/restore-backup.js scripts/backups/<carpeta>
```

(PowerShell: `$env:CONFIRM_RESTORE="RESTAURAR"; node scripts/restore-backup.js scripts/backups/<carpeta>`).
Vuelve a dejar cada colección del respaldo tal como estaba, en una sola transacción. Los respaldos de
`scripts/backups/` no se suben a git.
