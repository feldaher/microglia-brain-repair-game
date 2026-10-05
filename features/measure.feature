Feature: The measurements of Figs 1 and 3, made on a run of the model
  A run is recorded every 15 minutes, as the paper's time-lapses were. On that record the visitor
  tracks neurons, sees how straight they go, finds where they are heading and when the microglia
  gathered, and compares all of it with what was measured in fish.

  Background:
    Given the paper's simulation, recorded from 4 to 24 hours after injury

  Scenario: One frame every 15 minutes
    Then the record has 81 frames
    And a neuron's track starts where the neuron started and ends where it is now

  Scenario: Neurons are carried, they do not wander (Fig 1K, L)
    Then the displacement exponent of the neurons is 2.0, within 0.05
    And the paper measured 1.86 in fish, where a random walk gives 1
    And a single tracked neuron gives the same exponent as all of them, within 0.05

  Scenario: The model closes steadily where the fish closes late and then stops (Fig 1D, 3I)
    Then the measured closure of Fig 3I is still below a tenth at 7 hours and is nine tenths done by 16
    And the model's closure is already a tenth done at 7 hours and not nine tenths done until after 20

  Scenario: The tracks point at the microglia (Fig 3A, B, F)
    Then the neurons' tracks converge within 20 micrometres of where the microglia have gathered
    And a visitor's guess is scored by its distance to that point

  Scenario: The microglia gather first (Fig 3G, I)
    Then the microglia are nine tenths gathered by 8 hours after injury
    And in fish they reach nine tenths of their plateau by 6.5 hours
    And at 8 hours the model's wound is less than a quarter closed

  Scenario: Without microglia there is nothing to measure
    Given the same tissue without microglia, recorded to the end
    Then no neuron has moved more than 5 micrometres
    And there is no convergence point and no microglia to find

  Scenario: The record can be scrubbed
    Given a replay that has played for 10 seconds
    Then its playhead is where the tissue is, a little over 7 hours after injury
    And scrubbed back to 4 hours it shows every cell where it started
    And it cannot be scrubbed past what has been simulated
    And nobody is steered in it and every microglia pulls
