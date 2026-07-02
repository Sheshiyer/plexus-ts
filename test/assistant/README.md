# Assistant Test Harness

Assistant tests cover the native Plexus assistant runtime without calling live
model providers, live Workers, or local user data. Use fixtures and mocked
providers for every test unless a later smoke script explicitly opts into live
verification.

Run:

```bash
npm run test:assistant
```
