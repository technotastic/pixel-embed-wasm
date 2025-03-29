# pixel-embed-wasm

### Client-Side Image Steganography with Rust & WebAssembly

**[➡️ Live Demo Here ⬅️](https://technotastic.github.io/pixel-embed-wasm/)**

---

## Description

`pixel-embed-wasm` is a web-based tool that allows you to hide text messages within the pixels of an image using the Least Significant Bit (LSB) steganography technique.

The core processing logic is written in **Rust** and compiled to **WebAssembly (WASM)**, enabling fast, near-native performance directly within your browser. All embedding and extraction operations happen entirely **client-side** – your images and messages are never uploaded to any server, ensuring privacy.


## Features

*   **Embed Text:** Hide text messages inside PNG or JPEG images.
*   **Load Message from File:** Load secret messages directly from `.txt` (or other text-like) files.
*   **Extract Text:** Recover hidden text messages from images encoded by this tool.
*   **Save Extracted Text:** Download the recovered message as a `.txt` file.
*   **Client-Side Processing:** All operations run securely in your browser. No server interaction required after initial load.
*   **WASM Powered:** Leverages Rust compiled to WebAssembly for efficient pixel manipulation.
*   **Retro Theme:** Includes a fun, CRT-style visual theme.

## Technology Stack

*   **Rust:** Core logic for LSB embedding/extraction.
*   **WebAssembly:** Target compile format for running Rust efficiently in the browser.
    *   `wasm-pack`: Tooling for building Rust WASM packages.
    *   `wasm-bindgen`: Facilitates interaction between JavaScript and Rust/WASM.
*   **JavaScript:** Handles DOM manipulation, user interaction, File API, Canvas API, and gluing everything together.
*   **HTML:** Structure of the web application.
*   **CSS:** Styling (including the retro theme).
*   **GitHub Pages:** Hosting for the live demo (using GitHub Actions for deployment).

## How It Works

1.  **LSB Steganography:** The tool modifies the Least Significant Bit (LSB) – the bit with the smallest value (0 or 1) – of the Red, Green, and Blue color components of image pixels. Changing the LSB alters the color value minimally, often imperceptibly to the human eye.
2.  **Encoding:** The text message is converted to bytes (using UTF-8, supporting special characters), then to a sequence of bits. The length of the message (in bits) is embedded first, followed by the message bits themselves, replacing the LSBs of the image's pixel data.
3.  **Decoding:** The process is reversed. The tool first reads the initial LSBs to determine the expected message length. If the length is plausible for the image size, it reads that many subsequent LSBs, reconstructs the original bytes, and attempts to convert them back into a UTF-8 string.
4.  **Why WASM?** Iterating over potentially millions of pixels and performing bitwise operations is computationally intensive. Rust compiled to WASM executes this logic significantly faster than equivalent JavaScript, providing a smooth user experience even with larger messages or images.

## Usage (Live Demo)

1.  Visit the **[Live Demo](https://technotastic.github.io/pixel-embed-wasm/)**.

2.  **To Embed:**
    *   Click "Select Cover Image" and choose an image file (PNG is recommended for output).
    *   Type your message in the "Secret Message" textarea OR click "Load Message From Text File" to load from a `.txt` file.
    *   Click the "> Embed Data_" button.
    *   A preview of the encoded image will appear.
    *   Click "> Download Encoded Image_" to save the result. **IMPORTANT: Save the downloaded image as a PNG file** to ensure the hidden data is preserved losslessly. Saving as JPEG will destroy the message!

3.  **To Extract:**
    *   Click "Select Image to Decode" and choose a PNG image previously encoded by this tool.
    *   Click the "> Extract Data_" button.
    *   The extracted message will appear in the lower textarea.
    *   If desired, click "> Save Message As .txt_" to download the extracted text.

## Building and Running Locally

If you want to build and run the project yourself:

**Prerequisites:**

*   [Rust and Cargo](https://rustup.rs/)
*   [`wasm-pack`](https://rustwasm.github.io/wasm-pack/installer/) (`cargo install wasm-pack`)
*   [Node.js and npm](https://nodejs.org/) (Optional, for a simple local server like `http-server`)

**Steps:**

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/technotastic/pixel-embed-wasm.git # Replace with your repo URL if different
    cd pixel-embed-wasm
    ```
2.  **Build the WASM package:**
    ```bash
    wasm-pack build --target web --out-dir ./pkg
    ```
3.  **Serve the files:** Use a simple local HTTP server. Example using `http-server`:
    ```bash
    # Install globally (if needed): npm install -g http-server
    http-server .
    ```
4.  **Open in browser:** Navigate to the URL provided by the server (e.g., `http://localhost:8080`).

## Limitations & Disclaimers

*   **🚨 SECURITY WARNING:** This tool implements **basic LSB steganography ONLY**. It is **NOT secure** and should **NOT** be used for sensitive information. The hidden data is easily detectable by steganalysis tools and offers no real confidentiality. It provides *obscurity*, not encryption.
*   **Fragility:** The hidden data is destroyed if the image is edited, resized, or compressed using **lossy formats like JPEG**. Always save and share the encoded image as a **PNG**.
*   **File Size:** Encoding data often results in output PNG files that are significantly larger than highly compressed input files (like JPEGs) because PNG is lossless.
*   **Decoding Clean Images:** Attempting to decode an image that wasn't encoded by this tool will likely result in an error message (either about impossible message length or invalid UTF-8 data), which is expected behavior.

## Potential Future Enhancements

*   Password-based AES encryption before embedding.
*   Option to utilize the Alpha channel's LSB for increased capacity.
*   Progress indicators for long operations.
*   Better visual feedback on image capacity vs. message size.
*   Support for embedding/extracting small binary files (not just text).

