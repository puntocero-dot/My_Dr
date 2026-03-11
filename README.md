# My_Dr - Sistema de Gestión Médica Pediátrica con IA

Sistema completo para clínicas pediátricas con asistente de IA para diagnósticos.

## Arquitectura

```
my_dr/
├── backend/          # Node.js + Express API (Puerto 3001)
├── frontend/         # React + Vite + Tailwind CSS (Puerto 3000)
├── database/         # PostgreSQL schemas
└── docker-compose.yml
```

## Roles del Sistema

| Rol | Permisos |
|-----|----------|
| **Admin** | CRUD completo, configuración, analytics, gestión de usuarios y clínicas |
| **Doctor** | Expedientes, historial, IA diagnóstica, recetas, consultas |
| **Secretaria** | Agenda, citas, recordatorios, check-in, sala de espera |
| **Aseguradora** | Consulta historial, facturación (solo lectura) |
| **Padre/Tutor** | Portal paciente, historial hijos, solicitud de citas |

## Módulos Implementados

- [x] Autenticación JWT con roles
- [x] Gestión de Pacientes (datos demográficos, nacimiento, alergias)
- [x] Historia Clínica Digital (consultas, signos vitales, diagnósticos)
- [x] Gestión de Citas (calendario, slots disponibles, estados)
- [x] Control de Vacunación (esquema nacional, pendientes, carné digital)
- [x] Generación de Documentos (recetas, constancias, certificados)
- [x] Asistente IA Diagnóstico (OpenAI GPT-4)
- [x] Dashboards por rol (Admin, Doctor, Secretaria)
- [x] Gráficas de crecimiento (peso, talla, percentiles)

## Tech Stack

- **Backend**: Node.js 18+, Express, PostgreSQL, JWT, bcrypt
- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, Lucide Icons
- **IA**: OpenAI API (GPT-4)
- **Deploy**: Railway + GitHub

## Desarrollo Local

### Requisitos
- Node.js 18+
- PostgreSQL 15+ (o Docker)
- npm o yarn

### 1. Iniciar Base de Datos (Docker)

```bash
docker-compose up -d postgres
```

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

El backend estará en `http://localhost:3001`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend estará en `http://localhost:3000`

### 4. Credenciales de Prueba

| Usuario | Email | Contraseña |
|---------|-------|------------|
| Admin | admin@mydr.com | 123456 |
| Doctor | doctor@mydr.com | 123456 |
| Secretaria | secretaria@mydr.com | 123456 |

## Variables de Entorno

### Backend (.env)
```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=my_dr_super_secret_key_change_in_production
JWT_EXPIRES_IN=7d
OPENAI_API_KEY=sk-your-openai-api-key
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001/api
```

## Deploy en Railway

### 1. Crear Proyecto en Railway
- Ve a [railway.app](https://railway.app)
- Crea un nuevo proyecto
- Conecta tu repositorio de GitHub

### 2. Agregar PostgreSQL
- Click en "New" → "Database" → "PostgreSQL"
- Railway creará automáticamente la variable `DATABASE_URL`

### 3. Configurar Backend
- Click en "New" → "GitHub Repo" → selecciona tu repo
- En Settings:
  - **Root Directory**: `backend`
  - **Build Command**: `npm install`
  - **Start Command**: `npm start`
- Variables de entorno:
  ```
  JWT_SECRET=tu-clave-secreta-muy-larga
  NODE_ENV=production
  OPENAI_API_KEY=sk-... (opcional)
  ```

### 4. Configurar Frontend
- Click en "New" → "GitHub Repo" → selecciona tu repo
- En Settings:
  - **Root Directory**: `frontend`
  - **Build Command**: `npm install && npm run build`
  - **Start Command**: `npx serve -s dist -l $PORT`
- Variables de entorno:
  ```
  VITE_API_URL=https://tu-backend.railway.app/api
  ```

### 5. Inicializar Base de Datos
- Conecta a PostgreSQL desde Railway
- Ejecuta el contenido de `database/init.sql`

## Estructura de la Base de Datos

### Tablas Principales
- `users` - Usuarios del sistema (todos los roles)
- `doctors` - Información específica de doctores
- `patients` - Pacientes pediátricos
- `consultations` - Consultas médicas
- `appointments` - Citas programadas
- `prescriptions` - Recetas médicas
- `patient_vaccinations` - Registro de vacunas
- `documents` - Documentos generados
- `audit_logs` - Registro de auditoría

## API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar usuario
- `GET /api/auth/me` - Usuario actual

### Pacientes
- `GET /api/patients` - Listar pacientes
- `POST /api/patients` - Crear paciente
- `GET /api/patients/:id` - Detalle de paciente
- `GET /api/patients/:id/growth` - Datos de crecimiento

### Citas
- `GET /api/appointments` - Listar citas
- `POST /api/appointments` - Crear cita
- `PATCH /api/appointments/:id/status` - Cambiar estado
- `GET /api/appointments/slots/:doctorId/:date` - Slots disponibles

### Consultas
- `POST /api/consultations` - Iniciar consulta
- `PATCH /api/consultations/:id/vitals` - Registrar signos vitales
- `PATCH /api/consultations/:id/diagnosis` - Registrar diagnóstico

### IA
- `POST /api/ai/diagnose` - Obtener sugerencias diagnósticas
- `GET /api/ai/patterns/:patientId` - Detectar patrones

### Vacunación
- `GET /api/vaccinations/patient/:id` - Carné de vacunación
- `POST /api/vaccinations` - Registrar vacuna
- `GET /api/vaccinations/overdue` - Pacientes con vacunas pendientes

## Seguridad

- Autenticación JWT con expiración configurable
- Contraseñas hasheadas con bcrypt
- Rate limiting en endpoints
- Logs de auditoría para acciones sensibles
- Permisos granulares por rol
- Validación de datos con express-validator

## Próximas Funcionalidades (Fase 2)

- [ ] Portal del paciente (padres)
- [ ] Notificaciones por email/SMS
- [ ] Integración WhatsApp Business
- [ ] Facturación y cobros
- [ ] Reportes epidemiológicos
- [ ] Firma digital de documentos
- [ ] Modo offline

## Licencia

Privado - Todos los derechos reservados
