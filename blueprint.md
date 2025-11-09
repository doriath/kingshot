# Project Overview

This project is an Angular application designed to help players of a strategy game optimize their hero gear. The main feature is to calculate the most effective distribution of enhancement levels across different pieces of gear for multiple heroes, based on their stats and user-provided resources.

# Implemented Features

*   **Hero and Gear Management:** Users can define multiple heroes, each with four pieces of gear (helmet, gloves, breastplate, boots). For each gear, they can set mastery and current enhancement levels.
*   **Stat Weights:** Users can specify weights for `lethality` and `health` for each hero, indicating which stat is more important for them.
*   **Resource Input:** Users can input the amount of extra experience (`exp`) they have available for upgrades.
*   **Greedy Algorithm for Gear Optimization:** The application uses a greedy algorithm to find the most score-efficient distribution of enhancement levels.
*   **Modern UI:** The application features a clean, modern design with a responsive layout.

# Current Plan: Make the UI mobile-responsive

## Phase 1: Add responsive styles to the `hero-gear.css` file

1.  **Add media queries** to the `hero-gear.css` file to adjust the layout for smaller screens.
2.  The resource inputs will stack vertically on smaller screens.
3.  Paddings and font sizes will be reduced to make better use of the limited space.
4.  The tables will be made scrollable horizontally to prevent them from breaking the layout.
