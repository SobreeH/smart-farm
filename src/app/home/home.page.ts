import { Component, OnInit } from '@angular/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, remove } from 'firebase/database';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  // Variables to hold our sensor data
  sensors = {
    temperature: 0,
    humidity: 0,
    soilHumidity: 0,
    light: 0,
    waterLevel: 0,
    steam: 0,
    pir: false,
    distance: 0
  };

  // Variables to hold actuator control states
  controls: any = {
    waterPump: 'OFF',
    fan: 'OFF',
    led: 'OFF',
    servo: 'OFF',
    alarm: 'OFF'
  };

  // We will store our database references here
  db: any;
  firestore: any;

  // Guard against duplicate Firestore writes when RTDB fires multiple times
  private processingKeys = new Set<string>();

  constructor() { }

  ngOnInit() {
    const firebaseConfig = {
      apiKey: "AIzaSyD1LTlZXjINs58NoHKhr67kgsxeHJmkkSc",
      databaseURL: "https://iot-final-12af4-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "iot-final-12af4"
    };

    // Reuse existing Firebase app if already initialized (avoids "app already exists" error)
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    this.db = getDatabase(app);
    this.firestore = getFirestore(app);

    this.listenToSensors();
    this.listenToControls();
    this.bridgeLogsToFirestore();
  }

  bridgeLogsToFirestore() {
    const logsRef = ref(this.db, 'logs');
    onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        Object.keys(data).forEach(async (key) => {
          // Skip if this key is already being processed (prevents duplicates)
          if (this.processingKeys.has(key)) return;
          this.processingKeys.add(key);

          const logEntry = data[key];
          try {
            // Move to Firestore — store createdAt as server timestamp for reliable ordering
            await addDoc(collection(this.firestore, 'logs'), {
              type: logEntry.type,
              // Store the raw RTDB timestamp value (epoch ms from Arduino), not the literal string
              timestamp: (typeof logEntry.timestamp === 'number') ? logEntry.timestamp : null,
              createdAt: serverTimestamp()
            });
            // Remove from RTDB once safely written to Firestore
            await remove(ref(this.db, `logs/${key}`));
            console.log(`Moved log "${logEntry.type}" to Firestore`);
          } catch (e) {
            console.error("Error bridging log:", e);
          } finally {
            this.processingKeys.delete(key);
          }
        });
      }
    });
  }

  listenToSensors() {
    const sensorsRef = ref(this.db, 'sensors');
    onValue(sensorsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        this.sensors = data;
      }
    });
  }

  listenToControls() {
    const controlsRef = ref(this.db, 'controls');
    onValue(controlsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        this.controls.waterPump = data.waterPump?.mode || 'OFF';
        this.controls.fan = data.fan?.mode || 'OFF';
        this.controls.led = data.led?.mode || 'OFF';
        this.controls.servo = data.servo?.mode || 'OFF';
        this.controls.alarm = data.alarm?.mode || 'OFF';
      }
    });
  }

  updateControl(device: string, event: any) {
    const mode = event.detail.value;
    const controlRef = ref(this.db, `controls/${device}/mode`);
    set(controlRef, mode)
      .then(() => console.log(`${device} updated to ${mode}`))
      .catch((error) => console.error("Error updating database: ", error));
  }
}