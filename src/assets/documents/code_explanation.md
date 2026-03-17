# Smart Farm IoT Project: Detailed Code Explanation

This document provides a comprehensive technical breakdown of the Smart Farm system, covering the hardware (ESP32), the cloud infrastructure (Firebase), and the web application (Ionic/Angular).

---

## 1. System Architecture Overview

The Smart Farm is a distributed IoT system designed for automated farm management. It consists of three primary layers:

1.  **Hardware Layer (ESP32)**: Collects sensor data and controls actuators (pumps, fans, etc.). It communicates with the cloud via Wi-Fi.
2.  **Cloud Layer (Firebase)**:
    *   **Realtime Database (RTDB)**: Used for high-frequency data updates (current sensor values) and low-latency control commands.
    *   **Cloud Firestore**: Used for long-term data storage, historical snapshots, and event logging.
3.  **Application Layer (Ionic/Angular)**: Provides a user interface for real-time monitoring, manual control, and data analytics.

---

## 2. Hardware: ESP32 Firmware (`Smartfarm.ino`)

The ESP32 acts as the "brain" of the farm. It runs a continuous loop to monitor the environment and react to both local sensor data and remote commands.

### 2.1 Pin Configuration and Sensors
*   **DHT11 (Pin 17)**: Measures air temperature and humidity.
*   **Steam Sensor (Pin 35)**: Detects moisture or rain levels.
*   **Light Sensor (Pin 34)**: Measures ambient light intensity (LDR).
*   **Water Level (Pin 33)**: Detects the height of water in a tank.
*   **Soil Humidity (Pin 32)**: Measures the moisture level in the soil.
*   **PIR Motion Sensor (Pin 23)**: Detects movement (intruder or animal detection).
*   **Ultrasonic HC-SR04 (Trig: 12, Echo: 13)**: Measures distance, used for the auto-feeding system.
*   **Self-Locking Button (Pin 5)**: Interacts with the LCD to switch display pages.

### 2.2 Actuator Control Logic
The system supports three modes for each actuator: **ON**, **OFF**, and **AUTO**.

*   **Water Pump (Relay - Pin 25)**:
    *   `AUTO`: Turns ON if `soilHumidity < 30%`.
*   **Fan (L298N/DC Fan - Pins 19, 18)**:
    *   `AUTO`: Turns ON if `temperature > 28°C`.
*   **LED (Pin 27)**:
    *   `AUTO`: Turns ON if `light < 40%`.
*   **Buzzer (Alarm - Pin 16)**:
    *   `AUTO`: Sounds a "siren" effect if `pirMotion` is detected.
*   **Servo (Feeder - Pin 26)**:
    *   `AUTO`: Opens the feeder (80°) if an object is within 2-7cm, otherwise stays closed (180°).

### 2.3 Firebase Integration
The ESP32 uses the `Firebase_ESP_Client` library. It performs two main tasks:
1.  **Pushing Data**: Every 2 seconds, it updates the `/sensors` path in RTDB with current readings.
2.  **Fetching Commands**: Every 2 seconds, it retrieves the desired `mode` for each actuator from the `/controls` path.
3.  **Logging**: When an actuator state changes (e.g., pump turns ON), it pushes a log entry to `/logs` in RTDB.

---

## 3. Web Application: Ionic/Angular

The app is divided into three main modules: `Home`, `Dashboard`, and `History`.

### 3.1 Home Page (`home.page.ts`)
The Home page is the real-time command center.
*   **Real-time Sync**: Uses Firebase `onValue` listeners to update the UI instantly when sensor data changes in RTDB.
*   **The Log Bridge**: A critical function that listens to the `/logs` path in RTDB. When a new log arrives, it:
    1.  Copies the log to **Cloud Firestore** for permanent storage.
    2.  Deletes the log from **RTDB** to keep the real-time database small and fast.
*   **Hourly Snapshots**: Every hour, it takes the current sensor readings and saves a "snapshot" to Firestore. This creates the data used for the "History" graphs.

### 3.2 Dashboard Page (`dashboard.page.ts`)
Focuses on event frequency and analytics.
*   **Event Counting**: Fetches the last 100 logs from Firestore and counts how many times the pump, alarm, or feeder were triggered.
*   **Data Visualization**: Uses **Chart.js** to display a bar chart comparing the frequency of these events.

### 3.3 History Page (`history.page.ts`)
Focuses on long-term trends and environmental patterns.
*   **Time Filtering**: Allows users to view data from the last 24 hours, 7 days, or 30 days.
*   **Multi-Line Charts**:
    *   **Climate Chart**: Shows Temperature vs. Humidity trends.
    *   **Levels Chart**: Shows Soil Moisture, Water Level, Steam, and Light levels simultaneously.
*   **Summary Stats**: Calculates Min, Max, and Average values for the selected time period using simple JavaScript `reduce` and `Math` functions.

---

## 4. Data Management & Utilities

### 4.1 Data Flow Summary
1.  **Sensors** $\rightarrow$ **ESP32** $\rightarrow$ **RTDB** $\rightarrow$ **Ionic UI** (Real-time).
2.  **Events** $\rightarrow$ **RTDB** $\rightarrow$ **Ionic (Bridge)** $\rightarrow$ **Firestore** (Long-term logging).
3.  **Ionic UI (Snapshots)** $\rightarrow$ **Firestore** (Hourly environmental tracking).

### 4.2 Demo Data Generation (`generate-demo.js`)
This is a standalone Node.js script (and also a function within the app) used for testing. 
*   It generates **168 hourly snapshots** (7 days of data).
*   It uses **sine wave algorithms** to simulate realistic temperature (peaks at 2 PM) and humidity (lowest at 2 PM) patterns.
*   It randomly generates 75 event logs to populate the dashboard.

---

## 5. Summary of Technologies
*   **Framework**: Ionic v7 + Angular.
*   **Hardare**: ESP32 (C++/Arduino).
*   **Database**: Google Firebase (RTDB, Firestore, Auth).
*   **Charting**: Chart.js.
*   **Styling**: Ionic Components + SCSS.
