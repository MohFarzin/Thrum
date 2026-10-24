import { useMemo, useState } from 'react'

type OsId = 'powershell' | 'cmd' | 'mac' | 'linux'

const OS_OPTIONS: { id: OsId; label: string }[] = [
  { id: 'powershell', label: 'Windows PowerShell' },
  { id: 'cmd', label: 'Windows CMD' },
  { id: 'mac', label: 'macOS' },
  { id: 'linux', label: 'Linux' },
]

function detectOs(): OsId {
  const ua = navigator.userAgent.toLowerCase()
  const plat = (navigator.platform || '').toLowerCase()
  if (plat.includes('mac') || ua.includes('mac os')) return 'mac'
  if (plat.includes('linux') || ua.includes('linux')) return 'linux'
  // Windows default → PowerShell (modern Windows)
  return 'powershell'
}

function buildCommands(url: string, key: string, sleepSec: number): Record<OsId, { loop: string; once: string }> {
  return {
    powershell: {
      once: `curl.exe -sS -X POST "${url}" -H "Authorization: Bearer ${key}"`,
      loop: `while ($true) {\n  curl.exe -sS -X POST "${url}" -H "Authorization: Bearer ${key}"\n  Start-Sleep -Seconds ${sleepSec}\n}`,
    },
    cmd: {
      once: `curl.exe -sS -X POST "${url}" -H "Authorization: Bearer ${key}"`,
      loop: `REM Run once per interval via Task Scheduler, or:\n:loop\ncurl.exe -sS -X POST "${url}" -H "Authorization: Bearer ${key}"\ntimeout /t ${sleepSec} /nobreak >nul\ngoto loop`,
    },
    mac: {
      once: `curl -sS -X POST '${url}' -H "Authorization: Bearer ${key}"`,
      loop: `while true; do\n  curl -sS -X POST '${url}' -H "Authorization: Bearer ${key}"\n  sleep ${sleepSec}\ndone`,
    },
    linux: {
      once: `curl -sS -X POST '${url}' -H "Authorization: Bearer ${key}"`,
      loop: `while true; do\n  curl -sS -X POST '${url}' -H "Authorization: Bearer ${key}"\n  sleep ${sleepSec}\ndone`,
    },
  }
}

type Props = {
  url: string
  apiKey: string
  sleepSec: number
}

export function HeartbeatCommands({ url, apiKey, sleepSec }: Props) {
  const [open, setOpen] = useState(false)
  const [os, setOs] = useState<OsId>(() => detectOs())
  const cmds = useMemo(() => buildCommands(url, apiKey, sleepSec), [url, apiKey, sleepSec])
  const current = cmds[os]

  return (
    <div className="cmd-drawer">
      <button type="button" className="text-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide agent commands' : 'Show agent commands'}
      </button>
      {open ? (
        <div className="cmd-panel">
          <div className="range-tabs" role="tablist" aria-label="Shell">
            {OS_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                role="tab"
                aria-selected={os === o.id}
                className={`range-tab${os === o.id ? ' on' : ''}`}
                onClick={() => setOs(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="meta">Detected: {OS_OPTIONS.find((o) => o.id === detectOs())?.label}. No JSON body needed.</p>
          <p className="meta">Loop (keep this running):</p>
          <pre className="curl-block">{current.loop}</pre>
          <p className="meta">Single shot:</p>
          <pre className="curl-block">{current.once}</pre>
          <button
            type="button"
            className="btn tiny ghost"
            onClick={() => void navigator.clipboard.writeText(current.loop)}
          >
            Copy loop
          </button>
        </div>
      ) : null}
    </div>
  )
}
