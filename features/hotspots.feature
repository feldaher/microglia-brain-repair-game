Feature: Hotspots ride on the tissue
  A hotspot is a label on a point of the tissue. It is drawn where that point is on screen,
  and it is not drawn when the point cannot be seen.

  Scenario: A hotspot is drawn where its point is
    Given a camera looking at a point of the tissue in a window 1000 by 600
    Then that point is at the middle of the window
    And a point to the camera's right is drawn to the right of the middle, at the same height

  Scenario: A point behind the camera has no hotspot
    Given a camera looking at a point of the tissue in a window 1000 by 600
    Then a point behind the camera is not drawn

  Scenario: A hotspot can follow something that moves
    Given a hotspot that follows the first microglia
    Then it is where that microglia is
    And it is absent when there are no microglia
