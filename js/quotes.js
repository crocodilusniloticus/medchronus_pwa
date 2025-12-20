// --- CONFIGURATION ---
const CHANGE_EVERY_MINUTES = 20; 

// 1. YOUR HAND-PICKED ELITE LIST (Always included + New AI Giants)
const MANUAL_QUOTES = [
    // Original Classics
    { text: "Ata Arab is a sick Nigga", author: "Albert Halvaei" },    
    { text: "The only easy day was yesterday.", author: "Reza Sheibani" },
    { text: "It is not the mountain we conquer, but ourselves.", author: "Edmund Hillary" },
    { text: "Civilize the mind, but make savage the body.", author: "Chairman Mao" },
    { text: "Discipline equals freedom.", author: "Jocko Willink" },
    { text: "Medicine is a science of uncertainty and an art of probability.", author: "William Osler" },
    { text: "To win any battle, you must fight as if you are already dead.", author: "Miyamoto Musashi" },
    
    // New Tech & AI Giants
    { text: "Intelligence is the ultimate compounding asset.", author: "Sam Altman" },
    { text: "The more you buy, the more you save.", author: "Jensen Huang" },
    { text: "Software is eating the world, but AI is eating software.", author: "Jensen Huang" },
    { text: "You have to be right about something that most people are wrong about.", author: "Peter Thiel" },
    { text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
    { text: "Specific knowledge cannot be taught, but it can be learned.", author: "Naval Ravikant" },
    { text: "Play long-term games with long-term people.", author: "Naval Ravikant" },
    { text: "We are building the brain of the future.", author: "Demis Hassabis" },
    { text: "Move fast and break things.", author: "Mark Zuckerberg" },
    { text: "The biggest risk is not taking any risk.", author: "Mark Zuckerberg" }
];

// 2. THE KEYWORD ENGINE
const KEYWORDS = {
    WARRIOR: [
        "discipline", "glory", "conquer", "enemy", "sweat", "iron", 
        "steel", "endure", "pain", "struggle", "victory", "defeat", 
        "courage", "willpower", "fight", "battle", "training", "limit",
        "resilience", "hardship", "warrior"
    ],
    SCIENCE: [
        "science", "universe", "logic", "mathematics", "truth", 
        "knowledge", "curiosity", "experiment", "discovery", "reason", 
        "atom", "physics", "biology", "observe", "theory", "fact",
        "research", "evidence", "engineer"
    ],
    INNOVATION: [
        "future", "invent", "technology", "machine", "design", 
        "impossible", "progress", "create", "build", "vision", 
        "solution", "problem", "idea", "genius", "success", "fail",
        "code", "develop", "software", "algorithm", "intelligence", 
        "compute", "scale", "startup", "product"
    ],
    STUDY: [
        "book", "learn", "read", "mind", "brain", "focus", 
        "understand", "educate", "school", "scholar", "wisdom",
        "intelligence", "practice"
    ]
};

const ALL_KEYWORDS = [
    ...KEYWORDS.WARRIOR, 
    ...KEYWORDS.SCIENCE, 
    ...KEYWORDS.INNOVATION, 
    ...KEYWORDS.STUDY
];

// 3. THE HALL OF FAME (Added Modern Tech Figures)
const ELITE_AUTHORS = [
    // History & Science
    "Sun Tzu", "Marcus Aurelius", "Bruce Lee", "Miyamoto Musashi", "Napoleon", 
    "Winston Churchill", "Alexander the Great", "David Goggins",
    "Albert Einstein", "Isaac Newton", "Marie Curie", "Charles Darwin", 
    "Stephen Hawking", "Richard Feynman", "Carl Sagan", "Galileo", "Nikola Tesla",
    "Leonardo da Vinci", "Thomas Edison", "Henry Ford", "Aristotle", "Socrates",
    
    // Tech, AI & Startups
    "Steve Jobs", "Bill Gates", "Elon Musk", "Alan Turing", 
    "Sam Altman", "Jensen Huang", "Satya Nadella", "Sundar Pichai", 
    "Demis Hassabis", "Yann LeCun", "Geoffrey Hinton", "Andrew Ng",
    "Peter Thiel", "Paul Graham", "Marc Andreessen", "Naval Ravikant",
    "Vitalik Buterin", "Satoshi Nakamoto", "Jeff Bezos", "Larry Page"
];

let state = {
    quotes: [],
    container: null
};

function getSeededIndex(seed, arrayLength) {
    const a = 1664525;
    const c = 1013904223;
    const m = 4294967296; 
    let randomVal = (a * seed + c) % m;
    return Math.floor((randomVal / m) * arrayLength);
}

function getCurrentQuote() {
    if (!state.quotes || state.quotes.length === 0) return MANUAL_QUOTES[0];
    const now = Date.now();
    const intervalMs = CHANGE_EVERY_MINUTES * 60 * 1000;
    const timeSlotIndex = Math.floor(now / intervalMs);
    const index = getSeededIndex(timeSlotIndex, state.quotes.length);
    return state.quotes[index];
}

// Helper: Tries to fetch from a URL, returns null if fails
async function tryFetch(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(response.status);
        return await response.json();
    } catch (e) {
        // Silenced error logging
        return null;
    }
}

async function fetchAndFilterQuotes() {
    // SOURCE A: The "DWYL" massive list (General + History)
    // SOURCE B: JamesFT (Stable, Science/Tech focus)
    const sourceA = 'https://raw.githubusercontent.com/dwyl/quotes/main/quotes.json';
    const sourceB = 'https://raw.githubusercontent.com/JamesFT/Database-Quotes-JSON/master/quotes.json';

    let rawData = [];

    // Try Source A
    let dataA = await tryFetch(sourceA);
    if (dataA) {
        rawData = rawData.concat(dataA);
    }

    // Try Source B (Append to A)
    let dataB = await tryFetch(sourceB);
    if (dataB) {
        rawData = rawData.concat(dataB);
    }

    if (rawData.length === 0) {
        state.quotes = MANUAL_QUOTES;
        render();
        return;
    }

    // --- FILTERING ---
    const minedQuotes = rawData.filter(q => {
        // Normalize keys (supports standard keys AND JamesFT keys)
        const text = (q.text || q.body || q.content || q.en || q.quoteText || "").trim();
        const author = (q.author || q.quoteAuthor || "").toLowerCase();

        // 1. STRICT LENGTH CHECK (< 90 characters)
        if (text.length >= 120 || text.length === 0) return false;

        // 2. Keep Elite Authors
        const isElite = ELITE_AUTHORS.some(elite => author.includes(elite.toLowerCase()));
        if (isElite) return true;

        // 3. Scan for Topics
        const hasKeyword = ALL_KEYWORDS.some(word => text.toLowerCase().includes(word));
        
        // 4. Remove "Noise" (Specific off-topic constraints)
        const isNoise = text.toLowerCase().includes("marriage") || 
                        text.toLowerCase().includes("gardening") ||
                        (text.toLowerCase().includes("love") && !text.toLowerCase().includes("science") && !text.toLowerCase().includes("learning"));

        return hasKeyword && !isNoise;
    }).map(q => ({
        // Map any valid key to our standard 'text' and 'author'
        text: q.text || q.body || q.content || q.en || q.quoteText, 
        author: q.author || q.quoteAuthor || "Unknown"
    }));

    // Combine and apply length filter to manual quotes as well, just in case
    const finalPool = [...MANUAL_QUOTES, ...minedQuotes].filter(q => q.text.length < 90);
    
    // Shuffle
    finalPool.sort(() => Math.random() - 0.5);

    // Save
    localStorage.setItem('cachedQuotes_Study_v6', JSON.stringify(finalPool));
    state.quotes = finalPool;
    render(); 
}

function render() {
    if (!state.container) return;
    const quote = getCurrentQuote();
    
    const currentText = state.container.querySelector('.quote-text')?.textContent;
    if (currentText === `"${quote.text}"`) return;

    state.container.style.opacity = '0';
    setTimeout(() => {
        state.container.innerHTML = `
            <div class="quote-text">"${quote.text}"</div>
            <div class="quote-author">— ${quote.author}</div>
        `;
        state.container.style.opacity = '1';
    }, 300);
}

export function init(containerId) {
    state.container = document.getElementById(containerId);
    if (!state.container) return;

    // Clear old broken caches
    ['cachedQuotes_Study_v1', 'cachedQuotes_Study_v2', 'cachedQuotes_Study_v3', 'cachedQuotes_Study_v4', 'cachedQuotes_Study_v5'].forEach(k => localStorage.removeItem(k));

    // Load Cache
    const cached = localStorage.getItem('cachedQuotes_Study_v6');
    if (cached) {
        state.quotes = JSON.parse(cached);
        render(); 
    } else {
        state.quotes = MANUAL_QUOTES.filter(q => q.text.length < 90);
        render(); 
    }

    if (navigator.onLine) fetchAndFilterQuotes();
    setInterval(render, 1000); 
}