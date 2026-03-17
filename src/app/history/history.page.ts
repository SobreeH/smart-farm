import { Component, OnInit } from '@angular/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore, collection, query, orderBy, getDocs, limit, where, Timestamp, addDoc
} from 'firebase/firestore';
import {
  Chart, LineController, CategoryScale, LinearScale, PointElement,
  LineElement, Legend, Tooltip, Filler
} from 'chart.js';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { ToastController } from '@ionic/angular';

// Register Chart.js components for line charts
Chart.register(LineController, CategoryScale, LinearScale, PointElement, LineElement, Legend, Tooltip, Filler);

interface SensorSnapshot {
  temperature: number;
  humidity: number;
  soilMoisture: number;
  light: number;
  waterLevel: number;
  steam: number;
  distance: number;
  motion: boolean;
  timestamp: any;
  dateLabel?: string;
}

@Component({
  selector: 'app-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
  standalone: false,
})
export class HistoryPage implements OnInit {
  firebaseConfig = {
    apiKey: "AIzaSyD1LTlZXjINs58NoHKhr67kgsxeHJmkkSc",
    databaseURL: "https://iot-final-12af4-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "iot-final-12af4"
  };

  firestore: any;
  snapshots: SensorSnapshot[] = [];
  selectedRange: string = '24h';
  loading = true;
  generating = false;

  // Summary stats
  stats = {
    tempMin: 0, tempMax: 0, tempAvg: 0,
    humMin: 0, humMax: 0, humAvg: 0,
    soilMin: 0, soilMax: 0, soilAvg: 0,
    motionCount: 0,
    avgDistance: 0
  };

  // Climate chart (Temperature & Humidity)
  public climateChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        ticks: { maxRotation: 45, font: { size: 10 } },
        grid: { display: false }
      },
      yTemp: {
        type: 'linear',
        position: 'left',
        title: { display: true, text: '°C', font: { size: 12 } },
        grid: { color: 'rgba(255,99,132,0.08)' }
      },
      yHum: {
        type: 'linear',
        position: 'right',
        title: { display: true, text: '%', font: { size: 12 } },
        grid: { drawOnChartArea: false }
      }
    },
    plugins: {
      legend: { display: true, position: 'top' },
      tooltip: {
        backgroundColor: 'rgba(30,30,40,0.9)',
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
      }
    }
  };
  public climateChartType: ChartType = 'line';
  public climateChartData: ChartData<'line'> = { labels: [], datasets: [] };

  // Levels chart (Soil, Water, Steam, Light)
  public levelsChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        ticks: { maxRotation: 45, font: { size: 10 } },
        grid: { display: false }
      },
      y: {
        title: { display: true, text: 'Level (%)', font: { size: 12 } },
        grid: { color: 'rgba(100,100,100,0.08)' }
      }
    },
    plugins: {
      legend: { display: true, position: 'top' },
      tooltip: {
        backgroundColor: 'rgba(30,30,40,0.9)',
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
      }
    }
  };
  public levelsChartType: ChartType = 'line';
  public levelsChartData: ChartData<'line'> = { labels: [], datasets: [] };

  constructor(private toastCtrl: ToastController) { }

  ngOnInit() {
    const app = getApps().length ? getApp() : initializeApp(this.firebaseConfig);
    this.firestore = getFirestore(app);
    this.fetchSnapshots();
  }

  ionViewWillEnter() {
    this.fetchSnapshots();
  }

  onRangeChange(event: any) {
    this.selectedRange = event.detail.value;
    this.fetchSnapshots();
  }

  async fetchSnapshots() {
    this.loading = true;

    // Calculate the "since" timestamp based on selected range
    const now = new Date();
    let sinceDate: Date;
    let maxDocs: number;

    switch (this.selectedRange) {
      case '7d':
        sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        maxDocs = 168; // 7 * 24
        break;
      case '30d':
        sinceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        maxDocs = 720; // 30 * 24
        break;
      default: // '24h'
        sinceDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        maxDocs = 24;
        break;
    }

    const sinceTimestamp = Timestamp.fromDate(sinceDate);

    try {
      const snapshotsRef = collection(this.firestore, 'sensorSnapshots');
      const q = query(
        snapshotsRef,
        where('timestamp', '>=', sinceTimestamp),
        orderBy('timestamp', 'asc'),
        limit(maxDocs)
      );

      const querySnapshot = await getDocs(q);
      this.snapshots = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const ts = data['timestamp']?.toDate ? data['timestamp'].toDate() : new Date();
        this.snapshots.push({
          temperature: data['temperature'] ?? 0,
          humidity: data['humidity'] ?? 0,
          soilMoisture: data['soilMoisture'] ?? 0,
          light: data['light'] ?? 0,
          waterLevel: data['waterLevel'] ?? 0,
          steam: data['steam'] ?? 0,
          distance: data['distance'] ?? 0,
          motion: data['motion'] ?? false,
          timestamp: ts,
          dateLabel: this.formatDate(ts)
        });
      });

      this.computeStats();
      this.buildCharts();
    } catch (e) {
      console.error('Error fetching sensor snapshots:', e);
    } finally {
      this.loading = false;
    }
  }

  private formatDate(date: Date): string {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    if (this.selectedRange === '24h') {
      return `${hours}:${mins}`;
    }
    return `${month}/${day} ${hours}:${mins}`;
  }

  private computeStats() {
    if (this.snapshots.length === 0) {
      this.stats = {
        tempMin: 0, tempMax: 0, tempAvg: 0,
        humMin: 0, humMax: 0, humAvg: 0,
        soilMin: 0, soilMax: 0, soilAvg: 0,
        motionCount: 0, avgDistance: 0
      };
      return;
    }

    const temps = this.snapshots.map(s => s.temperature);
    const hums = this.snapshots.map(s => s.humidity);
    const soils = this.snapshots.map(s => s.soilMoisture);
    const dists = this.snapshots.map(s => s.distance);

    this.stats = {
      tempMin: Math.min(...temps),
      tempMax: Math.max(...temps),
      tempAvg: +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
      humMin: Math.min(...hums),
      humMax: Math.max(...hums),
      humAvg: +(hums.reduce((a, b) => a + b, 0) / hums.length).toFixed(1),
      soilMin: Math.min(...soils),
      soilMax: Math.max(...soils),
      soilAvg: +(soils.reduce((a, b) => a + b, 0) / soils.length).toFixed(1),
      motionCount: this.snapshots.filter(s => s.motion).length,
      avgDistance: +(dists.reduce((a, b) => a + b, 0) / dists.length).toFixed(1)
    };
  }

  private buildCharts() {
    const labels = this.snapshots.map(s => s.dateLabel!);

    // Climate Chart
    this.climateChartData = {
      labels,
      datasets: [
        {
          data: this.snapshots.map(s => s.temperature),
          label: 'Temperature (°C)',
          borderColor: '#ff6384',
          backgroundColor: 'rgba(255,99,132,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#ff6384',
          yAxisID: 'yTemp'
        },
        {
          data: this.snapshots.map(s => s.humidity),
          label: 'Humidity (%)',
          borderColor: '#36a2eb',
          backgroundColor: 'rgba(54,162,235,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#36a2eb',
          yAxisID: 'yHum'
        }
      ]
    };

    // Levels Chart
    this.levelsChartData = {
      labels,
      datasets: [
        {
          data: this.snapshots.map(s => s.soilMoisture),
          label: 'Soil Moisture',
          borderColor: '#9966ff',
          backgroundColor: 'rgba(153,102,255,0.08)',
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#9966ff'
        },
        {
          data: this.snapshots.map(s => s.waterLevel),
          label: 'Water Level',
          borderColor: '#3dc2ff',
          backgroundColor: 'rgba(61,194,255,0.08)',
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#3dc2ff'
        },
        {
          data: this.snapshots.map(s => s.steam),
          label: 'Steam',
          borderColor: '#eb445a',
          backgroundColor: 'rgba(235,68,90,0.08)',
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#eb445a'
        },
        {
          data: this.snapshots.map(s => s.light),
          label: 'Light',
          borderColor: '#ffc409',
          backgroundColor: 'rgba(255,196,9,0.08)',
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#ffc409'
        }
      ]
    };
  }

  async generateDemoData() {
    this.generating = true;
    const toast = await this.toastCtrl.create({
      message: 'Generating 7 days of demo data...',
      duration: 5000,
      position: 'bottom'
    });
    await toast.present();

    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const snapshotsCol = collection(this.firestore, 'sensorSnapshots');
      const logsCol = collection(this.firestore, 'logs');
      const eventTypes = ['water_on', 'water_off', 'alarm_on', 'alarm_off', 'feed_open', 'feed_close'];

      // 1. Generate 168 Snapshots
      for (let i = 0; i < 168; i++) {
        const timestamp = new Date(sevenDaysAgo.getTime() + i * 60 * 60 * 1000);
        const hour = timestamp.getHours();
        const tempBase = 25 + 5 * Math.sin((hour - 8) * Math.PI / 12);
        const humBase = 60 - 15 * Math.sin((hour - 8) * Math.PI / 12);

        await addDoc(snapshotsCol, {
          temperature: Math.round((tempBase + Math.random() * 2) * 10) / 10,
          humidity: Math.round((humBase + Math.random() * 5) * 10) / 10,
          soilMoisture: Math.round(30 + Math.random() * 40),
          light: Math.round(hour > 6 && hour < 18 ? 50 + Math.random() * 40 : Math.random() * 10),
          waterLevel: Math.round(20 + Math.random() * 60),
          steam: Math.round(Math.random() * 20),
          distance: Math.round(5 + Math.random() * 50),
          motion: Math.random() > 0.9,
          timestamp: Timestamp.fromDate(timestamp)
        });
      }

      // 2. Generate 75 Logs
      for (let i = 0; i < 75; i++) {
        const randomTime = new Date(sevenDaysAgo.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
        await addDoc(logsCol, {
          type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
          createdAt: Timestamp.fromDate(randomTime),
          timestamp: randomTime.getTime()
        });
      }

      const successToast = await this.toastCtrl.create({
        message: 'Demo data generated successfully!',
        duration: 3000,
        color: 'success',
        position: 'bottom'
      });
      await successToast.present();
      this.fetchSnapshots();
    } catch (e: any) {
      console.error('Error generating demo data:', e);
      const errorToast = await this.toastCtrl.create({
        message: 'Failed to generate data: ' + e.message,
        duration: 5000,
        color: 'danger',
        position: 'bottom'
      });
      await errorToast.present();
    } finally {
      this.generating = false;
    }
  }
}

