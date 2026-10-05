Feature: The model reproduces the simulation shown in the paper
  Fig 4A of El-Daher et al. 2024 shows the simulated tissue at 4 and at 24 hours after injury.
  Started from the cells of the first panel, the model must arrive at the second.

  Scenario: The starting layout is the one in the figure
    Given the cells read from the 4 hours panel of Fig 4A
    Then there are 950 neurons, 437 skin cells and 19 microglia
    And they sit on the lattice of the paper's packing script, 19.2 micrometres apart
    And three neurons, at the top edge of the domain, are held in place

  Scenario: After 1200 minutes the tissue has the shape of the 24 hours panel
    Given the cells read from the 4 hours panel of Fig 4A
    When the model runs for 1200 minutes
    Then the neurons span -399 to 373 micrometres in x, as measured on the figure, within 5
    And they span -375 to 414 micrometres in y, the held row apart, within 5
    And the microglia have gathered around -21, 39 micrometres, within 15
    And the skin has not moved by more than 3 micrometres
