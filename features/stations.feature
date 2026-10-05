Feature: One station for each figure of the paper
  The visitor moves through the seven main figures. Each station says what that figure found,
  beside a panel of it, and where it is built it lets the visitor do the experiment on a model.

  Scenario: There are seven stations, in the order of the paper
    Given the stations
    Then they are Fig 1 to Fig 7
    And each has a title, a finding of at most 60 words and a panel that is a file of the site
    And each says what kind of model stands behind it: the paper's, fitted to the paper's data, or illustrative

  Scenario: The Fig 4 station can be played
    Given the stations
    Then Fig 4 is built
    And so are Fig 1 and Fig 3, where the visitor watches and measures
    And it offers three fish: wild type, treated with KI20227, and the irf8 mutant

  Scenario: Each fish has the microglia the paper found in it
    Given the three fish
    Then the wild type has the 19 microglia of Fig 4A
    And the KI20227 fish has about a third as many, 6
    And the irf8 mutant has none

  Scenario: A fish without microglia cannot close its wound, and has no cell to steer
    Given a run in the irf8 mutant
    When it is played to the end with the visitor trying to pull and to call
    Then nothing was pulling and nobody could be called
    And the repair index is below 0.05

  Scenario: Fewer microglia close less
    Given a run in the KI20227 fish with every microglia pulling from the start
    When it is played to the end
    Then its repair index is above that of the irf8 mutant and below 0.6
