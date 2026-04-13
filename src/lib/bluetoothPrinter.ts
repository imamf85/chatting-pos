/**
 * Bluetooth Printer Service for Thermal Printers
 * Menggunakan Web Bluetooth API untuk koneksi ke printer thermal via BLE
 */

interface DeviceInfo {
  id: string;
  name: string;
  timestamp: number;
}

interface ConnectionInfo {
  isConnected: boolean;
  deviceName: string;
  hasSavedDevice: boolean;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

class BluetoothPrinterService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  // Common UUIDs for thermal printers
  private readonly SERVICE_UUID = '49535343-fe7d-4ae5-8fa9-9fafd205e455';
  private readonly CHARACTERISTIC_UUID = '49535343-8841-43f4-a8d4-ecbe34729bb3';

  // Storage keys for persistent connection
  private readonly STORAGE_KEY = 'bluetooth_printer_device';
  private readonly CONNECTION_STATUS_KEY = 'bluetooth_printer_connected';

  // Auto-reconnect settings
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;

  constructor() {
    this.initializeAutoReconnect();
  }

  /** Check if Web Bluetooth is supported */
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && navigator.bluetooth !== undefined;
  }

  /** Save device info to localStorage */
  private saveDeviceInfo(device: BluetoothDevice): void {
    try {
      const deviceInfo: DeviceInfo = {
        id: device.id,
        name: device.name || 'Unknown Printer',
        timestamp: Date.now(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(deviceInfo));
      localStorage.setItem(this.CONNECTION_STATUS_KEY, 'true');
    } catch (error) {
      console.warn('Failed to save device info:', error);
    }
  }

  /** Get saved device info from localStorage */
  getSavedDeviceInfo(): DeviceInfo | null {
    try {
      const deviceInfo = localStorage.getItem(this.STORAGE_KEY);
      return deviceInfo ? JSON.parse(deviceInfo) : null;
    } catch (error) {
      console.warn('Failed to get saved device info:', error);
      return null;
    }
  }

  /** Check if should auto-reconnect */
  private shouldAutoReconnect(): boolean {
    try {
      const connected = localStorage.getItem(this.CONNECTION_STATUS_KEY);
      const deviceInfo = this.getSavedDeviceInfo();
      return connected === 'true' && deviceInfo !== null && !!deviceInfo.id;
    } catch (error) {
      return false;
    }
  }

  /** Clear saved device info */
  clearSavedDeviceInfo(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.CONNECTION_STATUS_KEY);
    } catch (error) {
      console.warn('Failed to clear device info:', error);
    }
  }

  /** Initialize auto-reconnect functionality */
  private async initializeAutoReconnect(): Promise<void> {
    if (!this.isSupported()) {
      return;
    }

    // Wait a bit for the page to fully load
    setTimeout(async () => {
      if (this.shouldAutoReconnect()) {
        console.log('Attempting to auto-reconnect to saved printer...');
        await this.attemptReconnect();
      }
    }, 1000);
  }

  /** Attempt to reconnect to saved device */
  async attemptReconnect(): Promise<boolean> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return false;
    }

    try {
      const savedDevice = this.getSavedDeviceInfo();
      if (!savedDevice || !savedDevice.id) {
        return false;
      }

      // Try to get the device by ID
      const devices = await navigator.bluetooth.getDevices();
      const device = devices.find((d) => d.id === savedDevice.id);

      if (device && device.gatt) {
        console.log('Found saved device, attempting to reconnect:', device.name);
        this.device = device;
        await this.connectToExistingDevice();
        this.reconnectAttempts = 0;
        return true;
      } else {
        console.log('Saved device not found or not available');
        this.reconnectAttempts++;
        return false;
      }
    } catch (error) {
      console.warn('Auto-reconnect failed:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => this.attemptReconnect(), 2000);
      } else {
        this.clearSavedDeviceInfo();
      }
      return false;
    }
  }

  /** Connect to an existing paired device */
  private async connectToExistingDevice(): Promise<boolean> {
    if (!this.device) {
      throw new Error('No device available');
    }

    try {
      this.server = await this.device.gatt!.connect();
      this.service = await this.server.getPrimaryService(this.SERVICE_UUID);
      this.characteristic = await this.service.getCharacteristic(this.CHARACTERISTIC_UUID);

      this.device.addEventListener('gattserverdisconnected', this.onDeviceDisconnected.bind(this));

      console.log('Reconnected to printer:', this.device.name);
      return true;
    } catch (error) {
      console.error('Error reconnecting to existing device:', error);
      throw error;
    }
  }

  /** Handle device disconnection */
  private onDeviceDisconnected(): void {
    console.log('Device disconnected');
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;

    if (this.shouldAutoReconnect()) {
      console.log('Scheduling reconnect attempt...');
      setTimeout(() => this.attemptReconnect(), 3000);
    }
  }

  /** Connect to Bluetooth printer */
  async connect(): Promise<boolean> {
    try {
      if (!this.isSupported()) {
        throw new Error('Web Bluetooth API tidak didukung di browser ini');
      }

      if (this.isConnected()) {
        console.log('Printer already connected');
        return true;
      }

      // First try to reconnect to saved device
      if (this.shouldAutoReconnect()) {
        const reconnected = await this.attemptReconnect();
        if (reconnected) {
          return true;
        }
      }

      // Request new Bluetooth device
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [this.SERVICE_UUID],
      });

      this.server = await this.device.gatt!.connect();
      this.service = await this.server.getPrimaryService(this.SERVICE_UUID);
      this.characteristic = await this.service.getCharacteristic(this.CHARACTERISTIC_UUID);

      this.device.addEventListener('gattserverdisconnected', this.onDeviceDisconnected.bind(this));
      this.saveDeviceInfo(this.device);

      console.log('Printer connected:', this.device.name);
      return true;
    } catch (error) {
      console.error('Error connecting to printer:', error);
      throw error;
    }
  }

  /** Disconnect from printer (clears memory) */
  async disconnect(): Promise<void> {
    try {
      this.clearSavedDeviceInfo();

      if (this.device && this.device.gatt && this.device.gatt.connected) {
        this.device.gatt.disconnect();
      }

      this.device = null;
      this.server = null;
      this.service = null;
      this.characteristic = null;
      this.reconnectAttempts = 0;

      console.log('Printer disconnected and memory cleared');
    } catch (error) {
      console.error('Error during disconnect:', error);
    }
  }

  /** Soft disconnect (keeps memory for auto-reconnect) */
  async softDisconnect(): Promise<void> {
    try {
      if (this.device && this.device.gatt && this.device.gatt.connected) {
        this.device.gatt.disconnect();
      }

      this.server = null;
      this.service = null;
      this.characteristic = null;

      console.log('Printer soft disconnected (memory preserved)');
    } catch (error) {
      console.error('Error during soft disconnect:', error);
    }
  }

  /** Check if printer is connected */
  isConnected(): boolean {
    return !!(this.device && this.device.gatt && this.device.gatt.connected);
  }

  /** Get current device name */
  getDeviceName(): string {
    if (this.device && this.device.name) {
      return this.device.name;
    }

    const savedDevice = this.getSavedDeviceInfo();
    return savedDevice ? savedDevice.name : 'Unknown Printer';
  }

  /** Get connection status info */
  getConnectionInfo(): ConnectionInfo {
    return {
      isConnected: this.isConnected(),
      deviceName: this.getDeviceName(),
      hasSavedDevice: this.shouldAutoReconnect(),
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
    };
  }

  /** Send string data to printer */
  async print(data: string): Promise<boolean> {
    if (!this.isConnected() || !this.characteristic) {
      throw new Error('Printer tidak terhubung');
    }

    try {
      const encoder = new TextEncoder();
      const text = encoder.encode(data);

      // Send data in chunks (max 20 bytes for BLE)
      const chunkSize = 20;
      for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize);
        await this.characteristic.writeValue(chunk);
        // Small delay between chunks
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      return true;
    } catch (error) {
      console.error('Error printing:', error);
      throw error;
    }
  }

  /** Print raw bytes */
  async printBytes(bytes: Uint8Array): Promise<boolean> {
    if (!this.isConnected() || !this.characteristic) {
      throw new Error('Printer tidak terhubung');
    }

    try {
      const chunkSize = 20;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        await this.characteristic.writeValue(chunk);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      return true;
    } catch (error) {
      console.error('Error printing bytes:', error);
      throw error;
    }
  }
}

// Create singleton instance
const bluetoothPrinter = new BluetoothPrinterService();

export default bluetoothPrinter;
