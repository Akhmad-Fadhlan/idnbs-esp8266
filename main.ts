/***************************************************
 * ESP8266 MakeCode Library - CORE FUNCTIONS ONLY
 ***************************************************/
namespace esp8266 {
    // ==================== CORE VARIABLES ====================
    export let esp8266Initialized = false
    export let rxData = ""
    let wifiConnected = false

    // ==================== ERROR HANDLER ====================
    function error(code: number) {
        // debugging & LED dihilangkan
    }

    // ==================== CORE HELPER FUNCTIONS ====================
    /**
     * Send AT command to ESP8266
     */
    //% blockHidden=true
    export function sendCommand(
        command: string,
        expected: string = null,
        timeout: number = 1000
    ): boolean {
        rxData = ""
        serial.readString()
        serial.writeString(command + "\r\n")

        if (expected == null) return true

        let start = input.runningTime()
        while (input.runningTime() - start < timeout) {
            rxData += serial.readString()
            if (rxData.indexOf(expected) >= 0) return true
            if (rxData.indexOf("ERROR") >= 0) return false
        }
        return false
    }

    /**
     * Get response from ESP8266 within timeout
     */
    //% blockHidden=true
    export function getResponse(expected: string = "", timeout: number = 1000): string {
        rxData = ""
        let start = input.runningTime()
        
        while (input.runningTime() - start < timeout) {
            rxData += serial.readString()
            if (expected != "" && rxData.indexOf(expected) >= 0) {
                return rxData
            }
            basic.pause(50)
        }
        return rxData
    }

    /**
     * Check if WiFi is connected
     */
    //% blockHidden=true
    export function isWifiConnected(): boolean {
        return wifiConnected
    }

    /**
     * Set WiFi connection status
     */
    //% blockHidden=true
    export function setWifiConnected(status: boolean) {
        wifiConnected = status
    }

    // ==================== CORE PUBLIC API ====================
    /**
     * Initialize ESP8266 module
     */
    //% weight=100
    //% block="initialize ESP8266|Tx %tx|Rx %rx|Baud %baudrate"
    //% tx.defl=SerialPin.P8
    //% rx.defl=SerialPin.P12
    //% baudrate.defl=BaudRate.BaudRate115200
    export function init(tx: SerialPin, rx: SerialPin, baudrate: BaudRate) {
        serial.redirect(tx, rx, baudrate)
        basic.pause(100)

        // Reset ESP8266
        if (!sendCommand("AT+RST", "ready", 5000)) {
            error(1)
            return
        }

        // Disable echo
        if (!sendCommand("ATE0", "OK")) {
            error(2)
            return
        }

        // Set to station mode
        if (!sendCommand("AT+CWMODE=1", "OK")) {
            error(3)
            return
        }

        esp8266Initialized = true
    }

    /**
     * Connect to WiFi network
     */
    //% weight=95
    //% block="connect to WiFi|SSID %ssid|Password %password"
    //% ssid.defl="YourWiFi"
    //% password.defl="YourPassword"
    export function connectWiFi(ssid: string, password: string): boolean {
        if (!esp8266Initialized) return false

        wifiConnected = false
        
        if (sendCommand(
            "AT+CWJAP=\"" + ssid + "\",\"" + password + "\"",
            "WIFI GOT IP",
            20000
        )) {
            wifiConnected = true
            return true
        }
        
        return false
    }

    /**
     * Check WiFi connection status
     */
    //% weight=90
    //% block="WiFi connected"
    export function isConnected(): boolean {
        return wifiConnected
    }

    /**
     * Disconnect from WiFi
     */
    //% weight=85
    //% block="disconnect WiFi"
    export function disconnectWiFi() {
        sendCommand("AT+CWQAP", "OK")
        wifiConnected = false
    }
}
