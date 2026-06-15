# Plan de Pruebas - MaquilaControl

## 1. Pruebas Unitarias

| ID | Entrada | Accion | Resultado Esperado |
|---|---|---|---|
| U-01 | piezasAcumuladas=80, piezasNuevas=30, total=100 | Validar si excede limite | Retorna true (excede) |
| U-02 | piezasAcumuladas=60, piezasNuevas=20, total=100 | Validar si excede limite | Retorna false (no excede) |
| U-03 | piezasAcumuladas=80, piezasNuevas=20, total=100 | Validar si lote se completa | Retorna true (completo) |
| U-04 | rol=operador, endpoint=/api/lotes | Verificar acceso | Acceso denegado (403) |
| U-05 | rol=administrador, endpoint=/api/usuarios | Verificar acceso | Acceso permitido (200) |

## 2. Pruebas de Concurrencia

### Descripcion
Se utiliza SELECT ... FOR UPDATE para evitar condiciones de carrera cuando varios operadores reportan piezas sobre el mismo lote al mismo tiempo.

### Ejemplo de transaccion
```sql
BEGIN;
SELECT piezas_acumuladas FROM lotes WHERE id = $1 FOR UPDATE;
UPDATE lotes SET piezas_acumuladas = piezas_acumuladas + $piezas_nuevas WHERE id = $1;
COMMIT;
```

| ID | Entrada | Accion | Resultado Esperado |
|---|---|---|---|
| C-01 | 2 operadores registran piezas al mismo tiempo en lote-01 | SELECT FOR UPDATE en lote-01 | Solo un registro entra, el otro espera |
| C-02 | piezasAcumuladas=90, operador-A suma 15, operador-B suma 15 | Transaccion concurrente | Solo el primero pasa, el segundo recibe error 400 |
| C-03 | Lote con total=100, acumuladas=100 | Intentar agregar mas piezas | Sistema rechaza con error 400 |

## 3. Pruebas de Seguridad y Roles

| ID | Entrada | Accion | Resultado Esperado |
|---|---|---|---|
| S-01 | Sin token JWT | Llamar a /api/produccion/registrar | Error 401 no autorizado |
| S-02 | Token de operador | Llamar a /api/usuarios | Error 403 prohibido |
| S-03 | Token de supervisor | Llamar a /api/nomina/generar | Error 403 prohibido |
| S-04 | Token de administrador | Llamar a /api/usuarios | Respuesta 200 exitosa |
| S-05 | Token expirado | Llamar a cualquier endpoint | Error 401 token invalido |