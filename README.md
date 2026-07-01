# Explorador PAI EDIL — con chat

Explorador interactivo del flujo de ejecución del PAI EDIL (secuencia cronológica,
bloques del proceso, procesos transversales, glosario, perfiles ALDEA y cuestiones
pendientes), con un chat que responde preguntas en lenguaje natural **usando
exclusivamente el contenido documentado en esta misma herramienta**.

## Arquitectura (por qué hay dos carpetas)

```
frontend/index.html   → página estática. Se publica en GitHub Pages.
worker/                → servidor intermedio. Se publica en Cloudflare (gratis).
```

Un repositorio de GitHub **público** significa que todo su contenido es visible
para cualquiera, incluido el historial de commits. Por eso **la clave de la API
de Claude nunca puede estar en este repositorio**: si la pusiéramos en
`frontend/index.html`, cualquiera que visite la página podría leerla en el código
fuente y usarla a tu costa.

La solución estándar es un pequeño servidor intermedio ("proxy") que:
1. Recibe la pregunta desde el navegador (sin la clave).
2. Añade la clave de API él mismo (la tiene guardada de forma privada, no en el repo).
3. Llama a la API de Claude y devuelve solo la respuesta.

Ese servidor es el `worker/`, pensado para desplegarse gratis en
[Cloudflare Workers](https://workers.cloudflare.com/) (no requiere tarjeta de
crédito en el plan gratuito, con margen de sobra para un uso de consulta puntual).

## Paso 1 — Desplegar el servidor intermedio (worker)

No hace falta instalar nada en tu ordenador: puedes hacerlo entero desde el
navegador.

1. Crea una cuenta gratuita en [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
2. En el menú lateral, ve a **Workers y Pages → Create → Create Worker**.
3. Ponle un nombre, por ejemplo `pai-edil-proxy`, y pulsa **Deploy** (se crea con
   un código de ejemplo; lo sustituiremos).
4. Pulsa **Edit code**. Borra todo el contenido y pega el de este repositorio:
   [`worker/src/index.js`](./worker/src/index.js).
5. Pulsa **Deploy** (o "Save and deploy") para publicar el código.
6. Ve a **Settings → Variables and Secrets** de ese Worker y añade **dos secretos**:
   - `ANTHROPIC_API_KEY`: tu clave de la API de Claude (la generas en
     [console.anthropic.com](https://console.anthropic.com/settings/keys)).
   - `ACCESS_KEY`: la clave que vas a compartir con tu equipo para poder usar
     la herramienta — no tiene que ver con la clave de Anthropic; puede ser
     cualquier palabra o código que decidas, por ejemplo `edil2027`.

   Y una variable normal (no secreta):
   - `ALLOWED_ORIGIN`: el dominio donde vas a publicar el frontend, por ejemplo
     `https://tu-usuario.github.io` (puedes dejarla como `*` mientras pruebas,
     pero restringirla es más seguro una vez publicado).
7. Guarda. Cloudflare te da una URL del tipo:
   `https://pai-edil-proxy.tu-usuario.workers.dev` — cópiala, la necesitas en el
   paso 3.

**Alternativa con línea de comandos** (si prefieres usar `wrangler` en tu
ordenador en vez del editor web): dentro de `worker/`, ejecuta:
```
npm install
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ACCESS_KEY
npx wrangler deploy
```

## Paso 2 — Publicar el frontend en GitHub Pages

1. Crea un repositorio nuevo en GitHub (puede ser público; no contendrá ninguna
   clave).
2. Sube el contenido de esta carpeta completa (incluida `frontend/`, `worker/`,
   este `README.md` y el `.gitignore`).
3. En el repositorio, ve a **Settings → Pages**.
4. En "Build and deployment", elige **Deploy from a branch**, rama `main`, y
   carpeta `/frontend` (o `/root` si prefieres mover `index.html` a la raíz del
   repositorio — a elección tuya).
5. Guarda. GitHub te da una URL del tipo:
   `https://tu-usuario.github.io/nombre-del-repo/`

## Paso 3 — Conectar el frontend con tu servidor

1. Abre `frontend/index.html`.
2. Busca esta línea (cerca del final del archivo, sección `CHAT`):
   ```js
   const API_ENDPOINT = "";
   ```
3. Sustitúyela por la URL de tu Worker del paso 1:
   ```js
   const API_ENDPOINT = "https://pai-edil-proxy.tu-usuario.workers.dev";
   ```
4. Guarda, haz commit y push. GitHub Pages se actualiza automáticamente en uno
   o dos minutos.
5. Abre tu página publicada y prueba el chat.

## Clave de acceso para el equipo

La herramienta ahora pide una clave antes de mostrar nada (pantalla "Acceso
restringido"). Es importante entender **qué protege realmente cada capa**:

- **La pantalla de acceso (frontend)** es una barrera de uso, no una barrera
  criptográfica: como el archivo `index.html` es público (GitHub Pages siempre
  lo es), cualquiera con conocimientos técnicos podría leer el código fuente y
  saltársela. No pongas en el explorador ningún dato realmente confidencial
  contando solo con esta pantalla.
- **El Worker sí protege de verdad lo único que tiene coste real: el chat.**
  Cada pregunta que se envía incluye la clave, y el servidor la compara con el
  secreto `ACCESS_KEY` antes de gastar ni un token de la API de Claude. Si
  alguien se salta la pantalla del frontend pero no conoce la clave, el chat le
  devolverá "Clave de acceso incorrecta" y no se realizará ninguna llamada a
  Anthropic.

En resumen: para un equipo interno que simplemente no quieres que use un
enlace suelto por error, esta combinación es más que suficiente. Si en el
futuro necesitas protección real de contenido sensible, la vía correcta es
[Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) delante de GitHub Pages (gratuito hasta 50 usuarios), y puedo ayudarte a configurarlo si llega el caso.

**Compartir y rotar la clave**: comunica `ACCESS_KEY` a tu equipo por un canal
privado (no por email abierto ni por el propio repositorio). Si alguien deja
el equipo o sospechas que se ha filtrado, cambia el secreto en Cloudflare
(`wrangler secret put ACCESS_KEY` o desde el panel web) — se aplica al
instante, sin tocar el frontend.

## Añadir documentación de referencia

El explorador incluye una sección "Documentación de referencia" pensada para
ir añadiendo documentos según se publiquen (nuevas guías, resoluciones,
FAQ, etc.), sin tener que reconstruir toda la herramienta.

Para añadir un documento:

1. Abre `frontend/index.html` y busca el array `REFERENCIAS` (cerca de
   `CUESTIONES`).
2. Añade un nuevo objeto siguiendo el mismo formato:
   ```js
   {
     titulo: "Nombre del documento",
     fecha: "Marzo 2027",
     tipo: "Guía",              // o "Resolución", "FAQ", "Modificación normativa", etc.
     resumen: "Qué aporta o qué cambia respecto a lo anterior, en 1-2 frases.",
     url: "https://enlace-al-documento-si-existe"   // deja "" si no hay enlace público
   }
   ```
3. Elimina la entrada de ejemplo la primera vez que añadas contenido real.
4. Guarda, haz commit y push. GitHub Pages se actualiza solo en uno o dos
   minutos.

Estas entradas también se incluyen automáticamente en el contexto que recibe
el chat (`buildContext()`), así que el asistente podrá responder preguntas
sobre los documentos añadidos, y aparecen en la búsqueda rápida por palabra
clave.

## Coste

Cada pregunta consume tokens de la API de Claude, facturados a tu cuenta de
Anthropic (no a Anthropic ni a Cloudflare de forma gratuita — la clave es tuya).
El Worker usa por defecto el modelo `claude-haiku-4-5-20251001` (el más
económico) y limita cada respuesta a 1024 tokens para mantener el coste bajo.
Consulta los precios actualizados en
[docs.claude.com](https://docs.claude.com) antes de darle uso intensivo, y
valora añadir un límite de peticiones (por ejemplo, con Cloudflare Turnstile o
un límite por IP usando Cloudflare KV) si vas a compartir el enlace
públicamente.

## Mantenimiento del contenido

Todo el contenido (bloques, glosario, cuestiones pendientes) vive en
`frontend/index.html`, en las mismas constantes JavaScript que ya usa el
buscador y los desplegables (`BLOCKS`, `TRANSVERSAL`, `GLOSARIO`, `CUESTIONES`,
etc.). El chat construye automáticamente su contexto a partir de esas mismas
constantes (función `buildContext()`), así que **no hay que mantener el
contenido dos veces**: si actualizas un bloque en el explorador, el chat
responderá con la versión actualizada.

## Seguridad — resumen

- ✅ La clave de la API de Claude y la clave de acceso del equipo viven solo
  en Cloudflare, como secretos cifrados independientes.
- ✅ El código público (`frontend/` y `worker/src/index.js`) no contiene
  ninguna clave.
- ✅ El Worker valida la clave de acceso antes de gastar ningún token de la
  API, y usa comparación en tiempo constante para no filtrarla por temporización.
- ✅ El Worker limita el tamaño de los mensajes y el número de turnos por
  petición para reducir el riesgo de abuso.
- ⚠️ La pantalla de acceso del frontend es un filtro de uso, no una barrera
  criptográfica (ver "Clave de acceso para el equipo" más arriba).
- ⚠️ Si publicas el enlace ampliamente, restringe `ALLOWED_ORIGIN` a tu dominio
  real y valora añadir un límite de peticiones — el plan gratuito de Cloudflare
  tiene un tope diario de invocaciones.
