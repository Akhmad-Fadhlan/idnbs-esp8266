/***************************************************
 * ESP8266 MakeCode Library - HTTP FUNCTIONS
 ***************************************************/

namespace esp8266 {
    // ==================== HTTP CLIENT FUNCTIONS ====================
    
    /**
     * Get raw data from HTTP server
     */
    //% weight=80
    //% subcategory="HTTP"
    //% block="HTTP GET raw data|Server IP %serverIp|WiFi %ssid|Pass %password|Path %path"
    //% serverIp.defl="192.168.1.100"
    //% ssid.defl="YourWiFi"
    //% password.defl="YourPassword"
    //% path.defl="/api/data"
    export function getRawFromServer(
        serverIp: string,
        ssid: string,
        password: string,
        path: string
    ): string {
        if (!esp8266Initialized) return ""

        // Connect to WiFi if not connected
        if (!isWifiConnected()) {
            if (!connectWiFi(ssid, password)) return ""
        }

        rxData = ""
        serial.readString()

        // TCP Connection
        if (!sendCommand(
            "AT+CIPSTART=\"TCP\",\"" + serverIp + "\",80",
            "CONNECT",
            8000
        )) return ""

        let httpRequest =
            "GET " + path + " HTTP/1.1\r\n" +
            "Host: " + serverIp + "\r\n" +
            "Connection: close\r\n\r\n"

        if (!sendCommand("AT+CIPSEND=" + (httpRequest.length + 2), ">", 5000)) {
            sendCommand("AT+CIPCLOSE")
            return ""
        }

        serial.writeString(httpRequest)

        let start = input.runningTime()
        while (input.runningTime() - start < 8000) {
            rxData += serial.readString()
            basic.pause(200)
        }

        sendCommand("AT+CIPCLOSE")
        return rxData
    }

    /**
     * Send data to HTTP server
     */
    //% weight=75
    //% subcategory="HTTP"
    //% block="HTTP send data|Server IP %serverIp|WiFi %ssid|Pass %password|Data %data"
    //% serverIp.defl="192.168.1.100"
    //% ssid.defl="YourWiFi"
    //% password.defl="YourPassword"
    //% data.defl="sensor=123"
    export function sendToServer(
        serverIp: string,
        ssid: string,
        password: string,
        data: string
    ): boolean {
        if (!esp8266Initialized) return false

        // Connect to WiFi if not connected
        if (!isWifiConnected()) {
            if (!connectWiFi(ssid, password)) return false
        }

        // TCP Connection
        if (!sendCommand(
            "AT+CIPSTART=\"TCP\",\"" + serverIp + "\",80",
            "CONNECT",
            8000
        )) return false

        let httpRequest =
            "GET /tes.php?" + data + " HTTP/1.1\r\n" +
            "Host: " + serverIp + "\r\n" +
            "Connection: close\r\n\r\n"

        let len = httpRequest.length + 2
        if (!sendCommand("AT+CIPSEND=" + len, ">", 5000)) {
            sendCommand("AT+CIPCLOSE")
            return false
        }

        serial.writeString(httpRequest)
        basic.pause(4000)
        sendCommand("AT+CIPCLOSE")
        return true
    }

    /**
     * Simple HTTP GET (WiFi must be connected first)
     */
    //% weight=70
    //% subcategory="HTTP"
    //% block="simple HTTP GET|Server %serverIp|Path %path"
    //% serverIp.defl="192.168.1.100"
    //% path.defl="/"
    export function httpGet(serverIp: string, path: string): string {
        if (!esp8266Initialized) return ""
        if (!isWifiConnected()) return ""
        
        rxData = ""
        serial.readString()

        // TCP Connection
        if (!sendCommand("AT+CIPSTART=\"TCP\",\"" + serverIp + "\",80", "CONNECT", 5000)) {
            return ""
        }

        let httpRequest = 
            "GET " + path + " HTTP/1.1\r\n" +
            "Host: " + serverIp + "\r\n" +
            "Connection: close\r\n\r\n"
        
        if (!sendCommand("AT+CIPSEND=" + httpRequest.length, ">", 3000)) {
            sendCommand("AT+CIPCLOSE")
            return ""
        }

        serial.writeString(httpRequest)
        
        let start = input.runningTime()
        while (input.runningTime() - start < 5000) {
            rxData += serial.readString()
            basic.pause(200)
        }

        sendCommand("AT+CIPCLOSE")
        return rxData
    }

    /**
     * HTTP POST request
     */
    //% weight=65
    //% subcategory="HTTP"
    //% block="HTTP POST|Server %serverIp|Path %path|Data %data"
    //% serverIp.defl="192.168.1.100"
    //% path.defl="/api/data"
    //% data.defl='{"temp":25}'
    export function httpPost(serverIp: string, path: string, data: string): string {
        if (!esp8266Initialized) return ""
        if (!isWifiConnected()) return ""
        
        rxData = ""
        serial.readString()

        // TCP Connection
        if (!sendCommand("AT+CIPSTART=\"TCP\",\"" + serverIp + "\",80", "CONNECT", 5000)) {
            return ""
        }

        let httpRequest = 
            "POST " + path + " HTTP/1.1\r\n" +
            "Host: " + serverIp + "\r\n" +
            "Content-Type: application/json\r\n" +
            "Content-Length: " + data.length + "\r\n" +
            "Connection: close\r\n\r\n" +
            data
        
        if (!sendCommand("AT+CIPSEND=" + httpRequest.length, ">", 3000)) {
            sendCommand("AT+CIPCLOSE")
            return ""
        }

        serial.writeString(httpRequest)
        
        let start = input.runningTime()
        while (input.runningTime() - start < 5000) {
            rxData += serial.readString()
            basic.pause(200)
        }

        sendCommand("AT+CIPCLOSE")
        return rxData
    }
}
