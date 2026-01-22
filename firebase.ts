/**
 * Support for Firebase Realtime Database.
 * UPDATED: Better read functions, more block options
 */
namespace esp8266 {
    // ==================== FIREBASE VARIABLES ====================
    //% blockHidden=true
    export let firebaseApiKey = ""
    //% blockHidden=true
    export let firebaseDatabaseURL = ""
    //% blockHidden=true
    export let firebaseProjectId = ""
    //% blockHidden=true
    export let firebasePath = "iot" // Default path
    //% blockHidden=true
    export let firebaseDataSent = false

    // ==================== FIREBASE HELPER FUNCTIONS ====================
    // Helper: Extract host from Firebase URL
    function extractHost(url: string): string {
        let host = url
        if (host.indexOf("https://") >= 0) {
            host = host.substr(8)
        }
        if (host.indexOf("http://") >= 0) {
            host = host.substr(7)
        }
        if (host.charAt(host.length - 1) == "/") {
            host = host.substr(0, host.length - 1)
        }
        return host
    }

    // Helper: Clean path (remove leading slash)
    function cleanPath(path: string): string {
        if (path.charAt(0) == "/") {
            return path.substr(1)
        }
        return path
    }

    // Helper: Extract JSON body from HTTP response
    function extractJsonFromResponse(response: string): string {
        // Find body after headers (double CRLF)
        let bodyStart = response.indexOf("\r\n\r\n")
        if (bodyStart >= 0) {
            let body = response.substr(bodyStart + 4)
            
            // Find JSON start
            let jsonStart = body.indexOf("{")
            if (jsonStart >= 0) {
                return body.substr(jsonStart)
            }
            
            // Or return direct value (for simple reads)
            return body
        }
        
        // Fallback: find +IPD marker (old method)
        let ipdIndex = response.indexOf("+IPD")
        if (ipdIndex >= 0) {
            let colonIndex = response.indexOf(":", ipdIndex)
            if (colonIndex >= 0) {
                let httpData = response.substr(colonIndex + 1)
                bodyStart = httpData.indexOf("\r\n\r\n")
                if (bodyStart >= 0) {
                    httpData = httpData.substr(bodyStart + 4)
                }
                let jsonStart = httpData.indexOf("{")
                if (jsonStart >= 0) {
                    return httpData.substr(jsonStart)
                }
                return httpData
            }
        }
        
        return ""
    }

    // Helper: Parse string to number
    function parseStringToNumber(valueStr: string): number {
        let result = 0
        let isNegative = false
        let hasDecimal = false
        let decimalPlace = 0

        for (let i = 0; i < valueStr.length; i++) {
            let char = valueStr.charAt(i)

            if (char == "-" && i == 0) {
                isNegative = true
            } else if (char == ".") {
                hasDecimal = true
            } else if (char >= "0" && char <= "9") {
                let digit = char.charCodeAt(0) - 48

                if (hasDecimal) {
                    decimalPlace++
                    result = result + digit / Math.pow(10, decimalPlace)
                } else {
                    result = result * 10 + digit
                }
            }
        }

        return isNegative ? -result : result
    }

    // ==================== FIREBASE PUBLIC API ====================
    /**
     * Configure Firebase parameters.
     */
    //% subcategory="Firebase"
    //% weight=50
    //% blockGap=8
    //% blockId=esp8266_configure_firebase
    //% block="Firebase config|API Key %apiKey|URL %databaseURL|Project ID %projectId"
    //% apiKey.defl="your-api-key"
    //% databaseURL.defl="https://your-project.firebaseio.com"
    //% projectId.defl="your-project"
    export function configureFirebase(apiKey: string, databaseURL: string, projectId: string) {
        firebaseApiKey = apiKey
        firebaseDatabaseURL = databaseURL
        firebaseProjectId = projectId
    }

    /**
     * Quick Firebase setup (auto-extract project ID)
     */
    //% subcategory="Firebase"
    //% weight=49
    //% blockGap=8
    //% block="quick Firebase setup|URL %url|API Key %apiKey"
    //% url.defl="https://your-project.firebaseio.com"
    //% apiKey.defl="your-api-key"
    export function quickFirebaseSetup(url: string, apiKey: string) {
        let projectId = ""
        let hostStart = url.indexOf("://")
        if (hostStart >= 0) {
            let host = url.substr(hostStart + 3)
            let dotIndex = host.indexOf(".")
            if (dotIndex > 0) {
                projectId = host.substr(0, dotIndex)
            }
        }
        
        configureFirebase(apiKey, url, projectId)
        setFirebasePath("iot")
    }

    /**
     * Set Firebase path where all data will be sent.
     */
    //% subcategory="Firebase"
    //% weight=48
    //% blockGap=8
    //% blockId=esp8266_set_firebase_path
    //% block="set Firebase path %path"
    //% path.defl="iot"
    export function setFirebasePath(path: string) {
        firebasePath = path
    }

    // ==================== FIREBASE READ FUNCTIONS ====================

    /**
     * Read STRING value from Firebase (IMPROVED)
     */
    //% subcategory="Firebase"
    //% weight=45
    //% blockGap=8
    //% block="Firebase read STRING of %deviceName"
    //% deviceName.defl="status"
    export function readFirebaseString(deviceName: string): string {
        // Validate WiFi connection
        if (!isWifiConnected()) return ""

        // Validate Firebase configuration
        if (firebaseDatabaseURL == "" || firebaseApiKey == "") return ""

        // Build full path to /value field
        let fullPath = cleanPath(firebasePath + "/" + deviceName + "/value")
        let host = extractHost(firebaseDatabaseURL)

        // Connect to Firebase via SSL
        if (!sendCommand("AT+CIPSTART=\"SSL\",\"" + host + "\",443", "OK", 5000)) {
            return ""
        }

        // Build GET request
        let requestPath = "/" + fullPath + ".json?auth=" + firebaseApiKey
        let httpRequest = "GET " + requestPath + " HTTP/1.1\r\n"
        httpRequest += "Host: " + host + "\r\n"
        httpRequest += "Connection: close\r\n"
        httpRequest += "\r\n"

        // Send request
        if (!sendCommand("AT+CIPSEND=" + httpRequest.length, "OK", 2000)) {
            sendCommand("AT+CIPCLOSE", "OK", 1000)
            return ""
        }

        serial.writeString(httpRequest)
        basic.pause(100)

        // Wait for response (longer timeout for HTTPS)
        let response = getResponse("", 3000)

        // Close connection
        sendCommand("AT+CIPCLOSE", "OK", 500)

        // Parse response
        if (response.indexOf("200 OK") < 0) return ""
        
        // Find JSON body (after double CRLF)
        let bodyStart = response.indexOf("\r\n\r\n")
        if (bodyStart < 0) return ""
        
        let body = response.substr(bodyStart + 4)
        
        // Remove "null" responses
        if (body.indexOf("null") >= 0) return ""
        
        // Extract string value (remove quotes)
        if (body.charAt(0) == "\"") {
            let endQuote = body.indexOf("\"", 1)
            if (endQuote > 0) {
                return body.substr(1, endQuote - 1)
            }
        }
        
        // Return as-is for numbers (clean up)
        let cleanBody = ""
        for (let i = 0; i < body.length; i++) {
            let char = body.charAt(i)
            if ((char >= "0" && char <= "9") || char == "." || char == "-") {
                cleanBody += char
            } else if (cleanBody.length > 0) {
                break
            }
        }
        
        return cleanBody
    }

    /**
     * Read NUMBER value from Firebase (IMPROVED)
     */
    //% subcategory="Firebase"
    //% weight=44
    //% blockGap=8
    //% block="Firebase read NUMBER of %deviceName"
    //% deviceName.defl="temperature"
    export function readFirebaseNumber(deviceName: string): number {
        let valueStr = readFirebaseString(deviceName)
        if (valueStr == "") return 0
        return parseStringToNumber(valueStr)
    }

    /**
     * Read BOOLEAN value from Firebase
     */
    //% subcategory="Firebase"
    //% weight=43
    //% blockGap=8
    //% block="Firebase read BOOLEAN of %deviceName"
    //% deviceName.defl="relay"
    export function readFirebaseBoolean(deviceName: string): boolean {
        let value = readFirebaseString(deviceName)
        return value == "1" || value == "true" || value == "TRUE"
    }

    /**
     * Read device value from Firebase (legacy, kept for compatibility)
     */
    //% subcategory="Firebase"
    //% weight=42
    //% blockGap=40
    //% blockId=esp8266_read_firebase_value
    //% block="Firebase read value of %deviceName"
    //% deviceName.defl="temperature"
    export function readFirebaseValue(deviceName: string): number {
        return readFirebaseNumber(deviceName)
    }

    // ==================== FIREBASE CONTROL BLOCKS ====================
    
    /**
     * Check if device command is ON (1 or true)
     */
    //% subcategory="Firebase"
    //% weight=41
    //% blockGap=8
    //% block="Firebase %deviceName is ON"
    //% deviceName.defl="relay1"
    export function firebaseIsOn(deviceName: string): boolean {
        return readFirebaseBoolean(deviceName)
    }

    /**
     * Check if device command is OFF (0 or false)
     */
    //% subcategory="Firebase"
    //% weight=40
    //% blockGap=8
    //% block="Firebase %deviceName is OFF"
    //% deviceName.defl="relay1"
    export function firebaseIsOff(deviceName: string): boolean {
        return !readFirebaseBoolean(deviceName)
    }

    /**
     * Get dimmer/slider value from Firebase (0-1024)
     */
    //% subcategory="Firebase"
    //% weight=39
    //% blockGap=8
    //% block="Firebase get DIMMER value|%deviceName"
    //% deviceName.defl="brightness"
    export function firebaseGetDimmer(deviceName: string): number {
        return readFirebaseNumber(deviceName)
    }

    /**
     * Get slider value in percentage (0-100)
     */
    //% subcategory="Firebase"
    //% weight=38
    //% blockGap=40
    //% block="Firebase get PERCENTAGE|%deviceName"
    //% deviceName.defl="brightness"
    export function firebaseGetPercentage(deviceName: string): number {
        let value = firebaseGetDimmer(deviceName)
        return Math.round((value * 100) / 1024)
    }

    // ==================== FIREBASE WRITE FUNCTIONS ====================

    /**
     * Send data to Firebase Realtime Database (CORE FUNCTION)
     */
    //% blockHidden=true
    export function sendFirebaseData(path: string, jsonData: string) {
        firebaseDataSent = false

        // Validate WiFi connection
        if (!isWifiConnected()) return

        // Validate Firebase configuration
        if (firebaseDatabaseURL == "" || firebaseApiKey == "") return

        // Clean path and extract host
        path = cleanPath(path)
        let host = extractHost(firebaseDatabaseURL)

        // Connect to Firebase
        if (!sendCommand("AT+CIPSTART=\"SSL\",\"" + host + "\",443", "OK", 3000)) {
            return
        }

        // Build PATCH request (updates without overwriting)
        let requestPath = "/" + path + ".json?auth=" + firebaseApiKey
        let httpRequest = "PATCH " + requestPath + " HTTP/1.1\r\n"
        httpRequest += "Host: " + host + "\r\n"
        httpRequest += "Content-Type: application/json\r\n"
        httpRequest += "Content-Length: " + jsonData.length + "\r\n"
        httpRequest += "Connection: close\r\n"
        httpRequest += "\r\n"
        httpRequest += jsonData

        // Send request
        if (!sendCommand("AT+CIPSEND=" + httpRequest.length, "OK")) {
            sendCommand("AT+CIPCLOSE", "OK", 1000)
            return
        }

        sendCommand(httpRequest, null, 100)

        // Wait for SEND OK
        if (getResponse("SEND OK", 1500) == "") {
            sendCommand("AT+CIPCLOSE", "OK", 500)
            return
        }

        // Check response status
        let response = getResponse("", 1500)

        // Check if response contains 200 OK
        if (response != "" && response.indexOf("200") >= 0) {
            firebaseDataSent = true
        }

        // Close connection
        sendCommand("AT+CIPCLOSE", "OK", 500)
    }

    /**
     * Return true if last data sent successfully.
     */
    //% subcategory="Firebase"
    //% weight=37
    //% blockId=esp8266_is_firebase_data_sent
    //% block="Firebase data sent"
    export function isFirebaseDataSent(): boolean {
        return firebaseDataSent
    }

    /**
     * Write simple NUMBER to Firebase
     */
    //% subcategory="Firebase"
    //% weight=36
    //% blockGap=8
    //% block="Firebase write NUMBER|name %deviceName|value %value"
    //% deviceName.defl="counter"
    //% value.defl=0
    export function firebaseWriteNumber(deviceName: string, value: number) {
        let json = "{\"" + deviceName + "\":{\"value\":" + value + "}}"
        sendFirebaseData(firebasePath, json)
    }

    /**
     * Write simple STRING to Firebase
     */
    //% subcategory="Firebase"
    //% weight=35
    //% blockGap=8
    //% block="Firebase write STRING|name %deviceName|value %value"
    //% deviceName.defl="status"
    //% value.defl="OK"
    export function firebaseWriteString(deviceName: string, value: string) {
        let json = "{\"" + deviceName + "\":{\"value\":\"" + value + "\"}}"
        sendFirebaseData(firebasePath, json)
    }

    /**
     * Write simple BOOLEAN to Firebase
     */
    //% subcategory="Firebase"
    //% weight=34
    //% blockGap=8
    //% block="Firebase write BOOLEAN|name %deviceName|value %value"
    //% deviceName.defl="relay"
    //% value.defl=true
    export function firebaseWriteBoolean(deviceName: string, value: boolean) {
        let val = value ? 1 : 0
        let json = "{\"" + deviceName + "\":{\"value\":" + val + "}}"
        sendFirebaseData(firebasePath, json)
    }

    /**
     * Send SWITCH data to Firebase.
     */
    //% subcategory="Firebase"
    //% weight=33
    //% blockGap=8
    //% blockId=esp8266_firebase_switch
    //% block="Firebase send SWITCH|name %deviceName|value %value"
    //% value.min=0 value.max=1
    //% deviceName.defl="lampu"
    export function firebaseSendSwitch(deviceName: string, value: number) {
        let val = value == 1 ? 1 : 0
        let json = "{\"" + deviceName + "\":{\"tipe\":\"switch\",\"value\":" + val + "}}"
        sendFirebaseData(firebasePath, json)
    }

    /**
     * Send DIMMER data to Firebase.
     */
    //% subcategory="Firebase"
    //% weight=32
    //% blockGap=8
    //% blockId=esp8266_firebase_dimmer
    //% block="Firebase send DIMMER|name %deviceName|value %value"
    //% value.min=0 value.max=1024
    //% deviceName.defl="lampu"
    export function firebaseSendDimmer(deviceName: string, value: number) {
        let json = "{\"" + deviceName + "\":{\"tipe\":\"dimmer\",\"value\":" + value + ",\"batas_atas\":1024}}"
        sendFirebaseData(firebasePath, json)
    }

    /**
     * Send SENSOR reading to Firebase.
     */
    //% subcategory="Firebase"
    //% weight=31
    //% blockGap=8
    //% blockId=esp8266_firebase_sensor
    //% block="Firebase send SENSOR|name %deviceName|value %value|unit %unit"
    //% value.defl=0
    //% unit.defl="C"
    //% deviceName.defl="suhu"
    export function firebaseSendSensor(deviceName: string, value: number, unit: string) {
        let json = "{\"" + deviceName + "\":{\"tipe\":\"sensor\",\"value\":" + value + ",\"satuan\":\"" + unit + "\"}}"
        sendFirebaseData(firebasePath, json)
    }

    /**
     * Send multiple sensor readings at once
     */
    //% subcategory="Firebase"
    //% weight=30
    //% blockGap=8
    //% block="Firebase send sensors|temp %temp|humid %humid|light %light"
    //% temp.defl=25
    //% humid.defl=60
    //% light.defl=500
    export function firebaseSendMultiSensor(temp: number, humid: number, light: number) {
        let json = "{"
        json += "\"temperature\":{\"tipe\":\"sensor\",\"value\":" + temp + ",\"satuan\":\"C\"},"
        json += "\"humidity\":{\"tipe\":\"sensor\",\"value\":" + humid + ",\"satuan\":\"%\"},"
        json += "\"light\":{\"tipe\":\"sensor\",\"value\":" + light + ",\"satuan\":\"lux\"}"
        json += "}"
        sendFirebaseData(firebasePath, json)
    }

    /**
     * Send custom JSON to Firebase path
     */
    //% subcategory="Firebase"
    //% weight=29
    //% blockGap=8
    //% block="Firebase send JSON|%jsonData"
    //% jsonData.defl='{"status":"OK"}'
    export function firebaseSendJSON(jsonData: string) {
        sendFirebaseData(firebasePath, jsonData)
    }

    /**
     * Delete device data from Firebase
     */
    //% subcategory="Firebase"
    //% weight=28
    //% blockGap=8
    //% block="Firebase DELETE %deviceName"
    //% deviceName.defl="old_sensor"
    export function firebaseDelete(deviceName: string) {
        // Validate WiFi connection
        if (!isWifiConnected()) return

        // Validate Firebase configuration
        if (firebaseDatabaseURL == "" || firebaseApiKey == "") return

        let fullPath = cleanPath(firebasePath + "/" + deviceName)
        let host = extractHost(firebaseDatabaseURL)

        // Connect to Firebase
        if (!sendCommand("AT+CIPSTART=\"SSL\",\"" + host + "\",443", "OK", 3000)) {
            return
        }

        // Build DELETE request
        let requestPath = "/" + fullPath + ".json?auth=" + firebaseApiKey
        let httpRequest = "DELETE " + requestPath + " HTTP/1.1\r\n"
        httpRequest += "Host: " + host + "\r\n"
        httpRequest += "Connection: close\r\n"
        httpRequest += "\r\n"

        // Send request
        if (!sendCommand("AT+CIPSEND=" + httpRequest.length, "OK")) {
            sendCommand("AT+CIPCLOSE", "OK", 1000)
            return
        }

        serial.writeString(httpRequest)
        basic.pause(500)

        // Close connection
        sendCommand("AT+CIPCLOSE", "OK", 500)
    }
}
