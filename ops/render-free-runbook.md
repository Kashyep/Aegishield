# Free Render preview runbook

This deploys the synthetic demo API described by `render.yaml`. It is a public demo preview, not a production service.

## 1. Connect the source repository

1. Push the reviewed branch to the owner’s GitHub, GitLab, or Bitbucket repository.
2. In Render, connect that repository and choose **New → Blueprint**.
3. Select the repository root containing `render.yaml`, review the Blueprint changes, and apply it.
4. Confirm the service is named `aegisshield-demo`, uses the **Free** instance, and passes the `/api/v1/health` health check.
5. Record the generated `https://<service>.onrender.com` URL. Do not put access tokens in this repository.

The Blueprint sets `AEGIS_DEMO_MODE=1`, `AEGIS_LLM_MODE=off`, and SQLite at `/tmp/aegis-demo.sqlite3`. No provider key or external service is needed.

## 2. Verify the public service

Replace the host with the URL shown in Render, then check:

```powershell
curl.exe -i https://<service>.onrender.com/api/v1/health
curl.exe -i https://<service>.onrender.com/api/v1/scenario
```

Health should return `200` and `"status":"ok"`. Keep only synthetic fixture data on this public service. The API uses simulated `X-Actor-Id` values and has no authentication.

## 3. Add UptimeRobot monitoring

1. Sign in to UptimeRobot and add one **Keyword** monitor (or HTTP monitor if keyword matching is unavailable on the selected account).
2. Set the URL to `https://<service>.onrender.com/api/v1/health` and the check interval to the free plan’s **5 minutes**.
3. For a Keyword monitor, require the response body to contain `"status":"ok"`.
4. Send alerts to the owner’s chosen contact and confirm the first check succeeds.

Five-minute inbound checks are frequent enough to avoid Render’s documented 15-minute idle window while the monitor is operating. They do not prevent platform restarts or maintenance. A sleeping service can take about a minute to start, so its first check after sleep may be reported as down. Render’s free tier is limited to 750 instance hours per workspace each calendar month; the allowance is shared with other free services.

## 4. Data and demo reset

Free Render services have an ephemeral filesystem. Local SQLite data is lost on spin-down, restart, or deploy. Reset before each demo and do not rely on the cloud database as an audit archive:

```powershell
curl.exe -X POST https://<service>.onrender.com/api/v1/demo/reset `
  -H "X-Actor-Id: USR-PRIYA"
```

For reliable records, use the local offline demo or move to durable storage with an understood retention policy.

## 5. Links to current limits

- [Render free services](https://render.com/docs/free)
- [Render health checks](https://render.com/docs/health-checks)
- [UptimeRobot free plan](https://help.uptimerobot.com/en/articles/11604710-who-should-use-uptimerobot-s-free-plan)
