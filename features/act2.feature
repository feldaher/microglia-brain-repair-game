Feature: Act 2, pull the wound closed
  The visitor is one microglia in the paper's simulated tectum. They crawl, they pull,
  and they call other microglia to pull with them. The tissue moves by the paper's model only.

  Scenario: The run starts as the paper's simulation does, with nobody pulling yet
    Given a new run
    Then the clock reads 4 hours after injury
    And the tissue is the layout of Fig 4A
    And no microglia is pulling
    And the visitor's cell is the microglia nearest the wound
    And the repair index is 0

  Scenario: Twenty hours pass in one minute
    Given a new run
    When 60 seconds of play go by
    Then the clock reads 24 hours after injury
    And the run is over
    And time ran 1200 times faster than life

  Scenario: The visitor's cell crawls toward where they point, at a microglia's speed
    Given a new run
    When the visitor points 200 micrometres to the right of their cell for 2 seconds
    Then their cell has moved right by about 3 micrometres per minute of tissue time

  Scenario: Calling microglia adds them one at a time
    Given a new run
    When the visitor pulls and calls 5 microglia
    Then 6 microglia are pulling
    And calling 20 more leaves all 19 pulling and no one left to call

  Scenario: One cell is not enough, many are
    Given a run in which the visitor pulls alone to the end
    And a run in which every microglia pulls from the start
    Then alone the repair index stays below 0.2
    And together it is above 0.6
