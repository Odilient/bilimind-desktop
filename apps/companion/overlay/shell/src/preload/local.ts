// The exported preload (the bridge and the cookie jar), plus the one thing that makes this a single-user app: the
// session cookie is always there, so the SPA's sign-in guard never fires and it needs no change.
import { contextBridge } from 'electron'
import './preload.ts'

function seedSession(): void {
  document.cookie = 'bilimind_token=local; max-age=315360000'
}

if (location.protocol === 'app:') contextBridge.executeInMainWorld({ func: seedSession })
