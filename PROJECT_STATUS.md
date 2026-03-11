# My_Dr — Estado del Proyecto y Guía de Continuación

> **Última actualización:** 2026-02-27  
> **Repo:** https://github.com/puntocero-dot/drpollito.git  
> **Rama principal:** `main` (única rama activa)  
> **Deploy:** Railway (3 servicios)

---

## 1. Descripción General

**My_Dr** es un Sistema de Gestión Médica Pediátrica con IA. Permite gestionar pacientes pediátricos, citas, consultas médicas, vacunación, documentos, exámenes de laboratorio y recetas, con un asistente de IA (Google Gemini) que sugiere diagnósticos diferenciales y analiza exámenes de lab.

---

## 2. Arquitectura

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Frontend    │────▶│  Backend API    │────▶│  PostgreSQL   │
│  React+Vite  │     │  Express/Node   │     │  (Railway)    │
│  Port: 8080* │     │  Port: 3001     │     │  Port: 5432   │
└─────────────┘     └────────┬────────┘     └──────────────┘
                             │
                    ┌────────▼────────┐
                    │  Google Gemini   │
                    │  (IA Médica)     │
                    └─────────────────┘
```

*El frontend usa el PORT que Railway inyecta (actualmente 8080).

### Monorepo (una sola raíz)

```
My_Dr/
├── backend/          ← Express API (Node 18)
├── frontend/         ← React SPA (Vite + TailwindCSS)
├── database/         ← init.sql (schema + seed)
├── docker-compose.yml
└── .gitignore
```

---

## 3. Stack Tecnológico

### Backend (`backend/`)
| Tecnología | Versión | Uso |
|---|---|---|
| Node.js | ≥18 | Runtime |
| Express | 4.18 | Framework HTTP |
| PostgreSQL | 15 | Base de datos |
| pg | 8.11 | Driver PostgreSQL |
| bcryptjs | 2.4 | Hash de contraseñas |
| jsonwebtoken | 9.0 | JWT auth |
| multer | 1.4 | Upload de archivos |
| @google/generative-ai | 0.24 | Gemini IA |
| resend | 6.9 | Emails transaccionales |
| express-validator | 7.0 | Validación de inputs |
| helmet | 7.1 | Seguridad HTTP headers |
| express-rate-limit | 7.1 | Rate limiting |
| winston | 3.11 | Logging |

### Frontend (`frontend/`)
| Tecnología | Versión | Uso |
|---|---|---|
| React | 18.2 | UI framework |
| Vite | 5.0 | Build tool |
| TailwindCSS | 3.4 | Estilos |
| React Router DOM | 6.21 | Routing SPA |
| Axios | 1.6 | HTTP client |
| Lucide React | 0.303 | Iconos |
| Recharts | 2.10 | Gráficas de crecimiento |
| React Three Fiber | 8.18 | Gráficas 3D de crecimiento |
| date-fns | 3.0 | Formateo de fechas |
| react-hook-form | 7.49 | Formularios |

---

## 4. Deployment en Railway

### Servicios Configurados

| Servicio | Root Directory | Tipo | URL Pública |
|---|---|---|---|
| **Frontend** | `frontend` | Dockerfile | `https://frontend-production-c880.up.railway.app` |
| **Backend** | `backend` | Dockerfile | `https://backend-production-e373.up.railway.app` |
| **Postgres** | — | Railway plugin | Internal: `postgres.railway.internal:5432` |

### Variables de Entorno en Railway

#### Backend
| Variable | Valor |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referencia Railway) |
| `JWT_SECRET` | (secreto configurado) |
| `JWT_EXPIRES_IN` | `7d` |
| `GEMINI_API_KEY` | (configurado) |
| `OPENAI_API_KEY` | (configurado, pero no se usa activamente) |
| `RESEND_API_KEY` | (necesita configurar para emails) |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `CORS_ORIGINS` | `https://frontend-production-c880.up.railway.app` |
| `APP_URL` | `https://frontend-production-c880.up.railway.app` |

#### Frontend
| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://backend-production-e373.up.railway.app/api` |

> **IMPORTANTE:** `VITE_API_URL` es una variable de **build-time** (Vite la embebe durante `npm run build`). Si se cambia, se requiere un **re-deploy** del frontend para que tome efecto. Railway pasa env vars como Docker build args automáticamente.

### Dockerfiles

**Frontend** (`frontend/Dockerfile`):
- Build: `node:18-alpine`, `npm ci`, `npm run build`
- Serve: `server.cjs` — servidor Node.js puro que sirve `dist/` como SPA
- **Nota:** El archivo se llama `server.cjs` (no `.js`) porque `package.json` tiene `"type": "module"` y el server usa CommonJS `require()`
- Escucha en `0.0.0.0:${PORT}` (PORT lo inyecta Railway, típicamente 8080)

**Backend** (`backend/Dockerfile`):
- Build: `node:18-alpine`, `npm ci --only=production`
- Ejecuta: `node src/index.js`
- Crea directorio `uploads/` para archivos subidos

### Conexión a DB en Producción
```javascript
// backend/src/config/database.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
```

### PostgreSQL Railway
- **URL Interna:** `postgres.railway.internal:5432` (usada por el backend)
- **URL Externa:** `<RAILWAY_PUBLIC_HOST>:<RAILWAY_PUBLIC_PORT>` (ver panel de Railway → Postgres → Connect)
- **Credenciales:** Ver variables de entorno en Railway (nunca commitear)
- **DB Name:** `railway`

---

## 5. Base de Datos — Schema Completo

### Enums
```sql
user_role: 'admin', 'doctor', 'secretary', 'insurer', 'parent'
user_status: 'active', 'inactive', 'suspended'
gender: 'male', 'female', 'other'
blood_type: 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'
appointment_status: 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'
appointment_type: 'first_visit', 'follow_up', 'emergency', 'vaccination', 'teleconsultation'
document_type: 'prescription', 'medical_certificate', 'disability', 'referral', 'lab_order', 'health_certificate', 'vaccination_card'
consultation_status: 'in_progress', 'completed', 'cancelled'
```

### Tablas (31 tablas)

| Tabla | Descripción | Estado |
|---|---|---|
| `clinics` | Clínicas registradas | ✅ |
| `users` | Todos los usuarios (todos los roles) | ✅ |
| `doctors` | Extensión de users para doctores (con `is_active`) | ✅ |
| `secretaries` | Extensión de users para secretarias | ✅ |
| `secretary_clinics` | Asignación secretaria↔clínica (M:M) | ✅ |
| `insurers` | Extensión de users para aseguradoras | ✅ |
| `parents` | Extensión de users para padres/tutores | ✅ |
| `patients` | Pacientes pediátricos | ✅ |
| `patient_parents` | Relación paciente↔padre (M:M) | ✅ |
| `emergency_contacts` | Contactos de emergencia por paciente | ✅ |
| `appointments` | Citas médicas | ✅ |
| `waiting_list` | Lista de espera | ✅ |
| `schedule_blocks` | Bloques de horario (init.sql original) | ✅ |
| `consultations` | Consultas/visitas médicas (vitales, diagnóstico, plan) | ✅ |
| `prescriptions` | Recetas médicas | ✅ |
| `prescription_items` | Items de receta (medicamentos con dosis) | ✅ |
| `lab_orders` | Órdenes de laboratorio (del init.sql original) | ✅ |
| `lab_results` | Resultados de laboratorio (del init.sql original) | ✅ |
| `lab_exams` | Exámenes de lab con archivos y análisis IA | ✅ Creada en migración |
| `vaccines` | Catálogo de vacunas | ✅ |
| `patient_vaccinations` | Vacunaciones aplicadas | ✅ |
| `documents` | Documentos generados (recetas PDF, certificados) | ✅ |
| `document_templates` | Templates de documentos por clínica | ✅ |
| `services` | Catálogo de servicios y precios | ✅ |
| `invoices` | Facturas | ✅ |
| `invoice_items` | Items de factura | ✅ |
| `insurance_claims` | Reclamos a aseguradoras | ✅ |
| `audit_logs` | Log de auditoría de todas las acciones | ✅ |
| `notifications` | Notificaciones para usuarios | ✅ |
| `growth_measurements` | Mediciones de crecimiento (peso, talla, etc.) | ✅ |
| `user_preferences` | Preferencias de usuario (JSONB) | ✅ Creada en migración |

### Migraciones Pendientes en Railway
Las siguientes tablas existen como archivos de migración en `backend/src/scripts/migrations/` pero **NO han sido ejecutadas** en Railway:

- `doctor_schedule_blocks` — Bloques de horario avanzados con recurrencia
- `doctor_working_hours` — Horarios laborales regulares por día
- `email_notifications` — Log de emails enviados
- Columnas adicionales en `appointments`: `confirmation_token`, `confirmed_at`, `reminder_sent_at`, `confirmation_sent_at`

**Archivos de migración:**
- `backend/src/scripts/migrations/add_preferences_and_schedule.sql`
- `backend/src/scripts/migrations/add_lab_exams.sql` (esta ya fue aplicada manualmente)

### Seed Data
- **Clínica:** Clínica Pediátrica Central (UUID: `11111111-...`)
- **Admin:** admin@mydr.com (role: `admin`)
- **Doctor:** doctor@mydr.com (role: `doctor`, JVPM-12345, Pediatría General)
- **Secretaria:** secretaria@mydr.com (role: `secretary`)
- **Vacunas:** 10 vacunas del esquema nacional de El Salvador
- **Servicios:** 5 servicios (Consulta Primera Vez, Control, Urgencia, Vacunación, Teleconsulta)

> [!CAUTION] 
> Contraseñas por defecto (ej: 123456) deben ser cambiadas inmediatamente en producción.

---

## 6. Backend — API Routes

### Autenticación (`/api/auth` — `routes/auth.js`)
| Método | Ruta | Auth | Roles | Descripción |
|---|---|---|---|---|
| POST | `/login` | No | — | Login con email+password, retorna JWT + user |
| POST | `/register` | No | — | Registro de usuario (si existe) |
| GET | `/me` | JWT | Todos | Obtener usuario actual |
| POST | `/change-password` | JWT | Todos | Cambiar contraseña |

### Usuarios (`/api/users` — `routes/users.js`)
| Método | Ruta | Auth | Roles | Descripción |
|---|---|---|---|---|
| GET | `/` | JWT | admin | Listar usuarios (filtros: role, status, search) |
| GET | `/:id` | JWT | medical staff | Obtener usuario por ID |
| POST | `/` | JWT | admin | Crear usuario (crea registro en doctors/parents/secretaries según rol) |
| PUT | `/:id` | JWT | admin | Actualizar usuario |
| DELETE | `/:id` | JWT | admin | Desactivar usuario (soft delete → status='inactive') |
| GET | `/role/doctors` | JWT | medical staff | Listar doctores activos |

### Pacientes (`/api/patients` — `routes/patients.js`)
| Método | Ruta | Auth | Roles | Descripción |
|---|---|---|---|---|
| GET | `/` | JWT | Todos | Listar pacientes (search, clinicId, limit, offset) |
| GET | `/:id` | JWT | Todos | Detalle de paciente con padres y contactos |
| POST | `/` | JWT | medical staff | Crear paciente |
| PUT | `/:id` | JWT | medical staff | Actualizar paciente |
| DELETE | `/:id` | JWT | admin | Eliminar paciente |

### Citas (`/api/appointments` — `routes/appointments.js`)
| Método | Ruta | Auth | Roles | Descripción |
|---|---|---|---|---|
| GET | `/` | JWT | Todos | Listar citas (doctorId, patientId, date, status) |
| GET | `/:id` | JWT | Todos | Detalle de cita |
| POST | `/` | JWT | medical staff | Crear cita |
| PUT | `/:id` | JWT | medical staff | Actualizar cita |
| PATCH | `/:id/status` | JWT | medical staff | Cambiar estado de cita |
| DELETE | `/:id` | JWT | medical staff | Cancelar cita |

### Consultas (`/api/consultations` — `routes/consultations.js`)
| Método | Ruta | Auth | Roles | Descripción |
|---|---|---|---|---|
| GET | `/` | JWT | Todos | Listar consultas |
| GET | `/:id` | JWT | Todos | Detalle de consulta con vitales, diagnóstico |
| POST | `/` | JWT | doctor, admin | Crear consulta (auto-crea doctor record para admin) |
| PATCH | `/:id/vitals` | JWT | doctor, admin | Registrar signos vitales + guardar en growth_measurements |
| PATCH | `/:id/diagnosis` | JWT | doctor, admin | Registrar diagnóstico y plan de tratamiento |
| PATCH | `/:id/complete` | JWT | doctor, admin | Completar consulta |
| GET | `/patient/:patientId/history` | JWT | Todos | Historial de consultas del paciente |

### Recetas (`/api/prescriptions` — `routes/prescriptions.js`)
| Método | Ruta | Auth | Roles | Descripción |
|---|---|---|---|---|
| GET | `/patient/:patientId` | JWT | Todos | Recetas del paciente |
| POST | `/` | JWT | doctor, admin | Crear receta con items (medicamentos) |
| GET | `/:id` | JWT | Todos | Detalle de receta |

### Vacunación (`/api/vaccinations` — `routes/vaccinations.js`)
| Método | Ruta | Auth | Roles | Descripción |
|---|---|---|---|---|
| GET | `/patient/:patientId` | JWT | Todos | Vacunaciones del paciente |
| GET | `/vaccines` | JWT | Todos | Catálogo de vacunas |
| POST | `/` | JWT | medical staff | Registrar vacunación |
| PUT | `/:id` | JWT | medical staff | Actualizar vacunación |
| DELETE | `/:id` | JWT | medical staff | Eliminar vacunación |

### Documentos (`/api/documents` — `routes/documents.js`)
| Método | Ruta | Auth | Roles | Descripción |
|---|---|---|---|---|
| GET | `/patient/:patientId` | JWT | Todos | Documentos del paciente |
| POST | `/` | JWT | medical staff | Crear documento |
| GET | `/:id` | JWT | Todos | Obtener documento |

### Exámenes de Lab (`/api/lab-exams` — `routes/labExams.js`)
| Método | Ruta | Auth | Roles | Descripción |
|---|---|---|---|---|
| GET | `/patient/:patientId` | JWT | Todos | Exámenes del paciente |
| GET | `/:id` | JWT | Todos | Detalle de examen |
| GET | `/file/:id` | JWT | Todos | Servir archivo adjunto |
| POST | `/` | JWT | medical staff | Crear examen (con upload de archivo) |
| POST | `/:id/analyze` | JWT | medical staff | Analizar imagen con Gemini IA |
| PUT | `/:id` | JWT | medical staff | Actualizar resultados |
| PATCH | `/:id/review` | JWT | medical staff | Marcar como revisado |
| DELETE | `/:id` | JWT | medical staff | Eliminar examen |

### IA (`/api/ai` — `routes/ai.js`)
| Método | Ruta | Auth | Roles | Descripción |
|---|---|---|---|---|
| POST | `/diagnostic-suggestions` | JWT | doctor, admin | Sugerencias de diagnóstico diferencial |
| POST | `/treatment-suggestions` | JWT | doctor, admin | Sugerencias de tratamiento |

### Dashboard (`/api/dashboard` — `routes/dashboard.js`)
| Método | Ruta | Auth | Roles | Descripción |
|---|---|---|---|---|
| GET | `/stats` | JWT | Todos | Estadísticas generales |
| GET | `/today` | JWT | Todos | Resumen del día (citas, pendientes) |

### Crecimiento (`/api/growth` — `routes/growth.js`)
| Método | Ruta | Auth | Roles | Descripción |
|---|---|---|---|---|
| GET | `/patient/:patientId` | JWT | Todos | Mediciones de crecimiento |
| GET | `/patient/:patientId/chart-data` | JWT | Todos | Datos para gráficas WHO |

### Preferencias (`/api/preferences` — `routes/preferences.js`)
| Método | Ruta | Auth | Roles | Descripción |
|---|---|---|---|---|
| GET | `/` | JWT | Todos | Obtener preferencias (o defaults) |
| PUT | `/` | JWT | Todos | Actualizar todas las preferencias |
| PATCH | `/:section` | JWT | Todos | Actualizar sección específica |

### Clínicas (`/api/clinics` — `routes/clinics.js`)
| Método | Ruta | Auth | Roles | Descripción |
|---|---|---|---|---|
| GET | `/` | JWT | Todos | Listar clínicas |
| POST | `/` | JWT | admin | Crear clínica |
| PUT | `/:id` | JWT | admin | Actualizar clínica |

### Horarios (`/api/schedule` — `routes/schedule.js`)
| Método | Ruta | Auth | Roles | Descripción |
|---|---|---|---|---|
| GET | `/doctor/:doctorId` | JWT | Todos | Horario del doctor |
| POST | `/working-hours` | JWT | doctor, admin | Configurar horario |
| GET | `/available-slots` | JWT | Todos | Slots disponibles |

### Health Check
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | No | `{ status: 'ok', timestamp: '...' }` |

---

## 7. Frontend — Páginas y Componentes

### Contextos (React Context)
| Contexto | Archivo | Propósito |
|---|---|---|
| `AuthContext` | `context/AuthContext.jsx` | Login/logout, user state, JWT management |
| `PreferencesContext` | `context/PreferencesContext.jsx` | Preferencias de usuario, conversión de unidades |

### Rutas y Protección por Rol

| Ruta | Página | Roles Permitidos | Descripción |
|---|---|---|---|
| `/login` | `Login.jsx` | Público | Login con email/password |
| `/dashboard` | `Dashboard.jsx` | Todos (autenticados) | Estadísticas, resumen del día |
| `/patients` | `Patients.jsx` | Todos | Lista de pacientes, búsqueda, crear |
| `/patients/:id` | `PatientDetail.jsx` | Todos | Detalle completo del paciente (tabs) |
| `/appointments` | `Appointments.jsx` | Todos | Gestión de citas |
| `/consultation/new` | `ConsultationEnhanced.jsx` | doctor, admin | Nueva consulta |
| `/consultation/:id` | `ConsultationEnhanced.jsx` | doctor, admin | Editar consulta existente |
| `/vaccinations` | `Vaccinations.jsx` | Todos | Registro de vacunación |
| `/documents` | `Documents.jsx` | Todos | Documentos médicos |
| `/users` | `Users.jsx` | admin | Gestión de usuarios |
| `/clinics` | `Clinics.jsx` | admin | Gestión de clínicas |
| `/settings` | `Settings.jsx` | Todos | Configuración y preferencias |

### Componentes Compartidos
| Componente | Archivo | Uso |
|---|---|---|
| `Layout` | `components/Layout.jsx` | Sidebar + top bar + dark mode toggle |
| `ConfirmDialog` | `components/ConfirmDialog.jsx` | Diálogos de confirmación |
| `GrowthCharts` | `components/GrowthCharts.jsx` | Gráficas de crecimiento 2D (Recharts) |
| `GrowthComparison3D` | `components/GrowthComparison3D.jsx` | Visualización 3D (Three.js) |

### PatientDetail — Tabs
El componente `PatientDetail.jsx` (51KB, el más grande) tiene múltiples tabs:
- **Información General:** Datos demográficos, padres, contactos de emergencia
- **Crecimiento:** Gráficas de peso/talla/perímetro cefálico vs WHO
- **Consultas:** Historial de consultas
- **Recetas:** Historial de prescripciones
- **Vacunación:** Estado de vacunación con esquema sugerido
- **Laboratorio:** Exámenes de laboratorio con análisis IA
- **Documentos:** Documentos generados

### Navegación del Sidebar (Layout.jsx)
- Dashboard
- Pacientes
- Citas
- Vacunación
- Documentos
- Usuarios (solo admin)
- Clínicas (solo admin)
- Configuración

---

## 8. Servicios de IA

### Gemini Service (`backend/src/services/geminiService.js`)
- **getDiagnosticSuggestions()** — Diagnóstico diferencial basado en síntomas, vitales, edad
- **getTreatmentSuggestions()** — Sugerencias de tratamiento con dosis pediátricas
- **analyzeLabExam()** — Análisis de imagen de examen de lab con Gemini Vision
- **Fallback:** Si `GEMINI_API_KEY` no está configurado, retorna mensaje indicando que se necesita la key

### Email Service (`backend/src/services/emailService.js`)
- **Proveedor:** Resend
- **Templates:** Cita creada, recordatorio, confirmación, cancelación
- **Estado:** Configurado pero requiere `RESEND_API_KEY` válido y dominio verificado en Resend

---

## 9. Autenticación y Seguridad

### JWT Flow
1. Login: `POST /api/auth/login` → retorna `{ token, user }`
2. Frontend guarda token en `localStorage`
3. Interceptor de Axios agrega `Authorization: Bearer <token>` a cada request
4. Backend middleware `authenticateToken` verifica el JWT y carga `req.user`
5. Middleware `requireRole('admin')`, `requireMedicalStaff` verifican permisos

### Middleware de Auth (`backend/src/middleware/auth.js`)
```
authenticateToken  → Verifica JWT, carga req.user desde DB
requireRole(...)   → Verifica que req.user.role esté en la lista
requireAdmin       → requireRole('admin')
requireDoctor      → requireRole('doctor')
requireSecretary   → requireRole('secretary')
requireMedicalStaff → requireRole('admin', 'doctor', 'secretary')
```

### Interceptor 401 en Frontend (`frontend/src/services/api.js`)
- Si un request retorna 401 y NO estamos en `/login`, limpia token y redirige a `/login`
- Previene loops de redirección en la página de login

### CORS
- Backend lee `CORS_ORIGINS` env var, split por coma
- En dev: `http://localhost:3000, http://127.0.0.1:3000`
- En prod: `https://frontend-production-c880.up.railway.app`

---

## 10. Desarrollo Local

### Requisitos
- Node.js ≥ 18
- Docker + Docker Compose (para PostgreSQL)

### Setup
```bash
# 1. Clonar repo
git clone https://github.com/puntocero-dot/drpollito.git
cd drpollito

# 2. Configurar env vars del backend
cp backend/.env.example backend/.env
# Editar backend/.env con valores reales

# 3. Levantar con Docker Compose
docker-compose up -d

# O levantar por separado:
# Terminal 1: PostgreSQL
docker-compose up postgres

# Terminal 2: Backend
cd backend && npm install && npm run dev

# Terminal 3: Frontend
cd frontend && npm install && npm run dev
```

### Puertos Locales
| Servicio | Puerto |
|---|---|
| Frontend (Vite dev) | 3000 |
| Backend (Express) | 3001 |
| PostgreSQL | 5434 (mapeado del 5432 interno) |

---

## 11. Historial de Problemas Resueltos (Deploy)

| # | Problema | Causa | Fix |
|---|---|---|---|
| 1 | Railway "Railpack could not determine how to build" | Monorepo sin Root Directory | Configurar Root Directory en cada servicio Railway |
| 2 | Frontend "npx not found" | `railway.json` tenía startCommand con npx | Usar Dockerfile con CMD propio |
| 3 | Frontend Nginx port issue | Railway inyecta PORT dinámico, nginx hardcodeaba 80 | Reemplazar nginx con Node.js server |
| 4 | Frontend `serve` bind issue | `serve` no bindeaba a 0.0.0.0 | Reemplazar con `server.cjs` custom |
| 5 | `require is not defined` | `package.json` tiene `"type": "module"` | Renombrar `server.js` → `server.cjs` |
| 6 | Frontend 502 después de fix | Dominio apuntaba a puerto 3000 pero app escucha en 8080 | Regenerar dominio con puerto correcto en Railway |
| 7 | Login 401 Unauthorized | Hash bcrypt en seed data era de "password", no "123456" | Generar hash correcto y UPDATE en Railway DB |
| 8 | GET /preferences 500 | Tabla `user_preferences` no existía | CREATE TABLE en Railway + actualizar init.sql |
| 9 | GET /lab-exams 500 | Tabla `lab_exams` no existía | CREATE TABLE en Railway + actualizar init.sql |
| 10 | POST /consultations 500 | Columna `doctors.is_active` no existía | ALTER TABLE en Railway + actualizar init.sql |

---

## 12. Estado Actual — QUÉ FUNCIONA

### ✅ Completado y Verificado
- [x] Deploy de 3 servicios en Railway (Frontend, Backend, PostgreSQL)
- [x] Frontend carga correctamente en `https://frontend-production-c880.up.railway.app`
- [x] Backend responde en `https://backend-production-e373.up.railway.app`
- [x] Healthcheck pasa en ambos servicios
- [x] Login con credenciales de prueba (admin@mydr.com / 123456)
- [x] CORS configurado correctamente
- [x] JWT auth funcional
- [x] Tablas `user_preferences`, `lab_exams`, `doctors.is_active` creadas en Railway DB
- [x] Schema completo de 31 tablas en `init.sql`

### ✅ Funcionalidad Implementada (código existe)
- [x] CRUD completo de pacientes
- [x] Sistema de citas con estados
- [x] Consultas médicas con vitales, diagnóstico, plan de tratamiento
- [x] Sistema de recetas con medicamentos y dosis
- [x] Registro de vacunación con esquema de El Salvador
- [x] Exámenes de laboratorio con upload de archivos
- [x] Análisis IA de exámenes con Gemini Vision
- [x] Sugerencias de diagnóstico diferencial con IA
- [x] Sugerencias de tratamiento con IA
- [x] Gráficas de crecimiento 2D y 3D
- [x] Dashboard con estadísticas
- [x] Gestión de usuarios y roles (admin)
- [x] Gestión de clínicas (admin)
- [x] Preferencias de usuario (unidades, tema, idioma)
- [x] Dark mode
- [x] Generación de documentos médicos
- [x] Log de auditoría
- [x] Email service (template ready, requiere Resend API key funcional)
- [x] Sistema de horarios de doctores

---

## 13. PENDIENTES Y MEJORAS

### 🔴 Alta Prioridad (Bugs/Bloqueantes)

1. **Verificar POST /api/users en producción**
   - Se reportó un 500 al crear usuario. Podría estar arreglado con las migraciones de DB, pero NO se ha re-testado.
   - Acción: Intentar crear un usuario desde el frontend y verificar.

2. **Migraciones de DB sin ejecutar en Railway**
   - `add_preferences_and_schedule.sql` contiene tablas para `doctor_schedule_blocks`, `doctor_working_hours`, `email_notifications` y columnas en `appointments`
   - El backend route `schedule.js` probablemente falla sin estas tablas
   - Acción: Ejecutar la migración en Railway DB

3. **Uploads de archivos en producción**
   - Los archivos se guardan en `uploads/` dentro del container Docker
   - **Problema:** Los containers en Railway son efímeros — los archivos se pierden en cada re-deploy
   - Acción: Migrar a almacenamiento persistente (Railway Volume, S3, o Cloudinary)

### 🟡 Media Prioridad

4. **Emails transaccionales**
   - El servicio de email (`emailService.js`) está configurado con Resend pero necesita:
     - API key válida de Resend
     - Dominio verificado para enviar emails
   - Afecta: Recordatorios de citas, confirmaciones

5. **Rate limiting en producción**
   - Actualmente el rate limiter se salta en `NODE_ENV=development`
   - En producción está activo: 1000 requests/min por IP
   - Acción: Verificar que es suficiente, ajustar si es necesario

6. **Dominio personalizado**
   - El usuario tiene `drpollito.puntocero.dev` en GoDaddy
   - Acción: Configurar CNAME en GoDaddy → Railway, actualizar `CORS_ORIGINS` y `VITE_API_URL`

7. **Gzip/Compression en server.cjs**
   - El `server.cjs` del frontend no comprime respuestas
   - El bundle JS es ~800KB (215KB gzip)
   - Acción: Agregar compression al server o code-splitting en Vite

8. **Code splitting del frontend**
   - Vite advierte que el chunk principal es >500KB
   - Acción: Usar `React.lazy()` + dynamic imports para pages

### 🟢 Baja Prioridad / Mejoras Futuras

9. **Rol `parent` (Padre/Tutor)**
   - El rol existe en el enum y tabla pero NO hay vista de frontend dedicada para padres
   - Flujo: Los padres deberían poder ver información de sus hijos, citas, vacunaciones

10. **Rol `insurer` (Asegurador)**
    - El rol existe en el enum y tabla pero NO hay funcionalidad implementada
    - Flujo: Las aseguradoras deberían poder ver/aprobar reclamos de `insurance_claims`

11. **Reportes y analytics avanzados**
    - Dashboard tiene stats básicos, pero no hay reportes exportables

12. **Tests**
    - No hay tests unitarios ni de integración
    - `package.json` tiene script `test: jest` pero no hay archivos de test

13. **Notificaciones in-app**
    - Tabla `notifications` existe pero no hay UI ni lógica de notificaciones push

14. **Facturación completa**
    - Tablas `invoices`, `invoice_items` existen pero no hay ruta de backend ni UI

15. **Waiting list UI**
    - Tabla `waiting_list` existe pero no hay funcionalidad visible en frontend

---

## 14. Archivos Clave para Referencia Rápida

```
backend/
├── src/
│   ├── index.js                    ← Entry point, Express config, route mounting
│   ├── config/
│   │   ├── database.js             ← Pool de PostgreSQL
│   │   └── logger.js               ← Winston logger
│   ├── middleware/
│   │   ├── auth.js                 ← JWT auth + role middleware
│   │   └── audit.js                ← Auditoría de acciones
│   ├── routes/
│   │   ├── auth.js                 ← Login, register, /me, change-password
│   │   ├── users.js                ← CRUD usuarios (admin)
│   │   ├── patients.js             ← CRUD pacientes
│   │   ├── appointments.js         ← CRUD citas
│   │   ├── consultations.js        ← Consultas + vitales + diagnóstico
│   │   ├── prescriptions.js        ← Recetas médicas
│   │   ├── vaccinations.js         ← Vacunación
│   │   ├── labExams.js             ← Exámenes de lab + IA
│   │   ├── documents.js            ← Documentos médicos
│   │   ├── ai.js                   ← Endpoints de IA
│   │   ├── growth.js               ← Mediciones de crecimiento
│   │   ├── dashboard.js            ← Estadísticas
│   │   ├── preferences.js          ← Preferencias de usuario
│   │   ├── clinics.js              ← Gestión de clínicas
│   │   └── schedule.js             ← Horarios de doctores
│   ├── services/
│   │   ├── geminiService.js        ← Google Gemini IA
│   │   └── emailService.js         ← Resend emails
│   └── scripts/
│       └── migrations/             ← SQL de migraciones
├── Dockerfile
├── package.json
└── .env.example

frontend/
├── src/
│   ├── main.jsx                    ← React entry point
│   ├── App.jsx                     ← Router + ProtectedRoute
│   ├── index.css                   ← TailwindCSS imports
│   ├── context/
│   │   ├── AuthContext.jsx          ← Auth state + login/logout
│   │   └── PreferencesContext.jsx   ← Preferences + unit conversion
│   ├── services/
│   │   └── api.js                  ← Axios instance + interceptors
│   ├── components/
│   │   ├── Layout.jsx              ← Sidebar + header + dark mode
│   │   ├── ConfirmDialog.jsx       ← Modal de confirmación
│   │   ├── GrowthCharts.jsx        ← Gráficas 2D
│   │   └── GrowthComparison3D.jsx  ← Gráficas 3D
│   └── pages/
│       ├── Login.jsx
│       ├── Dashboard.jsx
│       ├── Patients.jsx
│       ├── PatientDetail.jsx       ← 51KB, componente más complejo (tabs)
│       ├── Appointments.jsx
│       ├── Consultation.jsx        ← Versión básica (no usada)
│       ├── ConsultationEnhanced.jsx ← Versión completa con IA
│       ├── Vaccinations.jsx
│       ├── Documents.jsx
│       ├── Users.jsx
│       ├── Clinics.jsx
│       └── Settings.jsx
├── server.cjs                      ← Node.js static server para producción
├── railway.json                    ← Config de deploy Railway
├── Dockerfile
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── package.json                    ← "type": "module"

database/
└── init.sql                        ← Schema completo + seed data
```

---

## 15. Comandos Útiles

### Ejecutar migración en Railway DB
```bash
# Desde la raíz del proyecto, usando la URL pública de PostgreSQL:
node -e "
const { Client } = require('pg');
const fs = require('fs');
const c = new Client({
  connectionString: process.env.DATABASE_PUBLIC_URL, // obtener de Railway → Postgres → Connect
  ssl: { rejectUnauthorized: false }
});
c.connect()
  .then(() => c.query(fs.readFileSync('./backend/src/scripts/migrations/YOUR_MIGRATION.sql', 'utf8')))
  .then(() => { console.log('Done'); c.end(); })
  .catch(e => { console.error(e.message); c.end(); });
"
```

### Deploy manual (Railway auto-deploya en push a main)
```bash
git add .
git commit -m "description"
git push origin main
# Railway detecta el push y re-deploya ambos servicios (~2-3 min)
```

### Verificar estado de deploy
- Frontend: `https://frontend-production-c880.up.railway.app`
- Backend health: `https://backend-production-e373.up.railway.app/health`

---

## 16. Notas Importantes para el Siguiente Desarrollador

1. **`VITE_API_URL` es build-time.** Si cambias la URL del backend, debes re-deployar el frontend. No es una variable de runtime.

2. **`server.cjs` no `server.js`.** El frontend package.json tiene `"type": "module"`. El server usa CommonJS (`require`), así que DEBE ser `.cjs`.

3. **Railway inyecta PORT.** No hardcodear puertos. El backend usa `process.env.PORT || 3001`. El frontend `server.cjs` usa `process.env.PORT || 3000`. Railway típicamente asigna 8080.

4. **SSL en producción.** La conexión a PostgreSQL usa `ssl: { rejectUnauthorized: false }` cuando `NODE_ENV=production`.

5. **Uploads son efímeros.** Los archivos subidos a `backend/uploads/` se pierden en cada re-deploy de Railway. Esto afecta: fotos de perfil, archivos de exámenes de lab, documentos.

6. **El init.sql es la fuente de verdad** para el schema. Las migraciones en `backend/src/scripts/migrations/` son incrementales y algunas ya están integradas en init.sql, otras no.

7. **Seguridad y contraseñas.** Todas las contraseñas deben ser seguras y únicas. Nunca compartir credenciales en texto plano.

8. **Consultas creadas por admin** auto-crean un doctor record (`ADMIN-LICENSE`) para el admin si no existe uno. Esto usa `ON CONFLICT (user_id) DO UPDATE SET is_active = true`.

9. **La tabla `Consultation.jsx` (5KB) no se usa.** La versión activa es `ConsultationEnhanced.jsx` (39KB) que incluye IA.

10. **Docker Compose** es para desarrollo local. Railway usa los Dockerfiles individuales.
