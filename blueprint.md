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