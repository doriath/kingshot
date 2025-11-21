# Castle Battle Timer Feature

## Overview
The Castle Battle Timer is a companion tool designed to help alliances coordinate defenses during the Castle Battle event in Kingshot. It allows players to track incoming enemy rallies on the Castle and its 4 Turrets, and calculates precise reinforcement departure times to ensure defenses arrive safely between attacks.

## Features
- **Space Management**: Create independent spaces for different alliances or battle sessions.
- **Real-time Tracking**: Live countdowns for incoming rallies.
- **Reinforcement Calculator**: Input your personal travel time to see exactly when to launch your march.
- **Building Dashboard**: Monitor the status of the Castle and all 4 Turrets (I, II, III, IV) in one view.
- **Rally Management**: Admins can add and remove rallies.

## Usage Guide

### 1. Creating a Space
1. Navigate to the Castle Event page (`/castle-event`).
2. Enter a unique name for your alliance's space.
3. Click **Create New Space**.

### 2. Tracking Rallies
1. Open your Space.
2. Locate the building under attack (e.g., Castle, Turret I).
3. Click **+ Add Rally**.
4. Select the **Enemy** (or create a new one).
5. Enter the **Travel Time** (e.g., `5:00` for 5 minutes).
6. Click **Start**.
   - The system automatically adds the 5-minute rally wait time.
   - A countdown to **Impact** will appear.

### 3. Timing Reinforcements
1. In the building card, find the **My Travel Time** input.
2. Enter your specific march time to that building (e.g., `2:30`).
3. Look at the **Leave in** timer next to the rally.
   - This timer tells you exactly how long to wait before sending your troops so they arrive just before the enemy hits.

### 4. Managing Enemies
- When adding a rally, you can save new enemies and their default travel times for quick access in future rallies.

## Technical Details
- **Storage**: Data is synced in real-time using Firebase Firestore.
- **State Management**: Angular Signals are used for reactive local state.
- **Time Sync**: Timers are calculated based on the server timestamp of the rally start.
