# Roadmap — MaquilaControl

## MVP (Alcance actual)

El MVP cubre las funcionalidades mínimas para validar el producto con maquiladoras reales:

- Gestión de lotes (registro, consulta, cierre automático)
- Registro de piezas por operador con validación en tiempo real
- Nómina automática por destajo con exportación PDF/Excel
- Roles: administrador, supervisor, operador
- Dashboard de supervisión en tiempo real
- Autenticación segura con JWT + bcrypt

## Fuera del MVP (próximas versiones)

Estas funcionalidades fueron identificadas en entrevistas con trabajadores de maquiladora pero se dejaron fuera del MVP para mantener el alcance manejable:

### V2 — Control de asistencia
- Registro de entrada y salida por turno.
- Integración con checador biométrico o QR.
- Descuentos automáticos por retardos e inasistencias.

### V2 — Gestión de defectos y calidad
- Registro de prendas defectuosas por operador y por lote.
- Clasificación de defectos: costura abierta, mancha, fuera de medida, etc.
- Reporte de porcentaje de segunda por línea.

### V3 — Control de inventario de materia prima
- Registro de rollos de tela con metraje y lote de proveedor.
- Asignación de material a órdenes de producción.
- Alertas de mínimos de inventario.

### V3 — Comunicación interna entre áreas
- Notificaciones internas entre supervisores y administración.
- Registro de incidencias por turno.
- Historial de comunicados por área.

## Criterio de priorización

Las funcionalidades del roadmap se incorporarán según validación con usuarios reales durante y después del MVP. La prioridad está determinada por frecuencia de mención en entrevistas y por impacto directo en la operación diaria de la maquiladora.