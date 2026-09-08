(() => {
  "use strict";

  const CERT_IMAGE_SOURCES = [
    "assets/fbwkjbwk.png",
    "assets/certificate-template.jpg",
    "assets/certificate-template.png"
  ];
  const PARTICIPANTS_SRC = "data/participants.json";

  // Position of the name line on the certificate template, as fractions of
  // the image width/height (measured from the source artwork).
  const NAME_CENTER_Y_FRAC = 0.595;
  const NAME_MAX_WIDTH_FRAC = 0.66;
  const NAME_COLOR = "#A5262F";
  const NAME_FONT_FAMILY = "'Times New Roman', Times, serif";
  const NAME_MAX_FONT_FRAC = 0.105; // font size ceiling, as a fraction of image height
  const NAME_MIN_FONT_FRAC = 0.045; // font size floor, as a fraction of image height

  const form = document.getElementById("lookup-form");
  const input = document.getElementById("name-input");
  const suggestionsBox = document.getElementById("name-suggestions");
  const statusBox = document.getElementById("status-box");
  const generateBtn = document.getElementById("generate-btn");
  const resultSection = document.getElementById("result-section");
  const canvas = document.getElementById("cert-canvas");
  const ctx = canvas.getContext("2d");
  const downloadPngBtn = document.getElementById("download-png");
  const downloadPdfBtn = document.getElementById("download-pdf");
  const startOverBtn = document.getElementById("start-over");
  const lookupCard = document.getElementById("lookup-card");

  let participants = [];        // display names, as cleaned from the sheet
  let normalizedIndex = new Map(); // normalized key -> display name
  let certImage = null;
  let currentName = null;

  function normalize(str) {
    return str.toLowerCase().replace(/[^a-z]/g, "");
  }

  function showStatus(message, kind) {
    statusBox.textContent = message;
    statusBox.className = "status-box " + kind;
    statusBox.hidden = false;
  }

  function clearStatus() {
    statusBox.hidden = true;
    statusBox.textContent = "";
  }

  function setLoading(isLoading) {
    generateBtn.classList.toggle("loading", isLoading);
    generateBtn.disabled = isLoading;
  }

  async function loadParticipants() {
    const res = await fetch(PARTICIPANTS_SRC);
    participants = await res.json();
    participants.forEach((name) => {
      normalizedIndex.set(normalize(name), name);
    });
  }

  function hideSuggestions() {
    suggestionsBox.hidden = true;
    suggestionsBox.innerHTML = "";
  }

  function renderSuggestions(query) {
    const cleaned = query.trim();
    if (!cleaned) {
      hideSuggestions();
      return;
    }

    const key = normalize(cleaned);
    const matches = participants.filter((name) => {
      const normalizedName = normalize(name);
      return normalizedName.includes(key) || key.includes(normalizedName);
    }).slice(0, 12);

    if (!matches.length) {
      suggestionsBox.innerHTML = '<button type="button" class="name-suggestion empty" disabled>No matching names found</button>';
      suggestionsBox.hidden = false;
      return;
    }

    suggestionsBox.innerHTML = matches
      .map((name) => `<button type="button" class="name-suggestion" data-name="${name}">${name}</button>`)
      .join("");

    suggestionsBox.querySelectorAll(".name-suggestion").forEach((button) => {
      button.addEventListener("click", () => {
        const selectedName = button.getAttribute("data-name");
        input.value = selectedName;
        hideSuggestions();
        generateCertificateFor(selectedName);
      });
    });

    suggestionsBox.hidden = false;
  }

  function loadCertImage() {
    return new Promise((resolve, reject) => {
      let index = 0;

      const tryLoad = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
          index += 1;
          if (index < CERT_IMAGE_SOURCES.length) {
            img.src = CERT_IMAGE_SOURCES[index];
          } else {
            reject(new Error("Certificate template image not found."));
          }
        };
        img.src = CERT_IMAGE_SOURCES[index];
      };

      tryLoad();
    });
  }

  function findMatch(rawInput) {
    const key = normalize(rawInput);
    if (!key) return null;
    if (normalizedIndex.has(key)) return normalizedIndex.get(key);

    // fall back to a loose "contains" match if there's exactly one candidate,
    // to forgive small typos / missing middle initials.
    const candidates = [];
    for (const [k, name] of normalizedIndex.entries()) {
      if (k.includes(key) || key.includes(k)) candidates.push(name);
    }
    if (candidates.length === 1) return candidates[0];
    return null;
  }

  function formatCertificateName(name) {
    return String(name || "").toUpperCase();
  }

  function drawCertificate(name) {
    const displayName = formatCertificateName(name);
    const w = certImage.naturalWidth;
    const h = certImage.naturalHeight;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(certImage, 0, 0, w, h);

    const maxWidth = w * NAME_MAX_WIDTH_FRAC;
    let fontFrac = NAME_MAX_FONT_FRAC;
    let fontSize = h * fontFrac;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = NAME_COLOR;

    // shrink the font until the name fits within the certificate's name box
    do {
      fontSize = h * fontFrac;
      ctx.font = `700 ${fontSize}px ${NAME_FONT_FAMILY}`;
      const width = ctx.measureText(displayName).width;
      if (width <= maxWidth || fontFrac <= NAME_MIN_FONT_FRAC) break;
      fontFrac -= 0.004;
    } while (true);

    ctx.fillText(displayName, w / 2, h * NAME_CENTER_Y_FRAC);
  }

  function filenameFor(name, ext) {
    const slug = formatCertificateName(name).trim().replace(/\s+/g, "_").replace(/[^\w-]/g, "");
    return `IDEATHON_Certificate_${slug}.${ext}`;
  }

  function downloadPNG() {
    if (!currentName) return;
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFor(currentName, "png");
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, "image/png", 1.0);
  }

  function downloadPDF() {
    if (!currentName) return;
    const { jsPDF } = window.jspdf;
    const w = canvas.width;
    const h = canvas.height;
    const orientation = w >= h ? "landscape" : "portrait";
    const pdf = new jsPDF({ orientation, unit: "px", format: [w, h] });
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    pdf.addImage(dataUrl, "JPEG", 0, 0, w, h);
    pdf.save(filenameFor(currentName, "pdf"));
  }

  async function generateCertificateFor(rawName) {
    clearStatus();
    const raw = rawName.trim();
    if (!raw) return;

    setLoading(true);
    try {
      if (!certImage) certImage = await loadCertImage();

      const match = findMatch(raw);
      if (!match) {
        resultSection.hidden = true;
        showStatus(
          `We couldn't find "${raw}" on the IDEATHON participant list. Please check the spelling, or reach out to the organizing team if you believe this is an error.`,
          "error"
        );
        return;
      }

      currentName = formatCertificateName(match);
      drawCertificate(currentName);
      resultSection.hidden = false;
      hideSuggestions();
      resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      console.error(err);
      showStatus("Something went wrong while generating your certificate. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await generateCertificateFor(input.value);
  }

  function startOver() {
    resultSection.hidden = true;
    currentName = null;
    input.value = "";
    clearStatus();
    hideSuggestions();
    lookupCard.scrollIntoView({ behavior: "smooth", block: "start" });
    input.focus();
  }

  input.addEventListener("input", () => {
    const typed = input.value.trim();
    if (!typed) {
      hideSuggestions();
      return;
    }

    renderSuggestions(typed);
  });

  form.addEventListener("submit", handleSubmit);
  downloadPngBtn.addEventListener("click", downloadPNG);
  downloadPdfBtn.addEventListener("click", downloadPDF);
  startOverBtn.addEventListener("click", startOver);

  loadParticipants().catch(() => {
    showStatus("Could not load the participant list. Please refresh the page.", "error");
  });
})();
