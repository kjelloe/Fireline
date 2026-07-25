### Milestone 0I: `frontier_corridor` parity gate

Run the full deterministic suite:

```bash
node --test test/milestone0.test.js test/milestone0i.test.js
```

`engine/frontier_corridor.js` defines a pure 128×128 named profile. It first applies a fixed PRNG-budget terrain pass, then stamps infrastructure deterministically. The final layers guarantee a four-cell horizontal cross-map route, two approach roads, two safe operational base zones, and a clear central objective area.

The fixture deliberately pins the map through full-array FNV-1a 64-bit hashes, terrain counts, and coordinate probes, rather than embedding a 16,384-value array. Any behavior change requires intentional fixture regeneration and review.
