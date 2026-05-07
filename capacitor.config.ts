import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eyecare.guardian',
  appName: '护眼小卫士',
  webDir: 'www',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  },
  plugins: {
    LocalNotifications: {
    },
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
