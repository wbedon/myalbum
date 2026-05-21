# MyAlbum — TODO / Pendientes

## Inpainting (modo "Fondo sin persona")

**Estado:** pausado. Intentado y revertido (2026-05-19).

**Funcionalidad esperada:** que el usuario pueda elegir, después del recorte
de fondo, una segunda salida en la que se **borra a la persona** y se
**reconstruye el fondo** que estaba detrás de ella, alucinando los píxeles
ocultos con un modelo de IA.

### Intento fallido (no usar)

Se asumió la existencia de un paquete npm `inpaint-web` que en realidad
no existe. El proyecto `lxfater/inpaint-web` es una webapp standalone,
no una librería distribuida por npm. Se revirtió toda la rama y se
documentó este pendiente para retomar más adelante.

### Plan B — Hugging Face Inference API (recomendado para retomar)

Implementación en dos partes:

1. **API route en Next.js** (`app/api/inpaint/route.ts`)
   - Recibe el archivo de imagen original + máscara binaria (multipart o base64)
   - Llama a HF Inference API con el token guardado como `HF_TOKEN` env var
   - Devuelve la imagen reconstruida al cliente

2. **UI en `PhotoUploader.tsx`**
   - Reintroducir el toggle `Persona` / `Fondo sin persona`
   - Recrear helpers `lib/mask.ts` (extraer máscara binaria del cutout)
   - Llamar al endpoint `/api/inpaint` en vez de un modelo local
   - Cachear el resultado para que el toggle vaya y vuelva sin recalcular

**Modelo sugerido:** `stabilityai/stable-diffusion-2-inpainting` (HF). Si
es muy lento o costoso para free tier, alternativa: `runwayml/stable-diffusion-inpainting`.

**Costo:** 0 USD en free tier de HF (rate-limited). Token se obtiene en
huggingface.co/settings/tokens y se guarda en Vercel como env var
`HF_TOKEN` (server-side, no expuesta al browser).

**Riesgos:**
- Free tier de HF tiene "cold starts" de 20-30 seg si el modelo lleva rato sin uso.
- Rate limits no documentados con precisión: si MyAlbum tiene tráfico real, podría requerir suscripción Pro de HF (~9 USD/mes) o cambiar a Replicate.
- Calidad de Stable Diffusion Inpainting es buena pero "inventa" detalles obvios cuando el área a rellenar es muy grande respecto a la imagen.

### Plan C — LaMa ONNX directo con `onnxruntime-web`

Más laborioso (~4-6 horas) pero 100% client-side y sin dependencia de
APIs externas. Solo retomarlo si HF deja de ser viable.

### Plan D — Inpainting clásico (OpenCV.js)

Última opción. Funciona pero la calidad es pobre para áreas grandes
(personas enteras). Útil solo para "tocar" defectos pequeños.
