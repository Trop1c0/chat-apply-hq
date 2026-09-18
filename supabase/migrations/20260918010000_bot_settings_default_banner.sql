ALTER TABLE public.bot_settings
  ALTER COLUMN welcome_image_url
  SET DEFAULT 'https://project--770cbd07-6e9e-47fb-b844-d8cbb458e5b2.lovable.app/banner.png';

UPDATE public.bot_settings
SET welcome_image_url = 'https://project--770cbd07-6e9e-47fb-b844-d8cbb458e5b2.lovable.app/banner.png'
WHERE welcome_image_url IS NULL;
