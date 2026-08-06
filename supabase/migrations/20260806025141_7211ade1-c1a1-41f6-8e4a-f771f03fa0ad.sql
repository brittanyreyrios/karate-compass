UPDATE public.app_settings
SET value = 'https://www.google.com/search?q=tiger%27s+den+martial+arts#lrd=0x863f62a478b5509f:0x222afd447a3214c5,3,,,,',
    updated_at = now()
WHERE key = 'google_review_url';