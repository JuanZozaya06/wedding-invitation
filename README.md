# Wedding Invitation

Invitación web privada para la boda de Gabriela y Juan, con Angular, backend Python y MySQL en Railway. Las invitaciones, RSVP, mensajes, canciones y fotos utilizan la API comercial; Firestore permanece intacto como sistema anterior.

Producción: [invitación](https://labodadelsiglo.app/) y [administración](https://labodadelsiglo.app/admin).
API: `https://api.labodadelsiglo.app`. El frontend se despliega desde `main` en GitHub Pages y el backend desde `main` en su repositorio independiente.
Consulta [frontend/README.md](frontend/README.md) y [backend-comercial/README.md](backend-comercial/README.md) para la operación actual.
Las conexiones y contraseñas están en `.credenciales/CREDENCIALES.md`, excluido de Git.

## Estado actual

- Angular 18 standalone app.
- Invitacion privada por token.
- Pantalla `/admin` con contraseña por boda, verificada por el backend contra un hash Argon2id en MySQL.
- Pantalla 404 si el token no existe o la URL es invalida.
- Sobre/carta inicial con apertura manual.
- Recorrido horizontal con ceremonia y recepcion ancladas al paisaje.
- RSVP con invitados precargados.
- Seccion opcional de mensaje y cancion.
- Musica de fondo opcional con boton flotante de play/pause.
- GitHub Pages configurado con fallback SPA.
- Dominio de produccion: `https://labodadelsiglo.app/`

## Estructura

```text
.
|-- assets/                           # Assets fuente originales
|-- frontend/
|   |-- public/
|   |   |-- assets/characters/        # Sprites e imagenes usadas por la app
|   |   `-- assets/audio/             # MP3 opcional de fondo
|   |-- src/app/
|   |   |-- app.component.*           # UI principal
|   |   |-- services/                 # API comercial y lógica de datos
|   |   |-- models/                   # Tipos de invitacion / RSVP
|   |   `-- data/                     # Demo data
|   `-- FIREBASE_SETUP.md             # Guia operativa para Firebase
|-- templates/                        # Plantillas Excel base
|-- AGENTS.md                         # Contexto operativo del proyecto
`-- README.md
```

## Requisitos

- Node.js 20 LTS o 22+ recomendado.
- npm.

La app puede compilar con Node 21.5.0, pero Angular muestra una advertencia porque no es una version LTS.

## Correr en local

Desde `frontend`:

```bash
npm install
npm start -- --host 127.0.0.1 --port 4200
```

URLs utiles:

- Invitación existente: `http://127.0.0.1:4200/{token}`
- Admin: `http://127.0.0.1:4200/admin`

## Build

Desde `frontend`:

```bash
npm run build
```

Salida:

```text
frontend/dist/frontend
```

## Firebase (documentación histórica)

Las secciones de Firebase, importación y clave maestra que siguen describen el sistema anterior. Sus scripts no deben ejecutarse para operar la versión comercial. La aplicación actual usa SQL y no conecta a Firestore.

La app ya esta preparada para leer y escribir en Firestore.

Colecciones usadas:

- `invitations/{token}`
- `admin/config`

Capacidades actuales:

- cargar invitacion por token
- guardar RSVP
- guardar notas, mensaje y cancion
- marcar apertura de invitacion
- contar aperturas y cambios
- leer estadisticas del panel admin

La guia detallada esta en [frontend/FIREBASE_SETUP.md](/C:/Users/Zozi/Documents/Projects/wedding-invitation/frontend/FIREBASE_SETUP.md:1).

## Modelo de datos

Cada documento representa una invitacion completa.

Campos principales:

- `displayName`
- `guestCount`
- `openedInvitation`
- `openedAt`
- `lastOpenedAt`
- `openCount`
- `hasChildren`
- `hasAbroadGuests`
- `notes`
- `message`
- `song`
- `rsvpStatus`
- `respondedAt`
- `responseEditCount`
- `updatedAt`
- `guests`

Cada `guest` contiene:

- `id`
- `name`
- `gender`
- `role`
- `attending`
- `isChild`
- `isAbroad`

Regla importante:

- cada token debe tener exactamente un invitado con `role = primary`

## Tokens y URLs

- En local la app usa `/:token`
- En produccion con dominio propio funciona como `https://labodadelsiglo.app/:token`
- La URL legacy de GitHub Pages puede seguir resolviendo como `/wedding-invitation/:token` mientras exista ese mapeo
- `/admin` se reserva para el panel privado
- si el token no existe, la app muestra 404
- si la URL es invalida, la app muestra 404

Recomendacion:

- usa tokens aleatorios alfanumericos de 8 caracteres minimo

## Audio de fondo

Si quieres musica de fondo, coloca tu mp3 aqui:

```text
frontend/public/assets/audio/invitacion.mp3
```

Comportamiento actual:

- la musica intenta arrancar cuando el usuario pulsa `Abrir invitacion`
- queda en loop
- hay un boton flotante para play/pause
- si el archivo no existe, simplemente no se muestran controles

## Panel admin

Ruta:

```text
/admin
```

El acceso se valida comparando la clave ingresada contra `admin/config.masterKeyHash`.

El panel muestra:

- resumen general
- aperturas recientes
- respuestas recientes
- detalle por invitacion
- invitados confirmados
- mensajes, canciones y notas

## Excel / importacion

El flujo recomendado es:

1. preparar invitados en Excel o Google Sheets
2. usar una fila por invitado
3. repetir el mismo token para todos los invitados del mismo grupo
4. agrupar e importar a Firestore

Plantillas base:

- `templates/invitados_base.xlsx`
- `templates/invitados_base_v2.xlsx`

## GitHub Pages

El proyecto se despliega con GitHub Actions cuando hay cambios en `main`.

URL principal:

```text
https://labodadelsiglo.app/
```

Notas:

- el build usa `--base-href=/` para que el dominio propio viva en la raiz
- el custom domain debe configurarse en `GitHub -> Settings -> Pages -> Custom domain`
- `frontend/public/CNAME` deja esa decision visible dentro del repo, aunque con GitHub Actions la configuracion efectiva sigue viviendo en Pages
- se genera `404.html` como fallback SPA
- la app ya soporta tanto rutas directas del dominio propio como el prefijo legacy `/wedding-invitation`

## Scripts utiles

Desde `frontend`:

```bash
npm run admin:hash -- mi-clave
npm run token
npm run report -- stats
npm run report -- attending
npm run reset:demo
```

## Notas conocidas

- `app.component.scss` supera el style budget y Angular muestra un warning en build.
- El panel admin actual es practico, pero no es seguridad fuerte.
- Para una version mas dura de seguridad, lo siguiente seria mover admin/reportes a Cloud Functions o a un backend real.
