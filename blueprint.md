
# Project Overview

This project is an Angular application that helps players of a strategy game to analyze their troop composition. The main feature is the ability to upload a screenshot of the troop overview screen and get a structured breakdown of troop types and quantities. The analysis is performed entirely on the client-side for privacy and speed.

# Implemented Features

*   **Bear Component:** A page that will host the troop analysis feature.
*   **Client-Side OCR:** Using `tesseract.js` to extract text from images in the browser.

# Current Plan: Implement a more robust parsing logic

## Phase 1: Update the `OcrService`

1.  **Modify the `OcrService`** to return the detailed recognition result, including word and line information with their coordinates.

## Phase 2: Refactor the parsing logic in `BearComponent`

1.  **Refactor the parsing logic in `BearComponent`** to use this detailed information. I will iterate through lines of text, and for each line, I'll look for a quantity (a number). I'll then associate that quantity with the text on the same line that describes the troop.

## Phase 3: Refine the UI

1.  **Refine the UI** to present this more accurately parsed information.
