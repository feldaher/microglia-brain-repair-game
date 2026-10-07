Feature: The paper told as chapters on one tissue
  The visitor is taken through the paper's argument chapter by chapter. The camera flies from one
  chapter's shot to the next; at a stop the visitor takes it over. Next, back and a jump to any
  chapter are all there is to learn.

  Scenario: The journey starts on its first chapter, already there
    Given a director on the chapters of the journey
    Then it is on the first chapter, on its first line, arrived
    And the camera is on that chapter's shot

  Scenario: Next reads the chapter out, then flies on
    Given a director on the chapters of the journey
    When next is pressed once for each remaining line of the first chapter
    Then it is still on the first chapter, on its last line
    When next is pressed again
    Then it is flying to the second chapter, on its first line
    And the camera has not moved yet

  Scenario: A flight ends exactly on the shot
    Given a director flying to the second chapter
    When the flight's time has passed
    Then it has arrived
    And the camera is on the second chapter's shot

  Scenario: Halfway through a descent the scale is the geometric mean
    Given a flight from a shot 3500 micrometres wide to one 350 wide
    When half the flight's time has passed
    Then the camera frames about 1107 micrometres

  Scenario: The camera turns the short way round
    Given a flight from a yaw of 3 radians to a yaw of -3 radians
    When half the flight's time has passed
    Then the yaw is within 0.2 of pi, not near zero

  Scenario: Next during a flight lands it
    Given a director flying to the second chapter
    When next is pressed
    Then it has arrived at the second chapter, on its first line

  Scenario: Back retraces the steps
    Given a director arrived at the second chapter
    When back is pressed
    Then it is flying to the first chapter, on its last line
    When back is pressed at the first line of the first chapter
    Then nothing changes

  Scenario: The last chapter has no next
    Given a director arrived at the last chapter, on its last line
    When next is pressed
    Then nothing changes

  Scenario: Any chapter can be reached directly
    Given a director on the chapters of the journey
    When the visitor goes to the last chapter
    Then it is flying to the last chapter, on its first line
    When the visitor goes to a chapter that does not exist
    Then nothing changes

  Scenario: With reduced motion a flight is a cut
    Given a director for a visitor who asked for reduced motion
    When next is pressed until the chapter changes
    Then it has arrived at once, without flying

  Scenario: At a stop the visitor takes the camera
    Given a director arrived at a chapter with a stop
    When the visitor takes the camera
    Then the camera is free
    When next is pressed until the chapter changes, from where the visitor left the camera
    Then the flight starts from where the visitor left it

  Scenario: Where there is no stop the camera cannot be taken
    Given a director arrived at a chapter without a stop
    When the visitor takes the camera
    Then the camera is still the director's

  Scenario: The chapters say where their numbers come from
    Given the chapters of the journey
    Then each has a title, at least one caption, and captions of at most 40 words
    And each chapter about a figure has a hotspot
    And every panel names a page or a figure of the paper, a kind of model, and a picture that is a file of the site
    And every micrograph in the scene is a file of the site
    And the chapter about Fig 4 sends the visitor on to the paper's own simulation

  Scenario: The same chapter frames the same tissue in any window
    Given a shot 300 micrometres wide
    When it is framed in a window 1400 by 900 with 470 pixels of text on the left and 290 on the right
    Then 300 micrometres span the 640 free pixels
    And the shot's centre is drawn in the middle of the free area
    When it is framed in a window 390 by 800 with 110 pixels of title at the top and 360 pixels of controls at the bottom
    Then the shot's centre is drawn in the middle of the free area
