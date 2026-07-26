# baseline: enemy record now includes heading — update the minimality pin
p = "test/baseline.test.js"
src = open(p).read()
src = src.replace('''  assert.deepEqual(
    Object.keys(enemy).sort(),
    ["id", "state", "team", "type", "x", "y"],
    "enemy view record must stay minimal"
  );''',
'''  assert.deepEqual(
    Object.keys(enemy).sort(),
    ["heading", "id", "state", "team", "type", "x", "y"],
    "enemy view record stays minimal (heading is externally observable)"
  );''')
open(p, "w").write(src)

# 3A + 9A stat pins gain turnRate
p = "test/milestone3a.test.js"
src = open(p).read()
src = src.replace("reloadTicks: 15, canTow: false, canCarryStandard: false, capacity: 0,",
                  "reloadTicks: 15, canTow: false, canCarryStandard: false, capacity: 0, turnRate: 8,")
open(p, "w").write(src)

p = "test/milestone9a.test.js"
src = open(p).read()
src = src.replace("canTow: false, canCarryStandard: true, capacity: 2,\n  });",
                  "canTow: false, canCarryStandard: true, capacity: 2, turnRate: 6,\n  });")
open(p, "w").write(src)
print("fallout patched")
