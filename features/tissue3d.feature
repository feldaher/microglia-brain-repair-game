Feature: A piece of optic tectum as one soft body
  The tissue is a three-dimensional elastic solid with the dimensions measured on the paper's
  images. Neuron nuclei and astrocytic fibres are pinned inside it and move as it deforms.
  Microglia pull on the tissue they touch. It replaces the flat lattice of the paper's 2D model.

  Background:
    Given the tectum, built once

  Scenario: The shape is the one measured on Fig 1C
    Then the lobe is 210 micrometres across and 200 long in a horizontal section
    And the neuropil is an oval of about 110 by 155 micrometres in that section
    And the cell-dense zone, the neuropil and the skin are all present in the mesh
    And the tissue is held where it joins the rest of the brain, and free elsewhere

  Scenario: The mesh is one the solver can carry
    Then every tetrahedron has a positive volume
    And there are between 3000 and 9000 particles
    And the mesh is one connected body

  Scenario: Neurons are packed as in the fish
    Then there are more than 8000 nuclei
    And each has its nearest neighbour between 4.5 and 6.5 micrometres away, as in Fig 1C
    And none lies in the wound, and nearly all lie in the cell-dense zone

  Scenario: The wound is the track of the pin
    Then the wound is a channel 80 micrometres wide at the skin, entering at 25 degrees
    And its measured volume is within a quarter of the volume of that channel inside the tissue

  Scenario: Nothing moves by itself
    When the tissue runs for 5 seconds with nothing pulling
    Then the wound's volume has changed by less than 1 percent
    And no nucleus has moved by more than half a micrometre

  Scenario: Microglia over the wound pull it shut, and it springs back when they let go
    Given twelve microglia in the neuropil around the wound, each holding the tissue within reach
    When they shorten their hold by half and the tissue settles
    Then the wound is smaller by more than a tenth
    And nuclei near the microglia have moved toward them, more than nuclei far away
    When they let go and the tissue settles
    Then the wound is back to within 3 percent of what it was

  Scenario: What the tissue settles to does not depend on the solver's substeps
    Given the same microglia and the same pull, solved with 2 and with 4 substeps
    Then the two wound volumes agree within 3 percent
