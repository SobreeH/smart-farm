# Hardware Maintenance & Logic: `Smartfarm.ino` Breakdown

This document provides a line-by-line and functional explanation of the ESP32 source code used in the Smart Farm project.

---

## 1. Libraries and Definitions

### 1.1 Essential Libraries
*   **`Firebase_ESP_Client.h`**: The core library for interacting with Google Firebase. It handles the authentication and protocol needed to speak to the Realtime Database.
*   **`WiFi.h`**: Manages the Wi-Fi connection of the ESP32.
*   **`ESP32Servo.h`**: A specialized library for driving Servo motors on the ESP32 architecture.
*   **`LiquidCrystal_I2C.h`**: Controls the 16x2 LCD display using only two wires (SDA/SCL).
*   **`dht11.h`**: The driver for the DHT11 temperature and humidity sensor.

### 1.2 Pin Map & Constants
The code defines several `macros` (using `#define`) to map hardware pins to logical names. This makes the code easier to maintain if a wire is moved to a different pin.
*   **Sensors**: DHT11 (17), Steam (35), Light (34), Water Level (33), Soil (32), PIR (23), Ultrasonic (12/13).
*   **Actuators**: LED (27), Pump/Relay (25), Servo (26), Fan (18/19), Buzzer (16).

---

## 2. Global Variables & State Tracking
The code maintains several variables to store the "current state" of the farm:
*   **Sensor Values**: Integers like `temperature`, `humidity`, and `soilHumidity`.
*   **Control Modes**: Strings like `waterPumpMode` which can be "ON", "OFF", or "AUTO".
*   **Timing Variables**: `sendDataPrevMillis` and `lastLcdUpdate` are used to perform tasks at specific intervals (every 2 seconds or every 1 second) without resetting the processor (non-blocking timing).
*   **State History**: `lastPumpState`, `lastAlarmState`, and `lastServoState` are used to detect when a device *just* turned on or off, allowing the code to trigger a single log event instead of logging continuously.

---

## 3. Core Functions

### 3.1 `setup()` — The Initialization
This function runs once when the ESP32 starts.
1.  **Pin Modes**: Sets `OUTPUT` or `INPUT` for every pin.
2.  **Actuator Reset**: Moves the servo to its default "closed" position (180°).
3.  **Wi-Fi Connection**: Enters a `while` loop that waits until the Wi-Fi is connected before proceeding.
4.  **Firebase Sign-Up**: Authenticates anonymously with Firebase to get a session token.

### 3.2 `loop()` — The Main Engine
The loop is designed to be highly responsive. It calls two types of tasks:
1.  **Continuous Tasks**: `handleButtonAndLCD()` and `handleActuators()` run every single time the loop cycles. This ensures that a button press or an emergency stop is processed instantly.
2.  **Timed Tasks**: The `millis()` check ensures that `readSensors()` and the Firebase data sync only happen every **2000ms (2 seconds)**. This prevents the system from overwhelming the database with too much traffic.

### 3.3 `readSensors()` — Data Acquisition
*   **Digital/Analog Conversion**: Reads raw voltages from sensors.
*   **Normalization**: Converts raw 12-bit analog values (0-4095) into a human-readable percentage (0-100) using the formula: `(analogRead / 4095.0) * 100`.
*   **Ultrasonic Calculation**: Calls `getDistance()` to trigger a sound pulse and calculate the distance based on the echo return time.

### 3.4 `handleActuators()` — The Logic Processor
This is the heart of the automation. It processes each device based on its mode:

*   **Pump & Fan**: Uses simple `if` statements. In `AUTO` mode, it compares `soilHumidity` or `temperature` against hardcoded thresholds (e.g., 30% humidity).
*   **Buzzer (Siren Algorithm)**: Instead of a flat beep, it uses a `lambda function` (`soundSiren`) to cycle the frequency from 200Hz to 1000Hz, creating a professional alarm sound.
*   **Servo (Feeder)**: In `AUTO`, it opens the door if the `distance` is exactly between 2cm and 7cm—perfect for detecting an animal at the feeder.

### 3.5 `logEvent(String type)` — Cloud Reporting
Whenever an actuator changes state, this function constructs a `FirebaseJson` object.
*   It uses `.sv: timestamp` to tell Firebase to generate a server-side timestamp.
*   It `push`es the data to the `/logs` path in the Realtime Database.

---

## 4. Helper: `getDistance()`
This function demonstrates precise timing:
1.  Triggers a 10-microsecond HIGH pulse on the `TRIGPIN`.
2.  Uses `pulseIn()` to wait for the `ECHOPIN` to go HIGH and measure the pulse duration.
3.  **Timeout Logic**: Includes a 30ms timeout. If the sensor is disconnected, it returns `999` instead of freezing the entire farm's logic.
4.  **Math**: Divides the duration by 58 (the speed of sound conversion factor for cm).
