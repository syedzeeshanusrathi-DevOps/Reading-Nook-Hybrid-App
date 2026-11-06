
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, Text, Share, Pressable, Platform, Button } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView, { WebViewMessageEvent } from "react-native-webview";
import books from "../data/book.json";
import * as Print from "expo-print";

import { useState, useEffect } from "react";



const WEBSITE = "https://the-readingnook.netlify.app/";
const TRUSTED_ORIGIN = "https://the-readingnook.netlify.app";
const PRINTER_STORAGE_KEY = "readingnook_default_printer";

// JavaScript that runs inside the webpage
const injectedScript = `
  (function () {

    // Create the button only if it does not exist
    if (!document.getElementById("native-share-button")) {

      const button = document.createElement("button");

      button.id = "native-share-button";
      button.textContent = "Share in App";

      // Position and appearance
      button.style.cssText =
        "position:fixed;" +
        "bottom:80px;" +
        "right:16px;" +
        "z-index:99999;" +
        "background:#2563eb;" +
        "color:white;" +
        "padding:14px;" +
        "border:none;" +
        "border-radius:10px;" +
        "font-size:16px;";

      // Send a message when pressed
      button.addEventListener("click", function () {

        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "SHARE_READING_NOOK",
            url: window.location.href
          })
        );

      });

      document.body.appendChild(button);
    }
      
    // Create our Browse Library button
    if (!document.getElementById("native-library-button")) {

      const browseButton = document.createElement("button");
      browseButton.id = "native-library-button";
      browseButton.textContent = "Browse Library";

      browseButton.style.cssText =
        "position:fixed;bottom:145px;right:16px;" +
        "z-index:99999;background:#16a34a;color:white;" +
        "padding:14px;border:none;border-radius:10px;";

      // Create a menu for Books and Audiobooks
      const menu = document.createElement("div");
      menu.style.cssText =
        "position:fixed;bottom:205px;right:16px;" +
        "z-index:99999;background:white;padding:12px;" +
        "border-radius:10px;box-shadow:0 2px 10px #888;" +
        "display:none;";

      ["Books", "Audiobooks"].forEach(function(type) {
        const option = document.createElement("button");
        option.textContent = type;
        option.style.cssText =
          "display:block;padding:12px;margin:5px;" +
          "background:#eee;color:black;border:0;";

        option.addEventListener("click", function() {

          // Find the existing website filter button
          const existingButton =
            Array.from(document.querySelectorAll("button"))
              .find(function(element) {
                const text = (element.textContent || "")
                  .replace(/^[^A-Za-z]+/, "")
                  .trim();

                return text === type && element !== option;
              });

          if (existingButton) {
            existingButton.click();
            menu.style.display = "none";
          } else {
            alert(type + " filter was not found");
          }

        });

        menu.appendChild(option);
      });

      browseButton.addEventListener("click", function() {
        menu.style.display =
          menu.style.display === "none" ? "block" : "none";
      });

      document.body.appendChild(browseButton);
      document.body.appendChild(menu);
    }


    // Notify React Native that the webpage is ready
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: "WEBVIEW_READY" })
    );

  })();

  true;
`;

export default function HomeScreen() {



  const [connected, setConnected] = useState(false);
  const [selectedPrinter, setSelectedPrinter] =
    useState<Print.Printer | null>(null);


    
useEffect(() => {
  if (Platform.OS !== "ios") return;

  const loadPrinter = async () => {
    try {
      const saved = await AsyncStorage.getItem(
        PRINTER_STORAGE_KEY
      );

      if (saved) {
        const printer = JSON.parse(saved) as Print.Printer;

        if (
          typeof printer.name === "string" &&
          typeof printer.url === "string"
        ) {
          setSelectedPrinter(printer);
        }
      }
    } catch (error) {
      console.log("Failed to load printer:", error);
    }
  };

  loadPrinter();
}, []);


 
const choosePrinter = async () => {
  if (Platform.OS !== "ios") return;

  try {
    const printer = await Print.selectPrinterAsync();

    setSelectedPrinter(printer);

    await AsyncStorage.setItem(
      PRINTER_STORAGE_KEY,
      JSON.stringify(printer)
    );

    console.log("Default printer saved:", printer.name);
  } catch (error) {
    console.log("Printer selection failed:", error);
  }
};


  // Receive messages from WebView
  const handleMessage = async (event: WebViewMessageEvent) => {

    try {
      // Only accept messages from our website
      const source = new URL(event.nativeEvent.url);

      if (source.origin !== TRUSTED_ORIGIN) {
        return;
      }

      // Convert the received JSON string into an object
      const message = JSON.parse(event.nativeEvent.data);

      if (message.type === "WEBVIEW_READY") {
        setConnected(true);
        return;
      }

      if (message.type === "SHARE_READING_NOOK") {

        const sharedUrl = new URL(message.url);

        if (sharedUrl.origin !== TRUSTED_ORIGIN) {
          return;
        }

        // Open the native phone sharing interface
        await Share.share({
          message: "Check out The Reading Nook: " + sharedUrl.href
        });
      }

    } catch (error) {
      console.warn("Bridge error:", error);
    }
  };

  const printBooks = async () => {


    // Read the existing book records
    const catalog = books as Array<{
      title: string;
      author: string;
    }>;

    // Escape special characters for HTML
    const escapeHtml = (value: string) =>
      String(value ?? "").replace(/[&<>"']/g, (char) => {
        const entities: Record<string, string> = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        };
        return entities[char];
      });

    // Convert books to printable table rows
    const rows = catalog.map((book, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(book.title)}</td>
      <td>${escapeHtml(book.author)}</td>
    </tr>
  `).join("");

    // Build a printable HTML document
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: Arial; padding: 20px; }
        h1 { text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        th, td {
          border: 1px solid #ccc;
          padding: 8px;
          text-align: left;
        }
        th { background: #eee; }
      </style>
    </head>
    <body>
      <h1>The Reading Nook</h1>
      <h3>Total Books: ${catalog.length}</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Book Title</th>
            <th>Author</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `;

    // Open the native print interface


    try {
      await Print.printAsync({
        html,
        ...(Platform.OS === "ios" && selectedPrinter
          ? { printerUrl: selectedPrinter.url }
          : {}),
      });
    } catch (error) {
      console.log("Printing canceled or failed:", error);
    }
  };




  return (
    <SafeAreaView style={{ flex: 1 }}>

      <View style={{ padding: 12 }}>
        <Text>
          {connected
            ? "✅ Website Connected"
            : "Connecting to Website..."}
        </Text>
      </View>

      <View style={{ padding: 12 }}>
        <Text>Total Books: {books.length}</Text>
      </View>

      <Pressable
        onPress={printBooks}
        style={{
          backgroundColor: "#2563eb",
          padding: 14,
          margin: 10,
          borderRadius: 10,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "bold" }}>
          Print Books List
        </Text>
      </Pressable>
      {Platform.OS === "ios" && (
        <>
          <Button
            title="Select Printer"
            onPress={choosePrinter}
          />

          <Text>
            {selectedPrinter
              ? `Selected Printer: ${selectedPrinter.name}`
              : "No printer selected"}
          </Text>
        </>
      )}

      <WebView
        source={{ uri: WEBSITE }}
        style={{ flex: 1 }}
        javaScriptEnabled={true}
        injectedJavaScript={injectedScript}
        onMessage={handleMessage}
        onLoadStart={() => setConnected(false)}
      />

    </SafeAreaView>
  );
}
