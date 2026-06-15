# Requerimientos del Sistema — MaquilaControl

## Requerimientos Funcionales

### RF-01 — Registrar lote
El sistema debe permitir registrar un lote con código único, total de piezas requeridas y estado inicial `abierto`.

### RF-02 — Consultar estado de lote
El sistema debe permitir consultar en tiempo real el estado de un lote: piezas totales, acumuladas y disponibles.

### RF-03 — Cierre automático de lote
El sistema debe cerrar automáticamente un lote cuando la suma de piezas reportadas iguale el total requerido.

### RF-04 — Registro de piezas por operador
El sistema debe permitir a cada operador registrar las piezas producidas en su turno.

### RF-05 — Validación en tiempo real
El sistema debe validar en tiempo real que la suma acumulada de piezas no supere el total del lote.

### RF-06 — Bloqueo de registro
El sistema debe bloquear el registro de piezas si el lote ya alcanzó su límite.

### RF-07 — Piezas disponibles visibles
El sistema debe mostrar al operador cuántas piezas quedan disponibles para reportar en el lote activo.

### RF-08 — Cálculo automático de nómina
El sistema debe calcular automáticamente el pago por operador con base en las piezas validadas y la tarifa vigente.

### RF-09 — Reporte de nómina por periodo
El sistema debe generar un reporte de nómina agrupado por operador para un periodo semanal o quincenal.

### RF-10 — Exportación de nómina
El sistema debe permitir exportar el reporte de nómina en formato descargable (PDF o Excel).

### RF-11 — Registro e inicio de sesión
El sistema debe permitir el registro de usuarios e inicio de sesión con correo y contraseña.

### RF-12 — Roles de usuario
El sistema debe soportar tres roles: `administrador`, `supervisor` y `operador`, cada uno con acceso restringido a sus funciones correspondientes.

### RF-13 — Dashboard de supervisión
El sistema debe mostrar al supervisor un dashboard con la producción por línea y por empleado en tiempo real.

### RF-14 — Historial de registros
El sistema debe permitir consultar el historial de registros de producción por lote y por operador.

### RF-15 — Alertas de lote
El sistema debe emitir una alerta cuando un lote esté cerca de su límite (>90% de piezas acumuladas).

### RF-16 — Control de acceso por rol
El sistema debe restringir el acceso a endpoints según el rol del token JWT; un operador no puede acceder a rutas de nómina o administración.

---

## Requerimientos No Funcionales

### RNF-01 — Accesibilidad multidispositivo
El sistema debe ser accesible desde cualquier dispositivo mediante diseño responsive o PWA.

### RNF-02 — Tiempo de respuesta
El sistema debe responder a las validaciones de piezas en menos de 2 segundos.

### RNF-03 — Seguridad de datos
Todos los datos deben estar protegidos con autenticación JWT y transmitidos bajo conexión HTTPS.

### RNF-04 — Disponibilidad
El sistema debe estar disponible 24/7.

### RNF-05 — Usabilidad
La interfaz debe ser simple e intuitiva, diseñada para operadores sin experiencia técnica previa.

### RNF-06 — Consistencia de datos
El sistema debe garantizar consistencia ACID en las operaciones de registro de piezas para evitar condiciones de carrera entre operadores concurrentes.

### RNF-07 — Seguridad de contraseñas
Las contraseñas de los usuarios deben almacenarse con hash bcrypt; nunca en texto plano.