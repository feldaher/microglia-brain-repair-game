Feature: The force laws of the paper's multi-agent model
  The tissue moves by the model of El-Daher et al. 2024 as its source code runs it:
  PhysiCell 1.7.1 repulsion and adhesion, a random walk, and an elastic traction
  between each microglia and every other cell.

  Scenario: The parameters are those of the repository's settings file
    Given the model parameters
    Then microglia move at 3 micrometres per minute and the elastic coefficient is 9e-6 per minute
    And neurons move at 0.01 micrometres per minute and both keep a direction for 10 minutes
    And the radius is 8.4127 micrometres, the time step 0.1 minutes and a run lasts 1200 minutes

  Scenario: Overlapping cells push apart
    Given two skin cells 10 micrometres apart
    When the model takes one step
    Then each moves away from the other at 50 times the square of one minus the distance over the sum of radii

  Scenario: Only neurons adhere to each other
    Given two neurons 19 micrometres apart
    When the model takes one step
    Then each moves toward the other at 0.04 times the square of one minus the distance over the adhesion range
    And a neuron and a skin cell at the same distance do not move
    And two neurons 22 micrometres apart do not move

  Scenario: A microglia pulls every other cell toward itself
    Given a pulling microglia and a neuron 200 micrometres apart
    When the model takes one step
    Then the neuron moves toward the microglia at the elastic coefficient times the distance
    And the microglia moves toward the neuron at the same speed

  Scenario: Traction adds up over microglia
    Given three pulling microglia and a neuron
    When the model takes one step
    Then the neuron moves toward their centroid at three times the elastic coefficient times its distance to the centroid

  Scenario: Skin cells feel no traction
    Given a pulling microglia and a skin cell 200 micrometres apart
    When the model takes one step
    Then the skin cell does not move

  Scenario: The skin anchors the microglia
    Given a pulling microglia between a skin cell 200 micrometres to its right and a neuron 100 micrometres to its left
    When the model takes one step
    Then the microglia is pulled toward the skin at the elastic coefficient times 200, less the neuron's pull of the elastic coefficient times 100
    And the skin cell does not move
    And with the skin cell taken away the microglia moves toward the neuron instead

  Scenario: A microglia that lets go pulls nothing
    Given a microglia that is not pulling and a neuron 200 micrometres apart
    When the model takes one step
    Then the neuron does not move

  Scenario: Held cells stay where they are
    Given a pulling microglia and a neuron that is held in place
    When the model takes one step
    Then the neuron has not moved

  Scenario: Positions advance by the Adams-Bashforth rule
    Given a pulling microglia held in place and a neuron 200 micrometres away
    When the model takes two steps
    Then the first displacement is 1.5 time steps of the first velocity
    And the second is 1.5 time steps of the second velocity minus 0.5 time steps of the first

  Scenario: A gap between two neurons closes exponentially
    Given four pulling microglia held at the origin and two neurons 100 micrometres either side
    When the model runs for 600 minutes
    Then the gap is 200 micrometres times the exponential of minus four times the elastic coefficient times 600
    And it is smaller by the half step the scheme gains on its first step, which has no previous velocity

  Scenario: Motile cells walk at their speed and turn at their persistence
    Given a single microglia that is not pulling
    When the model takes 20000 steps
    Then its motility vector always has the microglial speed in three dimensions
    And its component out of the plane never moves it
    And it changes direction in about one step in a hundred

  Scenario: The visitor steers one cell only
    Given two microglia that are not pulling, one of them the visitor's
    When the visitor heads along x and the model takes one step
    Then the visitor's cell moves along x at the microglial speed
    And the other microglia keeps its own random walk

  Scenario: The visitor's hold switches their traction on and off
    Given a neuron and the visitor's microglia 200 micrometres apart
    When the visitor holds and the model takes one step
    Then the neuron moves toward the visitor's cell
    When the visitor lets go and the model takes one step
    Then the neuron's velocity is zero

  Scenario: A weaker traction scales the pull and nothing else
    Given a pulling microglia and a neuron 200 micrometres apart
    When the model takes one step at half the traction
    Then the neuron moves toward the microglia at half the elastic coefficient times the distance
