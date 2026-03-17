const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, Timestamp } = require('firebase/firestore');
const { getAuth, signInAnonymously } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyD1LTlZXjINs58NoHKhr67kgsxeHJmkkSc",
  databaseURL: "https://iot-final-12af4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "iot-final-12af4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function generateData() {
  console.log("Attempting to sign in anonymously...");
  try {
    await signInAnonymously(auth);
    console.log("Signed in anonymously!");
  } catch (authErr) {
    console.warn("Anonymous sign-in failed (it might be disabled in Firebase Console):", authErr.message);
    console.log("Proceeding anyway, but writes might fail if rules require auth.");
  }

  console.log("Starting data generation for the last 7 days...");

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. Generate Hourly Sensor Snapshots (168 entries)
  const snapshotsCol = collection(db, 'sensorSnapshots');
  const snapshots = [];

  for (let i = 0; i < 168; i++) {
    const timestamp = new Date(sevenDaysAgo.getTime() + i * 60 * 60 * 1000);
    const hour = timestamp.getHours();

    // Realistic sine waves for temp and humidity
    const tempBase = 25 + 5 * Math.sin((hour - 8) * Math.PI / 12); // Peaks at 2 PM
    const humBase = 60 - 15 * Math.sin((hour - 8) * Math.PI / 12); // Lowest at 2 PM

    const snapshot = {
      temperature: Math.round((tempBase + Math.random() * 2) * 10) / 10,
      humidity: Math.round((humBase + Math.random() * 5) * 10) / 10,
      soilMoisture: Math.round(30 + Math.random() * 40),
      light: Math.round(hour > 6 && hour < 18 ? 50 + Math.random() * 40 : Math.random() * 10),
      waterLevel: Math.round(20 + Math.random() * 60),
      steam: Math.round(Math.random() * 20),
      distance: Math.round(5 + Math.random() * 50),
      motion: Math.random() > 0.9,
      timestamp: Timestamp.fromDate(timestamp)
    };
    snapshots.push(snapshot);
  }

  // Write snapshots in batches of 10 to avoid too many parallel writes in Node
  for (let i = 0; i < snapshots.length; i++) {
    await addDoc(snapshotsCol, snapshots[i]);
    if ((i + 1) % 24 === 0) console.log(`Generated snapshots for day ${(i + 1) / 24}`);
  }

  // 2. Generate Random Event Logs (75 entries)
  const logsCol = collection(db, 'logs');
  const eventTypes = ['water_on', 'water_off', 'alarm_on', 'alarm_off', 'feed_open', 'feed_close'];
  
  for (let i = 0; i < 75; i++) {
    const randomTime = new Date(sevenDaysAgo.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
    const log = {
      type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      createdAt: Timestamp.fromDate(randomTime),
      timestamp: randomTime.getTime()
    };
    await addDoc(logsCol, log);
  }

  console.log("Data generation complete! 168 snapshots and 75 logs added.");
  process.exit(0);
}

generateData().catch(err => {
  console.error("Error generating data:", err);
  process.exit(1);
});
