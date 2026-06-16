# MyAlbum — Estado del Proyecto

**Última actualización:** 2026-06-16  
**Producción:** https://myalbum-green.vercel.app  
**Repo:** https://github.com/wbedon/myalbum (rama `master`, deploy automático via Vercel)  
**Supabase:** proyecto `bsowrexmnvipyifhewqz`

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 13.5.11 + Tailwind CSS |
| Backend / DB | Supabase (PostgreSQL + Storage + Auth + Realtime) |
| Deploy | Vercel (free tier) |
| Email | Brevo API (300/día gratis) |
| Push notifications | Web Push con VAPID (service worker PWA) |
| IA bg removal | @imgly/background-removal 1.7.0 — modelo `medium`, 100% en browser |

---

## Roles de usuario

| Rol | Acceso |
|-----|--------|
| `superadmin` | Panel admin completo: campañas, plantillas, usuarios |
| `organizer` | Dashboard con sus campañas asignadas; acceso al creador de stickers |
| `member` | Acceso a sus campañas como participante |

**Credenciales de prueba:**

| Username | Email | Contraseña | Rol |
|----------|-------|-----------|-----|
| admin | rbedon1983@gmail.com | Admin.2026 | superadmin |
| wbedon1983 | rbedon1983+wbedon@gmail.com | Will.123 | organizer |
| williamroberto83 | rbedon1983+test@gmail.com | Will.123 | member |

---

## Features completadas

### Creador de stickers
- Upload de foto + borrado de fondo con IA (browser-side, sin servidor)
- Editor: drag, crop, resize de cutout y capa de uniforme independiente
- 5 plantillas: Argentina, Brasil, Colombia, Ecuador, Venezuela (+ uniform_url en Storage)
- Nombre del jugador (óvalo superior) y club (óvalo inferior)
- Captura por cámara del dispositivo (selector multi-cámara)
- Descarga PNG final

### Campañas / Álbum colectivo
- CRUD completo de campañas (superadmin)
- Slots: agregar individual, creación masiva (rango "1-22"), **editar etiqueta inline** (lápiz), eliminar
- Asignación de slot a participante
- Stickers: draft → pending → approved/rejected; 1 sticker por usuario por campaña
- Sobres/packs: generación, apertura con reveal overlay, colección
- Intercambios: ofrecer duplicado, solicitar, aceptar/rechazar
- Galería interna: grilla por slot, filtros, ordenar, exportar ZIP
- Reacciones con emoji (6 quick + picker de 24); toggle por usuario
- Comentarios: post, delete propio, moderación admin
- Ranking de participantes con barra de progreso
- Tab Stats (solo admin): reacciones, comentarios, actividad reciente
- Notificaciones in-app: badge, dropdown, marca leídas, realtime via Supabase Realtime
- Notificaciones por email (Brevo): sticker aprobado/rechazado, trade pedido/aceptado, sobre disponible, comentario nuevo
- Web Push: service worker PWA, notificación al llegar notif en background
- PDF export del álbum (window.print, grid A4)

### Álbum digital (Mi Álbum)
- Libro paginado con `react-pageflip`: portada, páginas de slots (2×2), contraportada
- **Fixes móvil (2026-06-16):** doble-rAF scroll preservation, `touch-action: none`, `overflow-anchor: none`, `mobileScrollSupport={false}`, `showPageCorners={false}`, `flippingTime=400ms`

### Páginas públicas (sin login)
- `/gallery/[albumId]` — galería pública con stickers aprobados + reacciones (RLS anon)
- `/u/[username]` — perfil público del participante
- `/explore` — lista de todos los álbumes públicos

### Perfil de usuario
- Modal de perfil: avatar con iniciales, bio editable, stats, logros (9 tipos)
- Username editable (regex `[a-zA-Z0-9_]{3,20}` + unicidad)
- Cambiar contraseña desde el perfil
- Links a perfil público (`/u/[username]`)

### Auth
- Login email+contraseña, registro con username
- Forgot password / reset password
- Forzar cambio de contraseña en primer login (organizadores invitados)
- Sesión cierra al cerrar el navegador (sessionStorage)

### Panel superadmin
- **Campañas:** CRUD completo + editar álbum (nombre, desc, pack_size), portada/contraportada, compartir público/privado
- **Plantillas:** subir, editar (nombre, orden, imagen, uniforme), activar/desactivar, eliminar
- **Usuarios:** listar todos, invitar por email (genera link Supabase + email Brevo), cambiar rol, forzar cambio de contraseña, eliminar

### Dashboard organizador
- Vista exclusiva: lista campañas asignadas, acceso directo a cada álbum

---

## Migraciones Supabase aplicadas

| # | Descripción |
|---|-------------|
| 001 | Schema inicial (profiles, templates) |
| 002 | name_band en plantillas |
| 003 | Campañas, album_slots, invitations + RLS |
| 004 | Tabla stickers + RLS + storage bucket |
| 005 | Packs (packs, pack_items, collection) + RPCs |
| 006 | Intercambios (trade_offers, trade_requests) + RPCs |
| 007 | Notifications + triggers |
| 008 | Profiles extendido (bio) + RPC get_user_stats |
| 009 | Achievements (9 tipos, triggers automáticos) |
| 010 | sticker_reactions + RPC toggle_reaction |
| 011 | albums.is_public + RPC get_public_album |
| 012 | RPC get_album_stats |
| 013 | push_subscriptions + trigger web push |
| 014-015 | Email notifications via pg_net |
| 016 | RLS superadmin para templates + storage |
| 017 | uniform_url en templates |
| 018-022 | Cover templates + album covers + ediciones |
| 023 | Rol organizer en profiles |
| 024 | Fix profiles RLS |
| 025 | must_change_password en profiles |
| 026 | Drop tabla uniforms (obsoleta) |
| 027 | email_log (cuota + cooldown) |
| 028 | Unique constraint: 1 sticker por usuario por campaña |
| 029 | Fix RLS UPDATE stickers |
| 030 | SECURITY DEFINER en trigger notify_sticker |
| 031 | slot_assignment (assigned_user_id en album_slots) |
| 032 | Metadata de edición en stickers |
| 033 | sticker_comments + RLS |
| 034 | Trigger notify_on_comment (sticker_commented) |
| 035 | RLS admin DELETE comments |
| 036 | RLS anon SELECT albums + stickers públicos |
| 037 | RLS anon SELECT profiles |
| 038 | RLS anon SELECT sticker_reactions |

---

## Archivos clave

```
app/
  page.tsx                    # Entry point (AuthGate + HomeContent)
  reset-password/page.tsx     # Reset de contraseña
  unirse/[token]/page.tsx     # Join campaign via invitación
  gallery/[albumId]/page.tsx  # Galería pública (Server Component)
  u/[username]/page.tsx       # Perfil público (Server Component)
  explore/page.tsx            # Explorar álbumes (Server Component)
  api/
    email/send/route.ts       # Envío de emails (Brevo)
    invite/route.ts           # Invitar usuario (Supabase Admin API)
    push/subscribe|send/      # Web Push endpoints
    users/route.ts            # CRUD usuarios (Admin API)

components/
  AuthGate.tsx                # Login / Registro / Forgot password
  HomeContent.tsx             # Home por rol (superadmin / organizer / member)
  AdminPanel.tsx              # Panel superadmin (tabs: Campañas, Plantillas, Usuarios)
  CampaignDetail.tsx          # Vista campaña (todos los tabs por rol)
  StickerEditor.tsx           # Creador de stickers (upload, IA, composición)
  GalleryView.tsx             # Galería interna + reacciones + comentarios
  AlbumBookInner.tsx          # Libro digital paginado (react-pageflip)
  NotificationsPanel.tsx      # Campana + dropdown notificaciones
  UserProfileModal.tsx        # Modal perfil (bio, stats, logros, username, pw)
  UserManager.tsx             # Gestión usuarios (superadmin)
  TemplateManager.tsx         # Gestión plantillas (superadmin)

lib/
  supabase.ts                 # Cliente Supabase + tipos TypeScript
  email.ts                    # Servicio email centralizado (Brevo)

public/
  manifest.json               # PWA manifest
  sw.js                       # Service worker (offline + push)
  icons/                      # Iconos PWA 192/512
  img/hero/                   # Imágenes hero (webp)
  uniforms/                   # PNGs de uniformes (fallback local)

supabase/migrations/          # 38 migraciones aplicadas en producción
```

---

## Pendiente (backlog)

| ID | Feature | Descripción |
|----|---------|-------------|
| A | Notificación `sticker_reacted` | Trigger SQL que inserta en `notifications` cuando alguien reacciona al sticker de un usuario. Incluye tipo nuevo en NotificationsPanel y email via Brevo. |
| B | Comentarios en galería pública | En `/gallery/[albumId]`, click en el count de comentarios abre una lista read-only de los comentarios del sticker. Sin auth requerido. |
| C | Filtro por usuario en galería pública | En `/gallery/[albumId]`, click en el nombre/avatar de un participante filtra la grilla para mostrar solo sus stickers. |
| D | Bulk-edit de etiquetas de slots | En la pestaña Slots del panel admin, un textarea con formato `1:Portero\n2:Defensa\n3:Arquero` que actualiza todas las etiquetas de un golpe via UPDATE masivo. |
| E | Exportar participantes a CSV | En la pestaña Participantes, botón que descarga CSV con username, email, slot asignado y estado del sticker. |
| F | Fecha límite de envío de stickers | Campo fecha/hora en "Editar álbum". Pasada esa fecha el formulario de envío se bloquea y muestra "Período cerrado". Countdown visible mientras está activo. |
| G | Buscador en galería interna | Campo de búsqueda que filtra stickers por número de slot o etiqueta (ej: "Portero", "3"). |

---

## Variables de entorno requeridas (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
BREVO_API_KEY
BREVO_SENDER_EMAIL
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_EMAIL
PUSH_API_SECRET
```
