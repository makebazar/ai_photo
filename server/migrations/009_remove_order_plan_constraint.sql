-- Remove plan_id check constraint from orders to support dynamic plans
alter table orders drop constraint if exists orders_plan_chk;
