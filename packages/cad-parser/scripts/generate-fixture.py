import ezdxf

doc = ezdxf.new('R2010')
doc.header['$INSUNITS'] = 2
msp = doc.modelspace()

doc.layers.add(name='WALLS', color=7)
doc.layers.add(name='TEXT', color=2)
doc.layers.add(name='DOORS', color=1)
doc.layers.add(name='WINDOWS', color=5)

# Room 1: Kitchen, 20x12
msp.add_lwpolyline(
    [(0, 0), (20, 0), (20, 12), (0, 12), (0, 0)],
    dxfattribs={'layer': 'WALLS'}
)
msp.add_text('Kitchen 240 sq ft', dxfattribs={'layer': 'TEXT', 'height': 1.0}).set_placement((5, 5))

# Room 2: Living Room, 15x18, adjacent
msp.add_lwpolyline(
    [(20, 0), (35, 0), (35, 18), (20, 18), (20, 0)],
    dxfattribs={'layer': 'WALLS'}
)
msp.add_text('Living Room 270 sq ft', dxfattribs={'layer': 'TEXT', 'height': 1.0}).set_placement((23, 8))

# Room 3: Bathroom, 6x8
msp.add_lwpolyline(
    [(35, 0), (41, 0), (41, 8), (35, 8), (35, 0)],
    dxfattribs={'layer': 'WALLS'}
)
msp.add_text('Bathroom', dxfattribs={'layer': 'TEXT', 'height': 1.0}).set_placement((37, 4))

# A door between Kitchen and Living Room, and a window on the Kitchen's outer wall
msp.add_line((20, 4), (20, 7), dxfattribs={'layer': 'DOORS'})
msp.add_line((0, 3), (0, 7), dxfattribs={'layer': 'WINDOWS'})

doc.saveas('fixtures/sample-house.dxf')
print('Fixture written to fixtures/sample-house.dxf')