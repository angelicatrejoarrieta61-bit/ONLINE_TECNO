-- 1) ¿Hay datos? (ejecuta y mira los números)
select 'store_config' as t, count(*)::int as n from store_config
union all select 'products_total', count(*)::int from products
union all select 'products_activos', count(*)::int from products where coalesce(is_deleted,false) = false;

-- 2) Si hay productos pero "activos" da 0: arregla is_deleted en NULL
update public.products set is_deleted = false where is_deleted is null;

-- 3) Solo si la tabla products está vacía: crea uno de prueba
insert into public.products (name, price, stock, is_deleted)
select 'Producto prueba', 99, 10, false
where not exists (select 1 from public.products limit 1);
