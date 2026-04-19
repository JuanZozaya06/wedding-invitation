# Firebase Setup

## 1. Crear el proyecto

1. En Firebase Console crea un proyecto nuevo.
2. Agrega una Web App.
3. Habilita `Cloud Firestore`.
4. Copia la configuracion web de Firebase.

## 2. Pegar la configuracion

Edita [firebase.config.ts](/C:/Users/Zozi/Documents/Projects/wedding-invitation/frontend/src/app/firebase/firebase.config.ts:1) y reemplaza los valores con tu configuracion real.

## 3. Crear la coleccion

Crea una coleccion llamada `invitations`.

Usa el `token` como ID del documento.

Para generar un token aleatorio alfanumerico desde el proyecto:

```bash
npm run token
```

Eso genera uno de 8 caracteres. Si quieres otra longitud:

```bash
npm run token -- 6
```

Recomendacion: usa 8 caracteres como minimo.

Ejemplo de documento base:

```json
{
  "displayName": "Valentina Hernandez",
  "guestCount": 2,
  "openedInvitation": false,
  "openedAt": null,
  "lastOpenedAt": null,
  "openCount": 0,
  "hasChildren": false,
  "hasAbroadGuests": false,
  "notes": "",
  "message": "",
  "song": "",
  "rsvpStatus": "pending",
  "respondedAt": null,
  "responseEditCount": 0,
  "updatedAt": null,
  "guests": [
    {
      "id": "guest-valentina",
      "name": "Valentina Hernandez",
      "gender": "female",
      "role": "primary",
      "attending": true,
      "isChild": false,
      "isAbroad": false
    },
    {
      "id": "guest-acompanante",
      "name": "Acompanante",
      "gender": null,
      "role": "guest",
      "attending": false,
      "isChild": false,
      "isAbroad": false
    }
  ]
}
```

Regla importante:

- cada documento representa una invitacion
- todas las personas del grupo viven dentro de `guests`
- por cada token debe existir exactamente un invitado con `role = primary`

## 4. Reglas minimas para desarrollo

Para arrancar rapido en desarrollo puedes usar reglas temporales abiertas y luego cerrarlas:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /invitations/{token} {
      allow read, write: if true;
    }
  }
}
```

No dejes esas reglas asi en produccion.

## 4.1. Reglas para el panel admin frontend

Si el panel `/admin` va a leer estadisticas directamente desde el navegador, Firestore debe permitir:

- `get` sobre `admin/config`
- `list` sobre `invitations`

Version simple para esta etapa:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /admin/{docId} {
      allow get: if true;
      allow list: if false;
      allow create, update, delete: if false;
    }

    match /invitations/{token} {
      allow get: if true;
      allow list: if true;
      allow create: if false;
      allow update: if true;
      allow delete: if false;
    }
  }
}
```

Esto hace posible el panel admin, pero sigue siendo una solucion ligera, no seguridad fuerte.

## 5. Flujo actual del frontend

- Si Firebase no esta configurado, la app usa datos demo.
- Si existe `invitations/{token}`, la invitacion se carga desde Firestore.
- Si Firebase esta configurado y el token no existe, la app muestra 404.
- El RSVP actualiza el mismo documento.
- El mensaje y la cancion tambien actualizan ese documento.
- Al pulsar `Abrir invitacion`, se guardan `openedInvitation` y `openedAt`.
- Tambien se guardan `lastOpenedAt` y `openCount`.
- Cada cambio de RSVP o de mensaje/cancion incrementa `responseEditCount`.
- Cuando envian RSVP se actualiza `respondedAt`.
- Si existe `frontend/public/assets/audio/invitacion.mp3`, la invitacion muestra un control flotante de play/pause despues de abrirla.

## 5.1. Crear el documento demo sin usar la consola

Si no quieres llenar Firestore campo por campo:

1. Arranca el frontend.
2. Abre `http://127.0.0.1:4200/demo-cuento`.
3. Abre la consola del navegador.
4. Ejecuta:

```js
window.seedDemoInvitation()
```

Eso crea o actualiza automaticamente `invitations/demo-cuento` con una invitacion demo completa.

## 5.2. Configurar la clave maestra del admin

Genera el hash SHA-256 de tu clave:

```bash
npm run admin:hash -- mi-clave-super-secreta
```

Luego crea este documento en Firestore:

- coleccion: `admin`
- documento: `config`

Contenido:

```json
{
  "masterKeyHash": "pega-aqui-el-hash-generado"
}
```

Despues entra a:

- `http://127.0.0.1:4200/admin`

El panel pedira la clave, comparara el hash y cargara estadisticas y confirmados.

Ademas, el panel ahora muestra:

- aperturas por grupo
- fecha de primera y ultima apertura
- cantidad de veces que entraron
- fecha de ultima confirmacion
- cantidad de cambios realizados
- listado de mensajes
- listado de canciones
- listado de notas
- detalle por grupo

## 6. Estructura pensada para tu Excel

Cuando prepares el Excel o CSV, conviene que al final generemos documentos agrupados por token con esta idea:

- un documento por invitacion
- un arreglo `guests` con todos los invitados de ese grupo
- un solo invitado con `role = primary` por cada token
- campos derivados como `guestCount`, `hasChildren`, `hasAbroadGuests` y `rsvpStatus`

Asi el frontend puede personalizar textos sin que tengas que mantener copy manual por cada caso.

## 7. Reportes utiles desde consola

Resumen general:

```bash
npm run report -- stats
```

Listado de invitados confirmados:

```bash
npm run report -- attending
```

Exportar confirmados a CSV:

```bash
npm run report -- attending --out ./reports/confirmados.csv
```

Nota:

- Para reportes pequeños, leer `guests` directamente esta bien en tu caso.
- `confirmedCount` sigue siendo util como resumen rapido y para detectar inconsistencias.
