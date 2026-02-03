-- Registrata seed data

insert into research_queries (org_id, object_id, query_type, status)
select o.org_id, o.id, 'comprehensive', 'completed'
from objects o
where not exists (
  select 1 from research_queries rq where rq.object_id = o.id
)
limit 0;
