import { app, safeStorage, shell } from 'electron'
import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { isRecord, REQUEST_TIMEOUT_MS } from './http'

/*
 * A "Desktop app" OAuth client. Google documents its secret as not being
 * confidential -- anything shipped inside an installer cannot be -- and PKCE
 * is what actually ties the code to this process.
 */
const CLIENT_ID = __GOOGLE_CLIENT_ID__
const CLIENT_SECRET = __GOOGLE_CLIENT_SECRET__

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

/** Long enough to find the right account and read the consent screen. */
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000
/** An access token this close to expiry is renewed rather than risked. */
const EXPIRY_MARGIN_MS = 60_000

export const googleAuthAvailable = CLIENT_ID.length > 0

/** The refresh token is gone or no longer honoured: only signing in again helps. */
export class RevokedError extends Error {
  constructor() {
    super('Google access was revoked. Connect again to keep syncing.')
    this.name = 'RevokedError'
  }
}

/** The user backed out, in the app or on Google's consent screen. Not worth an error message. */
export class CancelledError extends Error {
  constructor() {
    super('Sign-in was cancelled')
    this.name = 'CancelledError'
  }
}

class TokenEndpointError extends Error {
  readonly code: string | null

  constructor(code: string | null, status: number) {
    super(code ? `Google sign-in failed (${code})` : `Google sign-in failed (${status})`)
    this.name = 'TokenEndpointError'
    this.code = code
  }
}

function base64url(bytes: Buffer): string {
  return bytes.toString('base64url')
}

async function postForm(url: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(params)
  })
  const body = (await response.json().catch(() => null)) as unknown
  if (!response.ok) {
    const code = isRecord(body) && typeof body.error === 'string' ? body.error : null
    throw new TokenEndpointError(code, response.status)
  }
  if (!isRecord(body)) throw new Error('Malformed response from Google')
  return body
}

/** Shown in the browser tab the sign-in finished in. Static, so nothing to escape. */
function landingPage(heading: string, detail: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Electric Clock</title>
<style>body{margin:0;display:grid;place-items:center;height:100vh;font:16px system-ui,sans-serif;
background:#101214;color:#e8e8e6}main{text-align:center}p{color:#9a9c9e}</style></head>
<body><main><h1>${heading}</h1><p>${detail}</p></main></body></html>`
}

function respond(response: ServerResponse, status: number, html: string, then: () => void): void {
  // `connection: close` so the server can shut down the moment this is sent.
  response.writeHead(status, { 'content-type': 'text/html; charset=utf-8', connection: 'close' })
  response.end(html, then)
}

/**
 * Google's loopback flow for installed apps: listen on a random local port,
 * send the user to Google in their own browser -- Google refuses sign-in from
 * embedded webviews -- and wait for it to redirect back here with a code.
 */
function waitForCode(
  state: string,
  challenge: string,
  signal: AbortSignal
): Promise<{ code: string; redirectUri: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    let redirectUri = ''
    let settled = false

    const finish = (error: Error | null, code?: string): void => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', onAbort)
      server.close()
      server.closeAllConnections()
      if (error) reject(error)
      else resolve({ code: code ?? '', redirectUri })
    }

    const onAbort = (): void => {
      const reason = signal.reason as unknown
      const timedOut = reason instanceof DOMException && reason.name === 'TimeoutError'
      finish(timedOut ? new Error('Sign-in timed out') : new CancelledError())
    }
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener('abort', onAbort)

    server.on('request', (request, response) => {
      const url = new URL(request.url ?? '/', redirectUri)
      // Browsers ask for /favicon.ico and the like; only the redirect counts.
      if (url.pathname !== '/') {
        response.writeHead(404).end()
        return
      }
      // A request that did not come from our own redirect is ignored, not fatal.
      if (url.searchParams.get('state') !== state) {
        response.writeHead(400).end()
        return
      }

      const error = url.searchParams.get('error')
      const code = url.searchParams.get('code')
      if (error || !code) {
        respond(
          response,
          200,
          landingPage('Not connected', 'You can close this tab and try again from Electric Clock.'),
          () => finish(error === 'access_denied' ? new CancelledError() : new Error(`Google sign-in failed (${error ?? 'no code'})`))
        )
        return
      }

      respond(
        response,
        200,
        landingPage('Connected', 'Electric Clock can now read your calendar. You can close this tab.'),
        () => finish(null, code)
      )
    })

    server.on('error', (error) => finish(error))

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      redirectUri = `http://127.0.0.1:${port}`
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPE,
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        // Offline + consent so Google hands over a refresh token every time,
        // including on a reconnect after the old one was revoked.
        access_type: 'offline',
        prompt: 'consent'
      })
      shell.openExternal(`${AUTH_ENDPOINT}?${params.toString()}`).catch((error: Error) => finish(error))
    })
  })
}

interface StoredToken {
  encrypted: boolean
  /** Base64 of the encrypted bytes, or the token itself when `encrypted` is false. */
  data: string
}

/**
 * Owns the Google credentials. The refresh token lives in its own file rather
 * than in config.json, because the config is handed to the renderer whole;
 * the access token is never written anywhere.
 */
export class GoogleAuth {
  private readonly filePath = join(app.getPath('userData'), 'google-token.json')
  private refreshToken: string | null
  private access: { token: string; expiresAt: number } | null = null
  /** Shared by concurrent callers, so a burst of requests renews the token once. */
  private renewing: Promise<string> | null = null
  private signIn: AbortController | null = null

  constructor() {
    this.refreshToken = this.load()
  }

  get connected(): boolean {
    return this.refreshToken !== null
  }

  /** Resolves once connected. Rejects with CancelledError if the user backs out. */
  async connect(): Promise<void> {
    this.signIn?.abort()
    const controller = new AbortController()
    this.signIn = controller

    try {
      const verifier = base64url(randomBytes(32))
      const challenge = base64url(createHash('sha256').update(verifier).digest())
      const state = base64url(randomBytes(16))
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(SIGN_IN_TIMEOUT_MS)])

      const { code, redirectUri } = await waitForCode(state, challenge, signal)
      const body = await postForm(TOKEN_ENDPOINT, {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })

      const refreshToken = body.refresh_token
      if (typeof refreshToken !== 'string') throw new Error('Google did not grant offline access')

      // Google's consent screen lets each permission be unticked. Without
      // this one there is nothing to show, so say so instead of syncing an
      // empty calendar forever.
      const scopes = typeof body.scope === 'string' ? body.scope.split(' ') : []
      if (!scopes.includes(SCOPE)) {
        void this.revokeToken(refreshToken)
        throw new Error('Calendar access was not granted')
      }

      this.refreshToken = refreshToken
      this.access = null
      this.storeAccess(body)
      this.save(refreshToken)
    } finally {
      if (this.signIn === controller) this.signIn = null
    }
  }

  cancelConnect(): void {
    this.signIn?.abort()
  }

  /** A valid access token, renewed first if it is about to expire. */
  async accessToken(): Promise<string> {
    if (!this.refreshToken) throw new RevokedError()
    if (this.access && this.access.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
      return this.access.token
    }
    this.renewing ??= this.renew().finally(() => {
      this.renewing = null
    })
    return this.renewing
  }

  /** For a 401 on a token that looked fine: the next call fetches a new one. */
  invalidate(): void {
    this.access = null
  }

  /** Revoking is best-effort; forgetting the token locally always happens. */
  async disconnect(): Promise<void> {
    this.cancelConnect()
    const token = this.refreshToken
    this.forget()
    if (token) await this.revokeToken(token)
  }

  private async renew(): Promise<string> {
    const refreshToken = this.refreshToken
    if (!refreshToken) throw new RevokedError()
    try {
      const body = await postForm(TOKEN_ENDPOINT, {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
      return this.storeAccess(body)
    } catch (error) {
      // Revoked from the Google account page, expired, or the password was
      // changed. Retrying would only fail the same way.
      if (error instanceof TokenEndpointError && error.code === 'invalid_grant') {
        if (this.refreshToken === refreshToken) this.forget()
        throw new RevokedError()
      }
      throw error
    }
  }

  private storeAccess(body: Record<string, unknown>): string {
    const token = body.access_token
    if (typeof token !== 'string') throw new Error('Malformed response from Google')
    const lifetime = typeof body.expires_in === 'number' ? body.expires_in : 3600
    this.access = { token, expiresAt: Date.now() + lifetime * 1000 }
    return token
  }

  private async revokeToken(token: string): Promise<void> {
    try {
      await postForm(REVOKE_ENDPOINT, { token })
    } catch (error) {
      console.warn('[google] could not revoke token:', error)
    }
  }

  private forget(): void {
    this.refreshToken = null
    this.access = null
    rmSync(this.filePath, { force: true })
  }

  private load(): string | null {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf-8')) as unknown
      if (!isRecord(raw) || typeof raw.data !== 'string') return null
      if (raw.encrypted !== true) return raw.data
      // Encrypted with a keyring that is no longer there: unreadable, so the
      // user will simply be asked to connect again.
      if (!safeStorage.isEncryptionAvailable()) return null
      return safeStorage.decryptString(Buffer.from(raw.data, 'base64'))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[google] ignoring unreadable token file:', error)
      }
      return null
    }
  }

  private save(token: string): void {
    // The OS keychain (Keychain, DPAPI, libsecret/kwallet) where there is one.
    // A bare Linux session may have none; then the file's permissions are
    // the only protection, which is what most CLI tools settle for too.
    const encrypted = safeStorage.isEncryptionAvailable()
    if (!encrypted) console.warn('[google] no OS keyring available; storing the token unencrypted')

    const stored: StoredToken = encrypted
      ? { encrypted, data: safeStorage.encryptString(token).toString('base64') }
      : { encrypted, data: token }

    const temp = `${this.filePath}.tmp`
    try {
      mkdirSync(app.getPath('userData'), { recursive: true })
      writeFileSync(temp, JSON.stringify(stored), { encoding: 'utf-8', mode: 0o600 })
      renameSync(temp, this.filePath)
    } catch (error) {
      console.error('[google] failed to store token:', error)
    }
  }
}
