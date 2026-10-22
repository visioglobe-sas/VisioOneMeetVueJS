# Protected Map (Authorization Token)

> **Code sample only.** This demo has no protected map to load. Every value in the sample (`YOUR_PROTECTED_MAP_HASH`, `YOUR_JWT_FROM_YOUR_BACKEND`) is a placeholder: replace them with your own map hash and a token issued by your own backend. The app's "Protected map (token)" screen only points to this doc and loads nothing.

## Description

Loads a map served by Visioglobe's protected map server, which only answers requests carrying a valid JWT. It relies on two `LoadOptions` fields of `visioOne.loadVenue()` (`authorizationToken` and `baseURL`), on `venue.setAuthorizationToken()` to refresh the token while the map is displayed, and on the `UnauthorizedError` rejection of `loadVenue()` to tell a token problem apart from other load failures.

The sample lives in `src/components/ProtectedVisioOneMap.vue`. It reuses `src/components/VisioOneMap.vue`, which makes the actual `loadVenue()`/`createView()` calls.

## SDK usage

The placeholders are defined once, as constants at the top of `ProtectedVisioOneMap.vue`:

```js
// Your protected map's own hash (distinct from any public map hash).
const PROTECTED_MAP_HASH = 'YOUR_PROTECTED_MAP_HASH'
// The protected map server. https://mapserver.visioglobe.com/ does not enforce tokens.
const PROTECTED_MAP_SERVER_URL = 'https://mapserver-auth.visioglobe.com/'
// Issued by YOUR OWN backend. Never embed the signing secret in the app.
const AUTHORIZATION_TOKEN = 'YOUR_JWT_FROM_YOUR_BACKEND'
```

They're passed to `VisioOneMap.vue`, which loads the venue and creates the view:

```js
const visioOne = createVisioOne()
const venue = await visioOne.loadVenue(
  {
    vg_maphash: PROTECTED_MAP_HASH,
    baseURL: 'https://mapserver-auth.visioglobe.com/',
    authorizationToken: token,
  },
  loaderContainer,
)
const view = await visioOne.createView(container, venue)
```

A load failure is sorted into "token problem" or "anything else":

```js
function isUnauthorizedError(error) {
  return (
    error?.constructor?.name === 'UnauthorizedError' ||
    /authorization token/i.test(error?.message ?? '')
  )
}

try {
  // loadVenue(...) as above
} catch (error) {
  if (isUnauthorizedError(error)) {
    // Token invalid, expired or missing: get a new one from your backend.
  } else {
    // Any other load error (unknown hash, network, expired map...).
  }
}
```

Refresh the token on the loaded venue before it expires:

```js
venue.setAuthorizationToken(freshToken) // signature: (authorizationToken: string) => void
```

In the sample, the component exposes this as `refreshAuthorizationToken(freshToken)` (reach it through a template ref). It emits `unauthorized` for a token error and `error` for any other load error.

## Things to know

- **How the token is sent.** The SDK sends `authorizationToken` as the HTTP header `Authorization: Bearer <token>` on every map request. It only matters together with the protected server as `baseURL` (`https://mapserver-auth.visioglobe.com/`). The standard `https://mapserver.visioglobe.com/` does not enforce tokens.
- **Token errors.** An invalid, expired or missing token makes `loadVenue()` reject with `UnauthorizedError` ("the venue cannot be loaded because the authorization token is invalid or missing"). In SDK 1.1.0 the error is raised when the server answers `403` to the map's `descriptor.json`. Its message is `"This venue needs an Authorization token to be loaded"`.
- **Detecting `UnauthorizedError` in JavaScript.** The class is declared in the TypeScript typings (`VisioOne/Venue/Errors/UnauthorizedError.d.ts`), but SDK 1.1.0's package entry only exports `createVisioOne` and `VisioOne` at runtime. So there is no class to `import` and use with `instanceof`. Also, `error.name` stays `"Error"`. `error.constructor.name` is `"UnauthorizedError"` in this demo's dev server and its Vite production build, but a bundler that mangles class names would change it. Match on the message as a fallback, as `isUnauthorizedError()` does above.
- **Other failures look different.** A hash the server doesn't know rejects with `VenueNotFoundError`. A server that can't be reached rejects with a generic `Error('Cannot load the venue')`. Neither message mentions the token.
- **Tokens are short-lived.** The protected server accepts a token lifetime of at most 1 hour. Requests made after the token expires are rejected. Call `venue.setAuthorizationToken(freshToken)` before expiry: it updates the token for all later requests, with no reload. Refreshing in time is up to your app (for example, a timer set from the token's `exp` claim).
- **Never embed the JWT signing secret** in the app, the page or its bundle. Your backend signs the token with the secret and the claims Visioglobe gives you, and the page only ever receives the signed token.
- **Allowed origins (CORS).** The protected server also checks the request's `Origin` against an allowlist that Visioglobe configures for your account. For a web app like this one, the origin is wherever the page is served from. This demo's Vite dev server serves it from `http://localhost:5173` by default (or the port you pass with `--port`), and a deployed build serves it from your own domain (e.g. `https://maps.example.com`). Tell Visioglobe every origin your app uses (dev, staging, production). Because the token travels in an `Authorization` header, the browser sends a CORS preflight (`OPTIONS`) first. When the origin isn't allowed, the server answers the preflight with `403` and no `Access-Control-Allow-Origin` header, so the browser blocks the request (`TypeError: Failed to fetch`, logged by the SDK as a `VisioOne error:` warning). `loadVenue()` then rejects with the generic `Error('Cannot load the venue')`, **not** `UnauthorizedError`, even though the real cause is access control. This is what this sample's placeholder values produce from `http://localhost`. If you get this error with the protected server, check the origin allowlist before looking at the token.
- **A protected map has its own hash**, distinct from any public map hash. Using the public hash with the protected server (or the other way round) won't work.

## Learn more

- [Configurable Map Server](custom-base-url.md) covers `LoadOptions.baseURL` and the other `loadVenue()` errors.
- `node_modules/@visioglobe/visioone/dist/src/VisioOne/Venue/VisioOne.d.ts` (`loadVenue`, `@throws`) and `Venue.d.ts` (`setAuthorizationToken`).
