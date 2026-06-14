# Contribución a DWI-Proyecto

## Flujo de trabajo
Seguimos GitHub Flow. Todo cambio pasa por una rama y un Pull Request antes de llegar a `main`.

## Pasos para contribuir

1. Crea o asígnate un issue antes de escribir código
2. Crea tu rama desde `main` con la convención correcta
3. Haz commits descriptivos siguiendo Conventional Commits
4. Abre un PR ligado al issue correspondiente
5. Espera revisión de al menos un compañero antes del merge

## Convención de ramas

| Prefijo | Uso |
|---|---|
| `feature/` | Nueva funcionalidad |
| `fix/` | Corrección de bug |
| `docs/` | Documentación |
| `chore/` | Configuración, setup |
| `test/` | Pruebas |

## Convención de commits

```
feat: add hero section to landing page
fix: correct navbar responsive behavior
docs: update README with setup instructions
chore: configure eslint and prettier
```

## Pull Requests

Cada PR debe incluir:
- Qué se hizo
- Por qué se hizo
- Evidencia (captura, link o video)
- Issue relacionado (`Closes #N`)
- Al menos un reviewer asignado


## Flujo de ramas (GitFlow)

Este proyecto sigue una versión simplificada de GitFlow:

- **main** → versión estable / producción. Nadie trabaja directo aquí.
- **develop** → rama de integración. Todas las features se unen aquí primero.
- **feature/**, **docs/**, **test/**, **fix/**, **chore/** → ramas individuales,
  creadas siempre a partir de `develop`.

### Flujo de trabajo

1. Crear una rama desde `develop` con el prefijo correspondiente.
2. Hacer commits descriptivos siguiendo el formato `tipo: descripción`.
3. Abrir un Pull Request hacia `develop`.
4. Esperar revisión de al menos un compañero.
5. Hacer merge una vez aprobado.
