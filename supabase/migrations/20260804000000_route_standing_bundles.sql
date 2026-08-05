-- Standing per-bundle breakdown on volunteer_routes (mirrors route_deliveries).
-- Custom splits round-trip through create/edit; issue seed prefers these over greedySplit.

create or replace function greedy_split_papers(paper_count integer)
returns jsonb
language plpgsql
immutable
as $$
declare
  rest integer := paper_count;
  result jsonb := '[]'::jsonb;
begin
  if paper_count is null or paper_count < 0 then
    return '[]'::jsonb;
  end if;
  while rest >= 50 loop
    result := result || jsonb_build_array(jsonb_build_object('papers', 50));
    rest := rest - 50;
  end loop;
  while rest >= 25 loop
    result := result || jsonb_build_array(jsonb_build_object('papers', 25));
    rest := rest - 25;
  end loop;
  if rest > 0 then
    result := result || jsonb_build_array(jsonb_build_object('papers', rest));
  end if;
  return result;
end;
$$;

alter table volunteer_routes
  add column bundles jsonb not null default '[]'::jsonb;

update volunteer_routes
set bundles = greedy_split_papers(papers)
where bundles = '[]'::jsonb and papers > 0;

create or replace function validate_volunteer_route_bundles()
returns trigger
language plpgsql
as $$
declare
  total integer;
begin
  if jsonb_typeof(new.bundles) is distinct from 'array' then
    raise exception 'bundles must be a JSON array';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.bundles) as b
    where jsonb_typeof(b) is distinct from 'object'
       or jsonb_typeof(b -> 'papers') is distinct from 'number'
       or (b ->> 'papers')::numeric <> floor((b ->> 'papers')::numeric)
       or (b ->> 'papers')::numeric <= 0
  ) then
    raise exception 'each bundle must be an object with a positive integer "papers"';
  end if;

  select coalesce(sum((b ->> 'papers')::integer), 0)
  into total
  from jsonb_array_elements(new.bundles) as b;

  if total <> new.papers then
    raise exception 'bundles must sum to papers (bundles sum %, papers %)', total, new.papers;
  end if;

  return new;
end;
$$;

create trigger volunteer_routes_validate_bundles
  before insert or update on volunteer_routes
  for each row
  execute function validate_volunteer_route_bundles();
