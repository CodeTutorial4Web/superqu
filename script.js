// 1. Inject custom font
const fontStyle = document.createElement('style');
fontStyle.textContent = `
  @font-face {
    font-family: 'Satoshi';
    src: url('${chrome.runtime.getURL("Satoshi-Variable.ttf")}') format('truetype-variations'),
         url('${chrome.runtime.getURL("Satoshi-Variable.ttf")}') format('truetype');
    font-weight: 300 900;
    font-display: swap;
  }
`;
document.head.appendChild(fontStyle);

// 2. Add numbered circles to chapter buttons
function addCircles() {
  const chapterButtons = document.querySelectorAll('.LmK3iaUU .U_I1ofaC .iBzvpYEl');

  chapterButtons.forEach((button, index) => {
    if (!button.querySelector('.my-circle')) {
      const circle = document.createElement('div');
      const number = document.createElement('span');
      number.textContent = index + 1;
      circle.classList.add('my-circle');
      number.classList.add('my-number');
      button.appendChild(circle);
      button.prepend(number);
    }
  });
}

// 3. Reusable function to create a back button safely
function createHeaderBackButton(selector) {
  const header = document.querySelector(selector);

  // Fixed condition: Make sure header exists, doesn't have the exclude class, and doesn't already have a back button
  if (header && !header.classList.contains('yTJKGC6z') && !header.querySelector('.header-back-button')) {
    const backButton = document.createElement('button');
    backButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
      </svg>
    `;
    backButton.classList.add('header-back-button');

    backButton.addEventListener('click', () => {
      window.history.back();
    });

    header.prepend(backButton);
  }
}

// 4. Format chapter title dynamically
function formatChapterText() {
  const chapterEl = document.querySelector('.RQKTzKxN .Ff_AGwN5 .jzENrZQe');

  if (chapterEl) {
    chapterEl.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (/\[Chapter(\d+)\]/i.test(node.textContent)) {
          node.textContent = node.textContent.replace(/\[Chapter(\d+)\]/i, 'CH$1: ');
        }
      }
    });
  }
}

// Run all modifications together
function runAllModifications() {
  addCircles();
  createHeaderBackButton('.RQKTzKxN');
  createHeaderBackButton('.PhmJUtRE');
  formatChapterText();
}

// Initial execution
runAllModifications();

// Throttled/Safe observer to prevent rapid-fire triggers
let timeout;
const observer = new MutationObserver(() => {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    runAllModifications();
  }, 100);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});


async function getLectureData(lectureId) {
  try {
    const res = await fetch(
      `https://me-tp.qureo.education/api/study/lectures/${lectureId}`,
      {
        credentials: "include"
      }
    );

    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error("Failed to fetch lecture:", error);
    return null;
  }
}


function extractAnswers(lectureData) {
  return lectureData.talks
    .filter(talk => talk.type === "try")
    .flatMap(talk => {
      const body = talk.body;
      const codes = body.codes ?? [];

      return codes.flatMap((code, index) => {
        if (!code.editable || !code.model_answer.trim()) {
          return [{
            id: talk.id,
            type: "demo",
            codeIndex: index,
            answer: code.code
          }];
        }

        const placeholders = code.placeholders ?? [];

        // Partial editor: return only placeholder answers
        if (placeholders.length > 0) {
          return placeholders.map(placeholder => ({
            id: talk.id,
            type: "part",
            codeIndex: index,
            name: placeholder.name,
            answer: placeholder.model_answer,
            position: placeholder.position
          }));
        }

        // Full editor: return the complete model answer
        return [{
          id: talk.id,
          type: "full",
          codeIndex: index,
          answer: code.model_answer
        }];
      });
    });
}

let currentLectureData = null;
let answersOfTries = null;


let currentPath = location.pathname;
let navigationTimeout;

async function handlePageChange() {
  const path = location.pathname;

  if (path === currentPath) return;

  currentPath = path;

  clearTimeout(navigationTimeout);

  navigationTimeout = setTimeout(async () => {
    const lectureId = location.pathname.split("/").filter(Boolean).at(-1);

    console.log("[Navigation] New path:", location.pathname);
    console.log("[Navigation] Lecture ID:", lectureId);

    currentLectureData = null;
    answersOfTries = null;

    if (!lectureId || !/^\d+$/.test(lectureId)) return;

    currentLectureData = await getLectureData(lectureId);

    if (!currentLectureData) return;

    answersOfTries = await extractAnswers(currentLectureData);

    console.log("[Navigation] Lecture data:", currentLectureData);
    console.log("[Navigation] Answers:", answersOfTries);
  }, 100);
}

function observeNavigation() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    handlePageChange();
    return result;
  };

  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    handlePageChange();
    return result;
  };

  window.addEventListener("popstate", handlePageChange);

  // Detect navigation performed without History API calls.
  const observer = new MutationObserver(() => {
    handlePageChange();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  console.log("[Navigation] Observer initialized");
}

observeNavigation();


const SUBMIT_SELECTOR = "#code-exec";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(getter, timeout = 5000, step = 100) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = getter();
    if (value) return value;
    await sleep(step);
  }
  return null;
}

document.addEventListener("qureo:set-ace-value", (e) => {
  const { id, value } = JSON.parse(e.detail);
  const el = document.getElementById(id);
  if (!el) return;

  const editor = el.env?.editor ?? (window.ace ? window.ace.edit(el) : null);
  if (editor) editor.setValue(value, -1); // -1 = cursor to start, no select-all
});

function setEditorValue(editorEl, value) {
  document.dispatchEvent(
    new CustomEvent("qureo:set-ace-value", {
      detail: JSON.stringify({ id: editorEl.id, value }),
    })
  );
}


let isSolving = false;

async function solveAllTries() {
  if (isSolving || !currentLectureData || !answersOfTries) return;
  isSolving = true;

  try {

    for (const answer of answersOfTries) {
      const container = await waitFor(
        () => document.querySelector(`[data-test-id="lecture-try-${answer.id}"]`),
        500
      );

      if (!container) {
        console.warn(`Try container not found for answer ${answer.id}`);
        continue;
      }

      let filled = false;


      const editorEl = document.getElementById(`editor_talk_${answer.id}`);
      console.log(editorEl)
      if (!answer.answer || !editorEl) continue;

      setEditorValue(editorEl, answer.answer);

      await sleep(300);

      const submit = await waitFor(() => {
        const btn = container.querySelector(SUBMIT_SELECTOR);
        return btn && !btn.disabled ? btn : null;
      }, 1000);

      if (!submit) {
        console.warn(`Submit button not ready for ${answer.id}`);
        continue;
      }

      submit.click();
      if (!filled) continue;
    }
  } finally {
    isSolving = false;
  }
}


const tokenizer = ace.require(
  "ace/mode/javascript"
).Mode.prototype.getTokenizer.call(
  new (ace.require("ace/mode/javascript").Mode)()
);

function codeToAceHTML(code) {
  return code.split("\n").map(line => {
    const tokens = tokenizer.getLineTokens(line, "start").tokens;

    return `
      <div class="ace_line">
        ${tokens.map(token => {
      const classes = `ace_${token.type.replaceAll(".", " ace_")}`;

      const value = token.value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll(" ", "&nbsp;");

      return `<span class="${classes}">${value}</span>`;
    }).join("")}
      </div>
    `;
  }).join("");
}

// Easter egg keyboard listener
function setupEasterEgg() {
  const keyword = "niko";
  let typed = "";

  document.addEventListener("keydown", (e) => {
    // Ignore shortcuts and non-character keys
    if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1) {
      return;
    }

    typed += e.key.toLowerCase();

    // Keep only the last N characters
    typed = typed.slice(-keyword.length);

    if (typed === keyword) {
      // implementing the new feature of solving the whole thing
      console.log("easter egg activated!")
      typed = "";
      solveAllTries();
    }
  });
}

setupEasterEgg();

// Initialize
observeNavigation();
handlePageChange();
