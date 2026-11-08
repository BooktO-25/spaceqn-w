export interface ArchitectureDoc {
  id: string;
  title: string;
  category: string;
  description: string;
  markdownContent: string;
}

export const architectureDocs: ArchitectureDoc[] = [
  {
    id: 'prd',
    title: '1. Product Requirement Document (PRD)',
    category: 'Product & Vision',
    description: 'Executive overview, scope, core workflows, business hierarchy, and user roles.',
    markdownContent: `
# SPACEQ Display - Product Requirement Document (PRD)

## 1. Vision & Core Mission
**SPACEQ Display** is an enterprise-grade, cloud-first Business Display Operating System that transforms standard TVs, Android TVs, touch tablets, HDMI sticks, and mini PCs into remotely managed, smart commercial displays.

### Key Value Proposition
- **Zero In-Person Maintenance**: Never update USB thumb drives or physically touch displays again.
- **Unified Cloud Management**: Instant content publishing across single stores or 10,000+ global locations.
- **Resilient Offline Playback**: Edge caching ensures 100% uptime even during internet outages.
- **Future-Ready Modular Kernel**: Architecture designed to plug in Interactive Kiosks, Self-Ordering, AI Analytics, and Queue Systems without rewriting core services.

---

## 2. MVP Scope (Phase 1: Digital Signage)
Focus exclusively on high-performance Digital Signage to validate unit economics and SaaS scalability.

### Included Features:
1. **Multi-Tenant Hierarchy**: Business -> Locations -> Devices -> Playlists -> Content.
2. **Role-Based Access Control (RBAC)**: Super Admin, Business Owner, Manager, Designer, Viewer.
3. **Smart Edge Player**: Web, Tizen, WebOS, Android TV runtime with heartbeat, offline cache (IndexedDB), auto-recovery, and landscape/portrait modes.
4. **Instant 6-Digit Pairing**: Easy on-boarding using OTP/pairing code (\`SPQ-XXXX\`).
5. **Multi-Format Content Management**: Images, MP4 Videos, Web URLs, YouTube, Canva Embeds, PDFs.
6. **Playlist & Time-Slot Scheduler**: Dayparting (Breakfast/Lunch/Night menus), weekend triggers, priority overrides.

---

## 3. Business Hierarchy & Access Control
\`\`\`
SPACEQ Cloud
├── Business (Tenant)
│   ├── Location A (e.g. Nellore Branch)
│   │   ├── Device 1 (Reception TV)
│   │   └── Device 2 (Menu TV)
│   └── Location B (e.g. Hyderabad Central)
│       └── Device 3 (Outdoor Display)
└── Global Content & Playlist Engine
\`\`\`

### User Roles & Matrix
| Permission / Action | Super Admin | Business Owner | Manager | Designer | Viewer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Create/Delete Businesses | ✅ | ❌ | ❌ | ❌ | ❌ |
| Location Management | ✅ | ✅ | ❌ | ❌ | ❌ |
| Device Pairing & Reboot | ✅ | ✅ | ✅ | ❌ | ❌ |
| Upload Media / Playlists | ✅ | ✅ | ✅ | ✅ | ❌ |
| Read-only Analytics | ✅ | ✅ | ✅ | ✅ | ✅ |
`,
  },
  {
    id: 'system-arch',
    title: '2. System Architecture',
    category: 'Architecture',
    description: 'High-level cloud topology, microservices boundary, CDN edge distribution, and player runtime.',
    markdownContent: `
# System Architecture - SPACEQ Cloud OS

\`\`\`
                  +---------------------------------------------------+
                  |                 SPACEQ CONTROL PANEL               |
                  |     Next.js 15 App Router + Tailwind + Motion     |
                  +-------------------------+-------------------------+
                                            | HTTPS / GraphQL / REST
                                            v
                  +---------------------------------------------------+
                  |               API & MICROSERVICES LAYER           |
                  |  Next.js Serverless Routes / Vercel Edge Runtime   |
                  +-----+-------------------+-------------------+-----+
                        |                   |                   |
                        v                   v                   v
            +-----------------------+ +-----------+ +-----------------------+
            | Supabase Auth + JWT   | | Postgres  | | Supabase Storage CDN  |
            | Tenant Context Guard  | | RLS DB    | | S3 Global Edge Cache  |
            +-----------------------+ +-----------+ +-----------------------+
                                            ^
                                            | Secure Sync Engine
                                            v
                  +---------------------------------------------------+
                  |            EDGE DISPLAY PLAYER RUNTIME            |
                  |  Chrome / Tizen / WebOS / Android TV / Electron   |
                  |  - Local Storage & IndexedDB Media Cache          |
                  |  - 30s Heartbeat & Telemetry Collector            |
                  |  - Fallback Offline Playlist State Machine        |
                  +---------------------------------------------------+
\`\`\`

### Architectural Principles
- **Scale to 100,000+ Devices**: Stateless serverless API routes with connection pooling (Supabase Supavisor) and CDN caching.
- **Zero Single Point of Failure**: Player operates autonomously off cached state even if control plane is down for days.
- **Edge Acceleration**: Content distribution via Cloudflare/Supabase CDN so media loads under 100ms globally.
`,
  },
  {
    id: 'folder-structure',
    title: '3. Folder Structure',
    category: 'Codebase',
    description: 'Enterprise modular Next.js / React scalable directory layout.',
    markdownContent: `
# Enterprise Directory Layout

\`\`\`
spaceq-display/
├── public/
│   ├── assets/
│   └── favicon.ico
├── src/
│   ├── app/                      # Next.js 15 App Router / Views
│   │   ├── (auth)/               # Login / Register / OAuth
│   │   ├── (dashboard)/          # SaaS Management Platform
│   │   │   ├── businesses/
│   │   │   ├── locations/
│   │   │   ├── devices/
│   │   │   ├── content/
│   │   │   ├── playlists/
│   │   │   └── settings/
│   │   ├── api/                  # Backend REST / RPC Handlers
│   │   │   ├── v1/
│   │   │   │   ├── auth/
│   │   │   │   ├── devices/
│   │   │   │   ├── pairing/
│   │   │   │   ├── playlists/
│   │   │   │   └── heartbeat/
│   │   └── player/[deviceId]/    # Edge Display Player Route
│   ├── components/               # UI Component Library
│   │   ├── common/               # Buttons, Inputs, Modals
│   │   ├── dashboard/            # Metrics, Activity feeds
│   │   ├── devices/              # Device list, pairing modal
│   │   ├── playlist/             # Drag & drop timeline
│   │   ├── player/               # Fullscreen player engine
│   │   └── architecture/         # System Spec Explorer
│   ├── lib/                      # Core Logic & Utilities
│   │   ├── supabase/             # DB & Storage Clients
│   │   ├── offline/              # IndexedDB Edge Sync Engine
│   │   └── utils.ts
│   └── types.ts                  # Shared TypeScript Interfaces
├── supabase/
│   ├── migrations/               # SQL DDL & Versioning
│   └── seed.sql
├── next.config.mjs
└── package.json
\`\`\`
`,
  },
  {
    id: 'db-schema',
    title: '4. Database Schema (PostgreSQL + RLS)',
    category: 'Database',
    description: 'Complete PostgreSQL DDL with Row Level Security, indexes, and FK constraints.',
    markdownContent: `
# PostgreSQL Database Schema

\`\`\`sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Businesses (Tenants)
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  logo_url TEXT,
  brand_color VARCHAR(32) DEFAULT '#E11D48',
  total_storage_used_mb NUMERIC(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Locations
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  city VARCHAR(128) NOT NULL,
  country VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Content Library
CREATE TYPE content_type_enum AS ENUM ('IMAGE', 'VIDEO', 'PDF', 'YOUTUBE', 'WEBSITE', 'CANVA');

CREATE TABLE contents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  type content_type_enum NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INT NOT NULL DEFAULT 10,
  file_size_bytes BIGINT DEFAULT 0,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Playlists & Items
CREATE TABLE playlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  loop BOOLEAN DEFAULT true,
  shuffle BOOLEAN DEFAULT false,
  schedules JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE playlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  item_order INT NOT NULL,
  custom_duration_seconds INT,
  transition_effect VARCHAR(32) DEFAULT 'FADE'
);

-- 5. Devices
CREATE TYPE device_status_enum AS ENUM ('ONLINE', 'OFFLINE', 'PAIRING', 'SYNCING');
CREATE TYPE orientation_enum AS ENUM ('LANDSCAPE', 'PORTRAIT');

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pairing_code VARCHAR(16) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  active_playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL,
  status device_status_enum DEFAULT 'PAIRING',
  orientation orientation_enum DEFAULT 'LANDSCAPE',
  ip_address VARCHAR(64),
  app_version VARCHAR(32),
  storage_cached_mb NUMERIC(10,2) DEFAULT 0.00,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX idx_locations_business ON locations(business_id);
CREATE INDEX idx_devices_business ON devices(business_id);
CREATE INDEX idx_devices_pairing ON devices(pairing_code);
CREATE INDEX idx_contents_business ON contents(business_id);
\`\`\`
`,
  },
  {
    id: 'api-design',
    title: '5. API Design (OpenAPI 3.0 Specs)',
    category: 'Backend',
    description: 'REST API endpoints for pairing, heartbeats, playlist sync, and multi-tenant management.',
    markdownContent: `
# API Specification

### 1. Device Pairing & Boot
- \`POST /api/v1/pairing/code\`
  - Device boot request to generate 6-digit code.
  - Response: \`{ "pairingCode": "SPQ-8921", "expiresIn": 600 }\`
- \`POST /api/v1/pairing/claim\`
  - Business Owner assigns code to Business & Location.
  - Body: \`{ "pairingCode": "SPQ-8921", "businessId": "...", "locationId": "...", "deviceName": "Menu TV" }\`

### 2. Player Telemetry & Sync
- \`GET /api/v1/player/:deviceId/sync\`
  - Device fetches its current assigned playlist, media items, and schedules.
  - Returns compiled timeline + CDN download URLs + schedule triggers.
- \`POST /api/v1/player/:deviceId/heartbeat\`
  - Sent every 30 seconds.
  - Body: \`{ "status": "ONLINE", "cachedStorageMb": 120.4, "appVersion": "v1.4.2" }\`
  - Response: \`{ "command": "NONE" | "REBOOT" | "REFRESH_PLAYLIST" }\`

### 3. Business & Content Endpoints
- \`GET /api/v1/businesses/:id/devices\`
- \`POST /api/v1/contents/upload\` (Presigned S3/Supabase Storage URL)
- \`POST /api/v1/playlists\` (Create/Update with drag-and-drop order)
`,
  },
  {
    id: 'multi-tenant',
    title: '6. Multi Tenant Architecture',
    category: 'Security',
    description: 'Row-Level Security (RLS) policies and tenant isolation context.',
    markdownContent: `
# Multi-Tenant Security & RLS Architecture

SPACEQ Display enforces strict tenant isolation using **PostgreSQL Row Level Security (RLS)** at the database layer, combined with JWT claims verified by middleware.

\`\`\`sql
-- Enable RLS on core tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- Helper function to extract tenant ID from JWT
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'business_id', '')::uuid;
$$ LANGUAGE sql STABLE;

-- Tenant Isolation Policy Example for Content Table
CREATE POLICY tenant_isolation_contents ON contents
  FOR ALL
  USING (business_id = current_tenant_id());

-- Device Access Policy (Public Player read access via token)
CREATE POLICY device_player_read ON devices
  FOR SELECT
  USING (true);
\`\`\`
`,
  },
  {
    id: 'auth-flow',
    title: '7. Authentication Flow',
    category: 'Security',
    description: 'Dual auth model: User OAuth/JWT for Admin Console + Token-based Device Auth for Players.',
    markdownContent: `
# Authentication & Access Sequence

\`\`\`
1. USER AUTHENTICATION (SaaS Dashboard)
   User -> Login Page -> Supabase Auth (Email / Google OAuth)
   Supabase -> Issues JWT with custom claim { "role": "BUSINESS_OWNER", "business_id": "biz-123" }
   Dashboard -> Stores JWT securely in HttpOnly Cookie

2. DEVICE AUTHENTICATION (Edge Player)
   Device Boots -> Generates Pairing Code (SPQ-8921)
   Owner Claims Code -> Backend provisions a Device Token (32-char secret)
   Device Stores Token -> Saved in local secure hardware storage / localStorage
   Device Requests -> All subsequent API calls carry Bearer Device-Token
\`\`\`
`,
  },
  {
    id: 'pairing-flow',
    title: '8. Device Pairing Flow',
    category: 'Workflows',
    description: 'Step-by-step lifecycle from physical TV power-on to active signage rendering.',
    markdownContent: `
# Device Pairing Sequence

\`\`\`
[Unpaired TV]                     [SPACEQ Cloud]                   [Business Owner]
      |                                  |                                 |
      |-- 1. Boot up app -------------> |                                 |
      |   Request Pairing Code           |                                 |
      |                                  |                                 |
      |<-- 2. Return SPQ-8921 -----------|                                 |
      |   Display code on screen         |                                 |
      |                                  |                                 |
      |                                  |<-- 3. Opens Dashboard --------|
      |                                  |    Enters "SPQ-8921"            |
      |                                  |    Selects "Restaurant ABC"     |
      |                                  |    Selects "Nellore Branch"     |
      |                                  |                                 |
      |<-- 4. Socket / Long Poll --------|                                 |
      |   "DEVICE_PAIRED_SUCCESS"        |                                 |
      |   Payload: Device ID + Token     |                                 |
      |                                  |                                 |
      |-- 5. Fetch Assigned Playlist --->|                                 |
      |<-- 6. Return Playlist & Media ---|                                 |
      |                                  |                                 |
      |-- 7. Render Digital Signage ---->|                                 |
\`\`\`
`,
  },
  {
    id: 'player-arch',
    title: '9. Player Architecture',
    category: 'Edge Runtime',
    description: 'Edge state machine, IndexedDB media cache manager, and offline sync loop.',
    markdownContent: `
# Edge Display Player Architecture

The Edge Player is designed as a zero-maintenance state machine that runs on any browser or TV OS container.

### Core Modules
1. **Heartbeat & Telemetry Guard**: Ping cloud every 30s with network state, CPU load, and storage metrics.
2. **Media Cache Engine (IndexedDB + ServiceWorker)**: Pre-downloads videos and images in background.
3. **Schedule Evaluator**: Evaluates active dayparts (e.g. Breakfast vs Lunch vs Default loop).
4. **Playback State Machine**: Manages transitions (Fade, Slide, Zoom), handles corrupt media skips automatically.

\`\`\`
                     +---------------------------------------+
                     |           PLAYER ROOT APP             |
                     +-------------------+-------------------+
                                         |
               +-------------------------+-------------------------+
               |                                                   |
               v                                                   v
     +-------------------+                               +-------------------+
     | TELEMETRY DAEMON  |                               | PLAYBACK ENGINE   |
     | 30s Heartbeat     |                               | Motion / Canvas   |
     | Health Check      |                               | Hardware Accelerate|
     +---------+---------+                               +---------+---------+
               |                                                   |
               v                                                   v
     +-------------------+                               +-------------------+
     | OFFLINE CACHE     | <============================ | SCHEDULE ENGINE   |
     | IndexedDB Sinks   |   Syncs on Internet Return    | Daypart Selector  |
     +-------------------+                               +-------------------+
\`\`\`
`,
  },
  {
    id: 'ui-wireframes',
    title: '10. UI Wireframes & Design System',
    category: 'UI/UX',
    description: 'Apple-inspired visual hierarchy, dark/light theme tokens, and key layout specs.',
    markdownContent: `
# Visual System & Wireframe Spec

### Design Philosophy: Apple SaaS Aesthetic
- **Backgrounds**: High-contrast, clean canvas (#F8FAFC light / #0F172A dark) with sub-7% contrast offset.
- **Borders**: Hairline 1px borders (#E2E8F0 / #1E293B). Zero arbitrary drop-shadows or noisy gradients.
- **Typography**: Inter / Plus Jakarta Sans for UI elements, paired with tabular numbers for timers.
- **Status Badges**:
  - \`ONLINE\`: Emerald green pulse chip (\`#10B981\`)
  - \`OFFLINE\`: Slate gray (\`#64748B\`)
  - \`SYNCING\`: Amber loader (\`#F59E0B\`)

### Core Screen Layouts
1. **Executive Dashboard**: Top metrics banner (Businesses, Locations, Active Devices, Cache Storage) + Live Device Grid + Recent Telemetry Stream.
2. **Device Manager**: Interactive device cards showing location, IP, orientation, active playlist, and quick remote action buttons (Reboot, Refresh, Launch URL).
3. **Playlist Timeline**: Timeline sequence builder with drag-and-drop handles, duration sliders, and scheduling modal.
`,
  },
  {
    id: 'roadmap',
    title: '11. Development Roadmap',
    category: 'Product Strategy',
    description: 'Phased rollout plan from Phase 1 MVP to Future Enterprise Modules.',
    markdownContent: `
# Phase Rollout Strategy

### Phase 1: MVP Digital Signage (CURRENT BUILD)
- Core multi-tenant hierarchy (Business -> Locations -> Devices -> Playlists).
- Edge display player with offline caching and pairing code engine.
- Scheduling engine (Dayparting & Weekend overrides).

### Phase 2: AI Content Engine & Analytics
- AI Poster Generator (Gemini Flash integration for automatic menu design).
- AI Text-to-Video promotions.
- Camera-based anonymized audience analytics (Viewer count & dwell time).

### Phase 3: Interactive Touch Kiosks & Self-Ordering
- Touch screen kiosk engine with menu cart & checkout flow.
- Token Queue Management & Hospital / Bank Call-Out displays.
- WhatsApp & POS integration.

### Phase 4: SPACEQ HDMI Hardware & Ad Network
- SPACEQ HDMI Smart Stick with Android TV custom OS build.
- Cross-business advertisement exchange marketplace.
`,
  },
  {
    id: 'deployment',
    title: '12. Deployment Architecture',
    category: 'DevOps',
    description: 'Production Vercel + Supabase infrastructure setup with CDN caching.',
    markdownContent: `
# Production Infrastructure Architecture

\`\`\`
[ Edge DNS: Cloudflare ]
       |
       +---> [ Vercel Global Edge Network ]
       |     - SSR & API Serverless Functions
       |     - Static Player Asset CDN
       |
       +---> [ Supabase Managed Infrastructure ]
             - PostgreSQL (Transactional DB with PgBouncer)
             - Storage Buckets (Images & Videos with S3 CDN)
             - GoTrue Auth Service
\`\`\`

### Environment Setup Checklist
1. \`NEXT_PUBLIC_SUPABASE_URL\`: Supabase API Endpoint
2. \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`: Public Auth Key
3. \`SUPABASE_SERVICE_ROLE_KEY\`: Secure Backend Server Key
4. \`NEXT_PUBLIC_APP_URL\`: Production Host URL
`,
  },
];
