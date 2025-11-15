// --- DOM Elements ---
const dom = {
    sendTab: document.getElementById('send-tab'),
    receiveTab: document.getElementById('receive-tab'),
    senderView: document.getElementById('sender-view'),
    receiverView: document.getElementById('receiver-view'),
    errorText: document.getElementById('error-text'),
    // Sender Idle
    senderIdleState: document.getElementById('sender-idle-state'),
    broadcastToggle: document.getElementById('broadcast-toggle-cb'),
    dropzone: document.getElementById('dropzone'),
    selectFilesBtn: document.getElementById('select-files-btn'),
    selectFolderBtn: document.getElementById('select-folder-btn'),
    fileInput: document.getElementById('file-input'),
    folderInput: document.getElementById('folder-input'),
    fileListView: document.getElementById('file-list-view'),
    fileListInfo: document.getElementById('file-list-info'),
    clearFilesBtn: document.getElementById('clear-files-btn'),
    fileList: document.getElementById('file-list'),
    generateTicketBtn: document.getElementById('generate-ticket-btn'),
    // Sender Waiting
    senderWaitingState: document.getElementById('sender-waiting-state'),
    senderOfferTicket: document.getElementById('sender-offer-ticket'),
    copyOfferBtn: document.getElementById('copy-offer-btn'),
    senderAnswerInput: document.getElementById('sender-answer-input'),
    senderConnectBtn: document.getElementById('sender-connect-btn'),
    // Sender Broadcast
    senderBroadcastState: document.getElementById('sender-broadcast-state'),
    recipientCount: document.getElementById('recipient-count'),
    addRecipientBtn: document.getElementById('add-recipient-btn'),
    peerList: document.getElementById('peer-list'),
    broadcastAnswerInput: document.getElementById('broadcast-answer-input'),
    broadcastConnectBtn: document.getElementById('broadcast-connect-btn'),
    broadcastSendBtn: document.getElementById('broadcast-send-btn'),
    // Progress View
    progressView: document.getElementById('progress-view'),
    progressStatusText: document.getElementById('progress-status-text'),
    progressTotalSize: document.getElementById('progress-total-size'),
    progressBarInner: document.getElementById('progress-bar-inner'),
    progressPercentage: document.getElementById('progress-percentage'),
    completeText: document.getElementById('complete-text'),
    shareMoreBtn: document.getElementById('share-more-btn'),
    // Receiver Idle
    receiverIdleState: document.getElementById('receiver-idle-state'),
    receiverOfferInput: document.getElementById('receiver-offer-input'),
    receiverConnectBtn: document.getElementById('receiver-connect-btn'),
    // Receiver Answering
    receiverAnsweringState: document.getElementById('receiver-answering-state'),
    receiverAnswerTicket: document.getElementById('receiver-answer-ticket'),
    copyAnswerBtn: document.getElementById('copy-answer-btn'),
    // Receiver Preview
    receiverPreviewState: document.getElementById('receiver-preview-state'),
    receiverFileListView: document.getElementById('receiver-file-list-view'),
    receiverFileListInfo: document.getElementById('receiver-file-list-info'),
    receiverFileList: document.getElementById('receiver-file-list'),
    // Modal
    modalBackdrop: document.getElementById('modal-backdrop'),
    modalTicketOffer: document.getElementById('modal-ticket-offer'),
    modalCopyBtn: document.getElementById('modal-copy-btn'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    cancelBtns: document.querySelectorAll('.cancel-btn'),
};

// --- App State ---
let state = {};

const initialState = {
    mode: 'send', // 'send' or 'receive'
    files: [],
    status: 'idle',
    progress: 0,
    error: '',
    broadcastMode: false,
    peers: [], // { id, status, pc, dc }
    modalTicket: null,
};


// --- Crypto Helpers ---
const CRYPTO_ALGO = 'AES-GCM';
const IV_LENGTH = 12; // bytes

const generateEncryptionKey = async () => crypto.subtle.generateKey({ name: CRYPTO_ALGO, length: 256 }, true, ['encrypt', 'decrypt']);
const exportKey = async (key) => await crypto.subtle.exportKey('jwk', key);
const importKey = async (jwk) => await crypto.subtle.importKey('jwk', jwk, { name: CRYPTO_ALGO }, true, ['encrypt', 'decrypt']);
const encryptChunk = async (chunk, key) => {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encryptedData = await crypto.subtle.encrypt({ name: CRYPTO_ALGO, iv }, key, chunk);
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);
    return combined.buffer;
};
const decryptChunk = async (data, key) => {
    const iv = data.slice(0, IV_LENGTH);
    const encryptedData = data.slice(IV_LENGTH);
    return await crypto.subtle.decrypt({ name: CRYPTO_ALGO, iv }, key, encryptedData);
};
// --- End Crypto Helpers ---


// WebRTC configuration
const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.services.mozilla.com' }],
};
const CHUNK_SIZE = 64 * 1024; // 64 KB


// --- State Management and UI Rendering ---
function setState(newState) {
    state = { ...state, ...newState };
    render();
}

function render() {
    // Error
    dom.errorText.textContent = state.error || '';
    dom.errorText.classList.toggle('hidden', !state.error);

    // Tabs
    dom.sendTab.classList.toggle('active', state.mode === 'send');
    dom.receiveTab.classList.toggle('active', state.mode === 'receive');
    dom.senderView.classList.toggle('hidden', state.mode !== 'send');
    dom.receiverView.classList.toggle('hidden', state.mode !== 'receive');

    // Views based on mode and status
    const show = (element) => element.classList.remove('hidden');
    const hide = (element) => element.classList.add('hidden');

    if (state.mode === 'send') {
        hide(dom.senderIdleState);
        hide(dom.senderWaitingState);
        hide(dom.senderBroadcastState);
        hide(dom.progressView);
        
        switch(state.status) {
            case 'idle':
                show(dom.senderIdleState);
                dom.broadcastToggle.checked = state.broadcastMode;
                if (state.files.length > 0) {
                    show(dom.fileListView);
                    hide(dom.dropzone);
                    renderFileList();
                } else {
                    hide(dom.fileListView);
                    show(dom.dropzone);
                }
                dom.generateTicketBtn.disabled = state.files.length === 0;
                dom.generateTicketBtn.textContent = state.broadcastMode ? 'Start Broadcast Session' : 'Generate Secure Ticket';
                break;
            case 'generating':
                show(dom.senderIdleState);
                dom.generateTicketBtn.textContent = 'Generating...';
                dom.generateTicketBtn.disabled = true;
                break;
            case 'waiting':
                show(dom.senderWaitingState);
                break;
            case 'broadcasting':
                show(dom.senderBroadcastState);
                renderPeerList();
                break;
            case 'connecting':
            case 'transferring':
            case 'complete':
                show(dom.progressView);
                renderProgress();
                break;
        }

    } else { // Receive mode
        hide(dom.receiverIdleState);
        hide(dom.receiverAnsweringState);
        hide(dom.receiverPreviewState);
        hide(dom.progressView);
        
        switch(state.status) {
            case 'idle':
                show(dom.receiverIdleState);
                dom.receiverConnectBtn.disabled = !dom.receiverOfferInput.value;
                dom.receiverConnectBtn.textContent = 'Connect';
                break;
            case 'connecting':
                show(dom.receiverIdleState);
                dom.receiverConnectBtn.textContent = 'Connecting...';
                dom.receiverConnectBtn.disabled = true;
                break;
            case 'answering':
                show(dom.receiverAnsweringState);
                break;
            case 'connected':
            case 'preview':
                show(dom.receiverPreviewState);
                if (state.files.length > 0) {
                    show(dom.receiverFileListView);
                    renderReceiverFileList();
                } else {
                    hide(dom.receiverFileListView);
                }
                break;
            case 'transferring':
            case 'complete':
                show(dom.progressView);
                renderProgress();
                break;
        }
    }
    
    // Modal
    dom.modalBackdrop.classList.toggle('hidden', !state.modalTicket);
    if(state.modalTicket) {
        dom.modalTicketOffer.value = state.modalTicket.offer || '';
    }
}

function renderFileList() {
    const totalSize = state.files.reduce((acc, file) => acc + file.size, 0);
    dom.fileListInfo.textContent = `${state.files.length} items selected (${formatBytes(totalSize)})`;
    dom.fileList.innerHTML = '';
    state.files.forEach(file => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
            <span class="file-name">${file.webkitRelativePath || file.name}</span>
            <span class="file-size">${formatBytes(file.size)}</span>
        `;
        dom.fileList.appendChild(li);
    });
}
function renderReceiverFileList() {
    const totalSize = state.files.reduce((acc, file) => acc + file.size, 0);
    dom.receiverFileListInfo.textContent = `${state.files.length} items incoming (${formatBytes(totalSize)})`;
    dom.receiverFileList.innerHTML = '';
    state.files.forEach(file => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
            <span class="file-name">${file.name}</span>
            <span class="file-size">${formatBytes(file.size)}</span>
        `;
        dom.receiverFileList.appendChild(li);
    });
}

function renderPeerList() {
    dom.recipientCount.textContent = `RECIPIENTS (${state.peers.length})`;
    dom.peerList.innerHTML = '';
    state.peers.forEach(peer => {
        const li = document.createElement('li');
        li.className = 'peer-item';
        const color = peer.status === 'Connected' ? '#4CAF50' : 'var(--primary-color)';
        li.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            Recipient #${peer.id + 1}
            <span class="peer-status" style="color: ${color};">${peer.status}</span>
        `;
        dom.peerList.appendChild(li);
    });
    const connectedPeers = state.peers.filter(p => p.status === 'Connected').length;
    dom.broadcastSendBtn.textContent = `Broadcast to ${connectedPeers} Recipient(s)`;
    dom.broadcastSendBtn.disabled = connectedPeers === 0;
}

function renderProgress() {
    const totalSize = state.files.reduce((acc, file) => acc + file.size, 0);
    dom.progressTotalSize.textContent = formatBytes(totalSize);
    dom.progressBarInner.style.width = `${state.progress}%`;
    dom.progressPercentage.textContent = `${state.progress}%`;

    if (state.status === 'complete') {
        dom.progressStatusText.textContent = state.mode === 'send' ? 'Transfer Complete!' : 'Download Complete!';
        dom.shareMoreBtn.textContent = state.mode === 'send' ? 'Share More Files' : 'Receive More Files';
        dom.shareMoreBtn.classList.remove('hidden');
        if (state.mode === 'receive') {
            dom.completeText.textContent = 'Files saved with full path in your downloads folder.';
            dom.completeText.classList.remove('hidden');
        }
    } else if (state.status === 'transferring') {
        const peerCount = state.broadcastMode ? `${state.peers.length} peers` : '1 peer';
        dom.progressStatusText.textContent = state.mode === 'send' ? `Sending to ${peerCount}` : 'Downloading...';
    } else { // connecting
        dom.progressStatusText.textContent = `Connecting to peer...`;
    }
}


// --- Core Logic ---
let peerConnections = new Map();
let cryptoKey = null;
let receivedChunks = [];
let currentFileReceiving = { index: 0, receivedSize: 0 };
let nextPeerId = 0;

function cleanup() {
    peerConnections.forEach(({ pc, dc }) => {
        if (dc) dc.close();
        if (pc) pc.close();
    });
    peerConnections.clear();
    cryptoKey = null;
    receivedChunks = [];
    currentFileReceiving = { index: 0, receivedSize: 0 };
}

function reset() {
    cleanup();
    setState({ ...initialState, mode: state.mode });
}

function setupPeerConnection(isSender, peerId) {
    const pc = new RTCPeerConnection(rtcConfig);
    const connection = { pc, dc: null, isConnected: false };
    peerConnections.set(peerId, connection);

    const iceCandidates = [];
    let ticketCreated = false;
    let iceGatheringTimeout = null;
    
    const createTicketNow = async () => {
        if (ticketCreated) return;
        ticketCreated = true;
        if (iceGatheringTimeout) clearTimeout(iceGatheringTimeout);

        try {
            if(isSender) {
                 if (state.broadcastMode) {
                    const offerTicket = btoa(JSON.stringify({ sdp: pc.localDescription, ice: iceCandidates, key: state.modalTicket.key }));
                    setState({ modalTicket: {...state.modalTicket, offer: offerTicket} });
                    // Update peer status
                    const newPeers = state.peers.map(p => p.id === peerId ? {...p, status: 'Waiting for Answer'} : p);
                    setState({ peers: newPeers });
                 } else {
                    const key = await exportKey(cryptoKey);
                    dom.senderOfferTicket.value = btoa(JSON.stringify({ sdp: pc.localDescription, ice: iceCandidates, key }));
                 }
            } else { // is receiver
                dom.receiverAnswerTicket.value = btoa(JSON.stringify({ sdp: pc.localDescription, ice: iceCandidates }));
            }
        } catch(e) {
            console.error("Error creating ticket:", e);
            setState({ error: "Failed to create ticket. Please try again." });
        }
    };
    
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            iceCandidates.push(event.candidate);
            if (iceGatheringTimeout) clearTimeout(iceGatheringTimeout);
            iceGatheringTimeout = setTimeout(createTicketNow, 500);
        } else {
            createTicketNow();
        }
    };
    
    pc.onconnectionstatechange = () => {
         if (pc.connectionState === 'connected') {
            setState({ error: '' });
            if(!isSender) setState({ status: 'connected' });
            else {
                const newPeers = state.peers.map(p => p.id === peerId ? {...p, status: 'Connected'} : p);
                setState({ peers: newPeers });
            }
         }
         if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            setState({ error: `Connection with peer ${peerId} failed.` });
            const newPeers = state.peers.filter(p => p.id !== peerId);
            setState({ peers: newPeers });
            peerConnections.delete(peerId);
         }
    };

    if (isSender) {
        const dc = pc.createDataChannel('file-transfer');
        connection.dc = dc;
        dc.onopen = () => {
            if (!state.broadcastMode) {
                sendFiles();
            }
        };
    } else { // is receiver
        pc.ondatachannel = (event) => {
            const dc = event.channel;
            connection.dc = dc;
            dc.onopen = () => setState({ status: 'connected' });
            dc.onmessage = handleDataMessage;
            dc.onclose = reset;
        };
    }
    return pc;
}

async function handleDataMessage(event) {
    try {
        if (typeof event.data === 'string') {
            const { type, payload } = JSON.parse(event.data);
            if (type === 'metadata') {
                setState({ files: payload.files, status: 'preview' });
            } else if (type === 'done') {
                setState({ status: 'complete' });
            }
        } else { // Encrypted file chunk
            if (!cryptoKey) throw new Error("Encryption key not available.");
            const decryptedChunk = await decryptChunk(event.data, cryptoKey);
            
            receivedChunks.push(decryptedChunk);
            const currentFile = state.files[currentFileReceiving.index];
            currentFileReceiving.receivedSize += decryptedChunk.byteLength;
            
            const totalReceived = state.files.slice(0, currentFileReceiving.index).reduce((acc, f) => acc + f.size, 0) + currentFileReceiving.receivedSize;
            const totalSize = state.files.reduce((acc, f) => acc + f.size, 0);
            setState({ progress: Math.round((totalReceived / totalSize) * 100) });

            if (currentFileReceiving.receivedSize === currentFile.size) {
                 const blob = new Blob(receivedChunks, { type: currentFile.type });
                 const url = URL.createObjectURL(blob);
                 const a = document.createElement('a');
                 a.href = url;
                 a.download = currentFile.name.replace(/\//g, '_');
                 document.body.appendChild(a);
                 a.click();
                 a.remove();
                 URL.revokeObjectURL(url);
                 
                 receivedChunks = [];
                 currentFileReceiving.index++;
                 currentFileReceiving.receivedSize = 0;
            }
        }
    } catch(e) {
        setState({ error: "Decryption failed. The ticket might be invalid or corrupted." });
        reset();
    }
}

async function sendFiles() {
    const channels = Array.from(peerConnections.values()).map(p => p.dc).filter(Boolean);
    if (channels.length === 0) return;
    setState({ status: 'transferring' });

    const filesMetadata = state.files.map(f => ({ name: f.webkitRelativePath || f.name, size: f.size, type: f.type }));
    const metadataMessage = JSON.stringify({ type: 'metadata', payload: { files: filesMetadata } });
    channels.forEach(dc => dc.send(metadataMessage));
    
    await new Promise(resolve => setTimeout(resolve, 500));
    if (!cryptoKey) {
        setState({ error: "Encryption key not available for sending." });
        return;
    }
    
    const totalSize = state.files.reduce((acc, f) => acc + f.size, 0);

    for (const file of state.files) {
        const fileBuffer = await file.arrayBuffer();
        for (let offset = 0; offset < fileBuffer.byteLength; offset += CHUNK_SIZE) {
            const chunk = fileBuffer.slice(offset, offset + CHUNK_SIZE);
            const encryptedChunk = await encryptChunk(chunk, cryptoKey);
            
            for(const dc of channels) {
                while (dc.bufferedAmount > dc.bufferedAmountLowThreshold) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                dc.send(encryptedChunk);
            }
            const totalSent = state.files.slice(0, state.files.indexOf(file)).reduce((acc, f) => acc + f.size, 0) + offset + chunk.byteLength;
            setState({ progress: Math.round((totalSent / totalSize) * 100) });
        }
    }
    
    channels.forEach(dc => dc.send(JSON.stringify({type: 'done'})));
    setState({ status: 'complete' });
}


// --- Event Handlers ---
function handleFileChange(event) {
    if (!event.target.files) return;
    const selectedFiles = Array.from(event.target.files);
    setState({ files: [...state.files, ...selectedFiles] });
    event.target.value = ''; // Allow selecting same file/folder again
}

async function handleGenerateTicket() {
    if (state.files.length === 0) {
        setState({ error: "Please select files to share first." });
        return;
    };
    setState({ error: '', status: 'generating' });
    try {
        cryptoKey = await generateEncryptionKey();
        const pc = setupPeerConnection(true, 0); // peerId 0 for non-broadcast
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        setState({ status: 'waiting' });
    } catch (e) {
        setState({ error: 'Failed to create connection offer.' });
        reset();
    }
}

async function handleSenderConnect() {
    const answerTicket = dom.senderAnswerInput.value;
    if (!answerTicket) {
        setState({ error: 'Please paste the receiver\'s ticket.' });
        return;
    }
    try {
        const answer = JSON.parse(atob(answerTicket));
        const { pc } = peerConnections.get(0);
        await pc.setRemoteDescription(new RTCSessionDescription(answer.sdp));
        answer.ice.forEach(candidate => pc.addIceCandidate(new RTCIceCandidate(candidate)));
        setState({ status: 'connecting' });
    } catch(e) {
         setState({ error: 'Invalid answer ticket. Please try again.' });
    }
}

async function handleReceiveConnect() {
    const ticket = dom.receiverOfferInput.value;
    if (!ticket) {
        setState({ error: 'Please paste a ticket to connect.' });
        return;
    }
    setState({ status: 'connecting' });
    try {
        const { sdp, ice, key } = JSON.parse(atob(ticket));
        cryptoKey = await importKey(key);
        
        const pc = setupPeerConnection(false, 0);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        ice.forEach(candidate => pc.addIceCandidate(new RTCIceCandidate(candidate)));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        setState({ status: 'answering' });
    } catch (e) {
        setState({ error: 'Invalid ticket or connection failed.' });
        reset();
    }
}

async function handleStartBroadcast() {
    if (state.files.length === 0) return;
    cryptoKey = await generateEncryptionKey();
    setState({ status: 'broadcasting' });
}

async function handleAddRecipient() {
    const peerId = nextPeerId++;
    const newPeers = [...state.peers, {id: peerId, status: 'Generating Ticket...'}];
    setState({ peers: newPeers });
    
    const jwk = await exportKey(cryptoKey);
    setState({ modalTicket: { key: jwk, offer: null, peerId } });
    
    const pc = setupPeerConnection(true, peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
}

async function handlePeerAnswer() {
    const answerTicket = dom.broadcastAnswerInput.value;
    if (!answerTicket) {
        setState({ error: 'Please paste the receiver\'s ticket.' });
        return;
    }
    try {
        const answer = JSON.parse(atob(answerTicket));
        const peer = state.peers.find(p => p.status === 'Waiting for Answer');
        if (!peer) {
            setState({ error: 'No recipient is currently waiting for an answer.' });
            return;
        }
        const { pc } = peerConnections.get(peer.id);
        await pc.setRemoteDescription(new RTCSessionDescription(answer.sdp));
        answer.ice.forEach(candidate => pc.addIceCandidate(new RTCIceCandidate(candidate)));
        
        const newPeers = state.peers.map(p => p.id === peer.id ? {...p, status: 'Connecting...'} : p);
        setState({ peers: newPeers });
        dom.broadcastAnswerInput.value = '';
    } catch(e) {
         setState({ error: 'Invalid answer ticket. Please try again.' });
    }
}


// --- Utility and Initialization ---
function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function init() {
    // Tab switching
    dom.sendTab.addEventListener('click', () => {
        reset();
        setState({ mode: 'send' });
    });
    dom.receiveTab.addEventListener('click', () => {
        reset();
        setState({ mode: 'receive' });
    });
    
    // File selection
    dom.selectFilesBtn.addEventListener('click', () => dom.fileInput.click());
    dom.selectFolderBtn.addEventListener('click', () => dom.folderInput.click());
    dom.fileInput.addEventListener('change', handleFileChange);
    dom.folderInput.addEventListener('change', handleFileChange);
    dom.clearFilesBtn.addEventListener('click', () => setState({ files: [] }));
    
    // Drag and Drop
    dom.dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dom.dropzone.classList.add('active'); });
    dom.dropzone.addEventListener('dragleave', () => dom.dropzone.classList.remove('active'));
    dom.dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dom.dropzone.classList.remove('active');
        if (e.dataTransfer.files) {
            setState({ files: [...state.files, ...Array.from(e.dataTransfer.files)] });
        }
    });

    // Main action buttons
    dom.broadcastToggle.addEventListener('change', (e) => setState({ broadcastMode: e.target.checked }));
    dom.generateTicketBtn.addEventListener('click', () => state.broadcastMode ? handleStartBroadcast() : handleGenerateTicket());
    dom.senderConnectBtn.addEventListener('click', handleSenderConnect);
    dom.receiverOfferInput.addEventListener('input', (e) => dom.receiverConnectBtn.disabled = !e.target.value);
    dom.receiverConnectBtn.addEventListener('click', handleReceiveConnect);
    dom.addRecipientBtn.addEventListener('click', handleAddRecipient);
    dom.broadcastAnswerInput.addEventListener('input', e => dom.broadcastConnectBtn.disabled = !e.target.value);
    dom.broadcastConnectBtn.addEventListener('click', handlePeerAnswer);
    dom.broadcastSendBtn.addEventListener('click', sendFiles);


    // Copy buttons
    dom.copyOfferBtn.addEventListener('click', () => navigator.clipboard.writeText(dom.senderOfferTicket.value));
    dom.copyAnswerBtn.addEventListener('click', () => navigator.clipboard.writeText(dom.receiverAnswerTicket.value));
    dom.modalCopyBtn.addEventListener('click', () => navigator.clipboard.writeText(dom.modalTicketOffer.value));

    // Modal
    dom.modalCloseBtn.addEventListener('click', () => setState({ modalTicket: null }));
    
    // Cancel/Reset buttons
    dom.cancelBtns.forEach(btn => btn.addEventListener('click', reset));
    dom.shareMoreBtn.addEventListener('click', reset);
    
    // Initial setup
    reset();
}

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}
init();