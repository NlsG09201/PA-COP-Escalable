-- Dynamic service catalog: categories, base services, per-site offerings, optional professional assignments.

create table if not exists service_categories (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  slug text not null,
  name text not null,
  description text,
  status text not null,
  sort_order int not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (organization_id, slug)
);

create table if not exists catalog_services (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  category_id uuid not null references service_categories(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  default_duration_minutes int not null,
  specialty_match_tokens text,
  active boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (organization_id, code)
);

create index if not exists idx_catalog_services_org_category
  on catalog_services(organization_id, category_id);

create table if not exists service_offerings (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id),
  catalog_service_id uuid not null references catalog_services(id) on delete cascade,
  public_title text not null,
  public_description text,
  duration_override_minutes int,
  base_price bigint not null,
  promo_price bigint,
  currency text not null default 'COP',
  badge text,
  features text,
  visible_public boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_service_offerings_site_public
  on service_offerings(organization_id, site_id, visible_public, active);

create table if not exists professional_service_assignments (
  id uuid primary key,
  organization_id uuid not null references organizations(id),
  site_id uuid not null references sites(id),
  professional_id uuid not null references professionals(id) on delete cascade,
  service_offering_id uuid not null references service_offerings(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (professional_id, service_offering_id)
);

create index if not exists idx_prof_svc_assign_lookup
  on professional_service_assignments(organization_id, site_id, service_offering_id)
  where active = true;

alter table appointments
  add column if not exists service_offering_id uuid references service_offerings(id);

alter table appointments
  add column if not exists service_name_snapshot text;

alter table appointments
  add column if not exists service_category_snapshot text;

-- Seed categories per organization
insert into service_categories (id, organization_id, slug, name, description, status, sort_order, created_at, updated_at)
select gen_random_uuid(), o.id, 'odontologia', 'Odontologia', null, 'ACTIVE', 0, now(), now()
from organizations o;

insert into service_categories (id, organization_id, slug, name, description, status, sort_order, created_at, updated_at)
select gen_random_uuid(), o.id, 'psicologia', 'Psicologia', null, 'ACTIVE', 1, now(), now()
from organizations o;

-- Seed base catalog services (clinical definitions)
insert into catalog_services (id, organization_id, category_id, code, name, description, default_duration_minutes, specialty_match_tokens, active, created_at, updated_at)
select gen_random_uuid(), sc.organization_id, sc.id,
  'general-dentistry',
  'Valoracion dental integral',
  'Consulta de diagnostico, plan de tratamiento y recomendaciones preventivas.',
  45,
  'odont,dent',
  true, now(), now()
from service_categories sc where sc.slug = 'odontologia';

insert into catalog_services (id, organization_id, category_id, code, name, description, default_duration_minutes, specialty_match_tokens, active, created_at, updated_at)
select gen_random_uuid(), sc.organization_id, sc.id,
  'teeth-cleaning',
  'Profilaxis y limpieza',
  'Higiene oral profesional para control preventivo y mantenimiento.',
  60,
  'odont,dent',
  true, now(), now()
from service_categories sc where sc.slug = 'odontologia';

insert into catalog_services (id, organization_id, category_id, code, name, description, default_duration_minutes, specialty_match_tokens, active, created_at, updated_at)
select gen_random_uuid(), sc.organization_id, sc.id,
  'orthodontics',
  'Valoracion de ortodoncia',
  'Evaluacion de alineacion dental y opciones de tratamiento.',
  50,
  'orto,odont,dent',
  true, now(), now()
from service_categories sc where sc.slug = 'odontologia';

insert into catalog_services (id, organization_id, category_id, code, name, description, default_duration_minutes, specialty_match_tokens, active, created_at, updated_at)
select gen_random_uuid(), sc.organization_id, sc.id,
  'psych-assessment',
  'Consulta psicologica inicial',
  'Entrevista clinica, definicion de objetivos y ruta terapeutica.',
  60,
  'psico,psych',
  true, now(), now()
from service_categories sc where sc.slug = 'psicologia';

insert into catalog_services (id, organization_id, category_id, code, name, description, default_duration_minutes, specialty_match_tokens, active, created_at, updated_at)
select gen_random_uuid(), sc.organization_id, sc.id,
  'therapy-session',
  'Sesion terapeutica',
  'Atencion individual con enfoque clinico y seguimiento de progreso.',
  50,
  'psico,psych',
  true, now(), now()
from service_categories sc where sc.slug = 'psicologia';

insert into catalog_services (id, organization_id, category_id, code, name, description, default_duration_minutes, specialty_match_tokens, active, created_at, updated_at)
select gen_random_uuid(), sc.organization_id, sc.id,
  'psych-tests',
  'Bateria de test psicologicos',
  'Aplicacion de instrumentos con interpretacion y devolucion profesional.',
  75,
  'psico,psych',
  true, now(), now()
from service_categories sc where sc.slug = 'psicologia';

-- Per-site offerings (prices, marketing copy); features stored as pipe-separated
insert into service_offerings (id, organization_id, site_id, catalog_service_id, public_title, public_description, duration_override_minutes, base_price, promo_price, currency, badge, features, visible_public, active, created_at, updated_at)
select gen_random_uuid(), s.organization_id, s.id, cs.id, cs.name, cs.description, null,
  120000, 95000, 'COP', 'Promocion', 'Diagnostico clinico|Revision de tejidos|Plan inicial', true, true, now(), now()
from sites s
join catalog_services cs on cs.organization_id = s.organization_id and cs.code = 'general-dentistry';

insert into service_offerings (id, organization_id, site_id, catalog_service_id, public_title, public_description, duration_override_minutes, base_price, promo_price, currency, badge, features, visible_public, active, created_at, updated_at)
select gen_random_uuid(), s.organization_id, s.id, cs.id, cs.name, cs.description, null,
  160000, null, 'COP', null, 'Limpieza completa|Remocion de placa|Educacion en higiene', true, true, now(), now()
from sites s
join catalog_services cs on cs.organization_id = s.organization_id and cs.code = 'teeth-cleaning';

insert into service_offerings (id, organization_id, site_id, catalog_service_id, public_title, public_description, duration_override_minutes, base_price, promo_price, currency, badge, features, visible_public, active, created_at, updated_at)
select gen_random_uuid(), s.organization_id, s.id, cs.id, cs.name, cs.description, null,
  180000, 150000, 'COP', null, 'Analisis oclusal|Plan por fases|Presupuesto estimado', true, true, now(), now()
from sites s
join catalog_services cs on cs.organization_id = s.organization_id and cs.code = 'orthodontics';

insert into service_offerings (id, organization_id, site_id, catalog_service_id, public_title, public_description, duration_override_minutes, base_price, promo_price, currency, badge, features, visible_public, active, created_at, updated_at)
select gen_random_uuid(), s.organization_id, s.id, cs.id, cs.name, cs.description, null,
  140000, null, 'COP', null, 'Entrevista inicial|Historia breve|Plan de seguimiento', true, true, now(), now()
from sites s
join catalog_services cs on cs.organization_id = s.organization_id and cs.code = 'psych-assessment';

insert into service_offerings (id, organization_id, site_id, catalog_service_id, public_title, public_description, duration_override_minutes, base_price, promo_price, currency, badge, features, visible_public, active, created_at, updated_at)
select gen_random_uuid(), s.organization_id, s.id, cs.id, cs.name, cs.description, null,
  130000, 110000, 'COP', 'Alta demanda', 'Sesion individual|Notas clinicas|Objetivos por sesion', true, true, now(), now()
from sites s
join catalog_services cs on cs.organization_id = s.organization_id and cs.code = 'therapy-session';

insert into service_offerings (id, organization_id, site_id, catalog_service_id, public_title, public_description, duration_override_minutes, base_price, promo_price, currency, badge, features, visible_public, active, created_at, updated_at)
select gen_random_uuid(), s.organization_id, s.id, cs.id, cs.name, cs.description, null,
  210000, null, 'COP', null, 'Aplicacion guiada|Score automatizado|Informe breve', true, true, now(), now()
from sites s
join catalog_services cs on cs.organization_id = s.organization_id and cs.code = 'psych-tests';
