# La Force et la Douleur — Gym Tracker

App de seguimiento de entreno y peso corporal para Pablo.

## Deploy en Vercel (5 pasos)

### 1. Instalar dependencias
```bash
npm install
```

### 2. Subir a GitHub
```bash
git init
git add .
git commit -m "initial commit"
# Crea un repo en github.com y luego:
git remote add origin https://github.com/TU_USUARIO/gym-tracker.git
git push -u origin main
```

### 3. Conectar en Vercel
- Ve a vercel.com → New Project → importa el repo
- En el wizard de deploy, NO hagas click en Deploy todavía

### 4. Crear la base de datos
- En el proyecto de Vercel ve a **Storage → Create Database → Postgres**
- Nombre: `gym-tracker-db`
- Haz click en **Connect** — Vercel añade las variables de entorno automáticamente

### 5. Deploy
- Ahora sí haz click en **Deploy**
- La primera vez que abras la web, visita `/api/init` para crear las tablas

¡Listo! La URL será algo como `gym-tracker-pablo.vercel.app`

## Desarrollo local
```bash
# Copia las env vars desde Vercel
npx vercel env pull .env.local

# Arranca el servidor
npm run dev
# → http://localhost:3000
```
# gymTrack
