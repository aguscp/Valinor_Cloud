# TurnoFlex: Sistema de Gestión de Clases y Reservas

TurnoFlex es una aplicación web, hecha con **Node.js**, **Express** y **MongoDB** (con Mongoose), para gestionar las
clases grupales de un centro de pilates, yoga y bienestar. Permite administrar profesionales, clientes, salas, horarios de clases y reservas, aplicando reglas de negocio. Es un **producto mínimo viable** con:

- Persistencia en **MongoDB** usando Mongoose.
- **Autenticación stateless con Passport + JWT**: login con `passport-local` (contraseñas hasheadas con bcrypt) y protección de rutas con `passport-jwt`. El token viaja en una cookie `httpOnly` o en el header `Authorization: Bearer`.
- **Roles y permisos CRUD**: `admin` > `recepcion` > `profesional`, más el rol independiente `cliente`.
- **Autogestión para clientes**: registro desde el login, edición del perfil (excepto DNI), reserva de clases grupales y consulta de sus reservas.
- **Clases grupales semanales**: profesores publican sus horarios, eligen salas disponibles y clientes reservan lugares hasta cubrir la capacidad.
- **Auditoría** de todas las acciones relevantes.
- **Front con `fetch`**: las pantallas cargan y guardan datos de forma asincrónica, sin recargar la página.
- **Interfaz con Tailwind CSS 4** (por CDN, sin paso de build): navbar y sidebar colapsable, menú de usuario, colores por estado de reserva y diseño responsive para móviles, tablets, portátiles y escritorio.
- **Chat de consultas en tiempo real con WebSockets (Socket.io)**: clientes, recepción y profesionales consultan a un administrador desde un panel lateral. Cada consulta pasa por los estados pendiente, activo, finalizado o rechazado, y vence a los 5 minutos si nadie la acepta.
- **Asistente Gemini opcional**: en una conversación activa, escribí `@gemini` seguido de una pregunta para recibir una respuesta de ayuda. Configurá `GEMINI_API_KEY` para habilitarlo.

---

## Requisitos

- Node.js 18 o superior.
- MongoDB 6 o superior, local (MongoDB Community Server) o en la nube (MongoDB Atlas).

## Instalación y uso

```bash
npm install
cp .env.example .env      # en Windows: copy .env.example .env
npm run seed              # crea datos y usuarios de prueba (borra lo que haya)
npm run dev               # inicia con nodemon (o npm start)
```

`npm run seed` borra todos los datos de la base indicada en `MONGO_URI` antes de recrearlos. Usalo solo con una base local o de prueba.

La aplicación queda disponible en **http://localhost:3000**.

> Si venís de una versión anterior (con `express-session`), volvé a correr `npm run seed`: las contraseñas ahora se guardan hasheadas y las que estaban en texto plano ya no sirven para iniciar sesión.
>
> Si venís de una versión sin chat, corré `npm install` (agrega `socket.io`) y `npm run seed` (crea el segundo admin, `admin2`). Con Docker: `docker compose up --build -V`.

### Uso con Docker

También se puede levantar la app y MongoDB con contenedores (modo desarrollo con hot-reload):

```bash
cp .env.example .env
docker compose up --build -V      # -V: renueva node_modules si cambiaron las dependencias
docker compose exec app npm run seed
```

La guía completa está en [`docs/Docker/docker-readme.md`](docs/Docker/docker-readme.md).

### Variables de entorno (`.env`)

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `PORT` | Puerto del servidor | `3000` |
| `MONGO_URI` | Cadena de conexión a MongoDB | `mongodb://127.0.0.1:27017/turnoflex` |
| `JWT_SECRET` | Clave para firmar los JWT (HS256). En producción, un texto largo y aleatorio | clave de desarrollo (con aviso al iniciar) |
| `JWT_MINUTOS` | Vida del token en minutos. En el navegador se renueva mientras se usa la app | `30` |
| `CHAT_MAX_POR_ADMIN` | Máximo de chats abiertos (pendientes + activos) que puede tener cada admin | `3` |
| `CHAT_TIMEOUT_MINUTOS` | Minutos que espera una consulta a ser aceptada antes de vencer. Acepta decimales (`0.5` = 30 s) para probar | `5` |
| `GEMINI_API_KEY` | Clave de API para habilitar el asistente Gemini | Sin configurar (deshabilitado) |
| `GEMINI_MODEL` | Modelo de Gemini a utilizar | `gemini-3.5-flash-lite` |

### Usuarios de prueba (creados por `npm run seed`)

| Usuario | Contraseña | Rol | Contexto |
|---|---|---|---|
| `admin` | `admin123` | admin | Todo el sistema |
| `admin2` | `admin123` | admin | Segundo operador, para probar el reparto de chats |
| `recepcion` | `recepcion123` | recepcion | Clientes, profesionales y reservas |
| `profesional1` | `prof1234` | profesional | Clases de Camila Ferreyra |
| `profesional2` | `prof5678` | profesional | Clases de Martín Acosta |
| `profesional3` | `prof9012` | profesional | Clases de Valeria Quiroga |
| `cliente1` a `cliente20` | `cliente123` | cliente | Una cuenta vinculada a cada cliente de prueba |

El seed crea 20 clientes, 3 salas (capacidades 15, 15 y 20) y exactamente 3 horarios diarios de Pilates Reformer, Yoga y Pilates Mat, todos los días de lunes a domingo. Cada horario genera una clase semanal durante 8 semanas (168 clases en total). También crea las clases de hoy. Cada clase recibe entre 5 y 6 reservas; los clientes se distribuyen para que nadie quede inscripto en más de una clase por fecha.

---

## Estructura del proyecto

```
Valinor_Cloud/
├── .env.example
├── docs/
│   ├── Docker/docker-readme.md          Guía para usar Docker
│   ├── IA/                              Conversaciones con la IA usadas en cada cambio grande
│   ├── refactor-passport-jwt.md         Detalle del cambio a Passport + JWT
│   ├── refactor-frontend.md             Detalle del rediseño con Tailwind
│   ├── refactor-websockets.md           Detalle del chat en tiempo real
│   └── TurnoFlex.postman_collection.json
└── src/
    ├── index.js                         Configura Express, cookies, Passport, rutas, errores y Socket.io; conecta a Mongo
    ├── seed.js                          Carga datos y usuarios de prueba
    ├── config/
    │   ├── db.js                        Conexión a MongoDB con Mongoose
    │   ├── passport.js                  Estrategias local (login) y jwt (requests autenticadas)
    │   ├── roles.js                     Roles, jerarquía y permisos CRUD
    │   └── chat.js                      Límite de chats por admin, timeout y gracia de desconexión
    ├── models/                          Esquemas de Mongoose
    │   ├── Cliente.js  
    │   ├── Profesional.js  
    │   ├── Usuario.js                   Usuario, rol, estado, vencimiento, fechas y hash de contraseña
    │   ├── Chat.js                      Consulta, estado, admin asignado, vencimiento y mensajes
    │   ├── Sala.js / ConfiguracionClase.js
    │   ├── HorarioClase.js / ClaseProgramada.js / ReservaClase.js
    │   └── Auditoria.js                 Registro de eventos
    ├── controllers/                     Lógica de cada recurso (async/await)
    ├── services/
    │   ├── chatService.js               Máquina de estados del chat, asignación de admins y reasignación
    │   ├── chatTimeouts.js              Temporizadores del vencimiento de consultas pendientes
    │   ├── clasesService.js             Horarios, generación de clases programadas y control de superposiciones
    │   └── geminiService.js             Consulta a Gemini (contexto, tiempo máximo y modelo configurable)
    ├── socket/
    │   ├── index.js                     Servidor Socket.io: autenticación JWT en el handshake y salas por usuario
    │   ├── emisor.js                    emitirA() y desconectarUsuario()
    │   └── presencia.js                 Admins conectados (en memoria) con período de gracia
    ├── routes/
    │   ├── api/                         API REST en JSON (/api/...)
    │   └── vistasRoutes.js              Páginas Pug
    ├── middlewares/
    │   ├── auth.js                      requiereLogin, usuarioOpcional y requierePermiso
    │   ├── errores.js                   404 y manejo centralizado de errores
    │   └── logger.js                    Log de cada request
    ├── helpers/
    │   ├── auditoria.js                 registrarAuditoria()
    │   ├── campos.js                    tomarCampos(): solo acepta campos permitidos
    │   ├── errores.js                   crearError(): errores de negocio con status y mensaje
    │   └── token.js                     Firma del JWT y manejo de la cookie
    ├── views/                           Plantillas Pug
    │   ├── layouts/base.pug             Esqueleto HTML: Tailwind, tema, footer y scripts comunes
    │   ├── layout.pug                   Shell de la app logueada: navbar + sidebar + contenido
    │   ├── includes/
    │   │   ├── tema.pug                 Configuración de Tailwind: paleta, variantes y componentes
    │   │   ├── mixins.pug               Componentes de vista: campos, tablas, modales, íconos, logo
    │   │   ├── chatDrawer.pug           Panel lateral del chat (vista según el rol)
    │   │   └── navbar.pug  sidebar.pug  footer.pug
    │   ├── login.pug  error.pug         Páginas sin shell (extienden layouts/base)
    │   └── home.pug  clientes/  profesionales/  turnos/  clases/  salas/  usuarios/  auditoria/
    └── public/
        └── js/                          JS del navegador (fetch a la API, layout.js para sidebar y menú, chat.js para el chat)
```

### Cómo funciona

1. **Vistas y API separadas.** Las rutas de `vistasRoutes.js` solo renderizan la estructura de cada página con Pug. Los datos los pide el navegador con `fetch` a `/api/...`, que siempre responde JSON.
2. **Sin recargas.** Al guardar, editar o eliminar, el JS envía la petición, espera la respuesta con `await` y vuelve a dibujar la tabla. Si hay un error de validación, se muestra al lado del formulario.
3. **Autenticación sin estado.** El login (`POST /api/auth/login`) verifica la contraseña con la estrategia `local` de Passport, firma un JWT, lo guarda en la cookie `token` (`httpOnly`, `sameSite=strict`) y también lo devuelve en el JSON. El servidor no guarda sesiones: en cada request la estrategia `jwt` toma el token del header `Authorization: Bearer` o de la cookie y verifica su firma y vencimiento. Así funcionan tanto las páginas Pug (el navegador manda la cookie solo) como clientes externos como Postman (header Bearer).
4. **Estilos con Tailwind.** Tailwind 4 se carga por CDN y compila las clases en el navegador, incluidas las de los elementos que crea el JS. La paleta (fondo neutro `#F8F9FA`, lavanda para navbar y sidebar, y los colores de estado de las reservas) se define una sola vez en `src/views/includes/tema.pug`; no hay hojas de estilo propias. En las reservas, `reservada` se muestra en azul cobalto, `asistida` en gris claro y `cancelada` en coral. El detalle está en [`docs/refactor-frontend.md`](docs/refactor-frontend.md).
5. **Middlewares en cadena.** Cada ruta pasa por `requiereLogin` y luego por `requierePermiso("recurso:accion")` antes de llegar al controlador.
6. **Errores centralizados.** Express 5 envía al `errorHandler` los errores de los controladores `async`. Ese middleware traduce los errores de Mongoose a respuestas claras:

   | Error | Respuesta |
   |---|---|
   | Validación | 400 |
   | Id inválido | 400 |
   | Dato duplicado | 409 |
   | Error de negocio (`crearError`) | Su propio status y mensaje (por ejemplo 409 o 503) |
7. **Tiempo real con Socket.io.** Express y Socket.io comparten el mismo servidor HTTP. Las acciones del chat se hacen por la API REST y Socket.io solo empuja los eventos al navegador (consulta nueva, aceptada, mensaje, finalizada). Ver [Chat de consultas](#chat-de-consultas-en-tiempo-real).

---

## Modelos (MongoDB)

Todos los modelos usan `timestamps`, así que guardan `createdAt` (fecha de creación) y `updatedAt` (fecha de modificación).

| Colección | Campos principales | Validaciones |
|---|---|---|
| `clientes` | nombre, apellido, dni, telefono, email | dni único de 7 u 8 números, email válido |
| `profesionales` | nombre, apellido, especialidad, matricula | matrícula única |
| `usuarios` | usuario, password (hash bcrypt), nombre, rol, profesional (ref), cliente (ref), activo, expiraEl, ultimoAcceso, tokenVersion | usuario único, contraseña de 6 caracteres o más, rol válido, profesional obligatorio si el rol es profesional y cliente obligatorio si el rol es cliente |
| `chats` | solicitante (ref), rolSolicitante, admin (ref), estado, motivoCierre, expiraEl, aceptadoEl, cerradoEl, mensajes [autor (opcional), esIA, texto, createdAt] | estado en `pendiente / activo / finalizado / rechazado`, mensajes de 1 a 1000 caracteres, un solo chat abierto por usuario (índice único parcial), autor opcional porque los mensajes de Gemini no tienen autor |
| `salas` | nombre, capacidad, activa | capacidad entera positiva |
| `horarioclases` | profesional (ref), tipo, horaInicio, comienzaDesde, repetirSemanas, sala (ref), activo | la fecha de inicio es la primera clase y determina el día semanal; repite de 1 a 8 ocurrencias, sin superposición de sala o profesor |
| `claseprogramadas` | horario, fecha, tipo, profesional, sala, horaInicio, horaFin, capacidad, reservas, activa | ocurrencias generadas para las próximas 8 semanas; cupo atómico |
| `reservaclases` | clase (ref), cliente (ref), estado | historial de reservas; una sola reserva activa por cliente y clase |
| `configuracionclases` | clave, duracionMinutos | una duración general configurable por admin (por defecto 60 minutos) |
| `auditoria` | usuario (ref), usuarioNombre, accion, entidad, entidadId, detalle, ip, createdAt | acción dentro de la lista permitida |

### Reglas de negocio de reservas

- El registro público crea un cliente y una cuenta vinculada con rol `cliente`; el cliente puede consultar su historial y reservar clases grupales futuras.
- El cliente puede modificar nombre, apellido, teléfono y email desde su perfil; el DNI no se modifica.
- Cada profesor define el tipo, la fecha de la primera clase, la hora, la repetición de 1 a 8 semanas y una sala libre. La fecha determina el día semanal; los profesores también pueden consultar la vista semanal de clases sin reservar.
- Admin debe cargar al menos una sala antes de que los profesores puedan publicar horarios.
- Se generan tantas clases semanales como indique el profesor (de 1 a 8), desde la fecha elegida. Las ocurrencias se muestran cuando entran en la ventana de las próximas 8 semanas. Las completas se muestran deshabilitadas; hay una reserva por cliente y clase, con control atómico del cupo. Un cliente no puede reservar clases superpuestas.
- Recepción y admin pueden asignar una clase existente a un cliente desde la pantalla Reservas; se validan cupo, duplicados y superposiciones igual que en una reserva del cliente.
- Las reservas ya hechas conservan el horario y cupo que tenían si el profesor edita o desactiva su horario; el cambio rige para ocurrencias futuras sin reservas.
- El cliente puede cancelar antes del inicio de la clase. La reserva queda en el historial y libera el cupo; puede volver a reservar esa clase si hay lugar y se conserva cada cancelación.
- Admin y el profesor responsable pueden marcar asistencia. Solo se eliminan reservas canceladas.
- No se puede eliminar un cliente con reservas activas ni un profesional con horarios de clase activos.
- Los cambios de horarios, salas, duración y reservas se serializan en memoria; la implementación requiere un solo proceso Node.

---

## Usuarios, roles y permisos

Los permisos usan la nomenclatura **CRUD**: `recurso:create`, `recurso:read`, `recurso:update` y `recurso:delete`.

| Recurso | cliente | profesional | recepcion | admin |
|---|:-:|:-:|:-:|:-:|
| profesionales | R | R | C R U D | C R U D |
| reservas (`turnos:*`) | R | R\* U\* | C R U D | C R U D |
| clases | R, reservar | gestionar horarios | – | duración |
| salas | – | – | – | gestionar |
| clientes | – | R | C R U D | C R U D |
| usuarios | – | – | – | C R U D |
| auditoria | – | – | – | R |
| chat:usar | ✓ | ✓ | ✓ | ✓ |
| chat:moderar | – | – | – | ✓ |

\* Con control por contexto: el profesional solo ve las reservas de **sus** clases y solo puede marcar **asistencia** en ellas. El cliente solo ve sus propias reservas y modifica solo su propio perfil, excepto el DNI.

Los permisos del chat no siguen la nomenclatura CRUD: `chat:usar` permite consultar y escribir, y `chat:moderar` permite aceptar, rechazar y finalizar. Aunque el admin hereda `chat:usar`, **no puede iniciar** una consulta (control por contexto: 403).

La matriz está definida en un único lugar, [`src/config/roles.js`](src/config/roles.js). Cada ruta declara el permiso exacto que necesita, por ejemplo:

```js
router.delete("/:id", requierePermiso("clientes:delete"), eliminarCliente);
```

### Buenas prácticas aplicadas

| Práctica | Cómo se implementa |
|---|---|
| **Mínimo privilegio** | Un usuario nuevo nace con el rol más bajo (`profesional`). Cada endpoint pide un permiso CRUD puntual y no un rol genérico. Los controladores solo aceptan los campos permitidos (`tomarCampos`), así nadie puede cambiar, por ejemplo, el `estado` de una reserva al crearla. La contraseña nunca viaja en las respuestas (`select: false` y `toJSON`). El token no lleva el rol ni los permisos: se leen de la base en cada request. |
| **Contraseñas hasheadas** | Se guardan con bcrypt (`bcryptjs`, 10 rondas) en un hook `pre("save")` del modelo y se comparan con `bcrypt.compare`. |
| **Roles y permisos** | `cliente` es un rol independiente y limitado a sus reservas; `recepcion` hereda de `profesional` y `admin` hereda de `recepcion`. |
| **Control por contexto** | Un cliente solo lista y cancela sus propias reservas; un profesional solo lista las reservas de sus clases y solo puede marcar asistencia en ellas. Un admin no puede desactivarse, cambiarse el rol, ponerse vencimiento ni eliminarse a sí mismo. |
| **Auditoría** | Se registran LOGIN, LOGIN_FALLIDO, LOGOUT, CREAR, MODIFICAR, ELIMINAR, CAMBIO_ESTADO, ACCESO_DENEGADO, SESION_REVOCADA y CHAT_SIN_OPERADOR, con usuario, entidad, detalle, IP y fecha. Los cambios de estado del chat que hace el servidor (timeout, reasignación) quedan a nombre de `sistema`. El admin los consulta en `/auditoria`. |
| **Revocación automática** | (1) El token vence a los `JWT_MINUTOS`; en el navegador se renueva solo mientras el usuario usa la app, así que en la práctica vence por inactividad. (2) En cada request se vuelve a leer el usuario desde Mongo: si fue desactivado, eliminado o pasó su fecha `expiraEl`, el token se rechaza en ese momento y se audita como SESION_REVOCADA. (3) Cada usuario tiene un `tokenVersion` que se incrementa al hacer logout o al cambiar la contraseña: los tokens anteriores dejan de valer (el logout cierra la sesión en todos los dispositivos). (4) Un usuario vencido o inactivo no puede volver a iniciar sesión. (5) Los sockets del chat se autentican con el mismo JWT y se cierran al hacer logout o cuando un admin desactiva, cambia de rol, vence o elimina al usuario. |
| **Token seguro** | JWT firmado con HS256 (solo se acepta ese algoritmo). La cookie es `httpOnly` (no la lee JavaScript) y `sameSite=strict` (mitiga CSRF); en producción también es `secure`. |
| **Fechas de creación, acceso y modificación** | `createdAt` y `updatedAt` vienen de `timestamps`. `ultimoAcceso` se actualiza en cada login sin modificar `updatedAt`, para no mezclar "accedió" con "lo modificaron". |

---

## Chat de consultas en tiempo real

Los usuarios con rol `cliente`, `recepcion` o `profesional` pueden hacerle una consulta a un administrador desde el **ícono de mensajes de la navbar**, al lado del avatar. El ícono abre un **panel lateral** que se desliza desde la derecha y no bloquea la página. El badge del ícono muestra cuántos chats hay abiertos.

**Reglas**

- `cliente`, `recepcion` y `profesional` pueden **iniciar** una consulta. El `admin` atiende: acepta, rechaza o finaliza. No hay chats entre administradores.
- Cada usuario puede tener **una sola consulta abierta** a la vez (409).
- La consulta se asigna a **un solo admin conectado**: el que tiene menos chats abiertos (empate al azar), siempre que esté debajo de `CHAT_MAX_POR_ADMIN`. Si no hay ninguno conectado o todos llegaron al límite, se responde **503** con "Todos los operadores se encuentran ocupados en este momento".
- Mientras está **pendiente**, el usuario no puede enviar más mensajes. Si ningún admin la acepta en `CHAT_TIMEOUT_MINUTOS` (5), **el servidor** la cierra (`finalizado` por timeout) y le avisa al usuario.
- Cuando el admin la **finaliza** o la **rechaza**, el chat queda cerrado y en solo lectura, y para volver a consultar hay que iniciar una consulta nueva.

**Estados**

```
pendiente ──aceptar──► activo ──finalizar──► finalizado
    │                                            ▲
    ├──timeout (servidor) ───────────────────────┘
    └──rechazar──► rechazado
```

**Cómo funciona**

- **Persistencia:** chats y mensajes se guardan en MongoDB (colección `chats`). En memoria quedan solo los admins conectados y los temporizadores de vencimiento, que se reconstruyen desde la base si el servidor se reinicia.
- **Híbrido REST + WebSocket:** las acciones (iniciar, aceptar, rechazar, finalizar, enviar mensaje) son endpoints `/api/chats`, protegidos por los mismos middlewares, la misma auditoría y el mismo manejo de errores que el resto de la API. Socket.io avisa a los dos participantes en tiempo real. El único evento que manda el navegador por el socket es "escribiendo…".
- **Autenticación del socket:** el handshake usa el mismo JWT (cookie `httpOnly` o header Bearer) y la misma estrategia de Passport. Si el token no es válido, el navegador vuelve al login.
- **Salas por usuario:** cada socket se une a `usuario:<id>`. Como la app es multipágina y el socket se reconecta en cada navegación, los eventos van a la sala del usuario y llegan a todas sus pestañas. Un admin que cambia de página sigue contando como conectado durante 10 segundos de gracia; si no vuelve, sus consultas pendientes pasan a otro admin.
- **Transiciones atómicas:** cada cambio de estado se aplica solo si el chat sigue en el estado esperado. Si dos acciones compiten (aceptar justo cuando vence), una gana y la otra recibe 409.

| Evento (servidor → navegador) | Destino | Cuándo |
|---|---|---|
| `chat:nuevo` | admin asignado | Consulta nueva o reasignada |
| `chat:actualizado` | ambos | Creada, aceptada o rechazada |
| `chat:mensaje` | ambos | Mensaje nuevo |
| `chat:finalizado` | ambos | Finalizada por el admin o por timeout |
| `chat:retirado` | admin anterior | La consulta pendiente pasó a otro admin |
| `chat:escribiendo` | el otro participante | Indicador "escribiendo…" |

Para probarlo, abrí dos navegadores (o una ventana normal y una privada): uno como `admin` y otro como `recepcion`. El detalle completo (diseño, flujos, archivos y verificación) está en [`docs/refactor-websockets.md`](docs/refactor-websockets.md).

---

## Asistente Gemini

Dentro de un chat **activo**, cualquiera de los dos participantes puede pedirle ayuda a **Gemini**, la inteligencia artificial de Google. Se escribe `@gemini` seguido de la pregunta, por ejemplo `@gemini ¿Cómo reservo una clase?`.

**Cómo funciona**

1. El mensaje se guarda y se envía al otro participante como cualquier otro.
2. Si empieza con `@gemini`, el servidor le envía la pregunta a Gemini junto con una instrucción de contexto (`src/services/geminiService.js`): es el asistente de TurnoFlex, responde en español, de forma breve y sin inventar datos.
3. La respuesta se guarda como un mensaje con `esIA: true` y `autor: null`, y se envía en tiempo real a los dos participantes. En pantalla aparece con la etiqueta **Gemini**.
4. Si falta la clave, si Gemini no responde en 10 segundos o si devuelve un error, el chat guarda el aviso "No pude responder en este momento. Intentá de nuevo más tarde." y sigue funcionando.

**Configuración**

- `GEMINI_API_KEY`: clave de la API. Se genera en [Google AI Studio](https://aistudio.google.com/api-key). Nunca se sube al repositorio: va en el `.env` o en las variables de entorno del despliegue.
- `GEMINI_MODEL`: modelo a usar (opcional). El material de clase usa `gemini-2.5-flash`, pero ya no está disponible para claves nuevas, por eso el valor por defecto es `gemini-3.5-flash-lite`.

**Decisiones y límites**

- El campo `autor` de los mensajes pasó a ser opcional, y se agregó `esIA`. Se perdió la garantía de que todo mensaje tenga un usuario asociado, pero se evitó crear una cuenta "gemini" en la colección de usuarios, que habría que proteger para que nadie inicie sesión con ella.
- El asistente solo responde dentro de un chat que un administrador ya aceptó, y contesta preguntas generales de uso: no consulta la base de datos.
- Depende de la disponibilidad de Google y de la cuota gratuita de la clave.

---

## API REST

Todas las rutas (salvo el login y el registro público de clientes) requieren un token válido, enviado en la cookie `token` (navegador) o en el header `Authorization: Bearer <token>`. Responden **401** sin token o con un token inválido, vencido o revocado, y **403** sin permiso.

```bash
TOKEN=$(curl -s -H "Content-Type: application/json" \
  -d '{"usuario":"admin","password":"admin123"}' \
  http://localhost:3000/api/auth/login | jq -r .token)

curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/clientes
```

La colección de Postman (`docs/TurnoFlex.postman_collection.json`) guarda el token de cada login y se puede correr completa en orden. Para recorrer todo el flujo de la carpeta "Chat de consultas" tiene que haber un admin conectado por Socket.io (la app abierta en el navegador como `admin`); si no lo hay, la consulta responde 503 y los pasos siguientes se saltean.

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | público | `{ usuario, password }`. Devuelve `{ token, usuario, nombre, rol }` y setea la cookie `token` |
| POST | `/api/auth/registro-clientes` | público | Crea el cliente y su usuario vinculado; inicia sesión y devuelve el mismo formato que el login |
| POST | `/api/auth/logout` | token | Invalida los tokens del usuario y borra la cookie |
| GET | `/api/auth/yo` | token | Usuario actual y sus permisos |
| GET/PUT | `/api/auth/yo/perfil` | cuenta cliente | Consultar/actualizar el propio perfil. Solo acepta nombre, apellido, teléfono y email; el DNI no se modifica |
| GET | `/api/clases/disponibles` | clases:read | Clases futuras (8 semanas), con cupo; marca las reservas propias del cliente y permite consulta semanal al profesor |
| POST | `/api/clases/:id/reservas` | clases:reservar | Reservar un lugar. El servidor comprueba cupo, fecha y superposiciones |
| GET | `/api/clases/para-reservar` | turnos:create | Clases futuras para asignar a un cliente desde la pantalla Reservas |
| POST | `/api/clases/:id/reservas-para-cliente` | turnos:create | Reservar `{ cliente }` en una clase existente |
| GET | `/api/clases/mis-reservas` | clases:reservar | Historial de reservas del cliente |
| GET | `/api/clases/reservas?estado=&fecha=` | turnos:read | Listar reservas (por contexto: cliente, profesor o personal) |
| PATCH | `/api/clases/reservas/:id/cancelar` | clases:cancelar | El cliente cancela su reserva antes del inicio; conserva el historial y libera el cupo |
| PATCH | `/api/clases/reservas/:id/cancelar-personal` | turnos:update | Recepción/admin cancela una reserva |
| PATCH | `/api/clases/reservas/:id/asistencia` | turnos:update | Admin o profesor responsable marca asistencia |
| DELETE | `/api/clases/reservas/:id` | turnos:delete | Eliminar una reserva cancelada |
| GET/POST/PUT | `/api/salas[/:id]` | salas:manage | Listar, crear y editar salas/capacidad/estado |
| GET/PUT | `/api/clases/configuracion` | clases:configurar | Consultar o cambiar duración (15–240 minutos) |
| GET/POST/PUT/DELETE | `/api/clases/horarios[/:id]` | clases:gestionar | El profesor gestiona sus horarios; el admin puede gestionar y asignar horarios a cualquier profesor |
| GET | `/api/clases/horarios/salas-disponibles?comienzaDesde=&horaInicio=&repetirSemanas=&profesional=` | clases:gestionar | Salas libres para las fechas, hora y profesor elegidos |
| GET | `/api/clientes` - `/api/clientes/:id` | clientes:read | Listar y ver detalle |
| POST | `/api/clientes` | clientes:create | Crear |
| PUT | `/api/clientes/:id` | clientes:update | Modificar |
| DELETE | `/api/clientes/:id` | clientes:delete | Eliminar |
| GET/POST/PUT/DELETE | `/api/profesionales[/:id]` | profesionales:\* | Igual que clientes |
| GET | `/api/usuarios` | usuarios:read | Listar |
| POST | `/api/usuarios` | usuarios:create | Crear |
| PUT | `/api/usuarios/:id` | usuarios:update | Modificar rol, estado, vencimiento, contraseña, etc. |
| DELETE | `/api/usuarios/:id` | usuarios:delete | Eliminar |
| GET | `/api/auditoria?accion=&usuario=` | auditoria:read | Últimos 100 eventos |
| GET | `/api/chats` | chat:usar | Admin: sus chats pendientes y activos. Cliente/recepción/profesional: su consulta abierta o la última cerrada en la última hora. Incluye `maxPorAdmin` |
| GET | `/api/chats/:id` | chat:usar | Ver un chat con sus mensajes (solo participantes) |
| POST | `/api/chats` | chat:usar | Cliente/recepción/profesional inician consulta `{ mensaje }`. 403 si sos admin, 409 si ya tenés una abierta, 503 sin operadores conectados |
| POST | `/api/chats/:id/aceptar` | chat:moderar | `pendiente` → `activo` (solo el admin asignado) |
| POST | `/api/chats/:id/rechazar` | chat:moderar | `pendiente` → `rechazado` |
| POST | `/api/chats/:id/finalizar` | chat:moderar | `activo` → `finalizado` |
| POST | `/api/chats/:id/mensajes` | chat:usar | Enviar mensaje `{ texto }` (solo con el chat `activo`, 409 si no). Si empieza con `@gemini`, el servidor agrega la respuesta del asistente |

---

## Despliegue

La aplicación se despliega en **Vercel** (que toma el código de la rama `main` de GitHub y detecta que es una aplicación Express) con la base de datos en **MongoDB Atlas**.

1. **MongoDB Atlas:** crear un cluster gratuito, un usuario de base de datos y habilitar el acceso de red desde cualquier dirección (`0.0.0.0/0`), porque Vercel no usa IP fijas. La base queda protegida por usuario y contraseña.
2. **Vercel:** importar el repositorio y cargar las variables de entorno `MONGO_URI`, `JWT_SECRET` y `GEMINI_API_KEY` (opcionalmente `GEMINI_MODEL`). Estos valores no se suben al repositorio.
3. **Datos:** correr `npm run seed` una vez con la `MONGO_URI` de Atlas. No volver a correrlo en una base con datos que se quieran conservar: borra todo.
4. Las variables nuevas solo las toman los despliegues que se hagan después de cargarlas (usar **Redeploy** si hace falta).

---

## Declaración de uso de IA

En esta entrega usamos **Claude Code** como asistente de programación para:

- proponer un plan de trabajo acotado al alcance pedido.
- generar correcciones del código de la migración a MongoDB/Mongoose, del sistema de usuarios, roles, permisos y auditoría, y del front.
- planificar e implementar el cambio de `express-session` a Passport + JWT, verificarlo y documentarlo en `docs/refactor-passport-jwt.md`.
- rediseñar las vistas Pug con Tailwind CSS 4 (paleta, navbar, sidebar, formularios y responsive), verificarlo y documentarlo en `docs/refactor-frontend.md`.
- planificar e implementar el chat de consultas en tiempo real con Socket.io (máquina de estados, asignación de admins, timeout en el servidor y panel lateral), verificarlo y documentarlo en `docs/refactor-websockets.md`.
- integrar el asistente Gemini en el chat (servicio, mensajes marcados como IA, manejo de demoras y errores) y guiar el despliegue en Vercel con MongoDB Atlas.
- redactar este README y el borrador de la documentación.

El grupo revisó, probó y ajustó todo el código generado. Además, la aplicación usa IA en su funcionamiento: el asistente Gemini del chat. Las decisiones de diseño (roles, permisos CRUD, alcance del MVP) fueron nuestras.

---

## Bibliografía

- Documentación de Mongoose: https://mongoosejs.com/docs/
- Passport: https://www.passportjs.org/docs/
- passport-local: https://www.passportjs.org/packages/passport-local/
- passport-jwt: https://www.passportjs.org/packages/passport-jwt/
- jsonwebtoken: https://github.com/auth0/node-jsonwebtoken
- bcryptjs: https://github.com/dcodeIO/bcrypt.js
- RFC 7519, JSON Web Token: https://datatracker.ietf.org/doc/html/rfc7519
- Express 5, manejo de errores: https://expressjs.com/en/guide/error-handling.html
- Tailwind CSS 4: https://tailwindcss.com/docs
- Tailwind CSS, uso por CDN (Play CDN): https://tailwindcss.com/docs/installation/play-cdn
- Pug: https://pugjs.org/api/getting-started.html
- MDN, Fetch API: https://developer.mozilla.org/es/docs/Web/API/Fetch_API
- MongoDB Manual: https://www.mongodb.com/docs/manual/
- Socket.io v4: https://socket.io/docs/v4/
- MongoDB Atlas: https://www.mongodb.com/docs/atlas/
- Vercel: https://vercel.com/docs
- Google AI Studio (claves de API de Gemini): https://aistudio.google.com/api-key
- Gemini API: https://ai.google.dev/gemini-api/docs
- SDK `@google/generative-ai`: https://www.npmjs.com/package/@google/generative-ai
