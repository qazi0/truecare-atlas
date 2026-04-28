create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid)
from cron.job
where jobname = 'truecare-health-monitor';

select
  cron.schedule(
    'truecare-health-monitor',
    '*/5 * * * *',
    $$
    select net.http_get(
      url := 'https://truecare-atlas.vercel.app/api/cron/health',
      headers := jsonb_build_object(
        'Authorization', 'Bearer REPLACE_WITH_HEALTH_CRON_SECRET'
      ),
      timeout_milliseconds := 20000
    );
    $$
  );
