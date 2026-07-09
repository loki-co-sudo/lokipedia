-- lokipedia スキーマ + RLS ポリシー
-- Supabase ダッシュボード → SQL Editor に全文貼り付けて実行する。
-- 実行後、Authentication → Sign In / Up で「Allow new users to sign up」を必ず OFF にすること
-- （authenticated = 管理者、という前提が崩れるため）。

-- ============ テーブル ============

create table if not exists public.words (
  id          uuid primary key default gen_random_uuid(),
  term        text not null,
  reading     text,                         -- よみがな（ひらがな）。50音順ソートに使用。旧データはNULL
  definition  text not null,                -- Markdown
  tags        text[] not null default '{}',
  source_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.quizzes (
  id            uuid primary key default gen_random_uuid(),
  word_id       uuid not null references public.words(id) on delete cascade,
  question      text not null,
  choices       text[] not null check (array_length(choices, 1) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  explanation   text not null,               -- Markdown
  created_at    timestamptz not null default now()
);

create index if not exists quizzes_word_id_idx on public.quizzes (word_id);
create index if not exists words_created_at_idx on public.words (created_at desc);

-- ============ RLS ============
-- 読み取り: 誰でも可（友達はログイン不要で閲覧）
-- 書き込み: authenticated のみ（サインアップ無効化により実質管理者のみ）

alter table public.words enable row level security;
alter table public.quizzes enable row level security;

drop policy if exists "words_select_all" on public.words;
create policy "words_select_all" on public.words
  for select to anon, authenticated using (true);

drop policy if exists "words_write_admin" on public.words;
create policy "words_write_admin" on public.words
  for all to authenticated using (true) with check (true);

drop policy if exists "quizzes_select_all" on public.quizzes;
create policy "quizzes_select_all" on public.quizzes
  for select to anon, authenticated using (true);

drop policy if exists "quizzes_write_admin" on public.quizzes;
create policy "quizzes_write_admin" on public.quizzes
  for all to authenticated using (true) with check (true);
