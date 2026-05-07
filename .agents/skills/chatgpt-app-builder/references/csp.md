# Content Security Policy

Views run in sandboxed iframes with strict CSP. Whitelist external domains on the **`view.csp`** field of the tool/view config (NOT under `_meta`).

| Property | Purpose |
|----------|---------|
| `connectDomains` | Fetch/XHR requests to external APIs |
| `resourceDomains` | Static assets (images, fonts, scripts, styles, raster tiles) |
| `redirectDomains` | (optional) `openExternal` destinations without safe-link modal |
| `frameDomains` | (optional) Iframe embeds — triggers stricter review |
| `baseUriDomains` | (optional) Allowed values for `<base href>` |

```typescript
server.registerTool(
  {
    name: "search-flights",
    description: "Search flights",
    view: {
      component: "search-flights",
      description: "Flight results",
      csp: {
        connectDomains: ["https://api.example.com"],
        resourceDomains: ["https://cdn.example.com"],
        frameDomains: ["https://maps.example.com"],
        redirectDomains: ["https://checkout.example.com"],
      },
    },
    inputSchema: { ... },
  },
  async (input) => ({ ... }),
);
```

Skybridge auto-includes the server's own domain. Only add external domains.

> **Note:** Do NOT put `csp` under `_meta` (e.g. `_meta.ui.csp`). The `_meta` field is reserved for tool-level metadata and is **not** read by the view's CSP builder — entries placed there will silently fail to whitelist anything. The `csp` field must be a direct child of `view`.
