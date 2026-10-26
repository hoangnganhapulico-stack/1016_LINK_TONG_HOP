-- =====================================================================
-- Trợ lý Điều hành Store 1016 - Đồng bộ đám mây nhiều máy (TÙY CHỌN)
-- Chạy 1 lần trong Supabase → SQL Editor. Gói Free đủ dùng (bảng nhỏ, vài MB).
-- =====================================================================

-- 1. Bảng khóa - giá trị (mỗi dòng = 1 khóa dữ liệu: STATE của Trợ lý, ảnh chụp công cụ, trạng thái tracker...)
create table if not exists public.s1016_kv (
  k           text primary key,
  v           jsonb not null,
  rev         bigint not null default 1,          -- tăng mỗi lần ghi, dùng chống ghi đè đồng thời
  updated_at  timestamptz not null default now(),
  updated_by  text,
  device      text
);
create index if not exists s1016_kv_updated_idx on public.s1016_kv (updated_at);

-- 2. Mã cửa hàng bí mật (chỉ máy chủ đọc được). ĐỔI 'DOI-MA-NAY' thành mã riêng, dài, khó đoán.
create table if not exists public.s1016_config (id int primary key default 1, store_secret text not null);
insert into public.s1016_config (id, store_secret) values (1, 'DOI-MA-NAY')
  on conflict (id) do update set store_secret = excluded.store_secret;
revoke all on public.s1016_config from anon, authenticated;

-- 3. Hàm kiểm tra mã (SECURITY DEFINER: chạy quyền chủ sở hữu, anon không đọc được bảng config)
create or replace function public.s1016_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (current_setting('request.headers', true)::json ->> 'x-s1016-store') = (select store_secret from public.s1016_config where id = 1),
    false)
$$;
grant execute on function public.s1016_ok() to anon;

-- 4. Bật RLS: chỉ request gửi đúng header x-s1016-store mới đọc/ghi được
alter table public.s1016_kv enable row level security;
drop policy if exists s1016_rw on public.s1016_kv;
create policy s1016_rw on public.s1016_kv for all to anon using (public.s1016_ok()) with check (public.s1016_ok());
grant select, insert, update on public.s1016_kv to anon;
-- Không cấp quyền DELETE: Trợ lý không bao giờ xóa dữ liệu trên đám mây.

-- Kiểm tra nhanh (sau khi cấu hình trên Trợ lý và bấm "Đẩy lên"):
-- select k, rev, updated_at, updated_by, device from public.s1016_kv order by updated_at desc;
