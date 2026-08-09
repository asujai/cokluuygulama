export type TestStatus = 'untested' | 'passed' | 'failed' | 'unsupported';

export interface SensorInfo {
  id: string;
  name: string;
  description: string;
  available: boolean;
  value?: string;
}

export interface DiagnosticTestItem {
  id: 'colors' | 'touch' | 'vibration' | 'torch' | 'accelerometer' | 'sensors';
  title: string;
  description: string;
  icon: string;
  status: TestStatus;
}
