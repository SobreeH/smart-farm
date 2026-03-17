#include <Arduino.h>
#include <Firebase_ESP_Client.h>
#include <WiFi.h>

// Provide the token generation process info.
#include "addons/TokenHelper.h"
// Provide the RTDB payload printing info and other helper functions.
#include "addons/RTDBHelper.h"

#include <ESP32Servo.h>
#include <LiquidCrystal_I2C.h>
#include <dht11.h>

// Wi-Fi Credentials
#define WIFI_SSID "iot"
#define WIFI_PASSWORD "11223344"

// Firebase API Key and RTDB URL
#define API_KEY "AIzaSyD1LTlZXjINs58NoHKhr67kgsxeHJmkkSc"
#define DATABASE_URL                                                           \
  "https://iot-final-12af4-default-rtdb.asia-southeast1.firebasedatabase.app"

// Define Firebase Data objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Pins
#define DHT11PIN 17
#define STEAMPIN 35
#define LIGHTPIN 34
#define WATERLEVELPIN 33
#define SOILHUMIDITYPIN 32
#define PIRPIN 23   // Fixed mismatch: changed from 14 to 23
#define BUTTONPIN 5 // Set to 5 based on 5.1.4Self-Locking-Button.ino
#define TRIGPIN 12  // Ultrasonic Trig
#define ECHOPIN 13  // Ultrasonic Echo

#define LEDPIN 27
#define RELAYPIN 25
#define SERVOPIN 26
#define FANPIN1 19
#define FANPIN2 18
#define BUZZERPIN 16

LiquidCrystal_I2C lcd(0x27, 16, 2);
dht11 DHT11;
Servo myservo;

// Sensor Data Variables
int temperature = 0;
int humidity = 0;
int soilHumidity = 0;
int light = 0;
int waterLevel = 0;
int steam = 0;
bool pirMotion = false;
int distance = 0;

// Control Modes
String waterPumpMode = "OFF";
String fanMode = "OFF";
String ledMode = "OFF";
String servoMode = "OFF";
String alarmMode = "OFF";

// Button/LCD State
int lcdPage = 0;
const int totalPages = 4;
bool lastButtonState = HIGH; // Assuming pullup

unsigned long sendDataPrevMillis = 0;
unsigned long lastLcdUpdate = 0;
bool pageChanged = true;
unsigned long lastLogTime = 0;

// State tracking for logging
bool lastPumpState = false;
bool lastAlarmState = false;
bool lastServoState = false;

// Function to log events to Firebase
void logEvent(String type) {
  if (Firebase.ready()) {
    FirebaseJson json;
    json.set("type", type);
    json.set("timestamp/.sv", "timestamp");

    if (Firebase.RTDB.pushJSON(&fbdo, "/logs", &json)) {
      Serial.println("Event logged: " + type);
    } else {
      Serial.println("Logging failed: " + fbdo.errorReason());
    }
  }
}

void setup() {
  Serial.begin(115200);

  // Set pins
  pinMode(LEDPIN, OUTPUT);
  pinMode(RELAYPIN, OUTPUT);
  pinMode(FANPIN1, OUTPUT);
  pinMode(FANPIN2, OUTPUT);
  ledcAttachChannel(BUZZERPIN, 1000, 8, 4);

  pinMode(STEAMPIN, INPUT);
  pinMode(LIGHTPIN, INPUT);
  pinMode(SOILHUMIDITYPIN, INPUT);
  pinMode(WATERLEVELPIN, INPUT);
  pinMode(PIRPIN, INPUT);
  pinMode(BUTTONPIN, INPUT);
  pinMode(TRIGPIN, OUTPUT);
  pinMode(ECHOPIN, INPUT);

  myservo.attach(SERVOPIN);
  myservo.write(160); // Initial position

  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting Wi-Fi");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println();
  Serial.print("Connected with IP: ");
  Serial.println(WiFi.localIP());

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Wi-Fi Connected!");

  // Firebase Setup
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  // Anonymous sign-in for simplicity, make sure your rules allow it.
  Firebase.signUp(&config, &auth, "", "");
  config.token_status_callback = tokenStatusCallback; // see
                                                      // addons/TokenHelper.h

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  // 1. These must run continuously to catch immediate button presses and
  // actuator changes
  handleButtonAndLCD();
  handleActuators();

  // 2. Read sensors and communicate with Firebase every 2 seconds
  if (millis() - sendDataPrevMillis > 2000 || sendDataPrevMillis == 0) {
    sendDataPrevMillis = millis();

    // Read the sensors right before sending the data!
    readSensors();

    // Now send and receive from Firebase
    if (Firebase.ready()) {
      // SEND SENSOR DATA
      Firebase.RTDB.setInt(&fbdo, "/sensors/temperature", temperature);
      Firebase.RTDB.setInt(&fbdo, "/sensors/humidity", humidity);
      Firebase.RTDB.setInt(&fbdo, "/sensors/soilHumidity", soilHumidity);
      Firebase.RTDB.setInt(&fbdo, "/sensors/light", light);
      Firebase.RTDB.setInt(&fbdo, "/sensors/waterLevel", waterLevel);
      Firebase.RTDB.setInt(&fbdo, "/sensors/steam", steam);
      Firebase.RTDB.setBool(&fbdo, "/sensors/pir", pirMotion);
      Firebase.RTDB.setInt(&fbdo, "/sensors/distance", distance);

      // FETCH CONTROL MODES
      if (Firebase.RTDB.getString(&fbdo, "/controls/waterPump/mode")) {
        waterPumpMode = fbdo.stringData();
      }
      if (Firebase.RTDB.getString(&fbdo, "/controls/fan/mode")) {
        fanMode = fbdo.stringData();
      }
      if (Firebase.RTDB.getString(&fbdo, "/controls/led/mode")) {
        ledMode = fbdo.stringData();
      }
      if (Firebase.RTDB.getString(&fbdo, "/controls/servo/mode")) {
        servoMode = fbdo.stringData();
      }
      if (Firebase.RTDB.getString(&fbdo, "/controls/alarm/mode")) {
        alarmMode = fbdo.stringData();
      }
    }
  }
}

void readSensors() {
  DHT11.read(DHT11PIN);
  temperature = DHT11.temperature;
  humidity = DHT11.humidity;

  // Convert analogs to percentage (0 - 100) assuming 12-bit ADC
  steam = (analogRead(STEAMPIN) / 4095.0) * 100;
  light = (analogRead(LIGHTPIN) / 4095.0) * 100;
  soilHumidity = (analogRead(SOILHUMIDITYPIN) / 4095.0) * 100;
  waterLevel = (analogRead(WATERLEVELPIN) / 4095.0) * 100;

  pirMotion = digitalRead(PIRPIN) == HIGH;
  distance = getDistance();
}

void handleButtonAndLCD() {
  bool currentButtonState = digitalRead(BUTTONPIN);

  // 1. Detect if the button state has changed at all (Using pull-down logic
  // where 0 = pressed based on 5.1.4)
  if (currentButtonState != lastButtonState) {
    delay(10); // Debounce delay

    // 2. If the new state is LOW (0), the button was just pressed down
    if (currentButtonState == 0) {
      lcdPage = (lcdPage + 1) % totalPages;
      lcd.clear();
      pageChanged = true; // Tell the system to redraw the screen NOW
    }
  }

  // Save the current state for the next loop
  lastButtonState = currentButtonState;

  // --- LCD DISPLAY LOGIC ---
  // Only update if the page changed, or if 1 second has passed
  if (pageChanged || (millis() - lastLcdUpdate > 1000)) {
    lcd.setCursor(0, 0);

    if (lcdPage == 0) {
      lcd.print("Temp: ");
      lcd.print(temperature);
      lcd.print("C  ");
      lcd.setCursor(0, 1);
      lcd.print("Hum:  ");
      lcd.print(humidity);
      lcd.print("%  ");
    } else if (lcdPage == 1) {
      lcd.print("Soil: ");
      lcd.print(soilHumidity);
      lcd.print("%  ");
      lcd.setCursor(0, 1);
      lcd.print("Light: ");
      lcd.print(light);
      lcd.print("%  ");
    } else if (lcdPage == 2) {
      lcd.print("Water: ");
      lcd.print(waterLevel);
      lcd.print("%  ");
      lcd.setCursor(0, 1);
      lcd.print("Steam: ");
      lcd.print(steam);
      lcd.print("%  ");
    } else if (lcdPage == 3) {
      lcd.print(pirMotion ? "Motion Det!    " : "Clear          ");
      lcd.setCursor(0, 1);
      lcd.print("               ");
    }

    lastLcdUpdate = millis(); // Reset the screen timer
    pageChanged = false;      // Reset the screen flag
  }
}

void handleActuators() {
  // WATER PUMP (Relay) logic
  if (waterPumpMode == "ON") {
    digitalWrite(RELAYPIN, HIGH);
  } else if (waterPumpMode == "OFF") {
    digitalWrite(RELAYPIN, LOW);
  } else { // AUTO
    if (soilHumidity < 30)
      digitalWrite(RELAYPIN, HIGH);
    else
      digitalWrite(RELAYPIN, LOW);
  }

  // Log Water Pump events
  bool currentPumpState = (digitalRead(RELAYPIN) == HIGH);
  if (currentPumpState && !lastPumpState) {
    logEvent("water_on");
  } else if (!currentPumpState && lastPumpState) {
    logEvent("water_off");
  }
  lastPumpState = currentPumpState;

  // FAN logic
  if (fanMode == "ON") {
    digitalWrite(FANPIN1, HIGH);
    digitalWrite(FANPIN2, LOW);
  } else if (fanMode == "OFF") {
    digitalWrite(FANPIN1, LOW);
    digitalWrite(FANPIN2, LOW);
  } else { // AUTO
    if (temperature > 28) {
      digitalWrite(FANPIN1, HIGH);
      digitalWrite(FANPIN2, LOW);
    } else {
      digitalWrite(FANPIN1, LOW);
      digitalWrite(FANPIN2, LOW);
    }
  }

  // LED logic
  if (ledMode == "ON") {
    digitalWrite(LEDPIN, HIGH);
  } else if (ledMode == "OFF") {
    digitalWrite(LEDPIN, LOW);
  } else { // AUTO
    if (light < 40)
      digitalWrite(LEDPIN, HIGH);
    else
      digitalWrite(LEDPIN, LOW);
  }

  // BUZZER logic (Alarm if motion detected & Control Modes)
  static unsigned long lastBuzzerUpdate = 0;
  static int buzzerFreq = 200;
  static int buzzerDirection = 10;
  static bool isAlarming = false;

  // The siren sound algorithm
  auto soundSiren = []() {
    if (!isAlarming) {
      isAlarming = true;
      buzzerFreq = 200;
      buzzerDirection = 10;
      logEvent("alarm_on"); // Log when alarm starts
    }
    if (millis() - lastBuzzerUpdate > 10) {
      lastBuzzerUpdate = millis();
      ledcWriteTone(BUZZERPIN, buzzerFreq);
      buzzerFreq += buzzerDirection;
      if (buzzerFreq >= 1000) {
        buzzerDirection = -10;
      } else if (buzzerFreq <= 200) {
        buzzerDirection = 10;
      }
    }
  };

  auto silenceSiren = []() {
    if (isAlarming) {
      isAlarming = false;
      ledcWriteTone(BUZZERPIN, 0);
      logEvent("alarm_off"); // Log when alarm stops
    }
  };

  // Determine Buzzer action based on mode
  if (alarmMode == "ON") {
    soundSiren();
  } else if (alarmMode == "OFF") {
    silenceSiren();
  } else { // AUTO
    if (pirMotion) {
      soundSiren();
    } else {
      silenceSiren();
    }
  }

  // SERVO logic (Auto-Feeding System)
  if (servoMode == "ON") {
    myservo.write(80); // Open
  } else if (servoMode == "OFF") {
    myservo.write(180); // Close
  } else {              // AUTO
    // When distance is detected within 2~7cm, open the feeding box.
    if (distance >= 2 && distance <= 7)
      myservo.write(80);
    else
      myservo.write(180);
  }

  // Log Servo (Feeder) events
  // 80 is open, 180 is closed
  bool currentServoState = (myservo.read() < 100);
  if (currentServoState && !lastServoState) {
    logEvent("feed_open");
  } else if (!currentServoState && lastServoState) {
    logEvent("feed_close");
  }
  lastServoState = currentServoState;
}

// Helper func: Read HC-SR04. Timeout limits freezing the main loop.
int getDistance() {
  digitalWrite(TRIGPIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIGPIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIGPIN, LOW);

  // 30ms timeout (~5m) to limit loop slowdown if unresponsive
  long duration = pulseIn(ECHOPIN, HIGH, 30000);
  if (duration == 0)
    return 999;

  return duration / 58;
}
