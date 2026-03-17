import { Component, OnInit } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage implements OnInit {
  firebaseConfig = {
    apiKey: "AIzaSyD1LTlZXjINs58NoHKhr67kgsxeHJmkkSc",
    databaseURL: "https://iot-final-12af4-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "iot-final-12af4"
  };

  firestore: any;
  logs: any[] = [];
  stats = {
    pumpCount: 0,
    alarmCount: 0,
    feedCount: 0
  };

  // Chart configuration
  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    scales: {
      x: {},
      y: { min: 0 }
    },
    plugins: {
      legend: { display: true },
    }
  };
  public barChartType: ChartType = 'bar';
  public barChartData: ChartData<'bar'> = {
    labels: ['Water Pump', 'Alarm', 'Feed Door'],
    datasets: [
      { data: [0, 0, 0], label: 'Triggers Count', backgroundColor: ['#3880ff', '#eb445a', '#2dd36f'] }
    ]
  };

  constructor() { }

  ngOnInit() {
    const app = initializeApp(this.firebaseConfig);
    this.firestore = getFirestore(app);
    this.fetchLogs();
  }

  async fetchLogs() {
    const logsRef = collection(this.firestore, 'logs');
    const q = query(logsRef, orderBy('createdAt', 'desc'), limit(100));
    
    try {
      const querySnapshot = await getDocs(q);
      this.logs = [];
      this.stats = { pumpCount: 0, alarmCount: 0, feedCount: 0 };
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        this.logs.push(data);
        
        // Count frequencies of "ON" or "OPEN" events
        if (data['type'] === 'water_on') this.stats.pumpCount++;
        if (data['type'] === 'alarm_on') this.stats.alarmCount++;
        if (data['type'] === 'feed_open') this.stats.feedCount++;
      });

      // Update Chart
      this.barChartData.datasets[0].data = [
        this.stats.pumpCount,
        this.stats.alarmCount,
        this.stats.feedCount
      ];
      
      this.barChartData = { ...this.barChartData };

    } catch (e) {
      console.error("Error fetching logs:", e);
    }
  }

  ionViewWillEnter() {
    this.fetchLogs();
  }
}
