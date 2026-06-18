import html2canvas from 'html2canvas';
import gifshot from 'gifshot';

// ─── Discord Configuration ──────────────────────────────────────
const DISCORD_CLIENT_ID = '1517138500485513417';
const DISCORD_GUILD_ID  = '1343751435711414362';
const STATS_API_URL     = 'http://localhost:3000'; // Admin: Set your bot VPS API URL here (e.g. http://123.45.67.89:3000)

// Mapping of Discord Role ID -> Role key (mag1 to mag9, leader, administrator)
// Admin can adjust these keys based on their live Discord server role IDs.
const DISCORD_ROLE_MAP = {
    "1343751435711414363": "mag1",
    "1343751435711414364": "mag2",
    "1343751435711414365": "mag3",
    "1343751435711414366": "mag4",
    "1343751435711414367": "mag5",
    "1343751435711414368": "mag6",
    "1343751435711414369": "mag7",
    "1343751435711414370": "mag8",
    "1343751435711414371": "mag9",
    "1343751435711414372": "leader",
    "1343751435711414373": "administrator"
};

// ─── DOM ───────────────────────────────────────────────────────
const cardUsername      = document.getElementById('card-username');
const discordConnectBtn = document.getElementById('discord-connect-btn');
const discordStatus     = document.getElementById('discord-status');
const cardRoleTitle     = document.getElementById('card-role-title');
const cardSerial        = document.getElementById('card-serial');
const seismicCard       = document.getElementById('seismic-card');
const cardAvatar        = document.getElementById('card-avatar');
const avatarPlaceholder = document.getElementById('avatar-placeholder');
const cardStamp         = document.getElementById('card-stamp');
const downloadBtn       = document.getElementById('download-btn');
const downloadGifBtn    = document.getElementById('download-gif-btn');

const inputMessages = document.getElementById('input-messages');
const inputTweets   = document.getElementById('input-tweets');
const inputEvents   = document.getElementById('input-events');
const inputArt      = document.getElementById('input-art');

const cardValMessages = document.getElementById('card-val-messages');
const cardValTweets   = document.getElementById('card-val-tweets');
const cardValEvents   = document.getElementById('card-val-events');
const cardValArt      = document.getElementById('card-val-art');

// ─── Role Colors ────────────────────────────────────────────────
const ROLE_COLORS = {
    mag1:      { hex: '#dfc086', rgb: '223, 192, 134' },
    mag2:      { hex: '#4fc397', rgb: '79, 195, 151' },
    mag3:      { hex: '#10e566', rgb: '16, 229, 102' },
    mag4:      { hex: '#86e245', rgb: '134, 226, 69' },
    mag5:      { hex: '#a6b70f', rgb: '166, 183, 15' },
    mag6:      { hex: '#e5b800', rgb: '229, 184, 0' },
    mag7:      { hex: '#f37021', rgb: '243, 112, 33' },
    mag8:      { hex: '#ff0000', rgb: '255, 0, 0' },
    mag9:      { hex: '#00d8ff', rgb: '0, 216, 255' },
    leader:    { hex: '#965a38', rgb: '150, 90, 56' },
    administrator: { hex: '#9b59b6', rgb: '155, 89, 182' },
};

const STAMPS = { seismic: '/seismic.png', golem: '/golem.gif' };
const crystalImg = new Image();
crystalImg.src = '/crystal.png';
const defaultAvatarImg = new Image();
defaultAvatarImg.src = '/default_avatar.png';

// ─── Animation State ────────────────────────────────────────────
// Rings (JS-driven so html2canvas captures the actual rotation each frame)
let ring1Angle = 0;   // degrees
let ring2Angle = 0;
// Scanline position (0–100 %)
let scanlinePos = 0;
// Particles
const PARTICLES_COUNT = 8;
const particlesList = [];

function generateParticles() {
    particlesList.length = 0;
    for (let i = 0; i < PARTICLES_COUNT; i++) {
        // Alternate left (5%-27%) and right (73%-95%) to stay in the empty spaces away from avatar
        const isLeft = i % 2 === 0;
        const left = isLeft ? (5 + Math.random() * 22) : (73 + Math.random() * 22);
        const baseTop = 15 + Math.random() * 65; // 15% to 80%
        const delay = Math.random() * 4.0;
        const duration = 2.5 + Math.random() * 2.0; // 2.5s to 4.5s
        const maxY = 35 + Math.random() * 20; // 35px to 55px rise
        particlesList.push({ left, baseTop, delay, duration, maxY });
    }
}
generateParticles();

function initHtmlParticles() {
    const container = document.querySelector('.pixel-particles');
    if (!container) return;
    container.innerHTML = '';
    particlesList.forEach(p => {
        const el = document.createElement('div');
        el.className = 'part';
        el.style.left = `${p.left}%`;
        el.style.top = `${p.baseTop}%`;
        // Negative animation delay makes the animation start mid-way immediately
        el.style.animationDelay = `-${p.delay}s`;
        el.style.animationDuration = `${p.duration}s`;
        container.appendChild(el);
    });
}

// Global state
let currentUsername = 'seismic_mag';
let activeStamp     = 'seismic';
let avatarDebounce  = null;
let currentThemeHex = '#a0522d';
let currentThemeRgb = '160, 82, 45';

// CSS Animations handle preview movement; JS remains solely for deterministic canvas renders (GIF/PNG).

// ─── Theme ─────────────────────────────────────────────────────
function applyTheme(hex, rgb) {
    currentThemeHex = hex;
    currentThemeRgb = rgb;
    const glow = `rgba(${rgb}, 0.42)`;
    seismicCard.style.setProperty('--theme-color', hex);
    seismicCard.style.setProperty('--theme-color-rgb', rgb);
    seismicCard.style.setProperty('--theme-glow', glow);
    const sub = document.querySelector('.subtitle');
    if (sub) { sub.style.color = hex; sub.style.textShadow = `0 0 8px rgba(${rgb},0.45)`; }
}

// ─── Helpers ───────────────────────────────────────────────────
function formatNum(val) {
    const n = parseInt(val, 10);
    return isNaN(n) ? '0' : n.toLocaleString('en-US');
}
function drawImageCover(ctx, img, x, y, w, h) {
    const imgW = img.naturalWidth || img.width || w;
    const imgH = img.naturalHeight || img.height || h;
    const imgRatio = imgW / imgH;
    const destRatio = w / h;
    
    let sx = 0, sy = 0, sw = imgW, sh = imgH;
    
    if (imgRatio > destRatio) {
        sw = imgH * destRatio;
        sx = (imgW - sw) / 2;
    } else {
        sh = imgW / destRatio;
        sy = (imgH - sh) / 2;
    }
    
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
// ─── User ID Registry (localStorage persisted) ─────────────────
const STORAGE_USER_IDS_KEY = 'seismic_user_ids';
const STORAGE_NEXT_ID_KEY  = 'seismic_next_id';

let userIdsMap = {};
let nextId = 1;

// Clear old IDs one time to start fresh from 001
if (!localStorage.getItem('seismic_reset_done_v3')) {
    localStorage.removeItem(STORAGE_USER_IDS_KEY);
    localStorage.removeItem(STORAGE_NEXT_ID_KEY);
    localStorage.setItem('seismic_reset_done_v3', 'true');
}

try {
    const storedMap = localStorage.getItem(STORAGE_USER_IDS_KEY);
    if (storedMap) userIdsMap = JSON.parse(storedMap);
    
    const storedNext = localStorage.getItem(STORAGE_NEXT_ID_KEY);
    if (storedNext) nextId = parseInt(storedNext, 10) || 1;
} catch (e) {
    console.error('Failed to load user IDs from localStorage', e);
}

function getOrAssignId(username) {
    const cleanName = (username || '').trim().toLowerCase();
    if (!cleanName) return 1;
    
    if (userIdsMap[cleanName] !== undefined) {
        return userIdsMap[cleanName];
    }
    
    const assignedId = nextId;
    userIdsMap[cleanName] = assignedId;
    nextId++;
    
    try {
        localStorage.setItem(STORAGE_USER_IDS_KEY, JSON.stringify(userIdsMap));
        localStorage.setItem(STORAGE_NEXT_ID_KEY, nextId.toString());
    } catch (e) {
        console.error('Failed to save user IDs to localStorage', e);
    }
    
    return assignedId;
}

function getSerialText() {
    const name = currentUsername;
    const id = getOrAssignId(name);
    const padded = id.toString().padStart(3, '0');
    return `ID // SC - ${padded}`;
}
function updateSerial() {
    if (cardSerial) {
        cardSerial.textContent = getSerialText();
    }
}
function showPlaceholder() {
    cardAvatar.src = '/default_avatar.png';
    cardAvatar.style.display = 'block';
    if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
}

// ─── Canvas Rendering Engine ────────────────────────────────────

function drawPlaceholderAvatar(ctx, cx, cy) {
    if (defaultAvatarImg.complete && defaultAvatarImg.naturalWidth !== 0) {
        drawImageCover(ctx, defaultAvatarImg, cx - 41, cy - 41, 82, 82);
    } else {
        ctx.fillStyle = '#e5d9c9';
        ctx.font = "28px 'Press Start 2P', monospace";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.25;
        ctx.fillText('?', cx, cy);
        ctx.globalAlpha = 1.0;
    }
}

function drawMetricBoxDirect(ctx, label, value, bx, by, bw, bh) {
    ctx.fillStyle = '#191413';
    ctx.fillRect(bx, by, bw, bh);

    // Draw scanlines inside metrics box (behind text)
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh);
    ctx.clip();
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    const spacingY = 4;
    const lineWY = 1;
    for (let y = by; y < by + bh; y += spacingY) {
        ctx.fillRect(bx, y + 3, bw, lineWY);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    const spacingX = 6;
    const lineWX = 1;
    for (let x = bx; x < bx + bw; x += spacingX) {
        ctx.fillRect(x + 5, by, lineWX, bh);
    }
    ctx.restore();

    ctx.strokeStyle = `rgba(${currentThemeRgb}, 0.22)`;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = '#e5d9c9';
    ctx.globalAlpha = 0.55;
    ctx.font = "6px 'Press Start 2P', monospace";
    ctx.textBaseline = 'top';
    ctx.fillText(label, bx + 8, by + 6);
    ctx.globalAlpha = 1.0;

    ctx.fillStyle = currentThemeHex;
    ctx.font = "24px 'VT323', monospace";
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(value, bx + bw - 8, by + bh - 4);
    ctx.textAlign = 'left';
}

function drawCardToCanvasDirect(scale, bgColor, frameIndex) {
    const cardEl = document.getElementById('seismic-card');
    const cardRect = cardEl ? cardEl.getBoundingClientRect() : { top: 0, left: 0, width: 380, height: 508 };
    const cardWidth = cardRect.width;
    const cardHeight = cardRect.height;

    const canvas = document.createElement('canvas');
    canvas.width = (cardWidth + 64) * scale;
    canvas.height = (cardHeight + 64) * scale;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    ctx.save();
    ctx.scale(scale, scale);

    // Fetch elements dynamically to mirror their layout positions
    const headerEl = cardEl ? cardEl.querySelector('.card-header') : null;
    const graphicZoneEl = cardEl ? cardEl.querySelector('.card-graphic-zone') : null;
    const profileSectionEl = cardEl ? cardEl.querySelector('.card-profile-section') : null;
    const badgeEl = cardEl ? cardEl.querySelector('.profile-badge') : null;
    const avatarRingOuter = cardEl ? cardEl.querySelector('.avatar-ring-outer') : null;
    const cardUsername = cardEl ? cardEl.querySelector('#card-username') : null;
    const metricBoxes = cardEl ? cardEl.querySelectorAll('.card-metric-box') : [];
    const footerEl = cardEl ? cardEl.querySelector('.card-footer') : null;

    const hRect = headerEl ? headerEl.getBoundingClientRect() : null;
    const gRect = graphicZoneEl ? graphicZoneEl.getBoundingClientRect() : null;
    const pSecRect = profileSectionEl ? profileSectionEl.getBoundingClientRect() : null;
    const badgeRect = badgeEl ? badgeEl.getBoundingClientRect() : null;
    const avOuterRect = avatarRingOuter ? avatarRingOuter.getBoundingClientRect() : null;
    const userRect = cardUsername ? cardUsername.getBoundingClientRect() : null;
    const fRect = footerEl ? footerEl.getBoundingClientRect() : null;

    const headerY = hRect ? (32 + (hRect.top - cardRect.top)) : 46;
    const headerH = hRect ? hRect.height : 22;

    const gy = gRect ? (32 + (gRect.top - cardRect.top)) : 78;
    const gx = gRect ? (32 + (gRect.left - cardRect.left)) : (32 + 14);
    const gw = gRect ? gRect.width : 352;
    const gh = gRect ? gRect.height : 175;

    const cx = avOuterRect ? (32 + (avOuterRect.left - cardRect.left) + avOuterRect.width / 2) : (32 + 190);
    const cy = avOuterRect ? (32 + (avOuterRect.top - cardRect.top) + avOuterRect.height / 2) : (32 + 133);

    const nameY = userRect ? (32 + (userRect.top - cardRect.top)) : 263;

    const badgeW = badgeRect ? badgeRect.width : 50;
    const badgeH = badgeRect ? badgeRect.height : 18;
    const badgeX = badgeRect ? (32 + (badgeRect.left - cardRect.left)) : (32 + 165);
    const badgeY = badgeRect ? (32 + (badgeRect.top - cardRect.top)) : 284;

    const dividerY = pSecRect ? (32 + (pSecRect.top - cardRect.top) + pSecRect.height) : 312;

    const footerY = fRect ? (32 + (fRect.top - cardRect.top)) : 442;
    const statusEl = footerEl ? footerEl.querySelector('.footer-status') : null;
    const watermarkEl = footerEl ? footerEl.querySelector('.footer-watermark') : null;
    const statusRect = statusEl ? statusEl.getBoundingClientRect() : null;
    const watermarkRect = watermarkEl ? watermarkEl.getBoundingClientRect() : null;

    const statusX = statusRect ? (32 + (statusRect.left - cardRect.left)) : (32 + 14);
    const statusY = statusRect ? (32 + (statusRect.top - cardRect.top)) : (footerY + 7);
    const watermarkX = watermarkRect ? (32 + (watermarkRect.left - cardRect.left) + watermarkRect.width) : (32 + cardWidth - 14);
    const watermarkY = watermarkRect ? (32 + (watermarkRect.top - cardRect.top)) : (footerY + 11);

    // 1. Draw Background (pure dark for seamless integration if bgColor is specified)
    if (bgColor) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, cardWidth + 64, cardHeight + 64);
    } else {
        ctx.clearRect(0, 0, cardWidth + 64, cardHeight + 64);
    }

    // 2. Shadows (Glow)
    // Draw the ambient shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 15;
    ctx.fillStyle = '#191413';
    ctx.fillRect(32, 32, cardWidth, cardHeight);
    ctx.restore();

    // Draw the neon glow shadow
    ctx.save();
    ctx.shadowColor = `rgba(${currentThemeRgb}, 0.42)`;
    ctx.shadowBlur = 36;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#191413';
    ctx.fillRect(32, 32, cardWidth, cardHeight);
    ctx.restore();

    // Draw the thin theme color shadow
    ctx.save();
    ctx.shadowColor = currentThemeHex;
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#191413';
    ctx.fillRect(32, 32, cardWidth, cardHeight);
    ctx.restore();

    // 3. Card Base Gradient Background
    const grad = ctx.createRadialGradient(
        32 + cardWidth / 2, 32, 0,
        32 + cardWidth / 2, 32, Math.max(cardWidth, cardHeight)
    );
    grad.addColorStop(0, `rgba(${currentThemeRgb}, 0.20)`);
    grad.addColorStop(0.6, '#2c2523');
    grad.addColorStop(1.0, '#191413');
    ctx.fillStyle = grad;
    ctx.fillRect(32, 32, cardWidth, cardHeight);

    // Draw scanlines on the card background (behind boxes/text)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    const spacingY = 4;
    const lineWY = 1;
    for (let y = 32; y < 32 + cardHeight; y += spacingY) {
        ctx.fillRect(32, y + 3, cardWidth, lineWY);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    const spacingX = 6;
    const lineWX = 1;
    for (let x = 32; x < 32 + cardWidth; x += spacingX) {
        ctx.fillRect(x + 5, 32, lineWX, cardHeight);
    }
    ctx.restore();

    // 4. Outer border (6px solid #191413)
    ctx.strokeStyle = '#191413';
    ctx.lineWidth = 6;
    ctx.strokeRect(32 + 3, 32 + 3, cardWidth - 6, cardHeight - 6);

    // 5. Dashed inner border (2px dashed rgba(229, 217, 201, 0.12))
    ctx.save();
    ctx.strokeStyle = 'rgba(229, 217, 201, 0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(32 + 4, 32 + 4, cardWidth - 8, cardHeight - 8);
    ctx.restore();

    // 6. Pixel Corners
    ctx.fillStyle = currentThemeHex;
    ctx.fillRect(32 - 2, 32 - 2, 8, 8); // Top Left
    ctx.fillRect(32 + cardWidth - 6, 32 - 2, 8, 8); // Top Right
    ctx.fillRect(32 - 2, 32 + cardHeight - 6, 8, 8); // Bottom Left
    ctx.fillRect(32 + cardWidth - 6, 32 + cardHeight - 6, 8, 8); // Bottom Right

    // 7. Header Text
    ctx.fillStyle = '#e5d9c9';
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.textBaseline = 'middle';
    ctx.fillText('SEISMIC CARD', 32 + 14, headerY + headerH / 2);

    ctx.fillStyle = currentThemeHex;
    ctx.font = "18px 'VT323', monospace";
    ctx.textAlign = 'right';
    ctx.fillText(getSerialText(), 32 + cardWidth - 14, headerY + headerH / 2);
    ctx.textAlign = 'left';

    // Header Divider line
    ctx.strokeStyle = '#191413';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32 + 14, headerY + headerH);
    ctx.lineTo(32 + cardWidth - 14, headerY + headerH);
    ctx.stroke();

    // 8. Graphic Zone
    ctx.fillStyle = '#191413';
    ctx.fillRect(gx, gy, gw, gh);

    // Draw scanlines inside Graphic Zone (behind avatar/animations)
    ctx.save();
    ctx.beginPath();
    ctx.rect(gx, gy, gw, gh);
    ctx.clip();
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    for (let y = gy; y < gy + gh; y += 4) {
        ctx.fillRect(gx, y + 3, gw, 1);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let x = gx; x < gx + gw; x += 6) {
        ctx.fillRect(x + 5, gy, 1, gh);
    }
    ctx.restore();

    ctx.strokeStyle = '#2c2523';
    ctx.lineWidth = 4;
    ctx.strokeRect(gx + 2, gy + 2, gw - 4, gh - 4);

    // Get animation values (deterministic if frameIndex is provided)
    let r1, r2, sPos, activeParticles;
    const t = frameIndex !== undefined ? frameIndex * 0.100 : 0; // seconds for this frame

    if (frameIndex !== undefined) {
        r1 = (t * 120) % 360;
        r2 = (360 - (t * 180)) % 360;
        sPos = (t * (100 / 7)) % 100;
        
        activeParticles = particlesList.map(p => {
            const age = t + p.delay;
            const progress = (age % p.duration) / p.duration;
            const y = progress * p.maxY;
            return { ...p, y, progress };
        });
    } else {
        // For static PNG capture, use fixed, beautiful angles/positions matching user reference image
        r1 = -60;  // Rotates top half to 8-2 o'clock (left/top-left wrapping arc)
        r2 = -60;  // Rotates bottom half to 2-8 o'clock (right-side arc aligning with outer ring tips)
        sPos = 15; // Clean scanline position
        
        // Static particles to ensure every static PNG download has the exact same crystal positions
        activeParticles = [
            { left: 10, baseTop: 25, y: 15, progress: 0.3 },
            { left: 22, baseTop: 45, y: 10, progress: 0.5 },
            { left: 8, baseTop: 65, y: 5, progress: 0.2 },
            { left: 18, baseTop: 75, y: 20, progress: 0.6 },
            { left: 80, baseTop: 30, y: 12, progress: 0.4 },
            { left: 90, baseTop: 50, y: 8, progress: 0.3 },
            { left: 76, baseTop: 60, y: 18, progress: 0.7 },
            { left: 88, baseTop: 80, y: 14, progress: 0.5 }
        ];
    }

    // Moving Scanline (Only for GIF downloads, not for static PNG)
    if (frameIndex !== undefined) {
        ctx.save();
        ctx.strokeStyle = currentThemeHex;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.12;
        const sy = gy + (sPos / 100) * gh;
        ctx.beginPath();
        ctx.moveTo(gx, sy);
        ctx.lineTo(gx + gw, sy);
        ctx.stroke();
        ctx.restore();
    }

    // Floating Particles (crystals)
    activeParticles.forEach(p => {
        const px = gx + (p.left / 100) * gw;
        const py = gy + (p.baseTop / 100) * gh - p.y;
        ctx.save();
        const opacity = p.progress < 0.5 ? p.progress + 0.5 : 1 - (p.progress - 0.5) * 2;
        const scalePart = 1 - p.progress * 0.6;
        ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
        const size = 10 * scalePart; // 10px base size
        try {
            ctx.drawImage(crystalImg, px - size/2, py - size/2, size, size);
        } catch (e) {
            ctx.fillStyle = currentThemeHex;
            ctx.fillRect(px - size/2, py - size/2, size, size);
        }
        ctx.restore();
    });

    // Ring Shimmer 1
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((r1 * Math.PI) / 180);
    ctx.strokeStyle = currentThemeHex;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, 54, Math.PI, 2 * Math.PI); // 180 degree semi-circle (top half base)
    ctx.stroke();
    ctx.restore();

    // Ring Shimmer 2
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((r2 * Math.PI) / 180);
    ctx.strokeStyle = currentThemeHex;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(0, 0, 49, 0, Math.PI); // 180 degree semi-circle (bottom half base)
    ctx.stroke();
    ctx.restore();

    // Inner ring background
    ctx.save();
    ctx.shadowColor = `rgba(${currentThemeRgb}, 0.55)`;
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#2c2523';
    ctx.beginPath();
    ctx.arc(cx, cy, 44, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    // Avatar image or placeholder
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 41, 0, 2 * Math.PI);
    ctx.clip();
    
    const isSafeSrc = cardAvatar.src && (
        cardAvatar.src.startsWith('data:') ||
        cardAvatar.src.startsWith('blob:') ||
        !cardAvatar.src.includes('://') ||
        cardAvatar.src.includes(window.location.host)
    );

    if (cardAvatar && cardAvatar.style.display !== 'none' && cardAvatar.src && isSafeSrc) {
        try {
            drawImageCover(ctx, cardAvatar, cx - 41, cy - 41, 82, 82);
        } catch (e) {
            drawPlaceholderAvatar(ctx, cx, cy);
        }
    } else {
        drawPlaceholderAvatar(ctx, cx, cy);
    }
    ctx.restore();

    // Inner ring border
    ctx.strokeStyle = currentThemeHex;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 42.5, 0, 2 * Math.PI);
    ctx.stroke();

    // 9. Profile Section
    ctx.save();
    ctx.fillStyle = '#e5d9c9';
    ctx.font = "14px 'Press Start 2P', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(cardUsername.textContent, 32 + cardWidth / 2, nameY);
    ctx.restore();

    // Centered Role badge
    const roleTxt = cardRoleTitle.textContent;
    
    ctx.fillStyle = '#191413';
    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);

    // Draw top and bottom borders as solid
    ctx.strokeStyle = currentThemeHex;
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Top border line
    ctx.moveTo(badgeX, badgeY);
    ctx.lineTo(badgeX + badgeW, badgeY);
    // Bottom border line
    ctx.moveTo(badgeX, badgeY + badgeH);
    ctx.lineTo(badgeX + badgeW, badgeY + badgeH);
    ctx.stroke();

    // Draw left and right borders as dashed
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    // Left border line
    ctx.moveTo(badgeX + 1, badgeY);
    ctx.lineTo(badgeX + 1, badgeY + badgeH);
    // Right border line
    ctx.moveTo(badgeX + badgeW - 1, badgeY);
    ctx.lineTo(badgeX + badgeW - 1, badgeY + badgeH);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = currentThemeHex;
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Add text shadow glow effect matching style.css text-shadow
    ctx.save();
    ctx.shadowColor = `rgba(${currentThemeRgb}, 0.7)`;
    ctx.shadowBlur = 5;
    ctx.fillText(roleTxt, badgeX + badgeW/2, badgeY + badgeH/2);
    ctx.restore();
    ctx.textAlign = 'left';

    // Dashed divider below profile section
    ctx.save();
    ctx.strokeStyle = 'rgba(229, 217, 201, 0.08)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(32 + 14, dividerY);
    ctx.lineTo(32 + cardWidth - 14, dividerY);
    ctx.stroke();
    ctx.restore();

    // 10. Metrics Grid
    metricBoxes.forEach((boxEl) => {
        const boxRect = boxEl.getBoundingClientRect();
        const bx = 32 + (boxRect.left - cardRect.left);
        const by = 32 + (boxRect.top - cardRect.top);
        const bw = boxRect.width;
        const bh = boxRect.height;
        
        const label = boxEl.querySelector('.metric-label').textContent;
        const value = boxEl.querySelector('.metric-number').textContent;
        drawMetricBoxDirect(ctx, label, value, bx, by, bw, bh);
    });

    // 11. Footer
    ctx.strokeStyle = '#191413';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32 + 14, footerY);
    ctx.lineTo(32 + cardWidth - 14, footerY);
    ctx.stroke();

    ctx.fillStyle = '#e5d9c9';
    ctx.globalAlpha = 0.55;
    ctx.font = "15px 'VT323', monospace";
    ctx.textBaseline = 'top';
    ctx.fillText('STATUS // ACTIVE', statusX, statusY);

    ctx.fillStyle = currentThemeHex;
    ctx.globalAlpha = 0.38; // Slightly translucent (0.55 * 0.7)
    ctx.font = "6.5px 'Press Start 2P', monospace";
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('CORE VERIFIED', watermarkX, watermarkY);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1.0;

    ctx.restore();

    return canvas;
}

async function captureCardCanvas(scale, bgColor, frameIndex) {
    return drawCardToCanvasDirect(scale, bgColor, frameIndex);
}

// ─── Avatar ────────────────────────────────────────────────────
function loadAvatar(username) {
    if (!username || username.length < 2) { showPlaceholder(); return; }
    
    // Clean up username string
    const cleanUsername = username.replace('@', '').trim();
    
    // First try: microlink scraper (highly reliable for Twitter/X)
    fetch(`https://api.microlink.io/?url=https://x.com/${encodeURIComponent(cleanUsername)}`)
        .then(res => res.json())
        .then(json => {
            if (json.status === 'success' && json.data && json.data.image && json.data.image.url) {
                tryLoad(json.data.image.url, () => {
                    // Fallback 1: unavatar.io
                    tryLoad(`https://unavatar.io/twitter/${encodeURIComponent(cleanUsername)}`, () => {
                        // Fallback 2: unavatar generic
                        tryLoad(`https://unavatar.io/${encodeURIComponent(cleanUsername)}`, showPlaceholder);
                    });
                });
            } else {
                // Scraper failed, fallback to unavatar
                tryLoad(`https://unavatar.io/twitter/${encodeURIComponent(cleanUsername)}`, () => {
                    tryLoad(`https://unavatar.io/${encodeURIComponent(cleanUsername)}`, showPlaceholder);
                });
            }
        })
        .catch(() => {
            // Fetch failed, fallback to unavatar
            tryLoad(`https://unavatar.io/twitter/${encodeURIComponent(cleanUsername)}`, () => {
                tryLoad(`https://unavatar.io/${encodeURIComponent(cleanUsername)}`, showPlaceholder);
            });
        });
}
function tryLoad(src, onFail) {
    if (!src) { onFail(); return; }
    
    // Direct load for maximum preview speed (no CORS proxy latency on preview)
    const img = new Image();
    img.onload = () => {
        cardAvatar.src = src;
        cardAvatar.style.display = 'block';
        if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
    };
    img.onerror = onFail;
    img.src = src;
}

// ─── Stamp ─────────────────────────────────────────────────────
function renderStamp() {
    if (cardStamp) {
        cardStamp.innerHTML = `<img src="${STAMPS[activeStamp]}" alt="${activeStamp}" />`;
    }
}

// Background removal for golem stamp
function removeBg(src, callback) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, c.width, c.height);
        const d = id.data;
        const bgR = d[0], bgG = d[1], bgB = d[2];
        const tol = 32;
        for (let i = 0; i < d.length; i += 4) {
            const dr = d[i]-bgR, dg = d[i+1]-bgG, db = d[i+2]-bgB;
            if (Math.sqrt(dr*dr+dg*dg+db*db) < tol) d[i+3] = 0;
        }
        ctx.putImageData(id, 0, 0);
        callback(c.toDataURL('image/png'));
    };
    img.onerror = () => callback(src);
    img.src = src;
}

// ─── Events ────────────────────────────────────────────────────

document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const { hex, rgb } = ROLE_COLORS[btn.dataset.role];
        applyTheme(hex, rgb);
        cardRoleTitle.textContent = btn.textContent.replace('•','').trim();
    });
});

document.querySelectorAll('.stamp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.stamp-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeStamp = btn.dataset.stamp;
        renderStamp();
    });
});

if (inputMessages) {
    inputMessages.addEventListener('input', e => {
        cardValMessages.textContent = formatNum(e.target.value);
        updateSerial();
    });
}
if (inputTweets) {
    inputTweets.addEventListener('input',   e => cardValTweets.textContent   = formatNum(e.target.value));
}
if (inputEvents) {
    inputEvents.addEventListener('input',   e => cardValEvents.textContent   = formatNum(e.target.value));
}
if (inputArt) {
    inputArt.addEventListener('input',      e => cardValArt.textContent      = formatNum(e.target.value));
}

// Helper to temporarily swap remote avatar to a CORS-safe blob URL for canvas exporting
async function executeWithCorsSafeAvatar(action) {
    const originalSrc = cardAvatar.src;
    let tempBlobUrl = null;

    const isRemote = originalSrc && 
                     !originalSrc.startsWith('data:') && 
                     !originalSrc.startsWith('blob:') && 
                     !originalSrc.startsWith(window.location.origin) &&
                     !originalSrc.startsWith('/');

    if (cardAvatar && cardAvatar.style.display !== 'none' && isRemote) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

        try {
            let res;
            try {
                // Try direct fetch first (works if remote supports CORS directly, e.g. unavatar.io)
                res = await fetch(originalSrc, { signal: controller.signal });
            } catch (directErr) {
                // Fall back to proxy
                const proxiedSrc = `https://api.allorigins.win/raw?url=${encodeURIComponent(originalSrc)}`;
                res = await fetch(proxiedSrc, { signal: controller.signal });
            }

            clearTimeout(timeoutId);
            if (res && res.ok) {
                const blob = await res.blob();
                tempBlobUrl = URL.createObjectURL(blob);
                await new Promise((resolve) => {
                    cardAvatar.onload = () => {
                        cardAvatar.onload = null;
                        cardAvatar.onerror = null;
                        resolve();
                    };
                    cardAvatar.onerror = () => {
                        cardAvatar.onload = null;
                        cardAvatar.onerror = null;
                        resolve();
                    };
                    cardAvatar.src = tempBlobUrl;
                });
            }
        } catch (e) {
            clearTimeout(timeoutId);
            console.warn('CORS swap failed or timed out, proceeding with original:', e);
        }
    }

    try {
        await action();
    } finally {
        if (tempBlobUrl) {
            if (cardAvatar.src === tempBlobUrl) {
                cardAvatar.src = originalSrc;
            }
            URL.revokeObjectURL(tempBlobUrl);
        }
    }
}

// ─── PNG Download ──────────────────────────────────────────────
downloadBtn.addEventListener('click', async () => {
    downloadBtn.disabled = true;
    downloadBtn.querySelector('.btn-text').textContent = 'GENERATING PNG...';
    try {
        await executeWithCorsSafeAvatar(async () => {
            const canvas = await captureCardCanvas(3, null);
            const link = document.createElement('a');
            link.download = `seismic_golem_${currentUsername}_card.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    } catch (err) { console.error('PNG error:', err); }
    downloadBtn.disabled = false;
    downloadBtn.querySelector('.btn-text').textContent = 'DOWNLOAD PNG (STATIC)';
});

// ─── GIF Download ──────────────────────────────────────────────
downloadGifBtn.addEventListener('click', async () => {
    downloadGifBtn.disabled = true;
    downloadGifBtn.querySelector('.btn-text').textContent = 'CAPTURING (0%)...';

    try {
        await executeWithCorsSafeAvatar(async () => {
            const totalFrames = 75; // 7.5 seconds loop
            const frameDelay  = 100;
            const GIF_SCALE   = 1.5;
            const GIF_BG      = '#191413';

            const frames    = [];
            let   frameCount = 0;

            const cardEl = document.getElementById('seismic-card');
            const cardHeight = cardEl ? cardEl.offsetHeight : 508;
            const gifWidth = Math.round((380 + 64) * GIF_SCALE);
            const gifHeight = Math.round((cardHeight + 64) * GIF_SCALE);

            await new Promise((resolve, reject) => {
                async function captureNextFrame() {
                    if (frameCount >= totalFrames) {
                        compileGif(resolve);
                        return;
                    }
                    try {
                        const canvas = await captureCardCanvas(GIF_SCALE, GIF_BG, frameCount);
                        frames.push(canvas.toDataURL('image/png'));
                        frameCount++;
                        downloadGifBtn.querySelector('.btn-text').textContent =
                            `CAPTURING (${Math.round(frameCount / totalFrames * 100)}%)...`;
                        setTimeout(captureNextFrame, frameDelay);
                    } catch (err) {
                        console.error('Frame error:', err);
                        resetGifBtn();
                        reject(err);
                    }
                }

                function compileGif(doneResolve) {
                    downloadGifBtn.querySelector('.btn-text').textContent = 'COMPILING GIF...';
                    gifshot.createGIF({
                        images:         frames,
                        gifWidth:       gifWidth,
                        gifHeight:      gifHeight,
                        interval:       frameDelay / 1000,
                        numFrames:      totalFrames,
                        sampleInterval: 5,
                        numWorkers:     4,
                    }, obj => {
                        if (!obj.error) {
                            const link = document.createElement('a');
                            link.download = `seismic_golem_${currentUsername}_card.gif`;
                            link.href = obj.image;
                            link.click();
                        } else {
                            console.error('GIF error:', obj.error);
                            alert('GIF failed — try PNG instead.');
                        }
                        resetGifBtn();
                        doneResolve();
                    });
                }

                function resetGifBtn() {
                    downloadGifBtn.disabled = false;
                    downloadGifBtn.querySelector('.btn-text').textContent = 'DOWNLOAD GIF (ANIMATED)';
                }

                captureNextFrame();
            });
        });
    } catch (err) {
        console.error('GIF Capture error:', err);
        downloadGifBtn.disabled = false;
        downloadGifBtn.querySelector('.btn-text').textContent = 'DOWNLOAD GIF (ANIMATED)';
    }
});

// ─── Init ──────────────────────────────────────────────────────
applyTheme(ROLE_COLORS.mag1.hex, ROLE_COLORS.mag1.rgb);

removeBg('/golem.gif', cleanSrc => {
    STAMPS.golem = cleanSrc;
    const thumb = document.querySelector('[data-stamp="golem"] .pixel-stamp-thumb');
    if (thumb) thumb.src = cleanSrc;
    if (activeStamp === 'golem') renderStamp();
});

initHtmlParticles();
updateSerial();
renderStamp();
loadAvatar(currentUsername);

// Manual avatar upload handler (still works if triggered programmatically or via a future button, but not by clicking the avatar zone)
const avatarUpload = document.getElementById('avatar-upload');
if (avatarUpload) {
    avatarUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                tryLoad(event.target.result, showPlaceholder);
            };
            reader.readAsDataURL(file);
        }
    });
}

// ─── Twitter/X Sharing ─────────────────────────────────────────
const shareTwitterBtn = document.getElementById('share-twitter-btn');
if (shareTwitterBtn) {
    shareTwitterBtn.addEventListener('click', () => {
        const name = usernameInput.value.trim() || 'operator';
        const role = cardRoleTitle.textContent || 'MAG 1';
        const serial = getSerialText();
        
        const text = `Just generated my Seismic Card!

• Username: @${name}

• Role: ${role}

• Serial: ${serial}

Join the @SeismicSys community, check your stats and craft your card here: https://seismicc-cards.vercel.app`;

        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(shareUrl, '_blank');
    });
}

// ─── Discord OAuth2 Integration ────────────────────────────────
function getDiscordAuthorizeUrl() {
    const redirectUri = window.location.origin + '/';
    return `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=identify%20guilds.members.read`;
}

if (discordConnectBtn) {
    discordConnectBtn.addEventListener('click', () => {
        window.location.href = getDiscordAuthorizeUrl();
    });
}

async function fetchDiscordUser(accessToken) {
    try {
        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!userRes.ok) throw new Error('Failed to fetch Discord user info');
        const userData = await userRes.json();
        
        const username = userData.username;
        const userId = userData.id;
        const avatarHash = userData.avatar;
        
        // Update username state and preview (using global discord username, no nick override)
        currentUsername = username;
        cardUsername.textContent = username;
        
        // Load Discord avatar
        if (avatarHash) {
            const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
            const avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}`;
            tryLoad(avatarUrl, showPlaceholder);
        } else {
            showPlaceholder();
        }
        
        // Fetch server member details
        if (discordStatus) {
            discordStatus.style.display = 'block';
            discordStatus.textContent = `Connected as @${username}. Reading server details...`;
        }
        
        const memberRes = await fetch(`https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (memberRes.status === 404) {
            // Not in server
            if (discordStatus) {
                discordStatus.textContent = 'Note: You are not in the Discord server!';
                discordStatus.style.color = '#ff0000';
            }
            updateSerial();
            return;
        }
        
        if (!memberRes.ok) throw new Error('Failed to fetch Discord guild member info');
        const memberData = await memberRes.json();
        
        // Success! Member is in the server. Print roles to console for developer setup convenience
        console.log(`[Seismic Card] Discord authentication successful!`);
        console.log(`User ID: ${userId}`);
        console.log(`Guild Roles:`, memberData.roles);
        
        let detectedRole = null;

        // Try querying the bot member resolver API first (which performs name-based match)
        try {
            const botMemberRes = await fetch(`${STATS_API_URL}/api/member/${userId}`);
            if (botMemberRes.ok) {
                const botMemberData = await botMemberRes.json();
                if (botMemberData.detectedRole) {
                    detectedRole = botMemberData.detectedRole;
                    console.log(`[Seismic Card] Bot API resolved role: ${detectedRole}`);
                }
            }
        } catch (botErr) {
            console.warn('Could not query bot API for role name matching, using client ID map fallback:', botErr);
        }

        // Fallback to client ID role map
        if (!detectedRole) {
            // 1. Check Administrator
            const adminRoleId = Object.keys(DISCORD_ROLE_MAP).find(key => DISCORD_ROLE_MAP[key] === 'administrator');
            if (adminRoleId && memberData.roles.includes(adminRoleId)) {
                detectedRole = 'administrator';
            }
            
            // 2. Check Leader
            if (!detectedRole) {
                const leaderRoleId = Object.keys(DISCORD_ROLE_MAP).find(key => DISCORD_ROLE_MAP[key] === 'leader');
                if (leaderRoleId && memberData.roles.includes(leaderRoleId)) {
                    detectedRole = 'leader';
                }
            }
            
            // 3. Check Magnitude roles (from Magnitude 9.0 down to 1.0)
            if (!detectedRole) {
                const magnitudeOrder = ['mag9', 'mag8', 'mag7', 'mag6', 'mag5', 'mag4', 'mag3', 'mag2', 'mag1'];
                for (const magKey of magnitudeOrder) {
                    const roleId = Object.keys(DISCORD_ROLE_MAP).find(key => DISCORD_ROLE_MAP[key] === magKey);
                    if (roleId && memberData.roles.includes(roleId)) {
                        detectedRole = magKey;
                        break; // stop at highest magnitude found
                    }
                }
            }
        }
        
        const ROLE_TEXTS = {
            mag1: "Magnitude 1.0",
            mag2: "Magnitude 2.0",
            mag3: "Magnitude 3.0",
            mag4: "Magnitude 4.0",
            mag5: "Magnitude 5.0",
            mag6: "Magnitude 6.0",
            mag7: "Magnitude 7.0",
            mag8: "Magnitude 8.0",
            mag9: "Magnitude 9.0",
            leader: "LEADER",
            administrator: "ADMINISTRATOR"
        };
        
        if (detectedRole) {
            const roleInfo = ROLE_COLORS[detectedRole];
            if (roleInfo) {
                applyTheme(roleInfo.hex, roleInfo.rgb);
            }
            const roleName = ROLE_TEXTS[detectedRole] || detectedRole;
            cardRoleTitle.textContent = roleName;
            
            // Apply correct styling class on the card element
            seismicCard.className = `seismic-card role-${detectedRole}`;
            
            if (discordStatus) {
                discordStatus.textContent = `Discord Linked: @${username} (${roleName})`;
                discordStatus.style.color = '#10e566';
            }
        } else {
            cardRoleTitle.textContent = "No Magnitude Role";
            seismicCard.className = `seismic-card role-mag1`;
            if (discordStatus) {
                discordStatus.textContent = `Discord Linked: @${username} (No Magnitude role detected)`;
                discordStatus.style.color = '#dfc086';
            }
        }

        // Change button state to LINKED and disable it
        if (discordConnectBtn) {
            discordConnectBtn.disabled = true;
            discordConnectBtn.style.opacity = '0.7';
            discordConnectBtn.style.cursor = 'default';
            const btnText = discordConnectBtn.querySelector('.btn-text');
            if (btnText) {
                btnText.textContent = 'DISCORD LINKED';
            }
        }
        
        // Fetch Stats from our companion Bot API
        try {
            const statsRes = await fetch(`${STATS_API_URL}/api/stats/${userId}`);
            if (statsRes.ok) {
                const statsData = await statsRes.json();
                
                // Set inputs value (if they exist in DOM)
                if (inputMessages) inputMessages.value = statsData.messages || 0;
                if (inputTweets) inputTweets.value   = statsData.tweets || 0;
                if (inputEvents) inputEvents.value   = statsData.events || 0;
                if (inputArt) inputArt.value      = statsData.arts || 0;
                
                // Set card display values
                cardValMessages.textContent = formatNum(statsData.messages || 0);
                cardValTweets.textContent   = formatNum(statsData.tweets || 0);
                cardValEvents.textContent   = formatNum(statsData.events || 0);
                cardValArt.textContent      = formatNum(statsData.arts || 0);
                
                // Disable inputs if they exist in DOM
                if (inputMessages) inputMessages.disabled = true;
                if (inputTweets) inputTweets.disabled   = true;
                if (inputEvents) inputEvents.disabled   = true;
                if (inputArt) inputArt.disabled      = true;
            }
        } catch (apiErr) {
            console.warn('Companion Bot API stats fetch failed.', apiErr);
        }
        
        updateSerial();
    } catch (err) {
        console.error('Discord auth fetch error:', err);
        if (discordStatus) {
            discordStatus.textContent = 'Discord connection failed.';
            discordStatus.style.color = '#ff0000';
        }
    }
}

function checkDiscordAuth() {
    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    
    if (accessToken) {
        // Clean URL hash so the token is not visible in address bar
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Show loading status
        if (discordStatus) {
            discordStatus.style.display = 'block';
            discordStatus.textContent = 'Authenticating with Discord...';
            discordStatus.style.color = '#dfc086';
        }
        
        // Change button state to AUTHENTICATING
        if (discordConnectBtn) {
            discordConnectBtn.disabled = true;
            const btnText = discordConnectBtn.querySelector('.btn-text');
            if (btnText) {
                btnText.textContent = 'AUTHENTICATING...';
            }
        }
        
        fetchDiscordUser(accessToken);
    }
}

// Check on startup
checkDiscordAuth();

