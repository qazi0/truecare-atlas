# Run Book — TrueCare Atlas (Demo Day)

## URLs

- **Frontend**: https://trustmap-india.vercel.app
- **Backend (primary)**: https://trustmap-india-7474646917144080.aws.databricksapps.com
- **Backend (failover)**: _TBD_ (Modal)
- **Databricks workspace**: https://dbc-d744432c-1635.cloud.databricks.com

## Pre-Demo Checklist

- [ ] Databricks App is running (`databricks apps get trustmap-india --profile sj-wksp`)
- [ ] Frontend loads on phone hotspot
- [ ] Mapbox tiles load on hotspot
- [ ] Full golden path demo works end-to-end
- [ ] Backup video queued in second browser tab
- [ ] Eval slide numbers are final

## Failover: Backend

If Databricks Apps is down at demo time:

1. Frontend env var: set `BACKEND_URL` to the Modal URL
2. Redeploy on Vercel (or use Vercel env var override)
3. Modal URL: _TBD_

## Failover: Map

If Mapbox is down:

1. Set `NEXT_PUBLIC_MAP_PROVIDER=maplibre` in Vercel env vars
2. Redeploy — MapLibre + OpenFreeMap loads without code changes

## Free Edition Gotchas

- Databricks Apps auto-stop after 24h — deploy fresh on Saturday evening and Sunday morning
- Vector Search: 1 endpoint, 1 unit max
- Foundation Model Serving: rate limits vary — if extraction stalls, reduce concurrency
