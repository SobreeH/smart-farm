import { Component, OnInit } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';

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
    pir: false
  };

  // Variables to hold actuator control states
  controls: any = {
    waterPump: 'OFF',
    fan: 'OFF',
    led: 'OFF',
    servo: 'OFF'
  };

  // We will store our database reference here
  db: any;

  constructor() { }

  ngOnInit() {
    // 1. Initialize Firebase with your exact credentials
    const firebaseConfig = {
      apiKey: "AIzaSyD1LTlZXjINs58NoHKhr67kgsxeHJmkkSc",
      databaseURL: "https://iot-final-12af4-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "iot-final-12af4"
    };

    const app = initializeApp(firebaseConfig);
    this.db = getDatabase(app);

    // 2. Listen for sensor updates
    this.listenToSensors();

    // 3. Listen for control states
    this.listenToControls();
  }

  listenToSensors() {
    const sensorsRef = ref(this.db, 'sensors');
    onValue(sensorsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Update our local variables with the database data
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
      }
    });
  }

  // 4. Function to trigger when a dropdown is changed
  updateControl(device: string, event: any) {
    const mode = event.detail.value; // Ionic passes the value here
    const controlRef = ref(this.db, `controls/${device}/mode`);

    set(controlRef, mode)
      .then(() => console.log(`${device} updated to ${mode}`))
      .catch((error) => console.error("Error updating database: ", error));
  }
}