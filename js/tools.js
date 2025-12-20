let audioCtx;
let activeSource = null;
let activeGain = null;
let isPlaying = false;
let currentType = null;

// --- AUDIO ENGINE ---
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function createNoiseBuffer(type) {
    if (!audioCtx) return null;
    const bufferSize = audioCtx.sampleRate * 2; // 2 seconds buffer
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        
        if (type === 'white') {
            output[i] = white;
        } else if (type === 'pink') {
            let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            b6 = white * 0.115926;
            output[i] *= 0.11; 
        } else if (type === 'brown') {
            let lastOut = 0;
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5; 
        }
    }
    return buffer;
}

function toggleNoise(type, volumeEl) {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // If clicking same button, toggle off
    if (isPlaying && currentType === type) {
        stopNoise();
        return false;
    }

    if (isPlaying) {
        stopNoise();
    }

    activeSource = audioCtx.createBufferSource();
    activeSource.buffer = createNoiseBuffer(type);
    if (!activeSource.buffer) return false;

    activeSource.loop = true;
    
    activeGain = audioCtx.createGain();
    activeGain.gain.value = parseFloat(volumeEl.value);
    
    activeSource.connect(activeGain);
    activeGain.connect(audioCtx.destination);
    activeSource.start();
    
    isPlaying = true;
    currentType = type;
    return true;
}

function stopNoise() {
    if (activeSource) {
        try { activeSource.stop(); activeSource.disconnect(); } catch (e) {}
    }
    if (activeGain) {
        try { activeGain.disconnect(); } catch (e) {}
    }
    activeSource = null;
    activeGain = null;
    isPlaying = false;
    currentType = null;
}

function setVolume(val) {
    if (activeGain) {
        activeGain.gain.value = val;
    }
}

/// --- BREATHING PACER LOGIC ---
let breathingInterval;
let currentVisualMode = 'orb'; // 'orb' or 'lotus'
let breathStartTime = 0; 

function generateLotus(container) {
    container.innerHTML = '<div class="orb-layer orb-core"></div>'; 
    for(let i = 0; i < 8; i++) {
        const petal = document.createElement('div');
        petal.className = 'lotus-petal';
        petal.style.setProperty('--r', (i * 45) + 'deg'); 
        container.appendChild(petal);
    }
}

function generateOrb(container) {
    container.innerHTML = `
        <div class="orb-layer orb-glow"></div>
        <div class="orb-layer orb-ring"></div>
        <div class="orb-layer orb-core"></div>
    `;
}

function toggleVisualMode(visualContainer, btn) {
    if (currentVisualMode === 'orb') {
        currentVisualMode = 'lotus';
        document.getElementById('breathing-card-container').classList.add('style-lotus');
        generateLotus(visualContainer);
        btn.textContent = "Style: Lotus";
    } else {
        currentVisualMode = 'orb';
        document.getElementById('breathing-card-container').classList.remove('style-lotus');
        generateOrb(visualContainer);
        btn.textContent = "Style: Orb";
    }

    if (breathingInterval) {
        const elapsed = Date.now() - breathStartTime;
        const cycleDuration = 16000; 
        const currentOffset = elapsed % cycleDuration;
        const animatedElements = visualContainer.querySelectorAll('.orb-layer, .lotus-petal');
        animatedElements.forEach(el => {
            el.style.animationDelay = `-${currentOffset}ms`;
        });
    }
}

function toggleBreathing(container, label) {
    const body = document.body;
    
    if (breathingInterval) {
        // Stop
        clearInterval(breathingInterval);
        breathingInterval = null;
        container.classList.remove('breathing-active');
        body.classList.remove('breathing-mode'); 
        label.textContent = "Tap to Center";
        label.style.opacity = "0.8";
    } else {
        // Start
        container.classList.add('breathing-active');
        body.classList.add('breathing-mode'); 
        
        // --- FIX: Force Reset Animation Alignment ---
        const animatedElements = document.querySelectorAll('.orb-layer, .lotus-petal');
        animatedElements.forEach(el => el.style.animationDelay = '0s');
        // --------------------------------------------

        breathStartTime = Date.now(); 
        
        const updateText = () => {
            const cycleTime = 16000; 
            const elapsed = (Date.now() - breathStartTime) % cycleTime; 
            
            if (elapsed < 4000) {
                label.textContent = "Inhale...";
                label.style.opacity = "1";
            } else if (elapsed < 8000) {
                label.textContent = "Hold (Full)";
                label.style.opacity = "0.7";
            } else if (elapsed < 12000) {
                label.textContent = "Exhale...";
                label.style.opacity = "0.5";
            } else {
                label.textContent = "Hold (Empty)";
                label.style.opacity = "0.7";
            }
        };

        updateText(); 
        breathingInterval = setInterval(updateText, 100);
    }
}

export function initToolsListeners() {
    const btnBrown = document.getElementById('noise-brown');
    const btnPink = document.getElementById('noise-pink');
    const btnWhite = document.getElementById('noise-white');
    const btnStop = document.getElementById('noise-stop');
    const volSlider = document.getElementById('noise-volume');
    
    const updateBtns = () => {
        if(btnBrown) btnBrown.classList.toggle('active', currentType === 'brown');
        if(btnPink) btnPink.classList.toggle('active', currentType === 'pink');
        if(btnWhite) btnWhite.classList.toggle('active', currentType === 'white');
    };

    const handleNoiseClick = (type) => { toggleNoise(type, volSlider); updateBtns(); };
    
    if(btnBrown) btnBrown.addEventListener('click', () => handleNoiseClick('brown'));
    if(btnPink) btnPink.addEventListener('click', () => handleNoiseClick('pink'));
    if(btnWhite) btnWhite.addEventListener('click', () => handleNoiseClick('white'));
    if(btnStop) btnStop.addEventListener('click', () => { stopNoise(); updateBtns(); });
    if(volSlider) volSlider.addEventListener('input', (e) => setVolume(e.target.value));

    const breathTrigger = document.getElementById('breathing-trigger');
    const breathLabel = document.getElementById('breathing-label');
    const visualContainer = document.getElementById('visual-container');
    const styleBtn = document.getElementById('btn-style-toggle');
    
    if(breathTrigger && breathLabel) {
        breathTrigger.addEventListener('click', () => toggleBreathing(breathTrigger, breathLabel));
    }

    if(styleBtn && visualContainer) {
        styleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            toggleVisualMode(visualContainer, styleBtn);
        });
    }
}