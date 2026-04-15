# Wedding Invitation

Invitación web privada para la boda de Gabriela & Juan. El proyecto es un prototipo visual en Angular con una experiencia tipo cuento: sobre animado, escenas ilustradas, scroll narrativo horizontal, datos del evento, confirmación RSVP y mensajes opcionales de los invitados.

## Estado Actual

- Frontend en Angular 18.
- Experiencia responsive para mobile y desktop.
- Invitación inicial con sobre/carta.
- Escena horizontal con novia caminando hacia la ceremonia y carro hacia la recepción.
- RSVP con invitados precargados.
- Sección opcional para mensaje y canción recomendada.
- Datos fake por ahora; el backend se conectará luego por token privado.

## Estructura

```text
.
|-- assets/                         # Assets fuente originales
|-- frontend/                       # Aplicación Angular
|   |-- public/assets/characters/   # Assets usados por la app
|   `-- src/app/                    # Componentes, template y estilos principales
|-- AGENTS.md                       # Notas de contexto para agentes de desarrollo
`-- README.md
```

## Requisitos

- Node.js 20 LTS o 22+ recomendado.
- npm.

La app puede compilar con Node 21.5.0, pero Angular muestra una advertencia porque esa versión no es LTS.

## Correr en Local

Desde la carpeta `frontend`:

```bash
npm install
npm start -- --host 127.0.0.1 --port 4200
```

Luego abrir:

```text
http://127.0.0.1:4200/demo-cuento
```

## Build

Desde `frontend`:

```bash
npm run build
```

La salida se genera en:

```text
frontend/dist/frontend
```

## GitHub Pages

El proyecto se despliega automáticamente con GitHub Actions cuando hay cambios en `main`.

URL esperada:

```text
https://juanzozaya06.github.io/wedding-invitation/
```

## Notas de Producto

- La URL final esperada será `/:token`.
- El token cargará la invitación privada desde base de datos.
- El RSVP debe usar invitados precargados; los invitados no agregan personas manualmente.
- La ceremonia será en Iglesia María Auxiliadora, Capilla grande, Altamira, Chacao.
- La recepción será en Quinta Mirador, La Lagunita, El Hatillo.

## Assets

Los assets fuente viven en `assets/`. Los que usa Angular se copian a `frontend/public/assets/characters/`.

Assets actuales principales:

- `gaby-standing.png`
- `juan-standing.png`
- `gaby-walking.gif`
- `car.gif`

## Próximos Pasos

- Conectar datos reales por token.
- Persistir RSVP, notas, mensaje y canción.
- Optimizar peso de assets para mobile.
- Ajustar presupuesto de estilos o separar CSS si el proyecto crece.
