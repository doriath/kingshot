### Project Blueprint: Kingshot Companion

#### Overview
This application is a companion for the mobile game Kingshot. It helps players optimize their hero's gear, track event progress, and provides other useful tools to enhance their gameplay experience. The application is designed to be mobile-first, ensuring a seamless experience on any device.

#### Implemented Features
*   **Hero Configuration:** Users can define multiple heroes (e.g., Infantry, Cavalry, Archers).
*   **Gear State:** For each hero, users can input the current `enhancement` and `mastery` level for four pieces of gear: helmet, gloves, breastplate, and boots.
*   **Stat Weights:** Users can specify custom weights for `lethality` and `health` for each hero, defining what stats are most important to them.
*   **Resource Input:** Users can enter the amount of `experience` and `hammers` they have available for upgrades.
*   **Data Persistence:** All hero configurations and resource amounts are saved to the browser's local storage, so the data is not lost on refresh.
*   **Optimization Calculation:** A button triggers an algorithm to find the best way to spend experience points on gear enhancements.
*   **Results Display:** The application shows a detailed comparison of the gear "before" and "after" the optimization, including the change in stats and the overall weighted score.

---

### Current Task: Visual Revamp

**Goal:** Modernize the website's look and feel, with a strong focus on a mobile-first, responsive design. The new design will be more visually appealing, intuitive, and engaging for users.

**Execution Plan:**

**Phase 1: Foundational Redesign**

1.  **Blueprint Update:** Outline the full plan in `blueprint.md` to keep track of our goals and progress.
2.  **Modernize Global Styles:** Update the main `styles.css` file with a new, vibrant color palette, modern typography from Google Fonts, and a subtle background texture to give the app a premium feel.
3.  **Revamp the Home Page:** Completely rework the home page component's CSS to be mobile-first, responsive, and aligned with the new design language. This includes adding depth with shadows and improving the layout.
4.  **Introduce Icons:** Add SVG icons to enhance visual communication and make the UI more intuitive.

**Phase 2: Enhancing Interactivity & Navigation**

1.  **App Shell:** Redesign the main app component to include a clean, mobile-friendly navigation bar.
2.  **Animations:** Add subtle animations and hover effects to buttons and cards to make the interface feel more alive and responsive.

**Phase 3: Component Consistency**

1.  **Component Audit:** Review the other components in the application and apply the new design system to them, ensuring a consistent and polished user experience across the entire site.
2.  **Bear Event Page:** Optimize the Bear Event page for mobile devices. This includes rewriting the CSS to be mobile-first and responsive, styling the form controls to match the new design system, and fixing the styling of the generated formation results to be clear and readable.

**Phase 4: Bear Optimizer UI Revamp**

1.  **Goal**: Completely redesign the Bear Optimizer page to be more modern, mobile-first, and visually appealing, while preserving all existing functionality.
2.  **HTML Structure**: Rewrite the HTML for clarity and responsiveness, using a card-based layout for marches.
3.  **CSS Styling**: Implement a new mobile-first stylesheet with a modern design, including a clean layout, better typography, and improved user interactions.
4.  **Interactivity**: Add copy-to-clipboard functionality with visual feedback for the results.

**Phase 5: Hero Gear UI Revamp**

1.  **Goal**: Overhaul the Hero Gear Optimizer page with the new dark-theme design system, focusing on a clean, mobile-first, and intuitive user experience.
2.  **HTML Structure**: Restructure the page using a card-based system for resources, hero gear, advanced settings, and results. Replace input tables with responsive form layouts.
3.  **CSS Styling**: Write a new, mobile-first stylesheet using the established CSS variables for a consistent look. Style all elements, including cards, forms, and result tables, to be visually appealing and easy to interact with on any device.

**Phase 6: UI Polish and Final Touches**

1.  **Goal**: Address user feedback by making targeted UI improvements to the Hero Gear page for better clarity and visual appeal.
2.  **Advanced Settings Header**: Fix the styling of the "Advanced Stat Weights" header to ensure the background covers the entire area, not just the text.
3.  **Reset Button**: Redesign the reset button to be more visually distinct and convey a sense of caution, using a red color scheme.
4.  **Optimize Button**: Change the primary action button to a yellow/accent color to make it the main focal point.