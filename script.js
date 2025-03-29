// Import the WASM initialization function and exported Rust functions
import init, { embed, extract } from './pkg/wasm_steganography_retro.js';

// --- DOM Elements ---
const coverImageInput = document.getElementById('cover-image-input');
const originalCanvas = document.getElementById('original-canvas');
const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });

const secretMessageInput = document.getElementById('secret-message');
const loadMessageInput = document.getElementById('load-message-input'); // New
const embedButton = document.getElementById('embed-button');
const encodedCanvas = document.getElementById('encoded-canvas');
const encodedCtx = encodedCanvas.getContext('2d');
const downloadLink = document.getElementById('download-link');

const decodeImageInput = document.getElementById('decode-image-input');
const decodePreviewCanvas = document.getElementById('decode-preview-canvas');
const decodePreviewCtx = decodePreviewCanvas.getContext('2d');
const extractButton = document.getElementById('extract-button');
const extractedMessageOutput = document.getElementById('extracted-message');
const saveMessageButton = document.getElementById('save-message-button'); // New

const statusMessage = document.getElementById('status-message');

// --- Global variables ---
let originalImageData = null;
let imageDataForDecode = null;
let currentObjectUrl = null; // To keep track of blob URL for cleanup

// --- Utility Functions ---
function updateStatus(message, isError = false) {
    console.log(`Status: ${message}`);
    statusMessage.textContent = `> Status: ${message}` + (isError ? ' !' : '_');
    statusMessage.style.color = isError ? '#ff4141' : '#00cc33';
}

// Loads an image file onto a specified canvas
function loadImageToCanvas(file, canvas, ctx) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error("Please select a valid image file."));
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                 canvas.width = img.naturalWidth;
                 canvas.height = img.naturalHeight;
                 ctx.clearRect(0, 0, canvas.width, canvas.height);
                 ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
                 try {
                    // Using willReadFrequently: true is better but sometimes causes issues
                    // Fallback if getImageData fails initially
                     resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
                 } catch (error) {
                    console.warn("getImageData failed, trying without willReadFrequently hint:", error);
                     try {
                        // Retry without the hint if the browser didn't like it
                         const fallbackCtx = canvas.getContext('2d');
                         fallbackCtx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
                         resolve(fallbackCtx.getImageData(0, 0, canvas.width, canvas.height));
                     } catch (finalError) {
                         reject(new Error(`Failed to get image data: ${finalError.message}`));
                     }
                 }

            };
            img.onerror = (e) => reject(new Error(`Failed to load image: ${e}`));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error("Failed to read image file."));
        reader.readAsDataURL(file);
    });
}

// Function to trigger text file download
function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl); // Revoke previous URL if exists
    }
    currentObjectUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = currentObjectUrl;
    link.download = filename;
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link); // Clean up
    // Don't revoke immediately, let download start: URL.revokeObjectURL(currentObjectUrl);
    // currentObjectUrl = null; // Keep it for potential next download to revoke
}

// --- Main Application Logic ---
async function run() {
    updateStatus("Initializing WASM module...");
    try {
        await init();
        updateStatus("Ready_");
    } catch (err) {
        updateStatus(`Failed to initialize WASM: ${err}`, true);
        console.error("WASM Initialization failed:", err);
        embedButton.disabled = true;
        extractButton.disabled = true;
        saveMessageButton.disabled = true; // Also disable save if WASM fails
        return;
    }

    // --- Event Listeners ---

    // Load Cover Image for Embedding
    coverImageInput.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        updateStatus("Loading cover image...");
        try {
            originalImageData = await loadImageToCanvas(file, originalCanvas, originalCtx);
            encodedCanvas.width = originalCanvas.width;
            encodedCanvas.height = originalCanvas.height;
            encodedCtx.clearRect(0, 0, encodedCanvas.width, encodedCanvas.height);
            downloadLink.style.display = 'none';
            const capacityBytes = Math.floor(((originalImageData.width * originalImageData.height * 3) - 32) / 8);
            updateStatus(`Cover image loaded (${originalImageData.width}x${originalImageData.height}). Approx capacity: ${capacityBytes} bytes. Enter message and click Embed.`);
        } catch (err) {
            updateStatus(`Error loading cover image: ${err.message}`, true);
            console.error(err);
            originalImageData = null;
        }
    });

    // Load Secret Message from Text File
    loadMessageInput.addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.type !== "text/plain") {
            updateStatus("Please select a valid .txt file.", true);
            return;
        }
        updateStatus("Reading text file...");
        const reader = new FileReader();
        reader.onload = (e) => {
            secretMessageInput.value = e.target.result; // Put file content into textarea
            updateStatus("Text file loaded into message area.");
        };
        reader.onerror = () => {
            updateStatus("Failed to read text file.", true);
        };
        reader.readAsText(file);
    });

    // Embed Button Click
    embedButton.addEventListener('click', () => {
        if (!originalImageData) {
            updateStatus("Please load a cover image first.", true);
            return;
        }
        const message = secretMessageInput.value;
        if (!message) {
            updateStatus("Please enter or load a secret message.", true);
            return;
        }

        updateStatus("Embedding message... (this may take a moment for large data)");

        // Use setTimeout to allow UI update before potentially blocking WASM call
        setTimeout(() => {
            const imageDataCopy = new Uint8ClampedArray(originalImageData.data);
            const modifiableImageData = new ImageData(imageDataCopy, originalImageData.width, originalImageData.height);

            try {
                embed(modifiableImageData.data, message);
                encodedCtx.putImageData(modifiableImageData, 0, 0);
                updateStatus("Message embedded successfully. Prepare download.");

                encodedCanvas.toBlob((blob) => {
                     if (!blob) {
                         updateStatus("Failed to create image blob for download.", true);
                         return;
                     }
                    const url = URL.createObjectURL(blob);
                    downloadLink.href = url;
                    downloadLink.download = 'encoded_image.png';
                    downloadLink.style.display = 'inline-block';
                }, 'image/png');

            } catch (error) {
                 const errorMessage = error instanceof Error ? error.message : String(error);
                 updateStatus(`Embedding failed: ${errorMessage}`, true);
                 console.error("Embedding error:", error);
                 downloadLink.style.display = 'none';
            }
        }, 10); // Small delay
    });

    // Load Image for Decoding
    decodeImageInput.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        updateStatus("Loading image for decoding...");
         extractedMessageOutput.value = '';
        try {
             imageDataForDecode = await loadImageToCanvas(file, decodePreviewCanvas, decodePreviewCtx);
            updateStatus(`Image loaded (${imageDataForDecode.width}x${imageDataForDecode.height}). Click Extract Data.`);
        } catch (err) {
            updateStatus(`Error loading image for decoding: ${err.message}`, true);
            console.error(err);
             imageDataForDecode = null;
        }
    });

    // Extract Button Click
    extractButton.addEventListener('click', () => {
         if (!imageDataForDecode) {
             updateStatus("Please load an image to decode first.", true);
             return;
         }

         updateStatus("Extracting message... (this may take a moment)");
         extractedMessageOutput.value = '';

         // Use setTimeout for responsiveness
         setTimeout(() => {
             try {
                 const extracted = extract(imageDataForDecode.data);
                 extractedMessageOutput.value = extracted;
                 updateStatus(extracted ? "Extraction complete." : "Extraction complete (no message found or image incompatible).");

             } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  updateStatus(`Extraction failed: ${errorMessage}`, true);
                  console.error("Extraction error:", error);
                  extractedMessageOutput.value = `--- ERROR ---\n${errorMessage}`;
             }
        }, 10); // Small delay
    });

    // Save Extracted Message Button Click
    saveMessageButton.addEventListener('click', () => {
        const textToSave = extractedMessageOutput.value;
        if (!textToSave || textToSave.startsWith('--- ERROR ---')) {
            updateStatus("No valid message to save.", true);
            return;
        }
        try {
            downloadTextFile('extracted_message.txt', textToSave);
            updateStatus("Save initiated...");
        } catch (error) {
            updateStatus("Failed to initiate save.", true);
            console.error("Save error:", error);
        }
    });
}

// Start the application
run();
