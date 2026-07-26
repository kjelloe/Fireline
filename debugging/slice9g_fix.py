def patch(path, old, new, count=1):
    src = open(path).read()
    assert src.count(old) == count, f"{path}: x{src.count(old)}: {old[:60]!r}"
    open(path, "w").write(src.replace(old, new))

src = open("engine/reducer.js").read()
launch_start = "  // 9G anti-camping: idling outside your own supply umbrella draws a drone"
flight_start = "  if (next.drones.length > 0) {\n    const gone = new Set();"
i_launch = src.index(launch_start)
i_flight = src.index(flight_start)
assert i_launch < i_flight
end_marker = "\n\n  // Anti-deadlock (9A):"
i_end = src.index(end_marker, i_flight)
launch_block = src[i_launch:i_flight]
flight_block = src[i_flight:i_end]
# Flight first: a freshly launched drone sits on its pad until next tick.
flight_block = flight_block.replace(
    "  if (next.drones.length > 0) {",
    "  // 9G flight runs BEFORE launches: a fresh drone sits on its pad for\n"
    "  // one tick (deterministic spawn position, no same-tick teleport).\n"
    "  if (next.drones.length > 0) {", 1)
src = src[:i_launch] + flight_block + launch_block.rstrip() + src[i_end:]
open("engine/reducer.js", "w").write(src)

patch("test/milestone9g.test.js",
"""  assert.equal(hits, 2, "repeated light damage on station");
  assert.equal(s.assets[0].state, ASSET_DISABLED, "a camper can be pestered to death");
  assert.ok(
    s.events.some((e) => e.type === "drone_recalled"),
    "the drone breaks off once its target is a wreck"
  );""",
"""  assert.equal(hits, 2, "repeated light damage on station");
  assert.equal(s.assets[0].state, ASSET_DISABLED, "a camper can be pestered to death");
  s = apply(s, { type: "advance_tick" });
  assert.ok(
    s.events.some((e) => e.type === "drone_recalled"),
    "the drone breaks off once its target is a wreck"
  );""")
print("9G reordered")
