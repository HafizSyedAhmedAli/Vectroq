import os

out = []
def p(code, val):
    out.append(str(code)); out.append(str(val))

def line(layer, x1, y1, x2, y2):
    p(0, "LINE"); p(8, layer); p(10, x1); p(20, y1); p(11, x2); p(21, y2)

def arc(layer, cx, cy, r, a0, a1):
    p(0, "ARC"); p(8, layer); p(10, cx); p(20, cy); p(40, r); p(50, a0); p(51, a1)

def text(layer, x, y, h, s):
    p(0, "TEXT"); p(8, layer); p(10, x); p(20, y); p(40, h); p(1, s)

def door(hx, hy, tx, ty, a0, a1):
    r = abs(tx - hx) + abs(ty - hy)
    line("DOOR", hx, hy, tx, ty)
    arc("DOOR", hx, hy, r, a0, a1)

p(0, "SECTION"); p(2, "HEADER"); p(9, "$ACADVER"); p(1, "AC1009"); p(0, "ENDSEC")
p(0, "SECTION"); p(2, "TABLES"); p(0, "TABLE"); p(2, "LAYER"); p(70, 4)
for name, color in [("WALLS", 7), ("DOOR", 2), ("WINDOW", 4), ("LABELS", 3)]:
    p(0, "LAYER"); p(2, name); p(70, 0); p(62, color); p(6, "CONTINUOUS")
p(0, "ENDTAB"); p(0, "ENDSEC")
p(0, "SECTION"); p(2, "ENTITIES")

# walls (mm): 12 m x 10 m house
for w in [
    (0, 0, 12000, 0), (12000, 0, 12000, 10000),
    (12000, 10000, 0, 10000), (0, 10000, 0, 0),
    (5000, 0, 5000, 10000),        # bedrooms | living + dining
    (8500, 0, 8500, 5500),         # living | kitchen
    (0, 5000, 5000, 5000),         # bedroom 1 | bedroom 2
    (5000, 5500, 12000, 5500),     # living + kitchen | dining
    (0, 3000, 2000, 3000), (2000, 3000, 2000, 5000),     # bath 1 inside bedroom 1
    (0, 8000, 2000, 8000), (2000, 8000, 2000, 10000),    # bath 2 inside bedroom 2
]:
    line("WALLS", *w)

# doors (hinge on the wall, leaf points into the room it opens to)
door(6000, 0, 6000, 1000, 0, 90)          # main entrance, inside the living room
door(5000, 1800, 6000, 1800, 0, 90)       # bedroom 1 -> living
door(5000, 6500, 6000, 6500, 0, 90)       # bedroom 2 -> dining
door(8500, 2500, 9500, 2500, 270, 360)    # living -> kitchen
door(500, 3000, 500, 3800, 0, 90)         # bedroom 1 -> bath 1
door(500, 8000, 500, 8800, 0, 90)         # bedroom 2 -> bath 2
door(12000, 8500, 11200, 8500, 90, 180)   # back door from dining

# windows
for w in [
    (1200, 0, 3200, 0), (7300, 0, 8200, 0),            # front
    (2800, 10000, 4600, 10000), (6000, 10000, 7600, 10000), (9000, 10000, 10800, 10000),  # back
    (0, 5800, 0, 7400),                                  # bedroom 2 west
    (12000, 1200, 12000, 3200), (12000, 6500, 12000, 7200),  # east
]:
    line("WINDOW", *w)

for x, y, h, s in [
    (1200, 1500, 350, "BEDROOM 1"), (1200, 6200, 350, "BEDROOM 2"),
    (700, 4200, 250, "BATH"), (700, 9000, 250, "BATH"),
    (5700, 3000, 350, "LIVING ROOM"), (6500, 7800, 350, "DINING"),
    (9200, 3000, 350, "KITCHEN"),
    (5800, -700, 250, "MAIN ENTRANCE"),
    (5000, 10700, 450, "SIMPLE 12m x 10m HOUSE PLAN"),
]:
    text("LABELS", x, y, h, s)
text("DIMENSIONS", 5200, -1200, 220, "12000 mm OVERALL WIDTH")
text("DIMENSIONS", 12400, 4500, 220, "10000 mm OVERALL DEPTH")

p(0, "ENDSEC"); p(0, "EOF")
data = "\n".join(out) + "\n"

for path in [
    "packages/cad-parser/fixtures/whole_house_simple_plan.dxf",
    "apps/web/public/samples/sample-house-plan.dxf",
]:
    if os.path.isdir(os.path.dirname(path)):
        open(path, "w").write(data)
        print("wrote", path)