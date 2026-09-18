ALTER TABLE public.bot_settings
  ADD COLUMN manuals_banner_url text,
  ADD COLUMN manuals_intro text NOT NULL DEFAULT 'Все самое полезное и нужное тебе прямиком от нашей команды, ознакомься, здесь много полезной информации.',
  ADD COLUMN manuals jsonb NOT NULL DEFAULT '[{"title":"📘 Основной мануал","text":"Основной мануал скоро появится здесь."}]'::jsonb,
  ADD COLUMN help_banner_url text,
  ADD COLUMN help_intro text NOT NULL DEFAULT 'Если у тебя возникли вопросы или нужна помощь — выбери модератора ниже, и он тебе поможет.',
  ADD COLUMN moderators jsonb NOT NULL DEFAULT '[]'::jsonb;
