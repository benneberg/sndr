# sndr
# sndr

A peer-to-peer, zero-knowledge encrypted file sharing application built with modern web technologies. sndr allows users to transfer files directly between browsers without any server-side storage, ensuring complete privacy and security.

## Overview

sndr is a Progressive Web App (PWA) that leverages WebRTC for direct peer-to-peer connections and the Web Crypto API for robust end-to-end encryption. The "zero-knowledge" architecture means that the application has no access to your files or the encryption keys; they are generated in your browser and are only known by you and the recipient.

## Features

-   **Peer-to-Peer (P2P) Transfer**: Files are sent directly from the sender's browser to the receiver's using WebRTC. No servers, no middlemen.
-   **End-to-End Encryption (E2EE)**: Files are encrypted client-side using AES-GCM, a modern and secure authenticated encryption algorithm.
-   **Zero-Knowledge**: The encryption key is generated in the sender's browser and shared with the receiver via a secure ticket. The application server never sees the key or the file content.
-   **Broadcast Mode**: Send files to multiple recipients simultaneously in a single session.
-   **Folder Support**: Share entire folders with their directory structure preserved.
-   **Drag & Drop**: An intuitive user interface for selecting files and folders.
-   **Progressive Web App (PWA)**: Installable on desktop and mobile devices for a native-app-like experience and offline access to the application shell.
-   **No Sign-up Required**: Use the application instantly without any registration.

## How it Works

The application's core is a clever combination of web technologies to achieve secure, serverless file transfer.

1.  **File Selection**: The sender selects files or folders they wish to share.
2.  **Signaling (Ticket Exchange)**: This is the process of establishing a connection.
    *   The sender clicks "Generate Secure Ticket".
    *   The application generates a 256-bit AES-GCM encryption key and a WebRTC "offer" (a session description).
    *   The key and the offer are bundled into a base64-encoded "ticket".
    *   The sender shares this ticket with the receiver through an external, secure channel (e.g., an encrypted messaging app).
    *   The receiver pastes the sender's ticket. Their browser creates a WebRTC "answer" ticket.
    *   The receiver sends their answer ticket back to the sender.
    *   The sender pastes the receiver's ticket to complete the connection handshake.
3.  **WebRTC Connection**: Once the handshake is complete, a direct and secure `RTCDataChannel` is established between the two browsers.
4.  **Encrypted File Transfer**:
    *   Files are read into memory on the sender's device, chunk by chunk.
    *   Each chunk is encrypted using the shared AES-GCM key.
    *   The encrypted chunks are sent over the WebRTC data channel.
    *   The receiver's browser receives the encrypted chunks, decrypts them, and reassembles the original file.
    *   The file is then saved to the receiver's default download location. The application never stores the file.

## Technology Stack

-   **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES Modules)
-   **P2P Communication**: WebRTC (`RTCPeerConnection`, `RTCDataChannel`)
-   **Cryptography**: Web Crypto API (`SubtleCrypto` with AES-GCM)
-   **Offline Capability**: Progressive Web App (PWA) with a Service Worker

## Security Model

The security of SecureShareFlow is built on strong, well-established cryptographic principles.

-   **End-to-End Encryption**: All files are encrypted with AES-256-GCM. The key is never transmitted in plaintext over an insecure channel. It is part of the initial ticket, which you are responsible for sharing securely.
-   **Ephemeral Keys**: A new encryption key is generated for every sharing session.
-   **Zero-Knowledge Architecture**: The application itself is static and runs entirely in your browser. There is no backend server involved in the file transfer process that could intercept or store your data.
-   **Secure Signaling**: The security of the initial key exchange relies on the user sharing the "ticket" through a secure out-of-band channel. This design choice removes the need for a central server to manage authentication or key distribution, putting the user in full control.

## How to Use

### To Send Files:

1.  Open SecureShareFlow in your browser.
2.  Drag and drop your files/folders, or use the "Select Files"/"Select Folder" buttons.
3.  Click "Generate Secure Ticket".
4.  Copy the generated ticket and send it to your recipient.
5.  Wait for the recipient to send their ticket back.
6.  Paste the recipient's ticket into the input box and click "Connect".
7.  The transfer will begin automatically.

### To Receive Files:

1.  Open SecureShareFlow and switch to the "Receive" tab.
2.  Paste the ticket you received from the sender and click "Connect".
3.  A new ticket will be generated for you. Copy it and send it back to the sender.
4.  Wait for the sender to complete the connection. The file transfer will start, and files will be saved to your downloads folder.
