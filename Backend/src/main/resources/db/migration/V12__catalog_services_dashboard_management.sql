-- Catalog hardening for dashboard CRUD/search and initial business services.

create extension if not exists pg_trgm;

create index if not exists idx_catalog_services_name_trgm
	on catalog_services using gin (lower(name) gin_trgm_ops);

create unique index if not exists uk_catalog_services_org_category_name
	on catalog_services (organization_id, category_id, lower(name));

with service_seed as (
	select * from (
		values
			('odontologia','blanqueamiento-dental','Blanqueamiento Dental',350000,60),
			('odontologia','brackets-esteticos','Brackets Esteticos (Ceramica, Zafiro)',100000,60),
			('odontologia','brackets-metalicos','Brackets Metalicos',100000,60),
			('odontologia','carillas','Carillas de Porcelana y Resina',100000,60),
			('odontologia','contorneado-estetico','Contorneado Estetico',100000,45),
			('odontologia','coronas-dentales','Coronas Dentales',100000,60),
			('odontologia','coronas-implantes','Coronas sobre Implantes',2500000,90),
			('odontologia','empastes-restauraciones','Empastes y Restauraciones',100000,45),
			('odontologia','endodoncias','Endodoncias (Tratamientos de Conducto)',100000,90),
			('odontologia','extracciones-dentales','Extracciones Dentales',100000,45),
			('odontologia','implantes-titanio','Implantes de Titanio',2500000,90),
			('odontologia','limpieza-profilaxis','Limpieza y Profilaxis',85000,45),
			('odontologia','ortodoncia-invisible','Ortodoncia Invisible (Aligners)',1500000,60),
			('odontologia','puentes-implantes','Puentes sobre Implantes',2500000,90),
			('odontologia','regeneracion-osea','Regeneracion Osea',100000,60),
			('odontologia','retenedores','Retenedores',100000,45),
			('psicologia','evaluacion-psicologica','Evaluacion Psicologica',100000,60),
			('psicologia','terapia-pareja','Terapia de Pareja',120000,60),
			('psicologia','terapia-individual','Terapia Individual',120000,60),
			('psicologia','terapia-infantil','Terapia Infantil',120000,60)
	) as t(category_slug, code_suffix, name, price, duration_minutes)
),
inserted_catalog as (
	insert into catalog_services (
		id, organization_id, category_id, code, name, description, default_duration_minutes, specialty_match_tokens, active, created_at, updated_at
	)
	select
		gen_random_uuid(),
		c.organization_id,
		c.id,
		'managed-' || ss.code_suffix,
		ss.name,
		null,
		ss.duration_minutes,
		case when ss.category_slug = 'odontologia' then 'odont,dent' else 'psico,psych' end,
		true,
		now(),
		now()
	from service_seed ss
	join service_categories c on c.slug = ss.category_slug
	where not exists (
		select 1
		from catalog_services cs
		where cs.organization_id = c.organization_id
		  and cs.category_id = c.id
		  and lower(cs.name) = lower(ss.name)
	)
	returning id, organization_id, category_id, name
)
insert into service_offerings (
	id, organization_id, site_id, catalog_service_id, public_title, public_description, duration_override_minutes,
	base_price, promo_price, currency, badge, features, visible_public, active, created_at, updated_at
)
select
	gen_random_uuid(),
	s.organization_id,
	s.id,
	cs.id,
	cs.name,
	cs.description,
	null,
	ss.price,
	null,
	'COP',
	null,
	null,
	true,
	true,
	now(),
	now()
from service_seed ss
join service_categories c on c.slug = ss.category_slug
join catalog_services cs on cs.organization_id = c.organization_id and cs.category_id = c.id and lower(cs.name) = lower(ss.name)
join sites s on s.organization_id = cs.organization_id
where not exists (
	select 1
	from service_offerings so
	where so.organization_id = s.organization_id
	  and so.site_id = s.id
	  and so.catalog_service_id = cs.id
);
