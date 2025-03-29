use wasm_bindgen::prelude::*;
use web_sys::console;

// Optional: Better panic messages in the browser console
#[cfg(feature = "console_error_panic_hook")]
pub fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// How many bits we use at the start of the image data to store the message length
const MESSAGE_LENGTH_BITS: usize = 32;

// --- Helper: Get bit at index `n` from a byte ---
fn get_bit(byte: u8, n: u8) -> u8 {
    (byte >> n) & 1
}

// --- Helper: Set bit at index `n` in a byte ---
fn set_bit(byte: u8, n: u8, value: u8) -> u8 {
    (byte & !(1 << n)) | (value << n)
}

#[wasm_bindgen]
pub fn embed(image_data: &mut [u8], message: &str) -> Result<(), JsValue> {
    // Convert message string to bytes, then to bits
    let message_bytes = message.as_bytes();
    let message_len_bytes = message_bytes.len();
    let message_len_bits = message_len_bytes * 8;

    // --- Calculate required capacity ---
    let required_capacity_bits = MESSAGE_LENGTH_BITS + message_len_bits;
    // Use only R, G, B channels (3 bits per pixel) - ignore Alpha for simplicity
    // Ensure we don't count incomplete pixels if len isn't multiple of 4
    let available_capacity_bits = (image_data.len() / 4) * 3;


    if required_capacity_bits > available_capacity_bits {
        let err_msg_str = format!(
            "Error: Message too large. Required bits: {}, Available LSBs in RGB channels: {}",
            required_capacity_bits, available_capacity_bits
        );
        // Create JsValue, log it, then return it
        let js_err = JsValue::from_str(&err_msg_str);
        console::error_1(&js_err);
        return Err(js_err);
    }

    console::log_1(&format!("Embedding message: {} bytes ({} bits)", message_len_bytes, message_len_bits).into());
    console::log_1(&format!("Image data length: {} bytes, Available LSBs: {}", image_data.len(), available_capacity_bits).into());

    // --- Prepare bits to embed: Length + Message ---
    let mut bits_to_embed: Vec<u8> = Vec::with_capacity(required_capacity_bits);

    // 1. Add length bits (as u32, LSB first)
    let length_as_u32 = message_len_bits as u32;
    for i in 0..MESSAGE_LENGTH_BITS {
        // Extract i-th bit of the length
         bits_to_embed.push(((length_as_u32 >> i) & 1) as u8);
    }

    // 2. Add message bits (LSB of each byte first)
    for byte in message_bytes {
        for i in 0..8 {
            bits_to_embed.push(get_bit(*byte, i));
        }
    }

    // --- Embed bits into image data (RGB channels LSB) ---
    let mut data_idx = 0;
    // Iterate by reference to avoid moving bits_to_embed
    for bit_ref in &bits_to_embed {
        let bit = *bit_ref; // Dereference to get the u8 value

        // Find the next R, G, or B byte index (skip Alpha)
        while data_idx < image_data.len() && (data_idx + 1) % 4 == 0 {
            data_idx += 1;
        }

        // Check if we ran out of data (shouldn't happen if capacity check passed)
        if data_idx >= image_data.len() {
             let err_msg_str = "Error: Ran out of image data unexpectedly during embedding.";
             let js_err = JsValue::from_str(err_msg_str);
             console::error_1(&js_err);
             return Err(js_err);
        }

        // Modify the LSB
        image_data[data_idx] = set_bit(image_data[data_idx], 0, bit);
        data_idx += 1;
    }

    console::log_1(&"Embedding successful!".into());
    Ok(())
}


#[wasm_bindgen]
pub fn extract(image_data: &[u8]) -> Result<String, JsValue> {
    console::log_1(&"Starting extraction...".into());
    console::log_1(&format!("Image data length: {} bytes", image_data.len()).into());

     // --- Check if image is large enough for length header ---
     // Need at least MESSAGE_LENGTH_BITS LSBs. Each 4 bytes of image yield 3 LSBs (RGB).
    let min_pixels_for_len = (MESSAGE_LENGTH_BITS + 2) / 3; // Ceiling division approximation
    let min_bytes_for_len = min_pixels_for_len * 4;
    if image_data.len() < min_bytes_for_len {
         let err_msg_str = format!("Error: Image too small ({}) to potentially contain {} bits of length information.", image_data.len(), MESSAGE_LENGTH_BITS);
         let js_err = JsValue::from_str(&err_msg_str);
         console::error_1(&js_err);
         return Err(js_err);
    }

    // --- Extract Length (first MESSAGE_LENGTH_BITS LSBs from RGB channels) ---
    let mut message_len_bits: u32 = 0;
    let mut data_idx = 0;
    for i in 0..MESSAGE_LENGTH_BITS {
         // Skip Alpha
        while data_idx < image_data.len() && (data_idx + 1) % 4 == 0 {
             data_idx += 1;
        }
         // Check boundary before reading
         if data_idx >= image_data.len() {
             let err_msg_str = "Error: Image too small while reading length header.";
             let js_err = JsValue::from_str(err_msg_str);
             console::error_1(&js_err);
             return Err(js_err);
         }

        let lsb = get_bit(image_data[data_idx], 0);
        message_len_bits |= (lsb as u32) << i; // Reconstruct length bit by bit
        data_idx += 1;
    }


    console::log_1(&format!("Extracted raw message length: {} bits", message_len_bits).into());

    // --- Sanity check length ---
     let available_capacity_bits = (image_data.len() / 4) * 3; // Max LSBs in RGB
    // Check if length is plausible (greater than 0 and fits within total possible LSBs minus header)
     if message_len_bits == 0 {
          console::log_1(&"Extracted length is 0. No message found or message is empty.".into());
          return Ok(String::new()); // No message to extract
     }
     // Calculate required bits including the header itself for comparison
     let total_bits_implied = MESSAGE_LENGTH_BITS + message_len_bits as usize;

     if total_bits_implied > available_capacity_bits {
         let err_msg_str = format!(
             "Error: Extracted length ({} bits) plus header ({} bits) implies total {} bits needed, but image only has {} available LSBs in RGB.",
             message_len_bits, MESSAGE_LENGTH_BITS, total_bits_implied, available_capacity_bits
         );
         let js_err = JsValue::from_str(&err_msg_str);
         console::error_1(&js_err);
         return Err(js_err);
     }

    let message_len_bytes = (message_len_bits + 7) / 8; // Calculate bytes needed (ceiling division)
    console::log_1(&format!("Expecting message body: {} bytes", message_len_bytes).into());


    // --- Extract Message Bits ---
    let mut extracted_bits: Vec<u8> = Vec::with_capacity(message_len_bits as usize);
    // data_idx is already positioned after the length part from the previous loop

    for _ in 0..message_len_bits {
         // Skip Alpha
         while data_idx < image_data.len() && (data_idx + 1) % 4 == 0 {
             data_idx += 1;
         }
         // Check boundary before reading
         if data_idx >= image_data.len() {
              let err_msg_str = format!(
                  "Error: Ran out of image data while extracting message body. Expected {} bits, but stopped short at index {}.",
                   message_len_bits, data_idx
              );
              let js_err = JsValue::from_str(&err_msg_str);
              console::error_1(&js_err);
              return Err(js_err);
         }

        extracted_bits.push(get_bit(image_data[data_idx], 0));
        data_idx += 1;
    }

    // --- Reconstruct Bytes from Bits ---
    // Ensure we have a multiple of 8 bits if the original length wasn't
    if extracted_bits.len() % 8 != 0 {
        console::warn_1(&format!("Warning: Extracted bit count ({}) is not a multiple of 8. Resulting string might be truncated.", extracted_bits.len()).into());
        // We'll proceed, String::from_utf8 will handle the bytes we managed to form.
    }

    let mut message_bytes: Vec<u8> = Vec::with_capacity(message_len_bytes as usize);
    // Iterate over chunks of 8 bits to form bytes
    for chunk in extracted_bits.chunks(8) {
        let mut byte: u8 = 0;
         // Reconstruct byte (LSB first)
        for (i, bit) in chunk.iter().enumerate() {
             if i < 8 { // Ensure we don't go out of bounds if last chunk is short
                 byte |= bit << i;
             }
        }
         // Only add full bytes if length was multiple of 8, or all bytes if not
         if chunk.len() == 8 || extracted_bits.len() % 8 != 0 {
              message_bytes.push(byte);
         }
    }


    // --- Convert Bytes to String ---
    String::from_utf8(message_bytes)
        .map_err(|e| {
            // Handle UTF-8 conversion error
            let err_msg_str = format!("Error converting extracted bytes to UTF-8: {}. Bytes might be corrupted or not valid text.", e);
            let js_err = JsValue::from_str(&err_msg_str);
            console::error_1(&js_err);
            js_err
        })
}
