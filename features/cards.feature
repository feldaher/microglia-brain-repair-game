Feature: Labels that open cards with the paper's own images
  Each thing in the scene carries a label. Clicking it opens a card that says what it is,
  in the paper's numbers, beside a panel of one of the paper's figures.

  Scenario: Every part of the scene has a card
    Given the cards
    Then there is one for the visitor's cell, the neurons, the wound, the neuropil, the pull and the skin
    And each has a name and a text of at most 75 words

  Scenario: Every image is the paper's and says so
    Given the cards
    Then each card's image is a file of the site
    And each is credited to a numbered figure of El-Daher et al. 2024 under CC BY 4.0
    And each has a caption

  Scenario: The numbers on the cards are the paper's
    Given the facts the cards quote
    Then the wound closes between 18 and 22 hours after injury
    And microglia arrive from 2 hours and are gathered by 6
    And about 20 pulls happen per hour in each half of the tectum
    And a cut microglial process snaps back at 0.89 micrometres per second
    And the wound closed in 16 of 21 normal fish and 2 of 17 without microglia

  Scenario: Labels ride with what they name
    Given a run in which every microglia has pulled for 10 seconds
    Then the visitor's label is on the visitor's cell
    And the neurons' label has moved with its neuron
    And the wound's label is at the centre of the box
