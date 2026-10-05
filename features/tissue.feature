Feature: Packing cells into a tissue and measuring the wound
  Cells are placed on a hexagonal lattice inside an outline, as the paper's script does,
  and the wound is measured as the part of a region no neuron covers.

  Scenario: Cells are hexagonally packed at the script's spacing
    Given a square outline 200 micrometres wide
    When it is packed with cells
    Then nearest neighbours are 19.2 micrometres apart
    And every cell lies inside the outline

  Scenario: The wound is a gap in the packing
    Given a square outline 200 micrometres wide with a wound 60 micrometres wide through its middle
    When it is packed with neurons
    Then no neuron lies in the wound

  Scenario: An empty region is all wound and a covered one has none
    Given a region 40 micrometres square
    Then with no neuron its open area is 1600 square micrometres
    And with a neuron on every lattice point 8 micrometres apart its open area is zero

  Scenario: The repair index is the fraction of the wound that has closed
    Given wound volumes of 1000 at 4 hours and 250 at 24 hours
    Then the repair index is 0.75
    And a wound that does not change has a repair index of 0
    And a wound that grows has a negative repair index

  Scenario: Without microglia the wound stays open and with more of them it closes further
    Given a synthetic wounded band of neurons with held edges
    When it runs for 20 hours with 0, 20 and 60 microglia
    Then with none the repair index is below 0.05
    And the repair index rises with the number of microglia
