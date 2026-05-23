# GitHub Flow — DWI-Proyecto

## Reglas base

- `main` es producción. Nadie trabaja directo en `main`
- Todo cambio nace desde una rama derivada de `main`
- Todo entra por Pull Request, sin excepción
- Todo PR debe estar ligado a un issue

## Ciclo completo

```
1. Crear issue con formato completo
2. Crear rama: git checkout -b feature/nombre-descriptivo
3. Hacer commits: feat: descripción del cambio
4. Push: git push origin feature/nombre-descriptivo
5. Abrir PR en GitHub con evidencia
6. Revisión de compañero
7. Merge a main
8. Eliminar rama
```

## Estructura del repo

```
DWI-proyecto/
├── apps/
│   ├── web/     ← Next.js frontend
│   └── api/     ← Backend
├── docs/        ← Documentación del equipo
├── CONTRIBUTING.md
└── README.md
```

## Lo que cuenta como evidencia

- Capturas de pantalla del resultado
- Link de deploy funcional
- Video corto si aplica
